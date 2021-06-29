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
        if (!this.stocks) {
            return;
        };

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

    addStock(code) {
        this.stocks.push(new StockInfo({ code, name: '', holdCount: 0, availableCount: 0, market: ''}));
        if (!emjyBack.stockGuard.has(code)) {
            emjyBack.stockGuard.add(code);
            emjyBack.updateMonitor();
        };
    }

    save() {
        if (this.keyword == 'watch') {
            var codes = [];
            this.stocks.forEach(function(s) {
                codes.push(s.code);
            });
            chrome.storage.local.set({'watching_stocks': codes});
        };

        this.stocks.forEach(function(s) {
            if (s.buyStrategy) {
                strategyManager.flushStrategy(s.buyStrategy);
            };
            if (s.sellStrategy) {
                strategyManager.flushStrategy(s.sellStrategy);
            };
        });
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
        // emjyBack.log('checkStrategies', this.code, JSON.stringify(this.buyStrategy), JSON.stringify(this.sellStrategy));
        if (this.buyStrategy && this.buyStrategy.enabled) {
            if (this.buyStrategy.check(this.rtInfo)) {
                emjyBack.tryBuyStock(this.code, this.name, this.latestPrice, this.buyStrategy.count, this.buyStrategy.account);
                emjyBack.log('checkStrategies', this.code, 'buy match', JSON.stringify(this.buyStrategy));
                this.buyStrategy.buyMatch();
                if (this.sellStrategy) {
                    this.sellStrategy.buyMatch();
                };
            }
        }
        if (this.sellStrategy && this.sellStrategy.enabled) {
            if (this.sellStrategy.check(this.rtInfo)) {
                emjyBack.trySellStock(this.code, this.latestPrice, this.sellStrategy.count, this.sellStrategy.account);
                this.sellStrategy.sellMatch();
                if (this.buyStrategy) {
                    this.buyStrategy.sellMatch();
                };
                emjyBack.log('checkStrategies', 'sell match', this.code, JSON.stringify(this.sellStrategy));
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
            emjyBack.applyStrategy(message.account, message.code, message.buyStrategy, message.sellStrategy);
        } else if (message.command == 'mngr.addwatch') {
            emjyBack.watchAccount.addStock(message.code);
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
        this.watchAccount = null;
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
            this.watchAccount = new AccountInfo();
            this.watchAccount.initAccount('watch');
            chrome.storage.local.get('watching_stocks', function(item) {
                emjyBack.log('get watching_stocks', JSON.stringify(item));
                if (item && item.watching_stocks) {
                    emjyBack.initWatchList(item.watching_stocks);
                };
            });

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
                this.manager.sendStocks([this.normalAccount, this.collateralAccount, this.watchAccount]);
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
                this.manager.sendStocks([this.normalAccount, this.collateralAccount, this.watchAccount]);
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
            this.setupQuoteAlarms();
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
                    if (finalCount == 0) {
                        this.log('error: availableCount is 0');
                        return;
                    };
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
                    if (finalCount == 0) {
                        this.log('error: availableCount is 0');
                        return;
                    };
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

    setupQuoteAlarms() {
        if (DEBUG) {
            this.postQuoteWorkerMessage({command: 'quote.refresh', time: 0});
        };

        var now = new Date();
        var alarms = [
        {name:'morning-start', tick: new Date(now.toDateString() + ' 9:29:58').getTime()},
        {name:'morning-middle', tick: new Date(now.toDateString() + ' 10:15:55').getTime()},
        {name:'morning-end', tick: new Date(now.toDateString() + ' 11:30:7').getTime()},
        {name:'afternoon', tick: new Date(now.toDateString() + ' 12:59:58').getTime()},
        {name:'afternoon-end', tick: new Date(now.toDateString() + ' 15:0:2').getTime()}
        ];

        for (var i = 0; i < alarms.length; i++) {
            if (i == alarms.length - 1) {
                if (now < alarms[i].tick) {
                    this.log('setupQuoteAlarms', alarms[i].name);
                    chrome.alarms.create(alarms[i].name, {when: alarms[i].tick});
                };
                break;
            };
            if (i + 1 < alarms.length && now < alarms[i + 1].tick) {
                this.log('setupQuoteAlarms', alarms[i].name);
                chrome.alarms.create(alarms[i].name, {when: alarms[i].tick});
            }; 
        };
    }

    updateStockRtPrice(snapshot) {
        //this.log('updateStockRtPrice', JSON.stringify(snapshot));
        this.normalAccount.updateStockRtPrice(snapshot);
        this.collateralAccount.updateStockRtPrice(snapshot);
        this.watchAccount.updateStockRtPrice(snapshot);
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
        this.applyStrategy(account, code, bstr);
    }

    applyStoredSellStrategy(account, code, sstr) {
        this.applyStrategy(account, code, null, sstr);
    }

    applyStrategy(account, code, bstr, sstr) {
        this.log('applyStrategy', account, code, JSON.stringify(bstr), JSON.stringify(sstr));
        var buyStrategy = null;
        if (bstr) {
            buyStrategy = strategyManager.initStrategy(account + '_' + code + '_buyStrategy', JSON.parse(bstr), this.log);
        };

        var sellStrategy = null;
        if (sstr) {
            sellStrategy = strategyManager.initStrategy(account + '_' + code + '_sellStrategy', JSON.parse(sstr), this.log);
        };
        
        if (account == this.normalAccount.keyword) {
            this.normalAccount.applyStrategy(code, buyStrategy, sellStrategy);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.applyStrategy(code, buyStrategy, sellStrategy);
        } else if (account == this.watchAccount.keyword) {
            this.watchAccount.applyStrategy(code, buyStrategy, sellStrategy);
        };
    }

    initWatchList(codes) {
        this.log('initWatchList', codes);
        var holdChanged = false;
        this.watchAccount.stocks = [];
        for (var i = 0; i < codes.length; i++) {
            this.watchAccount.stocks.push(new StockInfo({ code: codes[i], name: '', holdCount: 0,availableCount: 0, market: ''}));
            if (!this.stockGuard.has(codes[i])) {
                this.stockGuard.add(codes[i]);
                holdChanged = true;
            };
        };

        this.loadStrategies(this.watchAccount);
        if (holdChanged) {
            this.updateMonitor();
        }
    }

    tradeClosed() {
        this.normalAccount.save();
        this.collateralAccount.save();
        this.watchAccount.save();
    }
}

chrome.alarms.onAlarm.addListener(function(alarmInfo) {
    var interval = 0;
    if (alarmInfo.name == 'morning-start') {
        interval = 1000;
    } else if (alarmInfo.name == 'morning-middle') {
        interval = 30000;
    } else if (alarmInfo.name == 'morning-end') {
        interval = -1;
    } else if (alarmInfo.name == 'afternoon') {
        interval = 30000;
    } else if (alarmInfo.name == 'afternoon-end') {
        interval = -1;
    };

    var now = new Date();
    if (DEBUG || now.getHours() > 9) {
        interval = 0;
    };
    emjyBack.postQuoteWorkerMessage({command: 'quote.refresh', time: interval});
    if (alarmInfo.name == 'afternoon-end') {
        emjyBack.tradeClosed();
    };
    emjyBack.log(alarmInfo.name, now.toLocaleTimeString(), 'interval', interval);
});
