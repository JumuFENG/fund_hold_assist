'use strict';
let DEBUG = true;
let emjyBack = null;

class AccountInfo {
    constructor() {
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
    }

    initAccount(buyPath, sellPath, assetsPath) {
        this.buyPath = buyPath;
        this.sellPath = sellPath;
        this.assetsPath = assetsPath;
    }
}

class StockInfo {
    constructor(code) {
        this.code = code;
        this.name = '';
        this.market = '';
        this.holdCost = null;
        this.holdCount = 0;
        this.costDetail = [];
        this.latestPrice = null;
        this.buyStrategy = null;
        this.sellStrategy = null;
    }

    checkStrategies() {
        emjyBack.log('checkStrategies');
        if (this.buyStrategy) {
            if (this.buyStrategy.check(this.latestPrice)) {
                emjyBack.tryBuyStock(this.code, this.latestPrice);
            }
        }
        if (this.sellStrategy) {
            if (this.sellStrategy.check(this.latestPrice)) {
                emjyBack.trySellStock(this.code, this.latestPrice);
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
        }
    }

    sendManagerMessage(message) {
        if (this.isValid()) {
            chrome.tabs.sendMessage(this.tabid, message);
        } else {
            this.log('manager tab id is', this.tabid);
        }
    }

    sendStocks(stocks) {
        this.sendManagerMessage({command:'mngr.stocks', stocks: JSON.stringify(stocks)});
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
        this.stockGuard = [];
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
            this.normalAccount.initAccount('/Trade/Buy', '/Trade/Sale', '/Search/Position');
            this.collateralAccount = new AccountInfo();
            this.collateralAccount.initAccount('/MarginTrade/Buy', '/MarginTrade/Sale', '/MarginSearch/MyAssets');
            this.creditAccount = new AccountInfo();
            this.creditAccount.initAccount('/MarginTrade/MarginBuy', '/MarginTrade/FinanceSale', '/MarginSearch/MyAssets');
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
                doSendMsgToContent(tabs[0].id, data);
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
            } else {
                // this.collateralAccount.pureAssets = message.totalAssets - message.pureAssets;
                this.creditAccount.pureAssets = 0.0;
                this.creditAccount.availableMoney = parseFloat(message.availableCreditMoney);
                this.collateralAccount.pureAssets = parseFloat(message.pureAssets);
                this.collateralAccount.availableMoney = parseFloat(message.availableMoney);
                this.collateralAccount.stocks = this.parseStockInfoList(message.stocks);
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
                if (message.reason == 'pageNotLoaded') {
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
            if (this.manager.isValid() && this.stockGuard.length > 0) {
                this.manager.sendStocks(this.stockGuard);
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
            var stockInfo = {};
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.market = stocks[i].market;
            if (stockInfo.holdCount > 0 && stockInfo.availableCount > 0) {
                stockList.push(stockInfo);
            }
        };
        return stockList;
    }

    updateHoldStocks(stocks) {
        var holdChanged = false;
        for (var i = 0; i < stocks.length; i++) {
            var stock = this.stockGuard.find(function(s) {return s.code == stocks[i].code;});
            if (!stock) {
                this.stockGuard.push(new StockInfo(stocks[i].code));
                holdChanged = true;
            }
        };
        if (holdChanged) {
            if (this.manager && this.manager.isValid()) {
                this.manager.sendStocks(this.stockGuard);
            }
            this.updateMonitor();
        }
    }

    updateMonitor() {
        var stocks = [];
        this.stockGuard.forEach(function(s) {
            stocks.push(s.code);
        });

        if (!this.quoteWorker) {
            this.quoteWorker = new Worker('workers/quoteworker.js');
            this.quoteWorker.onmessage = onQuoteWorkerMessage;
            this.postQuoteWorkerMessage({command: 'quote.refresh', time: this.getProperTimeInterval()});
        };
        this.postQuoteWorkerMessage({command: 'quote.update.code', stocks: stocks});
    }

    trySellStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }
        for (var i = 0; i < this.normalAccount.stocks.length; i++) {
            if (this.normalAccount.stocks[i].code == code) {
                if (finalCount > this.normalAccount.stocks[i].availableCount) {
                    finalCount = this.normalAccount.stocks[i].availableCount;
                }
                this.sendTradeMessage(this.normalAccount.sellPath, this.normalAccount.stocks[i], price, finalCount);
                return;
            }
        };
        for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
            if (this.collateralAccount.stocks[i].code == code) {
                if (finalCount > this.collateralAccount.stocks[i].availableCount) {
                    finalCount = this.collateralAccount.stocks[i].availableCount;
                }
                this.sendTradeMessage(this.collateralAccount.sellPath, this.collateralAccount.stocks[i], price, finalCount);
                return;
            }
        };
    }

    tryBuyStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = null;
        for (var i = 0; i < this.normalAccount.stocks.length; i++) {
            if (this.normalAccount.stocks[i].code == code) {
                stockInfo = this.normalAccount.stocks[i];
                break;
            }
        };
        if (!stockInfo) {
            for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
                if (this.collateralAccount.stocks[i].code == code) {
                    stockInfo = this.collateralAccount.stocks[i];
                    break;
                }
            };
        }

        if (!stockInfo) {
            stockInfo = {code: code};
        }

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
        var stock = this.stockGuard.find(function(s) {
            return s.code == snapshot.code;
        });

        if (stock) {
            if (!stock.name) {
                stock.name = snapshot.name;
            }
            stock.latestPrice = snapshot.realtimequote.currentPrice;
            stock.buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
            stock.sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
            stock.checkStrategies();
            this.log('updated', JSON.stringify(stock));
        }
    }

    applyStrategies() {
        for (var i = 0; i < this.stockGuard.length; i++) {
            var bstrategy = new StrategyBuy(this.log);
            bstrategy.setup(100, 0.01);
            this.stockGuard[i].buyStrategy = bstrategy;
            var sstrategy = new StrategySell(this.log);
            sstrategy.setup(110, 0.01);
            this.stockGuard[i].sellStrategy = sstrategy;
        };
    }
}