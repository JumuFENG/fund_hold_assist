'use strict';
let DEBUG = false;
let emjyBack = null;
let NewStockPurchasePath = '/Trade/NewBatBuy';
let NewBondsPurchasePath = '/Trade/XzsgBatPurchase';

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
            this.tabid = null;
        } else if (message.command == 'mngr.strategy') {
            emjyBack.applyStrategy(message.account, message.code, message.buyStrategy, message.sellStrategy);
        } else if (message.command == 'mngr.addwatch') {
            emjyBack.addWatchStock(message.account, message.code);
        } else if (message.command == 'mngr.rmwatch') {
            emjyBack.removeStock(message.account, message.code);
        } else if (message.command == 'mngr.getZTPool') {
            emjyBack.postQuoteWorkerMessage({command:'quote.get.ZTPool', date: message.date});
        } else if (message.command == 'mngr.getkline') {
            emjyBack.postQuoteWorkerMessage({command: 'quote.get.kline', code: message.code, date: message.date, len: message.len, market: emjyBack.stockMarket[message.code]});
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

function onQuoteWorkerMessage(e) {
    emjyBack.onQuoteWorkerMessageReceived(e.data);
}

class EmjyBack {
    constructor() {
        this.log = null;
        this.mainTab = null;
        this.authencated = false;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.contentProxies = [];
        this.stockGuard = null;
        this.stockMarket = {};
        this.klineAlarms = null;
        this.ztBoardTimer = null;
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
        };
        if (!this.ztBoardTimer) {
            this.ztBoardTimer = new ZtBoardTimer();
        };
        this.log('EmjyBack initialized!');
    }

    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
    }

    onContentLoaded(message, tabid) {
        if (!this.mainTab) {
            this.log('init mainTabId and accounts');
            this.mainTab = new TradeProxy();
            this.mainTab.tabid = tabid;
            this.mainTab.url = message.url;
            chrome.tabs.onRemoved.addListener((tabid, removeInfo) => {
                if (emjyBack.mainTab.tabid == tabid) {
                    emjyBack.mainTab = null;
                }
            });

            chrome.tabs.reload(this.mainTab.tabid, () => {
                var loadInterval = setInterval(() => {
                    chrome.tabs.get(this.mainTab.tabid, t => {
                        if (t.status == 'complete') {
                            clearInterval(loadInterval);
                            this.mainTab.url = t.url;
                            var url = new URL(t.url);
                            this.authencated = url.pathname != '/Login';
                            this.refreshAssets();
                        };
                    });
                }, 200);
            });

            this.normalAccount = new NormalAccount();
            this.normalAccount.initAccount('normal', '/Trade/Buy', '/Trade/Sale', '/Search/Position');
            this.normalAccount.loadWatchings();
            this.collateralAccount = new AccountInfo();
            this.collateralAccount.initAccount('collat', '/MarginTrade/Buy', '/MarginTrade/Sale', '/MarginSearch/MyAssets');
            this.collateralAccount.loadWatchings();
            this.creditAccount = new AccountInfo();
            this.creditAccount.initAccount('credit', '/MarginTrade/MarginBuy', '/MarginTrade/FinanceSale', '/MarginSearch/MyAssets');
            return;
        };

        if (tabid == this.mainTab.tabid) {
            this.mainTab.url = message.url;
            chrome.tabs.executeScript(this.mainTab.tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
            var url = new URL(this.mainTab.url);
            this.authencated = url.pathname != '/Login';
            if (this.contentProxies.length > 0 && this.authencated) {
                this.contentProxies.forEach(p => {
                    p.triggerTask();
                });
            };
        } else {
            this.contentProxies.forEach(c => {
                if (c.tabid == tabid) {
                    c.pageLoaded();
                };
            });
        };

        this.log('onContentLoaded', this.mainTab.url);
    }

    // DON'T use this API directly, or it may break the task queue.
    sendMsgToContent(data) {
        var url = new URL(this.mainTab.url);
        if (!this.mainTab.tabid || url.host != 'jywg.18.cn') {
            return;
        }

        if (url.pathname == '/Login' || !this.authencated) {
            this.log('not sendMsgToContent', url.pathname, this.authencated);
            // this.revokeCurrentTask();
            return;
        }

        //chrome.tabs.sendMessage(tabid, {command: 'emjy.navigate', url: url.href});

        chrome.tabs.sendMessage(this.mainTab.tabid, data);
        this.log('sendMsgToContent', JSON.stringify(data));
    }

    remvoeProxy(tabid) {
        this.log('remvoeProxy', tabid);
        this.contentProxies.forEach(c => {
            if (c.tabid == tabid) {
                c.closeTab();
                this.contentProxies.splice(this.contentProxies.indexOf(c), 1);
            };
        });
    }

    onContentMessageReceived(message, tabid) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('background not initialized');
            return;
        }

        this.log('onContentMessageReceived', tabid);
        if (message.command == 'emjy.getValidateKey') {
            this.log('getValidateKey =', message.key);
        } else if (message.command == 'emjy.getAssets') {
            this.log('update assets', JSON.stringify(message));
            if (message.assetsPath == this.normalAccount.assetsPath) {
                this.normalAccount.pureAssets = parseFloat(message.pureAssets);
                this.normalAccount.availableMoney = parseFloat(message.availableMoney);
                this.normalAccount.parseStockInfoList(message.stocks);
                this.normalAccount.loadStrategies();
            } else {
                this.creditAccount.pureAssets = 0.0;
                this.creditAccount.availableMoney = parseFloat(message.availableCreditMoney);
                this.collateralAccount.pureAssets = parseFloat(message.pureAssets);
                this.collateralAccount.availableMoney = parseFloat(message.availableMoney);
                this.collateralAccount.parseStockInfoList(message.stocks);
                this.collateralAccount.loadStrategies();
            }

            if (this.manager && this.manager.isValid()) {
                this.manager.sendStocks([this.normalAccount, this.collateralAccount]);
            }
            
            this.log(JSON.stringify(this.normalAccount));
            this.log(JSON.stringify(this.collateralAccount));
            this.log(JSON.stringify(this.creditAccount));
            this.remvoeProxy(tabid);
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.log('trade success', message.what);
                this.remvoeProxy(tabid);
            } else if (message.result == 'error') {
                this.log('trade error:', message.reason, message.what);
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
                this.manager.sendStocks([this.normalAccount, this.collateralAccount]);
            }
            chrome.tabs.onRemoved.addListener((tid, removeInfo) => {
                this.manager.onManagerMessage({command: 'mngr.closed'}, tid);
            });
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
        } else if (message.command == 'quote.query.stock') {
            this.updateStockMarketInfo(message.sdata);
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

        this.scheduleTaskInNewTab({command: 'emjy.getAssets', path: this.normalAccount.assetsPath});
        this.scheduleTaskInNewTab({command: 'emjy.getAssets', path: this.creditAccount.assetsPath});
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
        this.scheduleTaskInNewTab({command: 'emjy.trade', path: tradePath, stock, price, count});
    }

    refreshQuoteWorkerInterval(time) {
        emjyBack.postQuoteWorkerMessage({command: 'quote.refresh', time});
    }

    setupQuoteAlarms() {
        var now = new Date();
        if (DEBUG || now.getDay() == 0 || now.getDay() == 6) {
            this.refreshQuoteWorkerInterval(0);
            return;
        };

        var alarms = [
        {name:'morning-prestart', tick: new Date(now.toDateString() + ' 9:24:45').getTime()},
        {name:'morning-start', tick: new Date(now.toDateString() + ' 9:29:51').getTime()},
        {name:'morning-started', tick: new Date(now.toDateString() + ' 9:30:1').getTime()},
        {name:'morning-middle', tick: new Date(now.toDateString() + ' 10:15:55').getTime()},
        {name:'morning-end', tick: new Date(now.toDateString() + ' 11:30:3').getTime()},
        {name:'afternoon', tick: new Date(now.toDateString() + ' 12:59:55').getTime()},
        {name:'afternoon-started', tick: new Date(now.toDateString() + ' 13:0:1').getTime()},
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

    updateStockMarketInfo(sdata) {
        this.normalAccount.updateStockMarketInfo(sdata);
        this.collateralAccount.updateStockMarketInfo(sdata);
        this.stockMarket[sdata.code] = sdata.market;
    }

    updateStockRtPrice(snapshot) {
        //this.log('updateStockRtPrice', JSON.stringify(snapshot));
        this.normalAccount.updateStockRtPrice(snapshot);
        this.collateralAccount.updateStockRtPrice(snapshot);
        this.ztBoardTimer.updateStockRtPrice(snapshot);
    }

    updateStockRtKline(message) {
        this.normalAccount.updateStockRtKline(message);
        this.collateralAccount.updateStockRtKline(message);
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
        };

        if (buyStrategy && buyStrategy.shouldGetKline()) {
            this.klineAlarms.addStock(code, buyStrategy.kltype);
        } else if (sellStrategy && sellStrategy.shouldGetKline()) {
            this.klineAlarms.addStock(code, sellStrategy.kltype);
        }
        if (buyStrategy && buyStrategy.guardZtBoard()) {
            this.ztBoardTimer.addStock(code);
        };
        if ((buyStrategy && buyStrategy.guardRtPrices()) || (sellStrategy && sellStrategy.guardRtPrices())) {
            this.addToGuardStocks(code);
        };
    }

    addWatchStock(account, code) {
        if (account == this.normalAccount.keyword) {
            this.normalAccount.addWatchStock(code);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.addWatchStock(code);
        };
    }

    removeStock(account, code) {
        if (this.stockGuard.has(code)) {
            this.stockGuard.delete(code);
            this.updateMonitor();
        };

        if (account == this.normalAccount.keyword) {
            this.normalAccount.removeStock(code);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.removeStock(code);
        };
    }

    fetchStockSnapshot(code) {
        this.postQuoteWorkerMessage({command:'quote.fetch.code', code});
    }

    fetchStockKline(code, kltype) {
        var market = this.stockMarket[code];
        this.postQuoteWorkerMessage({command:'quote.kline.rt', code, kltype, market});
    }

    tradeDailyRoutineTasks() {
        this.scheduleTaskInNewTab({command:'emjy.trade.newstocks', path: NewStockPurchasePath});
        this.scheduleTaskInNewTab({command:'emjy.trade.newbonds', path: NewBondsPurchasePath});
    }

    getHSMarketFlag(code) {
        var market = this.stockMarket[code];
        if (market == 'SH') {
            return 'HA';
        };
        if (market == 'SZ') {
            return 'SA';
        };
        return '';
    }

    scheduleTaskInNewTab(task, active = true) {
        var proxy = new TradeProxy();
        proxy.task = task;
        proxy.active = active;
        if (task.path) {
            proxy.url = 'https://jywg.18.cn' + task.path;
        };

        if (task.command == 'emjy.trade') {
            proxy.url += '?' + task.stock.code;
            var market = this.getHSMarketFlag(task.stock.code);
            if (market != '') {
                proxy.url += '&market=' + market;
            };
        };
        if (this.authencated) {
            proxy.triggerTask();
        };
        this.contentProxies.push(proxy);
    }

    tradeBeforeClose() {
        this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
    }

    tradeClosed() {
        this.normalAccount.save();
        this.collateralAccount.save();
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
    if (alarmInfo.name == 'morning-prestart') {
        emjyBack.ztBoardTimer.startTimer();
    } else if (alarmInfo.name == 'morning-start') {
        emjyBack.refreshQuoteWorkerInterval(1000);
    } else if (alarmInfo.name == 'morning-started') {
        emjyBack.klineAlarms.startTimer();
    } else if (alarmInfo.name == 'morning-middle') {
        emjyBack.tradeDailyRoutineTasks();
        emjyBack.refreshQuoteWorkerInterval(10000);
    } else if (alarmInfo.name == 'morning-end') {
        emjyBack.refreshQuoteWorkerInterval(-1);
        emjyBack.klineAlarms.stopTimer();
        emjyBack.ztBoardTimer.stopTimer();
    } else if (alarmInfo.name == 'afternoon') {
        emjyBack.refreshQuoteWorkerInterval(10000);
        emjyBack.refreshAssets();
    } else if (alarmInfo.name == 'afternoon-started') {
        emjyBack.klineAlarms.startTimer();
        emjyBack.ztBoardTimer.startTimer();
    } else if (alarmInfo.name == 'afternoon-preend') {
        emjyBack.tradeBeforeClose();
    } else if (alarmInfo.name == 'afternoon-end') {
        emjyBack.refreshQuoteWorkerInterval(-1);
        emjyBack.klineAlarms.stopTimer();
        emjyBack.ztBoardTimer.stopTimer();
        emjyBack.tradeClosed();
    };

    var now = new Date();
    emjyBack.log(alarmInfo.name, now.toLocaleTimeString());
});
