'use strict';
let DEBUG = false;
let emjyBack = null;

class Wallet {
    constructor() {
        this.fundcode = '511880';
        this.name = '';
        this.state = 'none';
        this.holdCount = 0;
        this.log = emjyBack.log;
    }

    updateFundPrice(snapshot, account) {
        this.log('updateFundPrice');
        if (snapshot.code != this.fundcode) {
            return;
        };

        this.latestPrice = snapshot.realtimequote.currentPrice;
        this.buy1Prices = snapshot.fivequote.buy1;
        this.sell1Prices = snapshot.fivequote.sale1;
        if (this.state == 'fetchBuy') {
            this.state = 'none';
            emjyBack.tryBuyStock(this.fundcode, this.name, this.sell1Prices, 1, account);
        } else if (this.state == 'fetchSell') {
            this.state = 'none';
            emjyBack.trySellStock(this.fundcode, this.buy1Prices, 1, account);
        }
    }
}

class AccountInfo {
    constructor() {
        this.keyword = null;
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
        this.stocks = [];
        this.wallet = null;
    }

    initAccount(key, buyPath, sellPath, assetsPath) {
        this.keyword = key;
        this.buyPath = buyPath;
        this.sellPath = sellPath;
        this.assetsPath = assetsPath;
        this.wallet = new Wallet();
    }

    parseStockInfoList(stocks) {
        for (var i = 0; i < stocks.length; i++) {
            if (this.wallet && stocks[i].code == this.wallet.fundcode) {
                this.wallet.name = stocks[i].name;
                this.wallet.holdCount = stocks[i].holdCount;
                continue;
            };
            var stockInfo = this.stocks.find(function(s) {return s.code == stocks[i].code});
            if (!stockInfo) {
                stockInfo = new StockInfo(stocks[i]);
                this.stocks.push(stockInfo);
            };
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.holdCost = stocks[i].holdCost;
            stockInfo.market = stocks[i].market;
        };
    }

    getAccountStocks() {
        if (!this.stocks || this.stocks.length == 0) {
            return null;
        };

        return {account: this.keyword, stocks: JSON.stringify(this.stocks)};
    }

    updateStockRtPrice(snapshot) {
        // emjyBack.log('updateStockRtPrice', JSON.stringify(snapshot));
        if (this.wallet && snapshot.code == this.wallet.fundcode) {
            this.wallet.updateFundPrice(snapshot, this.keyword);
            return;
        };

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
            rtInfo.openPrice = snapshot.fivequote.openPrice;
            rtInfo.buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
            rtInfo.sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
            rtInfo.topprice = snapshot.topprice;
            rtInfo.bottomprice = snapshot.bottomprice;
            stock.rtInfo = rtInfo;
            stock.checkStrategies();
            tradeAnalyzer.updateStockRtPrice(snapshot);
        }
    }

    buyStock(code, name, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = {code, name};

        if (count < 100) {
            emjyBack.log('Buy', code, name, 'price:', price, 'count: 1/', finalCount);
            emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
            return;
        };

        var moneyNeed = finalCount * price;
        if (this.availableMoney < moneyNeed) {
            finalCount = 100 * Math.floor(this.availableMoney / (100 * price));
        }

        moneyNeed = finalCount * price;

        if (this.availableMoney < moneyNeed) {
            emjyBack.log('No availableMoney match');
            return;
        }
        emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
        this.availableMoney -= moneyNeed;
    }

    sellStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = this.stocks.find(function(s) { return s.code == code; });
        if (stockInfo) {
            if (finalCount > stockInfo.availableCount) {
                finalCount = stockInfo.availableCount;
            }
            if (finalCount == 0) {
                emjyBack.log('error: availableCount is 0');
                return;
            };

            emjyBack.sendTradeMessage(this.sellPath, {code: stockInfo.code, name: stockInfo.name}, price, finalCount);
            stockInfo.availableCount -= finalCount;
            this.availableMoney += finalCount * price;
        } else if (code == this.wallet.fundcode) {
            emjyBack.sendTradeMessage(this.sellPath, {code}, price, finalCount);
            this.availableMoney += this.wallet.holdCount * price;
            this.wallet.holdCount = 0;
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
            if (sstr.key == 'StrategySellEL' && stock.holdCost) {
                sstr.setHoldCost(stock.holdCost);
            };
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

    removeStock(code) {
        this.stocks.forEach(function(item, index, arr) {
            if (item.code == code) {
                arr.splice(index, 1);
            };
        });
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

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled && s.buyStrategy.inCritical
        });

        if (!anyCritial) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchBuy';
        };
    }

    checkAvailableMoney(price) {
        var count = 100 * Math.ceil(400 / price);
        var moneyNeed = count * price;
        if (moneyNeed > this.availableMoney && this.wallet.holdCount > 0) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchSell';
        };
    }
}

class WatchAccount extends AccountInfo {
    constructor() {
        super();
        this.keyword = 'watch';
    }

    buyFundBeforeClose() {
        var repCodes = ['204001', '131810'];
        repCodes.forEach(code => {
            emjyBack.log('Buy', code);
            emjyBack.postWorkerTask({command: 'emjy.trade.bonds', code});
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
            var checkResult = this.buyStrategy.check(this.rtInfo);
            if (checkResult.match) {
                emjyBack.log('checkStrategies', this.code, 'buy match', JSON.stringify(this.buyStrategy));
                emjyBack.tryBuyStock(this.code, this.name, checkResult.price, checkResult.count, checkResult.account);
                this.buyStrategy.buyMatch(checkResult.price);
                if (this.sellStrategy) {
                    this.sellStrategy.buyMatch(checkResult.price);
                };
            } else if (checkResult.stepInCritical) {
                emjyBack.checkAvailableMoney(this.rtInfo.latestPrice, checkResult.account);
            }
        }
        if (this.sellStrategy && this.sellStrategy.enabled) {
            var checkResult = this.sellStrategy.check(this.rtInfo);
            if (checkResult.match) {
                emjyBack.log('checkStrategies', 'sell match', this.code, JSON.stringify(this.sellStrategy));
                emjyBack.trySellStock(this.code, checkResult.price, checkResult.count, checkResult.account);
                this.sellStrategy.sellMatch(checkResult.price);
                if (this.buyStrategy) {
                    this.buyStrategy.sellMatch(checkResult.price);
                };
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
            emjyBack.normalAccount.save();
            emjyBack.collateralAccount.save();
            emjyBack.watchAccount.save();
            this.tabid = null;
        } else if (message.command == 'mngr.strategy') {
            emjyBack.applyStrategy(message.account, message.code, message.buyStrategy, message.sellStrategy);
        } else if (message.command == 'mngr.addwatch') {
            emjyBack.watchAccount.addStock(message.code);
        } else if (message.command == 'mngr.rmwatch') {
            emjyBack.removeStock(message.account, message.code);
        } else if (message.command == 'mngr.getZTPool') {
            emjyBack.postQuoteWorkerMessage({command:'quote.get.ZTPool', date: message.date});
        } else if (message.command == 'mngr.getkline') {
            emjyBack.postQuoteWorkerMessage({command: 'quote.get.kline', code: message.code, date: message.date, len: message.len});
        } else if (message.command == 'mngr.saveFile') {
            emjyBack.saveToFile(message.blob, message.filename);
        };
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
        if (!this.quoteWorker) {
            this.quoteWorker = new Worker('workers/quoteworker.js');
            this.quoteWorker.onmessage = onQuoteWorkerMessage;
            this.setupQuoteAlarms();
        };
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
            this.watchAccount = new WatchAccount();
            chrome.storage.local.get('watching_stocks', function(item) {
                emjyBack.log('get watching_stocks', JSON.stringify(item));
                if (item && item.watching_stocks) {
                    emjyBack.initWatchList(item.watching_stocks);
                };
            });

            this.refreshAssets();
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

        var sendNavigateToContent = function(tabid, url) {
            if (!emjyBack.navigating) {
                emjyBack.navigating = true;
                chrome.tabs.sendMessage(tabid, {command: 'emjy.navigate', url: url.href});
                //emjyBack.log('do sendNavigateToContent', url.href);
            }
        };

        chrome.tabs.sendMessage(this.contentTabId, data);
        emjyBack.currentTask = data;
        emjyBack.postWorkerTask({command: 'emjy.sent'});
        this.log('sendMsgToContent', JSON.stringify(data));
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
                this.normalAccount.parseStockInfoList(message.stocks);
                this.loadStrategies(this.normalAccount);
            } else {
                this.creditAccount.pureAssets = 0.0;
                this.creditAccount.availableMoney = parseFloat(message.availableCreditMoney);
                this.collateralAccount.pureAssets = parseFloat(message.pureAssets);
                this.collateralAccount.availableMoney = parseFloat(message.availableMoney);
                this.collateralAccount.parseStockInfoList(message.stocks);
                this.loadStrategies(this.collateralAccount);
            }

            if (this.manager && this.manager.isValid()) {
                this.manager.sendStocks([this.normalAccount, this.collateralAccount, this.watchAccount]);
            }
            
            this.log(JSON.stringify(this.normalAccount));
            this.log(JSON.stringify(this.collateralAccount));
            this.log(JSON.stringify(this.creditAccount));
            if (this.currentTask && this.currentTask.command == message.command) {
                this.popCurrentTask();
            }
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.log('trade success', message.what);
                this.popCurrentTask();
            } else if (message.result == 'error') {
                this.log('trade error:', message.reason, message.what);
                if (message.reason == 'btnConfirmDisabled') {
                    this.revokeCurrentTask();
                } else if (message.reason == 'pageNotLoaded') {
                    var loadingInterval = setInterval(()=>{
                        if (this.contentUrl == message.expected) {
                            clearInterval(loadingInterval);
                            this.revokeCurrentTask();
                        };
                    }, 200);
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
            if (this.manager.isValid()) {
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
        if (message.command == 'quote.log') {
            this.log('quote.log', message.log);
        } else if (message.command == 'quote.snapshot') {
            this.updateStockRtPrice(message.snapshot);
        } else if (message.command == 'quote.get.ZTPool') {
            this.manager.sendManagerMessage({command:'mngr.getZTPool', ztpool: message.ztpool});
        } else if (message.command == 'quote.get.kline') {
            this.manager.sendManagerMessage({command:'mngr.getkline', kline: message.kline});
        };
    }

    refreshAssets() {
        if (this.normalAccount.stocks.length > 0) {
            this.normalAccount.save();
        };
        if (this.collateralAccount.stocks.length > 0) {
            this.collateralAccount.save();
        };
        if (this.watchAccount.stocks.length > 0) {
            this.watchAccount.save();
        };

        this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.normalAccount.assetsPath});
        this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.creditAccount.assetsPath});
    }

    checkAvailableMoney(price, account) {
        if (this.normalAccount.keyword == account) {
            this.normalAccount.checkAvailableMoney(price);
        } else if (this.collateralAccount.keyword == account) {
            this.collateralAccount.checkAvailableMoney(price);
        }
    }

    addToGuardStocks(code) {
        if (!this.stockGuard.has(code)) {
            this.stockGuard.add(code);
            this.updateMonitor();
        };
    }

    updateMonitor() {
        this.postQuoteWorkerMessage({command: 'quote.update.code', stocks: this.stockGuard});
    }

    trySellStock(code, price, count, account) {
        var sellAccount = this.normalAccount;
        if (account) {
            if (account == this.normalAccount.keyword) {
                sellAccount = this.normalAccount;
            } else if (account == this.collateralAccount.keyword) {
                sellAccount = this.collateralAccount;
            } else if (account == this.creditAccount.keyword) {
                sellAccount = this.creditAccount;
            };
        };

        sellAccount.sellStock(code, price, count);
    }

    tryBuyStock(code, name, price, count, account) {
        var buyAccount = this.normalAccount;
        if (account) {
            if (account == this.normalAccount.keyword) {
                buyAccount = this.normalAccount;
            } else if (account == this.collateralAccount.keyword) {
                buyAccount = this.collateralAccount;
            } else if (account == this.creditAccount.keyword) {
                buyAccount = this.creditAccount;
            };
        };

        buyAccount.buyStock(code, name, price, count);
    }

    sendTradeMessage(tradePath, stock, price, count) {
        this.postWorkerTask({command: 'emjy.trade', tradePath, stock, price, count});
    }

    setupQuoteAlarms() {
        var now = new Date();
        if (DEBUG || now.getDay() == 0 || now.getDay() == 6) {
            this.postQuoteWorkerMessage({command: 'quote.refresh', time: 0});
            return;
        };

        var alarms = [
        {name:'morning-start', tick: new Date(now.toDateString() + ' 9:29:51').getTime()},
        {name:'morning-middle', tick: new Date(now.toDateString() + ' 10:15:55').getTime()},
        {name:'morning-end', tick: new Date(now.toDateString() + ' 11:30:7').getTime()},
        {name:'afternoon', tick: new Date(now.toDateString() + ' 12:59:55').getTime()},
        {name:'afternoon-preend', tick: new Date(now.toDateString() + ' 14:59:8').getTime()},
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

        if (buyStrategy || sellStrategy) {
            this.addToGuardStocks(code);
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

    removeStock(account, code) {
        chrome.storage.local.remove([account + '_' + code + '_buyStrategy', account + '_' + code + '_sellStrategy']);
        if (this.stockGuard.has(code)) {
            this.stockGuard.delete(code);
            this.updateMonitor();
        };

        if (account == this.normalAccount.keyword) {
            this.normalAccount.removeStock(code);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.removeStock(code);
        } else if (account == this.watchAccount.keyword) {
            emjyBack.watchAccount.removeStock(code);
        };
    }

    fetchStockSnapshot(code) {
        this.postQuoteWorkerMessage({command:'quote.fetch.code', code});
    }

    tradeDailyRoutineTasks() {
        this.postWorkerTask({command:'emjy.trade.newstocks'});
        this.postWorkerTask({command:'emjy.trade.newbonds'});
    }

    tradeBeforeClose() {
        // this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
        this.watchAccount.buyFundBeforeClose();
    }

    tradeClosed() {
        this.normalAccount.save();
        this.collateralAccount.save();
        this.watchAccount.save();
        tradeAnalyzer.save();
    }

    clearStorage() {
        chrome.storage.local.clear();
    }

    saveToFile(blob, filename, conflictAction = 'overwrite') {
        // conflictAction (uniquify, overwrite, prompt)
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({url, filename, saveAs:false, conflictAction});
    }
}

class TradingData {
    constructor() {
        this.dayPriceAvg = {};
    }

    updateStockRtPrice(snapshot) {
        if (!this.dayPriceAvg[snapshot.code]) {
            this.dayPriceAvg[snapshot.code] = [];
        };
        this.dayPriceAvg[snapshot.code].push([snapshot.realtimequote.currentPrice, snapshot.realtimequote.avg]);
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + ('' + (now.getMonth()+1)).padStart(2, '0') + ('' + now.getDate()).padStart(2, '0');
    }

    save() {
        var fileDate = this.getTodayDate();
        for (var c in this.dayPriceAvg) {
            var blob = new Blob([JSON.stringify(this.dayPriceAvg[c])], {type: 'application/json'});
            var url = URL.createObjectURL(blob);
            var filename = 'StockDailyPrices/' + fileDate + '_' + c + '.json';
            chrome.downloads.download({url, filename, saveAs:false});
        }
    }
}

let tradeAnalyzer = new TradingData();

chrome.alarms.onAlarm.addListener(function(alarmInfo) {
    var interval = 0;
    if (alarmInfo.name == 'morning-start') {
        interval = 1000;
    } else if (alarmInfo.name == 'morning-middle') {
        emjyBack.tradeDailyRoutineTasks();
        interval = 10000;
    } else if (alarmInfo.name == 'morning-end') {
        interval = -1;
    } else if (alarmInfo.name == 'afternoon') {
        interval = 10000;
        emjyBack.refreshAssets();
    } else if (alarmInfo.name == 'afternoon-end') {
        interval = -1;
    } else if (alarmInfo.name == 'afternoon-preend') {
        emjyBack.tradeBeforeClose();
    };

    var now = new Date();
    // if (DEBUG || now.getHours() > 9) {
    //     interval = 0;
    // };
    emjyBack.postQuoteWorkerMessage({command: 'quote.refresh', time: interval});
    if (alarmInfo.name == 'afternoon-end') {
        emjyBack.tradeClosed();
    };
    emjyBack.log(alarmInfo.name, now.toLocaleTimeString(), 'interval', interval);
});
