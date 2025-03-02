'use strict';
let emjyBack = null;
if (navigator.userAgent.includes('Firefox')) {
    chrome = browser;
}

let mktDict = {'SH': 1, 'SZ': 0, 'BJ': 4}
let holdAccountKey = {'credit': 'collat', 'collat': 'collat', 'normal': 'normal'};


class ManagerBack {
    constructor() {
        this.tabid = null;
        this.mgrChangedTimeout = null;
    }

    isValid() {
        return this.tabid != null;
    }

    startChangedTimeout() {
        if (this.mgrChangedTimeout) {
            clearTimeout(this.mgrChangedTimeout);
        }

        this.mgrChangedTimeout = setTimeout(() => {
            this.notifyMgrSave();
        }, 300000);
    }

    notifyMgrSave() {
        if (!this.mgrChangedTimeout) {
            return;
        }
        emjyBack.normalAccount.save();
        emjyBack.collateralAccount.save();
        for (const account of emjyBack.track_accounts) {
            account.save();
        }
        if (emjyBack.mgrFetched) {
            emjyBack.mgrFetched.forEach(c => {
                emjyBack.klines[c].save();
            });
            delete(emjyBack.mgrFetched)
        }
        if (emjyBack.costDog) {
            emjyBack.costDog.save();
        }
        clearTimeout(this.mgrChangedTimeout);
        emjyBack.log('manager saved');
        this.mgrChangedTimeout = null;
    }

    onManagerMessage(message, tabid) {
        emjyBack.log('ManagerBack ', JSON.stringify(message), tabid);
        if (message.command == 'mngr.init') {
            this.tabid = tabid;
        } else if (message.command == 'mngr.initaccstk') {
            this.sendStocks([emjyBack.all_accounts[message.account]]);
        } else if (message.command == 'mngr.closed') {
            this.notifyMgrSave();
            this.tabid = null;
        } else if (message.command == 'mngr.export') {
            emjyBack.exportConfig();
        } else if (message.command == 'mngr.import') {
            emjyBack.importConfig(message.config);
        } else if (message.command == 'mngr.strategy') {
            emjyBack.all_accounts[message.account].applyStrategy(message.code, message.strategies);
            this.startChangedTimeout();
        } else if (message.command =='mngr.strategy.rmv') {
            emjyBack.all_accounts[message.account].removeStrategy(message.code, message.stype);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.addwatch') {
            emjyBack.all_accounts[message.account].addWatchStock(message.code, message.strategies);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.rmwatch') {
            emjyBack.removeStock(message.account, message.code);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.checkrzrq') {
            emjyBack.checkRzrq(message.code).then(rzrq => {
                this.sendManagerMessage({command:'mngr.checkrzrq', rzrq});
            });
        } else if (message.command == 'mngr.getkline') {
            feng.getStockKline(message.code, '101', message.date).then(kline => {
                this.sendManagerMessage({command:'mngr.getkline', code: message.code, klines: emjyBack.klines[message.code].klines['101']});
            });
        } else if (message.command == 'mngr.saveFile') {
            emjyBack.saveToFile(message.blob, message.filename);
        } else if (message.command == 'mngr.costdog') {
            this.sendManagerMessage({command:'mngr.costdog', 'costdog': Object.values(emjyBack.costDog.dogdic)});
        } else if (message.command === 'mngr.costdog.add') {
            var cdo = message.cdo;
            emjyBack.costDog.dogdic[cdo.key] = cdo;
            this.startChangedTimeout();
        } else if (message.command === 'mngr.costdog.delete') {
            delete(emjyBack.costDog.dogdic[message.cikey]);
            this.startChangedTimeout();
        } else if (message.command === 'mngr.costdog.changed') {
            var cdo = message.cdo;
            for (const c of ['amount', 'max_amount', 'expect_earn_rate']) {
                emjyBack.costDog.dogdic[cdo.key][c] = cdo[c];
            }
            this.startChangedTimeout();
        }
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

    sendKline(code, klines) {
        this.sendManagerMessage({command:'mngr.initkline', code, klines});
    }
}

class EmjyBack {
    constructor() {
        this.jywghost = 'jywg.eastmoneysec.com';
        this.jywgroot = 'https://' + this.jywghost + '/';
        this.mainTab = null;
        this.authencated = false;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.manager = null;
        this.klines = {};
        this.fha = null;
    }

    log(...args) {
        var l = `[${new Date().toLocaleTimeString('zh',{hour12:false})}] ${args.join(' ')}`;
        this.logs.push(l + '\n');
        console.log(l);
    }

    Init() {
        this.logs = [];
        this.strategyManager = new StrategyManager();
        this.normalAccount = new NormalAccount();
        this.collateralAccount = new CollateralAccount();
        this.creditAccount = new CreditAccount();
        this.all_accounts = {};
        this.all_accounts[this.normalAccount.keyword] = this.normalAccount;
        this.all_accounts[this.collateralAccount.keyword] = this.collateralAccount;
        this.all_accounts[this.creditAccount.keyword] = this.creditAccount;
        this.getFromLocal('fha_server').then(fhaInfo => {
            if (fhaInfo) {
                this.fha = fhaInfo;
                this.setupWebsocketConnection();
            }
        }).then(() => {
            this.getFromLocal('hsj_stocks').then(hsj => {
                if (hsj) {
                    feng.loadSaved(hsj);
                }
                this.normalAccount.loadWatchings();
                this.collateralAccount.loadWatchings();
                this.initTrackAccounts();
            });
            this.getFromLocal('smilist').then(smi => {
                if (smi) {
                    this.smiList = smi;
                }
            });
            this.getFromLocal('purchase_new_stocks').then(pns => {
                this.purchaseNewStocks = pns;
            });
            this.getFromLocal('cost_dog').then(cd => {
                this.costDog = new CostDog(cd);
            });
            alarmHub.setupAlarms();
            istrManager.initExtStrs();
            this.log('EmjyBack initialized!');
        });
    }

    initTrackAccounts() {
        this.track_accounts = [];
        this.getFromLocal('track_accounts').then(accs => {
            if (!accs || Object.keys(accs).length === 0) {
                this.track_accounts.push(new TrackingAccount('track'));
            } else {
                for (let ac in accs) {
                    this.track_accounts.push(new TrackingAccount(ac));
                }
            }
            this.trackAccount = this.track_accounts[0];
            for (const account of this.track_accounts) {
                this.all_accounts[account.keyword] = account;
                holdAccountKey[account.keyword] = account.keyword;
                account.loadAssets();
            }
        });
    }

    setupWebsocketConnection() {
        var wsurl = new URL(this.fha.server);
        wsurl.protocol = 'ws';
        wsurl.port = '1792'
        this.websocket = new WebSocket(wsurl.href);
        this.websocket.onmessage = wsmsg => {
            this.onWebsocketMessageReceived(wsmsg);
        }
        this.websocket.onopen = () => {
            this.sendWebsocketMessage({ action: 'initialize'});
        }
        this.websocket.onclose = (cevt) => {
            this.log('websocket closed with code: ' + cevt.code + ' reason: ' + cevt.reason);
            this.setupWebsocketConnection();
        }
        this.websocket.onerror = err => {
            this.log('websocket error! ');
            this.setupWebsocketConnection();
        }
    }

    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
    }

    isLoginPage(hurl) {
        var url = new URL(hurl);
        return url.pathname == '/Login' || url.pathname == '/Login/ExitIframe';
    }

    startup() {
        chrome.tabs.query({}, tabs => {
            let emtab = null;
            for (var tab of tabs) {
                var url = new URL(tab.url);
                if (url.host == this.jywghost) {
                    emtab = tab;
                    break;
                }
            }
            emjyBack.InitMainTab(emtab);
        });
        this.Init();
    }

    InitMainTab(tab) {
        this.getFromLocal('acc_np').then(anp => {
            this.unp = anp;
            if (!tab) {
                var url = this.unp.credit ? this.jywgroot + 'MarginTrade/Buy': this.jywgroot + 'Trade/Buy';
                chrome.tabs.create({url}).then(ctab => this.mainTab = ctab);
            } else {
                chrome.tabs.reload(tab.id, { bypassCache: true }).then(() => this.mainTab = tab);
            }
        });
    }

    onContentLoaded(message, tabid, response) {
        if (!this.mainTab || this.mainTab.id != tabid) {
            this.log('onContentLoaded response false', tabid, JSON.stringify(this.mainTab));
            response(false);
            return;
        };

        this.mainTab.url = message.url;
        chrome.tabs.executeScript(this.mainTab.tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
        this.log('onContentLoaded', this.mainTab.url);
        response(true);
    }

    sendLoginInfo() {
        if (this.unp) {
            this.sendMessageToContent({command:'emjy.loginnp', np: this.unp});
            return;
        }

        this.getFromLocal('acc_np').then(anp => {
            this.unp = anp;
            this.sendLoginInfo();
        });
    }

    sendPendingMessages() {
        var url = new URL(this.mainTab.url);
        if (!this.mainTab.id || url.host != this.jywghost) {
            this.pendingTimeout = setTimeout(() => {
                this.sendPendingMessages();
            }, 300);
            return;
        }
        if (this.pendingContentMsgs && this.pendingContentMsgs.length > 0) {
            this.pendingContentMsgs.forEach(m => {
                chrome.tabs.sendMessage(this.mainTab.id, m);
                this.log('sendMsgToMainTabContent pending', JSON.stringify(m));
            });
            clearTimeout(this.pendingTimeout);
            delete(this.pendingTimeout);
            delete(this.pendingContentMsgs);
        }
    }

    insertPendingMessage(data) {
        if (!this.pendingContentMsgs) {
            this.pendingContentMsgs = [];
        }
        const uniqueCommands = ['emjy.loginnp', 'emjy.captcha'];
        if (!uniqueCommands.includes(data.command)) {
            this.pendingContentMsgs.push(data);
            return;
        }
        var cidx = this.pendingContentMsgs.findIndex(x => x.command == data.command);
        if (cidx > 0) {
            this.pendingContentMsgs[cidx] = data;
        } else {
            this.pendingContentMsgs.push(data);
        }
    }

    sendMessageToContent(data) {
        if (!this.mainTab || !this.mainTab.id || (new URL(this.mainTab.url)).host != this.jywghost) {
            this.insertPendingMessage(data);
            if (this.pendingTimeout) {
                clearTimeout(this.pendingTimeout);
            }
            this.pendingTimeout = setTimeout(() => {
                this.sendPendingMessages();
            }, 300);
            return;
        }

        if (!this.pendingTimeout) {
            this.sendPendingMessages();
        }
        chrome.tabs.sendMessage(this.mainTab.id, data);
        this.log('sendMsgToMainTabContent', JSON.stringify(data));
    }

    onContentMessageReceived(message, tabid) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('background not initialized');
            return;
        }

        this.log('onContentMessageReceived', tabid);
        if (message.command == 'emjy.getValidateKey') {
            chrome.tabs.executeScript(tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
            if (this.validateKey == message.key) {
                this.log('getValidateKey same, skip!');
                return;
            }
            this.log('getValidateKey =', message.key);
            this.validateKey = message.key;
            this.loadAssets();
            if ((new Date()).getDay() == 1 && (new Date()).getHours() <= 9) {
                // update history deals every Monday morning.
                this.updateHistDeals();
            }
        } else if (message.command == 'emjy.captcha') {
            this.recoginzeCaptcha(message.img);
        } else if (message.command == 'emjy.loginnp') {
            this.sendLoginInfo();
        } else if (message.command == 'emjy.trade') {
            this.log('trade message: result =', message.result, ', what =', message.what);
        } else if (message.command == 'emjy.addwatch') {
            this.all_accounts[message.account].addWatchStock(message.code, message.strategies);
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
                for (var c in this.klines) {
                    this.manager.sendKline(c, this.klines[c].klines);
                }
                this.manager.sendStocks([this.normalAccount]);
            }
            chrome.tabs.onRemoved.addListener((tid, removeInfo) => {
                if (tid == this.manager.tabid) {
                    this.manager.onManagerMessage({command: 'mngr.closed'}, tid);
                }
            });
        }
    }

    onPopupMessageReceived(message, sender, popcb) {
        if (message.command === 'popup.costdogs') {
            popcb(this.costDog.dogdic);
        } else if (message.command === 'popup.buystock') {
            let code = message.code;
            let price = message.price;
            let amount = message.amount;
            let strategies = message.strategies;
            let count = strategies?.uramount?.key ? this.costDog.urBuyCount(strategies.uramount.key, code, amount, price).count : guang.calcBuyCount(amount, price);
            let account = message.account;
            if (!account) {
                popcb(this.checkRzrq(message.code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    return this.buyWithAccount(code, price, count, racc, strategies);
                }));
            } else {
                popcb(this.buyWithAccount(code, price, count, account, strategies));
            }
        } else if (message.command === 'popup.addwatch') {
            this.log('popup message popup.addwatch');
            let code = message.code;
            let amount = message.amount;
            let strategies = message.strategies;
            let account = message.account;
            let str0 = {"key":strategies.key,"enabled":true, account};
            if (!account) {
                this.checkRzrq(code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    var hacc = holdAccountKey[racc];
                    str0.account = racc;
                    let bstrs = {
                        "grptype":"GroupStandard","transfers":{"0":{"transfer":"-1"}},
                        "strategies":{"0":str0},amount,"uramount":{"key":strategies?.uramount?.key}
                    };
                    this.all_accounts[hacc].addWatchStock(code, bstrs);
                });
            } else {
                let bstrs = {
                    "grptype":"GroupStandard","transfers":{"0":{"transfer":"-1"}},
                    "strategies":{"0":str0},amount,"uramount":{"key":strategies?.uramount?.key}};
                this.all_accounts[account].addWatchStock(code, bstrs);
            }
        }
    }

    sendWebsocketMessage(message) {
        if (this.websocket) {
            this.websocket.send(JSON.stringify(message));
        } else {
            this.log('error websocket not setup');
        }
    }

    onWebsocketMessageReceived(message) {
        var wsmsg = JSON.parse(message.data);
        if (wsmsg.type === 'str_available') {
            var str_available = wsmsg.strategies;
            var keys_received = [];
            for (const strategy of str_available) {
                keys_received.push(strategy.key);
            }
            emjyBack.getFromLocal('all_available_istr').then(all_str => {
                var keys_saved = [];
                for (const strategy of all_str) {
                    keys_saved.push(strategy.key);
                }
                var all_saved = true;
                for (const rkey of keys_received) {
                    if (!keys_saved.includes(rkey)) {
                        all_saved = false;
                        break;
                    }
                }
                if (keys_received.length != keys_saved.length || !all_saved) {
                    this.saveToLocal({'all_available_istr': str_available});
                }
                for (const rkey of keys_saved) {
                    if (!keys_received.includes(rkey)) {
                        this.removeLocal('itstrategy_' + rkey);
                    }
                }
                for (const rkey of keys_received) {
                    emjyBack.getFromLocal('itstrategy_' + rkey).then(istr => {
                        if (istr && istr.enabled) {
                            var subjson = {action: 'subscribe', strategy: istr.key, account: istr.account, amount: istr.amount};
                            if (istr.amtkey) {
                                subjson.amtkey = istr.amtkey;
                            }
                            emjyBack.sendWebsocketMessage(subjson);
                        }
                    });
                }
            });
            return;
        }
        if (wsmsg.type == 'intrade_buy') {
            this.log(message.data);
            this.log(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account);
            if (!wsmsg.account) {
                this.checkRzrq(wsmsg.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'credit';
                    this.buyWithAccount(wsmsg.code, wsmsg.price, wsmsg.count, account, wsmsg.strategies);
                });
            } else {
                this.buyWithAccount(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account, wsmsg.strategies);
            }
            return;
        }
        if (wsmsg.type == 'intrade_addwatch') {
            this.log(message.data);
            if (!wsmsg.account) {
                this.checkRzrq(message.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'collat';
                    this.all_accounts[account].addWatchStock(wsmsg.code, wsmsg.strategies);
                });
            } else {
                this.all_accounts[wsmsg.account].addWatchStock(wsmsg.code, wsmsg.strategies);
            }
            return;
        }
        console.log(wsmsg);
    }

    loadAssets() {
        this.normalAccount.loadAssets();
        this.collateralAccount.loadAssets();
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
        this.getFromLocal('hist_deals').then(hdl => {
            var startDate = null;
            if (hdl) {
                this.savedDeals = hdl;
                if (this.savedDeals && this.savedDeals.length > 0) {
                    startDate = new Date(this.savedDeals[this.savedDeals.length - 1].time);
                    startDate.setDate(startDate.getDate() + 1);
                } else {
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 10);
                }
            }
            this.doUpdateHistDeals(startDate);
            this.loadOtherDeals(startDate);
        });
    }

    doUpdateHistDeals(date) {
        var startDate = date;
        if (typeof(date) === 'string') {
            startDate = new Date(date.split('-'));
        }
        this.normalAccount.loadHistDeals(startDate).then(deals => {this.addHistDeals(deals);});
        this.collateralAccount.loadHistDeals(startDate).then(deals => {this.addHistDeals(deals);});
    }

    loadOtherDeals(date) {
        var startDate = date;
        if (typeof(startDate) === 'string') {
            startDate = new Date(date.split('-'));
        }
        this.normalAccount.loadOtherDeals(startDate).then(deals => {this.addOtherDeals(deals)});
        this.collateralAccount.loadOtherDeals(startDate).then(deals => {this.addOtherDeals(deals)});
    }

    getDealTime(cjrq, cjsj) {
        var date = cjrq.slice(0, 4) + "-" + cjrq.slice(4, 6) + "-" + cjrq.slice(6, 8);
        if (cjsj.length == 8) {
            cjsj = cjsj.substring(0, 6);
        }
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
//     "Xyjylx": "卖出担保品" 信用交易类型
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
                this.log('unknown trade type', deali.Mmsm, JSON.stringify(deali));
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
            if (count - 0 <= 0) {
                this.log('invalid count', deali);
                continue;
            }
            fetchedDeals.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
        }

        fetchedDeals.reverse();
        var uptosvrDeals = [];
        if (!this.savedDeals || this.savedDeals.length == 0) {
            this.savedDeals = fetchedDeals;
            uptosvrDeals = fetchedDeals;
        } else {
            for (let i = 0; i < fetchedDeals.length; i++) {
                const deali = fetchedDeals[i];
                if (!this.savedDeals.find(d => d.time == deali.time && d.code == deali.code && d.sid == deali.sid)) {
                    this.savedDeals.push(deali);
                    uptosvrDeals.push(deali);
                }
            }
            this.savedDeals.sort((a, b) => a.time > b.time);
        }
        chrome.storage.local.set({'hist_deals': this.savedDeals});
        this.uploadDeals(uptosvrDeals);
        this.clearCompletedDeals();
    }

    mergeCumDeals(deals) {
        // 合并时间相同的融资利息
        var tdeals = {};
        deals.forEach(d => {
            if (Object.keys(tdeals).includes(d.time)) {
                tdeals[d.time].price += parseFloat(d.price);
            } else {
                tdeals[d.time] = d;
                tdeals[d.time].price = parseFloat(d.price);
            }
        });
        return Object.values(tdeals);
    }

    addOtherDeals(deals) {
        var fetchedDeals = [];
        var dealsTobeCum = [];
        var ignoredSm = ['融资买入', '融资借入', '偿还融资负债本金', '担保品卖出', '担保品买入', '担保物转入', '担保物转出', '融券回购', '融券购回', '证券卖出', '证券买入', '股份转出', '股份转入', '配股权证', '配股缴款']
        var otherBuySm = ['红股入账', '配股入帐'];
        var otherSellSm = [];
        var otherSm = ['配售缴款', '新股入帐', '股息红利差异扣税', '偿还融资利息', '偿还融资逾期利息', '红利入账', '银行转证券', '证券转银行', '利息归本'];
        var fsjeSm = ['股息红利差异扣税', '偿还融资利息', '偿还融资逾期利息', '红利入账', '银行转证券', '证券转银行', '利息归本'];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            var sm = deali.Ywsm;
            if (ignoredSm.includes(sm)) {
                continue;
            }
            var tradeType = '';
            if (otherBuySm.includes(sm)) {
                tradeType = 'B';
            } else if (otherSellSm.includes(sm)) {
                tradeType = 'S';
            } else if (otherSm.includes(sm)) {
                this.log(JSON.stringify(deali));
                tradeType = sm;
                if (sm == '股息红利差异扣税') {
                    tradeType = '扣税';
                }
                if (sm == '偿还融资利息' || sm == '偿还融资逾期利息') {
                    tradeType = '融资利息';
                }
            } else {
                this.log('unknow deals', sm, JSON.stringify(deali));
                continue;
            }
            var code = deali.Zqdm;
            var time = this.getDealTime(
                deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,
                deali.Fssj === undefined || deali.Fssj == '0' ? deali.Cjsj : deali.Fssj);
            if (sm == '红利入账' && time.endsWith('0:0')) {
                time = this.getDealTime(deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,'150000');
            }
            var count = deali.Cjsl;
            var price = deali.Cjjg;
            if (fsjeSm.includes(sm)) {
                count = 1;
                price = deali.Fsje;
            }
            var fee = deali.Sxf;
            var feeYh = deali.Yhs;
            var feeGh = deali.Ghf;
            var sid = deali.Htbh;
            if (sm == '配股入帐' && sid == '') {
                continue;
            }
            if (tradeType == '融资利息') {
                dealsTobeCum.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
            } else {
                fetchedDeals.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
            }
        }
        fetchedDeals.reverse();
        if (dealsTobeCum.length > 0) {
            var ndeals = this.mergeCumDeals(dealsTobeCum);
            ndeals.forEach(d => {
                fetchedDeals.push(d);
            });
        }

        this.uploadDeals(fetchedDeals);
    }

    uploadTodayDeals(deals) {
        var fetchedDeals = [];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (deali.Wtzt != '已成' && deali.Wtzt != '部撤') {
                emjyBack.log('uploadTodayDeals unknown deal:', JSON.stringify(deali));
                continue;
            }
            if (deali.Mmsm == '担保品划入' || deali.Mmsm == '担保品划出' || deali.Mmsm == '融券') {
                emjyBack.log('uploadTodayDeals ignore deal:', JSON.stringify(deali));
                continue;
            }

            var tradeType = '';
            if (deali.Mmsm == '证券卖出') {
                tradeType = 'S';
            } else if (deali.Mmsm == '证券买入' || deali.Mmsm == '配售申购' || deali.Mmsm == '配股缴款' || deali.Mmsm == '网上认购') {
                tradeType = 'B';
            } else {
                emjyBack.log('unknown trade type', deali.Mmsm, JSON.stringify(deali));
                continue;
            }
            var code = deali.Zqdm;
            var time = this.getDealTime(deali.Wtrq, deali.Wtsj);
            var count = deali.Cjsl;
            var price = deali.Cjjg;
            var sid = deali.Wtbh;
            fetchedDeals.push({time, sid, code, tradeType, price, count});
        }
        fetchedDeals.reverse();
        this.uploadDeals(fetchedDeals);
    }

    testFhaServer() {
        var url = this.fha.server + 'stock?act=test';
        var headers = {}
        if (this.fha) {
            headers['Authorization'] = 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd);
        }
        fetch(url, {headers}).then(r=>r.text()).then(txt => {
            if (txt == 'OK') {
                emjyBack.log('testFhaServer,Good!');
            }
        });
    }

    uploadDeals(deals) {
        if (deals.length == 0) {
            return;
        }

        if (!this.fha) {
            return;
        }

        this.testFhaServer();
        if (this.fha) {
            var url = this.fha.server + 'stock';
            const pd = deals.map(d => feng.getLongStockCode(d.code).then(fcode => d.code = fcode));
            Promise.all(pd).then(() => {
                var dfd = new FormData();
                dfd.append('act', 'deals');
                dfd.append('data', JSON.stringify(deals));
                var headers = {'Authorization': 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd)};
                this.log('uploadDeals', JSON.stringify(deals));
                fetch(url, {method: 'POST', headers, body: dfd}).then(r=>r.text()).then(p => {
                    this.log('upload deals to server,', p);
                });
            });
        }
    }

    recoginzeCaptcha(img) {
        if (!this.fha) {
            this.getFromLocal('fha_server').then(fhaInfo => {
                if (fhaInfo) {
                    this.fha = fhaInfo;
                    this.recoginzeCaptcha(img);
                }
            })
            return;
        }

        var url = this.fha.server + 'api/captcha';
        var dfd = new FormData();
        dfd.append('img', img);
        fetch(url, {method: 'POST', body: dfd}).then(r=>r.text()).then(text => {
            this.sendMessageToContent({'command': 'emjy.captcha', text});
        });
    }

    clearCompletedDeals() {
        if (!this.savedDeals) {
            this.getFromLocal('hist_deals').then(sdeals => {
                if (sdeals) {
                    this.savedDeals = sdeals;
                    this.clearCompletedDeals();
                }
            });
            return;
        }

        var codes = new Set();
        for (let i = 0; i < this.savedDeals.length; i++) {
            codes.add((this.savedDeals[i].code));
        }
        var curDeals = [];
        codes.forEach(c => {
            var stk = this.normalAccount.getStock(c);
            if (!stk) {
                stk = this.collateralAccount.getStock(c);
            }
            if (stk && stk.holdCount > 0) {
                curDeals.push.apply(curDeals, this.savedDeals.filter(d => d.code == c));
            }
        });
        curDeals.sort((a, b) => a.time > b.time);
        this.savedDeals = curDeals;
        this.saveToLocal({'hist_deals': this.savedDeals});
    }

    getSmiOffset(date) {
        if (!this.smiList || this.smiList.length == 0 || !date || date == '0') {
            return 0;
        }

        var buySmi = this.smiList[0].value;
        for (var i = 1; i < this.smiList.length; ++i) {
            if (date <= this.smiList[i].date) {
                break;
            }
            buySmi = this.smiList[i].value;
        }
        var curSmi = this.smiList[this.smiList.length - 1].value;
        if (buySmi == curSmi) {
            return 0;
        }
        return (curSmi - buySmi) / buySmi;
    }

    checkRzrq(code) {
        if (!this.creditAccount) {
            return Promise.resolve();
        }
        if (!this.creditAccount.tradeClient) {
            this.creditAccount.createTradeClient();
        }
        return this.creditAccount.tradeClient.checkRzrqTarget(code);
    }

    trySellStock(code, price, count, account, cb) {
        if (!this.all_accounts[account]) {
            this.log('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].sellStock(code, price, count).then(sd => {
            var holdacc = holdAccountKey[account];
            var stk = this.all_accounts[holdacc].getStock(code);
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[holdacc].applyStrategy(code, {grptype: 'GroupStandard', strategies: {'0': {key: 'StrategySellELS', enabled: false, cutselltype: 'all', selltype: 'all'}}, transfers: {'0': {transfer: '-1'}}, amount: '5000'});
                }
                if (sd) {
                    stk.strategies.buydetail.addSellDetail(sd);
                }
            }
            return sd;
        });
    }

    tryBuyStock(code, price, count, account) {
        if (!this.all_accounts[account]) {
            this.log('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].buyStock(code, price, count).then(bd => {
            var holdacc = holdAccountKey[account];
            var stk = this.all_accounts[holdacc].getStock(code);
            var strgrp = {};
            if (!stk) {
                this.all_accounts[holdacc].addWatchStock(code, strgrp);
                stk = this.all_accounts[holdacc].getStock(code);
            }
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[holdacc].addStockStrategy(stk, strgrp);
                }
                stk.strategies.buydetail.addBuyDetail(bd);
            }
            return bd;
        });
    }

    buyWithAccount(code, price, count, account, strategies) {
        var holdacc = holdAccountKey[account];
        if (strategies) {
            this.all_accounts[holdacc].addWatchStock(code, strategies);
        }
        if (!count) {
            var stk = this.all_accounts[holdacc].getStock(code);
            if (stk) {
                count = stk.strategies.getBuyCount(price);
            }
            if (count * price - this.all_accounts[account].availableMoney > 0) {
                count = guang.calcBuyCount(this.all_accounts[account].availableMoney, price);
            }
        }
        return this.tryBuyStock(code, price, count, account);
    }

    testTradeApi(code) {
        if (!code) {
            code = '601398';
        }
        feng.getStockSnapshot(code).then(snap => {
            this.tryBuyStock(code, snap.bottomprice, guang.calcBuyCount(1000, snap.bottomprice), 'normal').then(bd => {
                if (bd) {
                    console.log('tade test with deal', bd);
                }
            }).catch(err => {
                console.log('test trade failed', err)
            });
        });
    }

    applyKlVars(code, klvars) {
        if (this.klines[code]) {
            this.klines[code].addKlvars(klvars);
        }
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

    removeStock(account, code) {
        this.all_accounts[account].removeStock(code);
    }

    tradeDailyRoutineTasks() {
        if (this.purchaseNewStocks) {
            feng.buyNewStocks();
        }
        feng.buyNewBonds();
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
        for (const account of this.track_accounts) {
            account.fillupGuardPrices();
        }

        const allstks = Object.values(emjyBack.all_accounts).map(a => a.stocks.map(x=>x.code)).flat();
        let holdcached = feng.dumpCached(allstks);
        this.saveToLocal({'hsj_stocks': holdcached});

        const todaystr = guang.getTodayDate('-');
        const lastkltime = function(kl, klt) {
            if (!kl.klines || !kl.klines[klt] || kl.klines[klt].length < 1) {
                return '';
            }
            return kl.klines[klt].slice(-1)[0].time;
        }
        let stks = allstks.filter(s=>emjyBack.klines[s]);
        let prm = stks.filter(s=>lastkltime(emjyBack.klines[s], '101') != todaystr).map(s => feng.getStockKline(s, '101'));
        for (t of ['15', '1']) {
            let s15 = stks.filter(s => emjyBack.klines[s] && emjyBack.klines[s].length > 0 && lastkltime(emjyBack.klines[s], t) != todaystr + ' 15:00');
            prm = prm.concat(s15.map(s=>feng.getStockKline(s, t)));
        }

        Promise.all(prm).then(()=>{
            this.normalAccount.save();
            this.collateralAccount.save();
            this.track_accounts.forEach(acc => {acc.save()});
            if (this.costDog) {
                this.costDog.save();
            }
            Object.values(this.klines).forEach(kl => kl.save());
            this.flushLogs();
        });
    }

    flushLogs() {
        emjyBack.log('flush log!');
        var blob = new Blob(this.logs, {type: 'application/text'});
        this.saveToFile(blob, 'logs/stock.assist' + guang.getTodayDate() + '.log');
        this.logs = [];
    }

    exportHoldStocksCode() {
        var codes = [];
        this.normalAccount.stocks.forEach(s => {if (s.holdCount > 0) {codes.push(s.code + '\n')}});
        this.collateralAccount.stocks.forEach(s => {if (s.holdCount > 0) {codes.push(s.code + '\n')}});
        var blob = new Blob(codes, {type: 'application/text'});
        this.saveToFile(blob, 'holdingstocks.txt');
    }

    exportConfig() {
        var configs = this.normalAccount.exportConfig();
        var colConfig = this.collateralAccount.exportConfig();
        for (var i in colConfig) {
            configs[i] = colConfig[i];
        };
        for (const account of this.track_accounts) {
            var trackConfig = account.exportConfig();
            for (var i in trackConfig) {
                configs[i] = trackConfig[i];
            }
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
        for (const account of this.track_accounts) {
            account.importConfig(configs);
        }
    }

    clearStorage() {
        chrome.storage.local.clear();
    }

    saveToFile(blob, filename, conflictAction = 'overwrite') {
        // conflictAction (uniquify, overwrite, prompt)
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({url, filename, saveAs:false, conflictAction});
    }

    getFromLocal(key) {
        return chrome.storage.local.get(key).then(item => {
            if (item && item[key]) {
                return item[key];
            }
            return null;
        });
    }

    saveToLocal(data) {
        chrome.storage.local.set(data);
    }

    removeLocal(key) {
        chrome.storage.local.remove(key);
    }

    addMissedStocks(days = 1) {
        var setMaGuardPrice = function(strategygrp, prc) {
            for (var id in strategygrp.strategies) {
                if (strategygrp.strategies[id].data.key == 'StrategyMA') {
                    strategygrp.strategies[id].data.guardPrice = prc;
                }
            }
        }

        var fitBuyMA = function(code, cnt, strategies) {
            if (!emjyBack.klines[code]) {
                return false;
            }

            var kline = emjyBack.klines[code].getKline('101');
            if (kline.length < 10) {
                this.log('new stock!', code, kline);
                return false;
            }
            for (let i = 1; i <= cnt; i++) {
                const kl = kline[kline.length - i];
                if (kl.bss18 == 'b') {
                    var low = emjyBack.klines[code].getLowestInWaiting('101');
                    var cutp = (kl.c - low) * 100 / kl.c;
                    if (cutp >= 14 && cutp <= 27) {
                        this.log(code, kl.c, low, cutp);
                        if (code.startsWith('60') || code.startsWith('00')) {
                            setMaGuardPrice(strategies, low);
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        var addMissed = function(account) {
            for (let i = 0; i < account.stocks.length; i++) {
                const stocki = account.stocks[i];
                if (stocki.strategies && stocki.holdCount == 0 && fitBuyMA(stocki.code, days, stocki.strategies)) {
                    var str = {"key":"StrategyBuy","enabled":true};
                    if (account.keyword == 'collat') {
                        str.account = 'credit';
                    }
                    this.log('addStrategy', account.keyword, stocki.code, str);
                    stocki.strategies.addStrategy(str);
                }
            }
        }

        addMissed(this.normalAccount);
        addMissed(this.collateralAccount);
    }

    cheatExistingStocks() {
        var cheatOperation = function(account) {
            for (let i = 0; i < account.stocks.length; i++) {
                const stocki = account.stocks[i];
                // TODO: add operations here!
            }
        }
        console.log('normal');
        cheatOperation(this.normalAccount);
        console.log('collat');
        cheatOperation(this.collateralAccount);
    }

    dumpTestKl(code, kltype = '101') {
        var r = [];
        this.klines[code].klines[kltype].forEach(kl => {r.push({kl:kl, expect:{dcount:0}})});
        console.log(JSON.stringify(r));
    }
}
