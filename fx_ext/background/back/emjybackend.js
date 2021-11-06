'use strict';
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
        } else if (message.command == 'mngr.export') {
            emjyBack.exportConfig();
        } else if (message.command == 'mngr.import') {
            emjyBack.importConfig(message.config);
        } else if (message.command == 'mngr.strategy') {
            emjyBack.applyStrategy(message.account, message.code, message.strategies);
        } else if (message.command =='mngr.strategy.rmv') {
            emjyBack.removeStockStrategy(message.account, message.code, message.stype);
        } else if (message.command == 'mngr.addwatch') {
            emjyBack.addWatchStock(message.account, message.code, message.strategies);
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
        this.mainTab = null;
        this.authencated = false;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.contentProxies = [];
        this.stockMarket = {};
        this.klineAlarms = null;
        this.ztBoardTimer = null;
        this.rtpTimer = null;
        this.dailyAlarm = null;
        this.quoteWorker = null;
        this.manager = null;
    }

    log(...args) {
        var dt = new Date();
        var l = '[' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds()  + '] ' +  args.join(' ');
        this.logs.push(l + '\n');
        console.log(l);
    }

    Init() {
        this.logs = [];
        emjyBack = this;
        this.stockMarket['511880'] = 'SH';
        if (!this.quoteWorker) {
            this.quoteWorker = new Worker('workers/quoteworker.js');
            this.quoteWorker.onmessage = onQuoteWorkerMessage;
        };
        if (!this.klineAlarms) {
            this.klineAlarms = new KlineAlarms();
        };
        if (!this.ztBoardTimer) {
            this.ztBoardTimer = new ZtBoardTimer();
        };
        if (!this.rtpTimer) {
            this.rtpTimer = new RtpTimer();
        };
        if (!this.dailyAlarm) {
            this.dailyAlarm = new DailyAlarm();
        };
        if (!this.otpAlarm) {
            this.otpAlarm = new OtpAlarm();
        }
        this.setupQuoteAlarms();
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
                            this.loadAssets();
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
                var trcnt = 0;
                for (var i = 0; i < this.contentProxies.length && trcnt < 5; i++) {
                    this.contentProxies[i].triggerTask();
                    ++ trcnt;
                }
            };
            this.log('onContentLoaded', this.mainTab.url);
        } else {
            this.contentProxies.forEach(c => {
                if (c.tabid == tabid) {
                    c.pageLoaded();
                };
            });
        };
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
        for (var i = 0; i < this.contentProxies.length; i++) {
            if (!this.contentProxies[i].triggered) {
                this.contentProxies[i].triggerTask();
                break;
            }
        }
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
            
            this.remvoeProxy(tabid);
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.log('trade success', message.what);
                this.remvoeProxy(tabid);
            } else if (message.result == 'error') {
                this.log('trade error:', message.reason, message.what);
            }
        } else if (message.command == 'emjy.addwatch') {
            this.addWatchStock(message.account, message.code, message.strategies);
            this.log('content add watch stock', message.account, message.code);
        } else if (message.command == 'emjy.save') {
            this.normalAccount.save();
            this.collateralAccount.save();
            this.log('content message save');
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
                if (tid == this.manager.tabid) {
                    this.manager.onManagerMessage({command: 'mngr.closed'}, tid);
                }
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

    loadAssets() {
        this.scheduleTaskInNewTab({command: 'emjy.getAssets', path: this.normalAccount.assetsPath});
        this.scheduleTaskInNewTab({command: 'emjy.getAssets', path: this.creditAccount.assetsPath});
    }

    refreshAssets() {
        if (this.normalAccount.stocks.length > 0) {
            this.normalAccount.save();
        };
        if (this.collateralAccount.stocks.length > 0) {
            this.collateralAccount.save();
        };

        this.loadAssets();
    }

    checkAvailableMoney(price, account) {
        if (this.normalAccount.keyword == account) {
            this.normalAccount.checkAvailableMoney(price);
        } else if (this.collateralAccount.keyword == account) {
            this.collateralAccount.checkAvailableMoney(price);
        }
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

    setupQuoteAlarms() {
        chrome.alarms.onAlarm.addListener(alarmInfo =>  {
            this.onAlarm(alarmInfo);
        });
        var now = new Date();
        if (now.getDay() == 0 || now.getDay() == 6) {
            return;
        };

        var alarms = [
        {name:'morning-prestart', tick: new Date(now.toDateString() + ' 9:24:45').getTime()},
        {name:'morning-start', tick: new Date(now.toDateString() + ' 9:29:42').getTime()},
        {name:'morning-middle', tick: new Date(now.toDateString() + ' 10:15:55').getTime()},
        {name:'morning-end', tick: new Date(now.toDateString() + ' 11:30:3').getTime()},
        {name:'afternoon', tick: new Date(now.toDateString() + ' 12:59:5').getTime()},
        {name:'daily-preend', tick: new Date(now.toDateString() + ' 14:56:45').getTime()},
        {name:'afternoon-preend', tick: new Date(now.toDateString() + ' 14:59:38').getTime()},
        {name:'afternoon-end', tick: new Date(now.toDateString() + ' 15:0:10').getTime()}
        ];

        if (now >= alarms[alarms.length - 1].tick) {
            this.log('setupQuoteAlarms, time passed.');
            return;
        };

        for (var i = 0; i < alarms.length; i++) {
            if (now < alarms[i].tick) {
                this.log('setupQuoteAlarms', alarms[i].name);
                chrome.alarms.create(alarms[i].name, {when: alarms[i].tick});
            } else {
                this.log(alarms[i].name, 'expired, trigger now');
                this.onAlarm({name: alarms[i].name});
            };
        };
    }

    onAlarm(alarmInfo) {
        if (alarmInfo.name == 'morning-prestart') {
            this.ztBoardTimer.startTimer();
        } else if (alarmInfo.name == 'morning-start') {
            this.rtpTimer.startTimer();
            this.klineAlarms.startTimer();
            this.otpAlarm.onTimer();
        } else if (alarmInfo.name == 'morning-middle') {
            this.tradeDailyRoutineTasks();
            this.rtpTimer.setTick(10000);
        } else if (alarmInfo.name == 'morning-end') {
            this.rtpTimer.stopTimer();
            this.klineAlarms.stopTimer();
            this.ztBoardTimer.stopTimer();
        } else if (alarmInfo.name == 'afternoon') {
            this.refreshAssets();
            this.rtpTimer.startTimer();
            this.klineAlarms.startTimer();
            this.ztBoardTimer.startTimer();
        } else if (alarmInfo.name == 'daily-preend') {
            this.dailyAlarm.onTimer();
        } else if (alarmInfo.name == 'afternoon-preend') {
            this.tradeBeforeClose();
        } else if (alarmInfo.name == 'afternoon-end') {
            this.stopAllTimers();
            this.tradeClosed();
        };
    }

    startAllTimers() {
        this.ztBoardTimer.startTimer();
        this.rtpTimer.setTick(10000);
        this.rtpTimer.startTimer();
        this.klineAlarms.startTimer();
    }

    stopAllTimers() {
        this.ztBoardTimer.stopTimer();
        this.rtpTimer.stopTimer();
        this.klineAlarms.stopTimer();
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

    applyStrategy(account, code, str) {
        this.log('applyStrategy', account, code, JSON.stringify(str));
        if (account == this.normalAccount.keyword) {
            this.normalAccount.applyStrategy(code, str);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.applyStrategy(code, str);
        };
    }

    removeStockStrategy(account, code, stype) {
        if (account == this.normalAccount.keyword) {
            this.normalAccount.removeStrategy(code, stype);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.removeStrategy(code, stype);
        };
    }

    addWatchStock(account, code, str) {
        if (account == this.normalAccount.keyword) {
            this.normalAccount.addWatchStock(code);
            this.normalAccount.applyStrategy(code, str);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.addWatchStock(code);
            this.collateralAccount.applyStrategy(code, str);
        };
    }

    removeStock(account, code) {
        this.rtpTimer.removeStock(code);
        this.ztBoardTimer.removeStock(code);
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
            return '1';// 'HA';
        };
        if (market == 'SZ') {
            return '2'; // 'SA';
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
            proxy.url += '?code=' + task.stock.code;
            var market = this.getHSMarketFlag(task.stock.code);
            if (market != '') {
                proxy.url += '&mt=' + market;
            };
        };
        if (this.authencated && this.contentProxies.length < 5) {
            proxy.triggerTask();
        };
        this.contentProxies.push(proxy);
    }

    tradeBeforeClose() {
        this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
    }

    tradeClosed() {
        this.normalAccount.fillupGuardPrices();
        this.normalAccount.save();
        this.collateralAccount.fillupGuardPrices();
        this.collateralAccount.save();
        tradeAnalyzer.save();
        this.flushLogs();
    }

    flushLogs() {
        var blob = new Blob(this.logs, {type: 'application/text'});
        this.saveToFile(blob, 'stock.assist.log');
        this.logs = [];
    }

    exportConfig() {
        var configs = this.normalAccount.exportConfig();
        var colConfig = this.collateralAccount.exportConfig();
        for (var i in colConfig) {
            configs[i] = colConfig[i];
        };
        var blob = new Blob([JSON.stringify(configs)], {type: 'application/json'});
        this.saveToFile(blob, 'stocks.config.json');
    }

    importConfig(configs) {
        for (var i in configs) {
            var cfg = {};
            cfg[i] = configs[i];
            chrome.storage.local.set(cfg);
        };
        this.normalAccount.importConfig(configs);
        this.collateralAccount.importConfig(configs);
    }

    clearStorage() {
        chrome.storage.local.clear();
    }

    saveToFile(blob, filename, conflictAction = 'overwrite') {
        // conflictAction (uniquify, overwrite, prompt)
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({url, filename, saveAs:false, conflictAction});
    }

    listAllBuySellPrice() {
        for (var i = 0; i < this.normalAccount.stocks.length; i++) {
            var stocki = this.normalAccount.stocks[i];
            tradeAnalyzer.listAllBuySellPrice(stocki.klines.klines, stocki.code, stocki.name);
        }
        for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
            var stocki = this.collateralAccount.stocks[i];
            tradeAnalyzer.listAllBuySellPrice(stocki.klines.klines, stocki.code, stocki.name);
        }
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

    listAllBuySellPrice(stockKl, code, name) {
        var codes = new Set(['000858', '002460', '000401', '002041', '600862', '601600', '601101', '000998', '600546', '600918', '600276', '600031', '000630', '002241', '600010', '600089', '600150', '601016', '601117', '601601', '601800', '600905', '002847']);
        if (!codes.has(code)) {
            return;
        }
        for (var i in stockKl) {
            var afterbuy = false;
            var bcount = 0;
            var ecount = 0;
            var lcount = 0;
            var b = 0;
            var rec = [];
            var earned = 0;
            for (var j = 0; j < stockKl[i].length; j++) {
                if (stockKl[i][j].bss18 == 'b') {
                    afterbuy = true;
                    bcount ++;
                    b = stockKl[i][j].c;
                }
                if (stockKl[i][j].bss18 == 's' && afterbuy) {
                    var e = stockKl[i][j].c - b;
                    rec.push('b:' + b + ' s:' + stockKl[i][j].c + ' e:' + e.toFixed(2));
                    if (e > 0) {
                        ecount ++;
                    } else {
                        lcount ++;
                    }
                    earned += e * 100 / b;
                    afterbuy = false;
                }
            }

            console.log(name, 'kltype' + i, stockKl[i].length, 'b:', bcount, 'e', ecount, 'l', lcount, 'total', earned.toFixed(2));
        }
    }
}

let tradeAnalyzer = new TradingData();
