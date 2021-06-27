'use strict';
let DEBUG = true;
let emjyBack = null;

class AccountInfo {
    constructor() {
        this.keyword = null;
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
        this.stocks = null;
    }

    initAccount(key, buyPath, sellPath, assetsPath) {
        this.keyword = key;
        this.buyPath = buyPath;
        this.sellPath = sellPath;
        this.assetsPath = assetsPath;
    }

    getAccountStocks() {
        if (!this.stocks || this.stocks.length == 0) {
            return null;
        };

        return {account: this.keyword, stocks: JSON.stringify(this.stocks)};
    }

    updateStockRtPrice(snapshot) {
        var stock = this.stocks.find(function(s) { return s.code == snapshot.code});

        if (stock) {
            if (!stock.name) {
                stock.name = snapshot.name;
            }
            stock.latestPrice = snapshot.realtimequote.currentPrice;
            var rtInfo = {};
            rtInfo.latestPrice = stock.latestPrice;
            rtInfo.buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
            rtInfo.sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
            rtInfo.topprice = snapshot.topprice;
            rtInfo.bottomprice = snapshot.bottomprice;
            stock.rtInfo = rtInfo;
            stock.checkStrategies();
        }
    }

    applyStrategy(code, bstr, sstr) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        if (bstr) {
            stock.buyStrategy = bstr;
        };
        if (sstr) {
            stock.sellStrategy = sstr;
        };
    }
}

class StockInfo {
    constructor(stock) {
        this.code = stock.code;
        this.name = stock.name;
        this.market = stock.market;
        this.holdCost = stock.holdCost;
        this.holdCount = stock.holdCount;
        this.availableCount = stock.availableCount;
        this.costDetail = [];
        this.latestPrice = null;
        this.buyStrategy = null;
        this.sellStrategy = null;
    }

    checkStrategies() {
        emjyBack.log('checkStrategies', this.code, JSON.stringify(this.buyStrategy), JSON.stringify(this.sellStrategy));
        if (this.buyStrategy && this.buyStrategy.enabled) {
            if (this.buyStrategy.check(this.rtInfo)) {
                emjyBack.tryBuyStock(this.code, this.name, this.latestPrice, this.buyStrategy.count, this.buyStrategy.account);
            }
        }
        if (this.sellStrategy && this.sellStrategy.enabled) {
            if (this.sellStrategy.check(this.rtInfo)) {
                emjyBack.trySellStock(this.code, this.latestPrice, this.sellStrategy.count, this.sellStrategy.account);
            }
        }
    }
}

class ManagerBack {
    constructor(log) {
        this.log = log;
        this.tabid = null;
    }

    isValid() {
        return this.tabid != null;
    }

    onManagerMessage(message, tabid) {
        this.log('ManagerBack ', JSON.stringify(message), tabid);
        if (message.command == 'mngr.init') {
            this.tabid = tabid;
        } else if (message.command == 'mngr.closed') {
            this.tabid = null;
        } else if (message.command == 'mngr.strategy') {
            emjyBack.applyStrategy(message.account, message.code, JSON.parse(message.buyStrategy), JSON.parse(message.sellStrategy));
        }
    }

    sendManagerMessage(message) {
        if (this.isValid()) {
            chrome.tabs.sendMessage(this.tabid, message);
        } else {
            this.log('manager tab id is', this.tabid);
        }
    }

    sendStocks(accounts) {
        var accStocks = [];
        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i].stocks && accounts[i].stocks.length > 0) {
                accStocks.push(accounts[i].getAccountStocks());
            };
        };
        if (accStocks.length > 0) {
            this.sendManagerMessage({command:'mngr.stocks', stocks: accStocks});
        };
    }
}

function onMainWorkerMessage(e) {
    emjyBack.onMainWorkerMessageReceived(e.data);
}

function onQuoteWorkerMessage(e) {
    emjyBack.onQuoteWorkerMessageReceived(e.data);
}

class EmjyBack {
    constructor() {
        this.log = null;
        this.contentTabId = null;
        this.navigating = false;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.currentTask = null;
        this.stockGuard = null;
        this.mainWorker = null;
        this.quoteWorker = null;
        this.manager = null;
    }

    Init(logger) {
        this.log = logger;
        this.stockGuard = new Set();
        emjyBack = this;
        this.log('EmjyBack initialized!');
    }

    onContentLoaded(message, tabid) {
        if (!this.contentTabId) {
            this.log('init contentTabId and accounts');
            this.contentTabId = tabid;
            if (!this.mainWorker) {
                this.mainWorker = new Worker('workers/mainworker.js');
                this.mainWorker.onmessage = onMainWorkerMessage;
            };
            chrome.tabs.onRemoved.addListener(function(tabid, removeInfo) {
                if (emjyBack.contentTabId == tabid) {
                    emjyBack.contentTabId = null;
                    emjyBack.contentUrl = '';
                }
            });
            this.normalAccount = new AccountInfo();
            this.normalAccount.initAccount('normal', '/Trade/Buy', '/Trade/Sale', '/Search/Position');
            this.collateralAccount = new AccountInfo();
            this.collateralAccount.initAccount('collat', '/MarginTrade/Buy', '/MarginTrade/Sale', '/MarginSearch/MyAssets');
            this.creditAccount = new AccountInfo();
            this.creditAccount.initAccount('credit', '/MarginTrade/MarginBuy', '/MarginTrade/FinanceSale', '/MarginSearch/MyAssets');
            this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.normalAccount.assetsPath});
            this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.creditAccount.assetsPath});
        }
        if (tabid == this.contentTabId) {
            this.contentUrl = message.url;
        }
        this.navigating = false;
        this.log('onContentLoaded');
    }

    // DON'T use this API directly, or it may break the task queue.
    sendMsgToContent(data) {
        var url = new URL(this.contentUrl);
        if (!this.contentTabId || url.host != 'jywg.18.cn') {
            return;
        }

        if (url.pathname == '/Login') {
            return;
        }

        this.log('sendMsgToContent', JSON.stringify(data));
        var doSendMsgToContent = function (tabid, data) {
            chrome.tabs.sendMessage(tabid, data);
            emjyBack.currentTask = data;
            emjyBack.postWorkerTask({command: 'emjy.sent'});
            //emjyBack.log('do sendMsgToContent', JSON.stringify(data));
        };

        var sendNavigateToContent = function(tabid, url) {
            if (!emjyBack.navigating) {
                emjyBack.navigating = true;
                chrome.tabs.sendMessage(tabid, {command: 'emjy.navigate', url: url.href});
                //emjyBack.log('do sendNavigateToContent', url.href);
            }
        };

        if (data.command == 'emjy.getAssets') {
            if (url.pathname == data.assetsPath) {
                doSendMsgToContent(this.contentTabId, data);
            } else {
                url.pathname = data.assetsPath;
                url.search = '';
                sendNavigateToContent(this.contentTabId, url);
            }
            return;
        }
        if (data.command == 'emjy.trade') {
            if (url.pathname == data.tradePath && url.search.includes('code=')) {
                doSendMsgToContent(this.contentTabId, data);
            } else {
                url.pathname = data.tradePath;
                url.search = '?code=' + data.stock.code;
                sendNavigateToContent(this.contentTabId, url);
            }
            return;
        }
    }

    onContentMessageReceived(message) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('background not initialized');
            return;
        }

        this.log('onContentMessageReceived');
        if (message.command == 'emjy.getValidateKey') {
            this.log('getValidateKey =', message.key);
        } else if (message.command == 'emjy.getAssets') {
            this.log('update assets', JSON.stringify(message));
            if (message.assetsPath == this.normalAccount.assetsPath) {
                this.normalAccount.pureAssets = parseFloat(message.pureAssets);
                this.normalAccount.availableMoney = parseFloat(message.availableMoney);
                this.normalAccount.stocks = this.parseStockInfoList(message.stocks);
                this.loadStrategies(this.normalAccount);
            } else {
                this.creditAccount.pureAssets = 0.0;
                this.creditAccount.availableMoney = parseFloat(message.availableCreditMoney);
                this.collateralAccount.pureAssets = parseFloat(message.pureAssets);
                this.collateralAccount.availableMoney = parseFloat(message.availableMoney);
                this.collateralAccount.stocks = this.parseStockInfoList(message.stocks);
                this.loadStrategies(this.collateralAccount);
            }

            if (this.manager && this.manager.isValid()) {
                this.manager.sendStocks([this.normalAccount, this.collateralAccount]);
            }
            this.updateHoldStocks(message.stocks);
            this.log(JSON.stringify(this.normalAccount));
            this.log(JSON.stringify(this.collateralAccount));
            this.log(JSON.stringify(this.creditAccount));
            if (this.currentTask && this.currentTask.command == message.command) {
                this.popCurrentTask();
            }
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.popCurrentTask();
            } else if (message.result == 'error') {
                if (message.reason == 'pageNotLoaded' || message.reason == 'btnConfirmDisabled') {
                    this.revokeCurrentTask();
                } else {
                    this.popCurrentTask();
                }
            }
        }
    }

    onManagerMessageReceived(message, tabid) {
        if (!this.manager) {
            this.manager = new ManagerBack(this.log);
        }

        this.manager.onManagerMessage(message, tabid);
        if (message.command == 'mngr.init') {
            this.log('manager initialized!');
            if (this.manager.isValid() && this.stockGuard.size > 0) {
                this.manager.sendStocks([this.normalAccount, this.collateralAccount]);
            }
            this.log('manager sendStocks');
        }
    }

    postWorkerTask(task) {
        this.log('postMessage to worker');
        this.mainWorker.postMessage(task);
    }

    revokeCurrentTask() {
        this.log('revoke task');
        this.postWorkerTask({command: 'emjy.revoke'});
        this.currentTask = null;
    }

    popCurrentTask() {
        this.currentTask.state = 'done';
        this.log('pop task');
        this.postWorkerTask(this.currentTask);
        this.currentTask = null;
    }

    onMainWorkerMessageReceived(message) {
        // this.log('mainworker', message.task, message.assetsPath);
        if (!this.currentTask) {
            this.sendMsgToContent(message);
        }
    }

    postQuoteWorkerMessage(message) {
        // this.log('post message to quote worker', JSON.stringify(message));
        this.quoteWorker.postMessage(message);
    }

    onQuoteWorkerMessageReceived(message) {
        // this.log('message from quoteWorker', JSON.stringify(message));
        if (message.command == 'quote.snapshot') {
            this.updateStockRtPrice(message.snapshot);
        }
    }

    parseStockInfoList(stocks) {
        var stockList = [];
        for (var i = 0; i < stocks.length; i++) {
            var stockInfo = new StockInfo(stocks[i]);
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.market = stocks[i].market;
            stockList.push(stockInfo);
        };
        this.log('parseStockInfoList', JSON.stringify(stockList));
        return stockList;
    }

    updateHoldStocks(stocks) {
        var holdChanged = false;
        for (var i = 0; i < stocks.length; i++) {
            if (!this.stockGuard.has(stocks[i].code)) {
                this.stockGuard.add(stocks[i].code);
                holdChanged = true;
            };
        };

        if (holdChanged) {
            this.updateMonitor();
        }
    }

    updateMonitor() {
        if (!this.quoteWorker) {
            this.quoteWorker = new Worker('workers/quoteworker.js');
            this.quoteWorker.onmessage = onQuoteWorkerMessage;
            this.postQuoteWorkerMessage({command: 'quote.refresh', time: this.getProperTimeInterval()});
        };
        this.postQuoteWorkerMessage({command: 'quote.update.code', stocks: this.stockGuard});
    }

    trySellStock(code, price, count, account) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        if (!account || account == this.normalAccount.keyword) {
            for (var i = 0; i < this.normalAccount.stocks.length; i++) {
                if (this.normalAccount.stocks[i].code == code) {
                    var stockInfo = this.normalAccount.stocks[i];
                    if (finalCount > stockInfo.availableCount) {
                        finalCount = stockInfo.availableCount;
                    }
                    this.sendTradeMessage(this.normalAccount.sellPath, {code: stockInfo.code, name: stockInfo.name}, price, finalCount);
                    return;
                }
            };
        };

        if (!account || this.collateralAccount.keyword == account) {
            for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
                if (this.collateralAccount.stocks[i].code == code) {
                    var stockInfo = this.collateralAccount.stocks[i];
                    if (finalCount > stockInfo.availableCount) {
                        finalCount = stockInfo.availableCount;
                    }
                    this.sendTradeMessage(this.collateralAccount.sellPath, {code: stockInfo.code, name: stockInfo.name}, price, finalCount);
                    return;
                }
            };
        };
    }

    tryBuyStock(code, name, price, count, account) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = {code: code, name: name};

        var moneyNeed = finalCount * price;
        var moneyMax = Math.max(this.normalAccount.availableMoney, this.collateralAccount.availableMoney, this.creditAccount.availableMoney);
        if (moneyMax < moneyNeed) {
            finalCount = 100 * Math.floor(moneyMax / (100 * price));
        }

        moneyNeed = finalCount * price;
        var buyAccount = this.normalAccount;
        if (this.normalAccount.availableMoney < moneyNeed) {
            buyAccount = this.collateralAccount;
            if (this.collateralAccount.availableMoney < moneyNeed) {
                buyAccount = this.creditAccount;
            }
        }

        if (account) {
            if (account == this.normalAccount.keyword) {
                buyAccount = this.normalAccount;
            } else if (account == this.collateralAccount.keyword) {
                buyAccount = this.collateralAccount.keyword;
            } else if (account == this.creditAccount.keyword) {
                buyAccount = this.creditAccount;
            };
        };

        if (buyAccount.availableMoney < moneyNeed) {
            this.log('No availableMoney match');
            return;
        }
        this.sendTradeMessage(buyAccount.buyPath, stockInfo, price, finalCount);
    }

    sendTradeMessage(tradePath, stock, price, count) {
        this.postWorkerTask({command: 'emjy.trade', tradePath: tradePath, stock: stock, price: price, count: count});
    }

    getProperTimeInterval() {
        if (DEBUG) {
            return 0;
        }
        var now = new Date();
        if (now.getDay() == 0 || now.getDay() == 6) {
            return -1;
        }
        var hr = now.getHours();
        var mn = now.getMinutes();
        if (hr < 9 || hr > 15) {
            return -1;
        }

        var minutes = (hr - 9) * 60 + mn;
        if (minutes < 30) {
            return -1;
        } else if (minutes <= 60) {
            return 1000;
        } else if (minutes <= 150) {
            return 60000;
        } else if (minutes < 240) {
            return -1;
        } else if (minutes <= 365) {
            return 60000;
        }
        return -1;
    }

    updateStockRtPrice(snapshot) {
        this.log('updateStockRtPrice', JSON.stringify(snapshot));
        this.normalAccount.updateStockRtPrice(snapshot);
        this.collateralAccount.updateStockRtPrice(snapshot);
    }

    loadStrategies(account) {
        account.stocks.forEach(function(s) {
            var buyStorageKey = account.keyword + '_' + s.code + '_buyStrategy';
            chrome.storage.local.get(buyStorageKey, function(item) {
                if (item && item[buyStorageKey]) {
                    emjyBack.applyStoredBuyStrategy(account.keyword, s.code, item[buyStorageKey]);
                };
            });
            var sellStorageKey = account.keyword + '_' + s.code + '_sellStrategy';
            chrome.storage.local.get(sellStorageKey, function(item) {
                if (item && item[sellStorageKey]) {
                    emjyBack.applyStoredSellStrategy(account.keyword, s.code, item[sellStorageKey]);
                };
            });
        });
    }

    applyStoredBuyStrategy(account, code, bstr) {
        this.applyStrategy(account, code, JSON.parse(bstr));
    }

    applyStoredSellStrategy(account, code, sstr) {
        this.applyStrategy(account, code, null, JSON.parse(sstr));
    }

    applyStrategy(account, code, bstr, sstr) {
        this.log('applyStrategy', account, code, JSON.stringify(bstr), JSON.stringify(sstr));
        var buyStrategy = null;
        if (bstr) {
            buyStrategy = strategyManager.initStrategy(account + '_' + code + '_buyStrategy', bstr, this.log);
        };

        var sellStrategy = null;
        if (sstr) {
            sellStrategy = strategyManager.initStrategy(account + '_' + code + '_sellStrategy', sstr, this.log);
        };
        
        if (account == this.normalAccount.keyword) {
            this.normalAccount.applyStrategy(code, buyStrategy, sellStrategy);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.applyStrategy(code, buyStrategy, sellStrategy);
        };
    }
}