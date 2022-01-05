'use strict';
let emjyBack = null;
let NewStockPurchasePath = '/Trade/NewBatBuy';
let NewBondsPurchasePath = '/Trade/XzsgBatPurchase';

class ManagerBack {
    constructor() {
        this.tabid = null;
    }

    isValid() {
        return this.tabid != null;
    }

    onManagerMessage(message, tabid) {
        emjyBack.log('ManagerBack ', JSON.stringify(message), tabid);
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
            emjyBack.postQuoteWorkerMessage({command: 'quote.get.kline', code: message.code, date: message.date, len: message.len, market: emjyBack.getStockMarketHS(message.code)});
        } else if (message.command == 'mngr.saveFile') {
            emjyBack.saveToFile(message.blob, message.filename);
        };
    }

    sendManagerMessage(message) {
        if (this.isValid()) {
            chrome.tabs.sendMessage(this.tabid, message);
        } else {
            emjyBack.log('manager tab id is', this.tabid);
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
        this.klines = {};
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
        if ((new Date()).getDate() == 1) {
            if (!this.fetchingBKstocks) {
                this.fetchingBKstocks = new BkStocksFetch('BK0596', 1000);
            }
            this.log('update rzrq BK stcoks, BK0596');
            this.fetchingBKstocks.fetchBkStcoks();
        }
        this.normalAccount = new NormalAccount();
        this.collateralAccount = new CollateralAccount();
        this.creditAccount = new CreditAccount();
        this.trackAccount = new TrackingAccount();
        chrome.storage.local.get('hsj_stocks', item => {
            if (item && item['hsj_stocks']) {
                this.stockMarket = item['hsj_stocks'];
            }
            this.normalAccount.loadWatchings();
            this.collateralAccount.loadWatchings();
            this.trackAccount.loadAssets();
        });
        this.setupQuoteAlarms();
        this.log('EmjyBack initialized!');
    }

    setupRetroAccount() {
        this.retroAccount = new RetrospectAccount();
        this.retroAccount.loadAssets();
    }

    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
    }

    isLoginPage(pathname) {
        return pathname == '/Login' || pathname == '/Login/ExitIframe';
    }

    onContentLoaded(message, tabid) {
        if (!this.mainTab) {
            this.log('init mainTabId and accounts');
            this.mainTab = new CommanderBase();
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
                            this.authencated = !this.isLoginPage(url.pathname);
                            if (this.authencated && !this.validateKey) {
                                this.sendMsgToMainTabContent({command:'emjy.getValidateKey'});
                            }
                        };
                    });
                }, 200);
            });
            return;
        };

        if (tabid == this.mainTab.tabid) {
            this.mainTab.url = message.url;
            chrome.tabs.executeScript(this.mainTab.tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
            var url = new URL(this.mainTab.url);
            this.authencated = !this.isLoginPage(url.pathname);
            if (this.authencated && !this.validateKey) {
                this.sendMsgToMainTabContent({command:'emjy.getValidateKey'});
            }
            if (this.contentProxies.length > 0 && this.authencated) {
                for (var i = 0; i < this.contentProxies.length; i++) {
                    this.contentProxies[i].triggerTask();
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
    sendMsgToMainTabContent(data) {
        var url = new URL(this.mainTab.url);
        if (!this.mainTab.tabid || url.host != 'jywg.18.cn') {
            return;
        }

        if (url.pathname == '/Login' || !this.authencated) {
            this.log('not sendMsgToMainTabContent', url.pathname, this.authencated);
            return;
        }

        chrome.tabs.sendMessage(this.mainTab.tabid, data);
        this.log('sendMsgToMainTabContent', JSON.stringify(data));
    }

    onContentMessageReceived(message, tabid) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('background not initialized');
            return;
        }

        this.log('onContentMessageReceived', tabid);
        if (message.command == 'emjy.getValidateKey') {
            this.log('getValidateKey =', message.key);
            this.validateKey = message.key;
            this.loadAssets();
        } else if (message.command == 'emjy.trade') {
            this.log('trade message: result =', message.result, ', what =', message.what);
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
            this.manager = new ManagerBack();
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
            message.command = 'mngr.getkline';
            this.manager.sendManagerMessage(message);
        } else if (message.command == 'quote.kline.rt') {
            this.updateStockRtKline(message);
        } else if (message.command == 'quote.get.bkcode') {
            if (this.fetchingBKstocks) {
                this.fetchingBKstocks.updateBkStocks(message);
            }
        }
    }

    loadAssets() {
        this.normalAccount.loadAssets();
        this.collateralAccount.loadAssets(assets=> {this.creditAccount.onAssetsLoaded(assets);});
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

    loadDeals() {
        this.normalAccount.loadDeals();
        this.collateralAccount.loadDeals();
    }

    updateHistDeals() {
        chrome.storage.local.get('hist_deals', item => {
            var startDate = null;
            if (item && item['hist_deals']) {
                this.savedDeals = item['hist_deals'];
                if (this.savedDeals && this.savedDeals.length > 0) {
                    startDate = new Date(this.savedDeals[this.savedDeals.length - 1].time);
                    startDate.setDate(startDate.getDate() + 1);
                }
            }
            this.normalAccount.loadHistDeals(startDate, deals => {this.addHistDeals(deals);});
            this.collateralAccount.loadHistDeals(startDate, deals => {this.addHistDeals(deals);});
        });
    }

    getDealTime(cjrq, cjsj) {
        var date = cjrq.slice(0, 4) + "-" + cjrq.slice(4, 6) + "-" + cjrq.slice(6, 8);
        if (cjsj.length != 6) {
            return date + ' 0:0';
        }
        return date + ' ' + cjsj.slice(0, 2) + ':' + cjsj.slice(2, 4) + ':' + cjsj.slice(4, 6);
    }
// {
//     "Cjrq": "20210629", 成交日期
//     "Cjsj": "143048", 成交时间
//     "Zqdm": "600905", 证券代码
//     "Zqmc": "三峡能源", 证券名称
//     "Mmsm": "证券卖出", 买卖说明
//     "Cjsl": "10000", 成交数量
//     "Cjjg": "6.620", 成交价格
//     "Cjje": "66200.00", 成交金额
//     "Sxf": "16.55", 手续费
//     "Yhs": "66.20", 印花税
//     "Ghf": "1.32", 过户费
//     "Zjye": "66682.05", 资金余额
//     "Gfye": "26700", 股份余额
//     "Market": "HA",
//     "Cjbh": "24376386", 成交编号
//     "Wtbh": "319719", 委托编号
//     "Gddm": "E062854229", 股东代码
//     "Dwc": "",
//     "Xyjylx": "卖出担保品" 交易类型
// }
    addHistDeals(deals) {
        var fetchedDeals = [];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (deali.Mmsm == '担保品划入' || deali.Mmsm == '担保品划出' || deali.Mmsm == '融券') {
                continue;
            }

            var tradeType = '';
            if (deali.Mmsm == '证券卖出') {
                tradeType = 'S';
            } else if (deali.Mmsm == '证券买入' || deali.Mmsm == '配售申购' || deali.Mmsm == '配股缴款' || deali.Mmsm == '网上认购') {
                tradeType = 'B';
            } else {
                console.log('unknown trade type', deali.Mmsm, deali);
                continue;
            }
            var code = deali.Zqdm;
            var time = this.getDealTime(deali.Cjrq, deali.Cjsj);
            var count = deali.Cjsl;
            var price = deali.Cjjg;
            var fee = deali.Sxf;
            var feeYh = deali.Yhs;
            var feeGh = deali.Ghf;
            var sid = deali.Wtbh;
            fetchedDeals.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
        }

        fetchedDeals.reverse();
        if (!this.savedDeals || this.savedDeals.length == 0) {
            this.savedDeals = fetchedDeals;
        } else {
            for (let i = 0; i < fetchedDeals.length; i++) {
                const deali = fetchedDeals[i];
                if (!this.savedDeals.find(d => d.time == deali.time && d.code == deali.code && d.sid == deali.sid)) {
                    this.savedDeals.push(deali);
                }
            }
            this.savedDeals.sort((a, b) => a.time > b.time);
        }
        chrome.storage.local.set({'hist_deals': this.savedDeals});
        console.log(this.savedDeals);
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
            } else if (account == this.trackAccount.keyword) {
                sellAccount = this.trackAccount;
            } else if (this.retroAccount && account == this.retroAccount.keyword) {
                sellAccount = this.retroAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        sellAccount.sellStock(code, price, count);
    }

    tryBuyStock(code, price, count, account, cb) {
        var buyAccount = this.normalAccount;
        if (account) {
            if (account == this.normalAccount.keyword) {
                buyAccount = this.normalAccount;
            } else if (account == this.collateralAccount.keyword) {
                buyAccount = this.collateralAccount;
            } else if (account == this.creditAccount.keyword) {
                buyAccount = this.creditAccount;
            } else if (account == this.trackAccount.keyword) {
                buyAccount = this.trackAccount;
            } else if (this.retroAccount && account == this.retroAccount.keyword) {
                buyAccount = this.retroAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        buyAccount.buyStock(code, price, count, cb);
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
        {name:'morning-otp', tick: new Date(now.toDateString() + ' 9:30:01').getTime()},
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
        } else if (alarmInfo.name == 'morning-otp') {
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
        var mkt = sdata.market == 'SH' ? 1 : 0;
        this.stockMarket[sdata.code] = {name:sdata.name, mkt};
        this.marketInfoUpdated = true;
    }

    updateStockRtPrice(snapshot) {
        //this.log('updateStockRtPrice', JSON.stringify(snapshot));
        this.normalAccount.updateStockRtPrice(snapshot);
        this.collateralAccount.updateStockRtPrice(snapshot);
        this.ztBoardTimer.updateStockRtPrice(snapshot);
        this.trackAccount.updateStockRtKline(snapshot);
    }

    isTradeTime() {
        var now = new Date();
        if (now > new Date(now.toDateString() + ' 9:30') && now < new Date(now.toDateString() + ' 15:00')) {
            return true;
        }
        return false;
    }

    loadKlines(code, cb) {
        if (!this.klines[code]) {
            this.klines[code] = new KLine(code);
            this.klines[code].loadSaved(cb);
        } else {
            if (typeof(cb) === 'function') {
                cb();
            }
        }
    }

    updateStockRtKline(message) {
        var code = message.kline.data.code;
        var updatedKlt = this.klines[code].updateRtKline(message);
        if (!this.isTradeTime()) {
            return;
        }
        this.normalAccount.updateStockRtKline(code, updatedKlt);
        this.collateralAccount.updateStockRtKline(code, updatedKlt);
        this.trackAccount.updateStockRtKline(code, updatedKlt);
        if (this.retroAccount) {
            this.retroAccount.updateStockRtKline(code, updatedKlt);
        }
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
            this.normalAccount.addWatchStock(code, str);
        } else if (account == this.collateralAccount.keyword) {
            this.collateralAccount.addWatchStock(code, str);
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

    getStockMarketHS(code) {
        var stk = this.stockMarket[code];
        if (!stk) {
            return (code.startsWith('00') || code.startsWith('30')) ? 'SZ' : 'SH';
        }
        return stk.mkt == '0' ? 'SZ' : 'SH';
    }

    fetchStockKline(code, kltype, sdate) {
        this.postQuoteWorkerMessage({command:'quote.kline.rt', code, kltype, market: this.getStockMarketHS(code), sdate});
    }

    tradeDailyRoutineTasks() {
        var nsClient = new NewStocksClient(this.validateKey);
        nsClient.buy();
        var nbClient = new NewBondsClient(this.validateKey);
        nbClient.buy();
    }

    getHSMarketFlag(code) {
        var market = this.getStockMarketHS(code);
        if (market == 'SH') {
            return '1';// 'HA';
        };
        if (market == 'SZ') {
            return '2'; // 'SA';
        };
        return '';
    }

    fetchAllStocksMktInfo() {
        this.fetchingBKstocks = new BkStocksMarketFetch();
        this.fetchingBKstocks.fetchBkStcoks();
        this.log('fetch all stock market info!');
    }

    scheduleNewTabCommand(command) {
        if (this.authencated) {
            command.triggerTask();
        };
        this.contentProxies.push(command);
    }

    tradeBeforeClose() {
        this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
    }

    tradeClosed() {
        this.normalAccount.buyFundBeforeClose();
        this.loadDeals();
        this.normalAccount.fillupGuardPrices();
        this.collateralAccount.fillupGuardPrices();
        if ((new Date()).getDate() == 2) {
            this.fetchAllStocksMktInfo();
        }
        if (this.marketInfoUpdated) {
            chrome.storage.local.set({'hsj_stocks': this.stockMarket});
        }
        var s101 = new Set();
        this.dailyAlarm.stocks['101'].forEach(s => s101.add(s));
        this.dailyAlarm.stocks['15'].forEach(s => s101.add(s));
        this.klineAlarms.stocks['15'].forEach(s => s101.add(s));
        this.klineAlarms.stocks['101'].forEach(s => s101.add(s));
        s101.forEach(s => {this.fetchStockKline(s, '101')});
        setTimeout(()=> {
            this.normalAccount.save();
            this.collateralAccount.save();
            this.trackAccount.save();
            for (const c in this.klines) {
                this.klines[c].save();
            }
            this.flushLogs();
        }, 20000);
    }

    getTodayDate(sep = '') {
        var dt = new Date();
        return dt.getFullYear() + sep + ('' + (dt.getMonth() + 1)).padStart(2, '0') + sep + ('' + dt.getDate()).padStart(2, '0');
    }

    flushLogs() {
        var blob = new Blob(this.logs, {type: 'application/text'});
        this.saveToFile(blob, 'logs/stock.assist' + this.getTodayDate() + '.log');
        this.logs = [];
    }

    exportConfig() {
        var configs = this.normalAccount.exportConfig();
        var colConfig = this.collateralAccount.exportConfig();
        for (var i in colConfig) {
            configs[i] = colConfig[i];
        };
        var trackConfig = this.trackAccount.exportConfig();
        for (var i in trackConfig) {
            configs[i] = trackConfig[i];
        }
        chrome.storage.local.get(['ztstocks','ztdels', 'hist_deals'], item => {
            if (item) {
                configs['ztstocks'] = item['ztstocks'];
                configs['ztdels'] = item['ztdels'];
                configs['hist_deals'] = item['hist_deals'];
            }
            var blob = new Blob([JSON.stringify(configs)], {type: 'application/json'});
            this.saveToFile(blob, 'stocks.config.json');
        });
    }

    importConfig(configs) {
        for (var i in configs) {
            var cfg = {};
            cfg[i] = configs[i];
            chrome.storage.local.set(cfg);
        };
        this.normalAccount.importConfig(configs);
        this.collateralAccount.importConfig(configs);
        this.trackAccount.importConfig(configs);
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
            tradeAnalyzer.listAllBuySellPrice(emjyBack.klines[stocki.code].klines, stocki.code, stocki.name);
        }
        for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
            var stocki = this.collateralAccount.stocks[i];
            tradeAnalyzer.listAllBuySellPrice(emjyBack.klines[stocki.code].klines, stocki.code, stocki.name);
        }
    }

    retro(code) {
        if (!this.retroEngine) {
            this.retroEngine = new RetroEngine();
        }
        if (!this.retroAccount) {
            this.setupRetroAccount();
        }
        if (code) {
            this.retroEngine.initRetro(code, {"grptype":"GroupStandard","strategies":{"0":{"key":"StrategyMA","enabled":true, kltype:'101'}},"amount":10000}, '2021-01-04');
        }
    }
}

class BkStocksFetch {
    constructor(bk, pz) {
        this.bk = 'b:' + bk;
        this.pn = 1;
        this.pz = pz;
        this.stocks = new Set();
    }

    fetchBkStcoks() {
        emjyBack.postQuoteWorkerMessage({command:'quote.get.bkcode', bk: this.bk, pn: this.pn, pz: this.pz});
    }

    updateBkStocks(message) {
        for (var i in message.data) {
            var code = message.data[i].f12;
            this.stocks.add(code);
        }

        if (this.stocks.size != message.total) {
            this.pn++;
            this.fetchBkStcoks();
            return;
        }

        var bkstocks = {};
        bkstocks['bkstocks_' + this.bk] = [...this.stocks];
        chrome.storage.local.set(bkstocks);
    }
}

class BkStocksMarketFetch extends BkStocksFetch {
    constructor(pz = 1000) {
        super('', pz);
        this.bk = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
        this.stockDetails = {};
    }

    updateBkStocks(message) {
        for (var i in message.data) {
            var code = message.data[i].f12;
            var name = message.data[i].f14;
            var mkt = message.data[i].f13;
            if (!this.stocks.has(code)) {
                this.stocks.add(code);
                this.stockDetails[code] = {name, mkt};
            }
        }

        if (this.stocks.size != message.total) {
            this.pn++;
            this.fetchBkStcoks();
            return;
        }

        var bkstocks = {};
        bkstocks['hsj_stocks'] = this.stockDetails;
        chrome.storage.local.set(bkstocks);
        emjyBack.stockMarket = this.stockDetails;
    }
}
