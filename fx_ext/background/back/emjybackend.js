'use strict';
let DEBUG = false;
let emjyBack = null;

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
        this.authencated = true;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.watchAccount = null;
        this.currentTask = null;
        this.taskTimeoutTimer = null;
        this.stockGuard = null;
        this.klineAlarms = null;
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
        if (!this.klineAlarms) {
            this.klineAlarms = new KlineAlarms();
            this.klineAlarms.setupAlarms();
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
        var url = new URL(this.contentUrl);
        this.authencated = url.pathname != '/Login';
        if (this.currentTask && url.pathname == '/Login') {
            this.authencated = false;
            this.revokeCurrentTask();
        };
        this.log('onContentLoaded', this.contentUrl);
    }

    // DON'T use this API directly, or it may break the task queue.
    sendMsgToContent(data) {
        var url = new URL(this.contentUrl);
        if (!this.contentTabId || url.host != 'jywg.18.cn') {
            return;
        }

        if (url.pathname == '/Login' || !this.authencated) {
            this.log('not sendMsgToContent', url.pathname, this.authencated);
            // this.revokeCurrentTask();
            return;
        }

        //chrome.tabs.sendMessage(tabid, {command: 'emjy.navigate', url: url.href});

        chrome.tabs.sendMessage(this.contentTabId, data);
        this.taskTimeoutTimer = setTimeout(() => {
            this.log('currentTask pending 1 min:', JSON.stringify(this.currentTask));
            this.popCurrentTask();
            this.taskTimeoutTimer = null;
        }, 60000);
        this.currentTask = data;
        this.postWorkerTask({command: 'emjy.sent'});
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
                this.clearTaskTimeoutTimer();
                this.popCurrentTask();
            }
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.log('trade success', message.what);
                this.clearTaskTimeoutTimer();
                this.popCurrentTask();
            } else if (message.result == 'error') {
                this.log('trade error:', message.reason, message.what);
                if (message.reason == 'btnConfirmDisabled') {
                    this.revokeCurrentTask();
                } else if (message.reason == 'pageNotLoaded') {
                    var loadingInterval = setInterval(()=>{
                        if (this.contentUrl == message.expected && this.authencated) {
                            clearInterval(loadingInterval);
                            this.revokeCurrentTask();
                        };
                    }, 200);
                } else {
                    this.clearTaskTimeoutTimer();
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
        this.clearTaskTimeoutTimer();
        this.currentTask = null;
    }

    popCurrentTask() {
        this.currentTask.state = 'done';
        this.log('pop task');
        this.postWorkerTask(this.currentTask);
        this.currentTask = null;
    }

    clearTaskTimeoutTimer() {
        if (this.taskTimeoutTimer) {
            clearTimeout(this.taskTimeoutTimer);
            this.taskTimeoutTimer = null;
        };
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
        } else if (message.command == 'quote.kline.rt') {
            this.updateStockRtKline(message);
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

    updateStockRtKline(message) {
        this.normalAccount.updateStockRtKline(message);
        this.collateralAccount.updateStockRtKline(message);
        this.watchAccount.updateStockRtKline(message);
    }

    loadStrategies(account) {
        account.stocks.forEach((s) => {
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

        if (buyStrategy && buyStrategy.shouldGetKline()) {
            this.klineAlarms.addStock(code, buyStrategy.kltype);
        } else if (sellStrategy && sellStrategy.shouldGetKline()) {
            this.klineAlarms.addStock(code, sellStrategy.kltype);
        }
        if ((buyStrategy && buyStrategy.guardRtPrices()) || (sellStrategy && sellStrategy.guardRtPrices())) {
            this.addToGuardStocks(code);
        };
    }

    initWatchList(codes) {
        this.log('initWatchList', codes);
        this.watchAccount.stocks = [];
        for (var i = 0; i < codes.length; i++) {
            this.watchAccount.stocks.push(new StockInfo({ code: codes[i], name: '', holdCount: 0,availableCount: 0, market: ''}));
        };

        this.loadStrategies(this.watchAccount);
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

    fetchStockKline(code, kltype) {
        this.postQuoteWorkerMessage({command:'quote.kline.rt', code, kltype});
    }

    tradeDailyRoutineTasks() {
        this.postWorkerTask({command:'emjy.trade.newstocks'});
        this.postWorkerTask({command:'emjy.trade.newbonds'});
    }

    tradeBeforeClose() {
        // this.normalAccount.buyFundBeforeClose();
        this.watchAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
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
