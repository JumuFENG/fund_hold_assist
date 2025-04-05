'use strict';

if (navigator.userAgent.includes('Firefox')) {
    chrome = browser;
}

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
        accld.normalAccount.save();
        accld.collateralAccount.save();
        for (const account of accld.track_accounts) {
            account.save();
        }
        if (emjyBack.mgrFetched) {
            emjyBack.mgrFetched.forEach(c => {
                klPad.klines[c].save();
            });
            delete(emjyBack.mgrFetched)
        }
        if (costDog) {
            costDog.save();
        }
        clearTimeout(this.mgrChangedTimeout);
        logger.info('manager saved');
        this.mgrChangedTimeout = null;
    }

    onManagerMessage(message, tabid) {
        logger.info('ManagerBack ', JSON.stringify(message), tabid);
        if (message.command == 'mngr.init') {
            this.tabid = tabid;
        } else if (message.command == 'mngr.initaccstk') {
            this.sendStocks([accld.all_accounts[message.account]]);
        } else if (message.command == 'mngr.closed') {
            this.notifyMgrSave();
            this.tabid = null;
        } else if (message.command == 'mngr.export') {
            ext.exportConfig();
        } else if (message.command == 'mngr.import') {
            ext.importConfig(message.config);
        } else if (message.command == 'mngr.strategy') {
            accld.all_accounts[message.account].applyStrategy(message.code, message.strategies);
            accld.all_accounts[message.account].getStock(message.code)?.strategies?.updateKlines();
            this.startChangedTimeout();
        } else if (message.command =='mngr.strategy.rmv') {
            accld.all_accounts[message.account].removeStrategy(message.code, message.stype);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.addwatch') {
            accld.all_accounts[message.account].addWatchStock(message.code, message.strategies);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.rmwatch') {
            accld.removeStock(message.account, message.code);
            this.startChangedTimeout();
        } else if (message.command == 'mngr.checkrzrq') {
            accld.checkRzrq(message.code).then(rzrq => {
                this.sendManagerMessage({command:'mngr.checkrzrq', rzrq});
            });
        } else if (message.command == 'mngr.getkline') {
            klPad.getStockKline(message.code, '101', message.date).then(kline => {
                this.sendManagerMessage({command:'mngr.getkline', code: message.code, klines: klPad.klines[message.code].klines['101']});
            });
        } else if (message.command == 'mngr.saveFile') {
            svrd.saveToFile(message.blob, message.filename);
        } else if (message.command == 'mngr.costdog') {
            this.sendManagerMessage({command:'mngr.costdog', 'costdog': Object.values(costDog.dogdic)});
        } else if (message.command === 'mngr.costdog.add') {
            var cdo = message.cdo;
            costDog.dogdic[cdo.key] = cdo;
            this.startChangedTimeout();
        } else if (message.command === 'mngr.costdog.delete') {
            delete(costDog.dogdic[message.cikey]);
            this.startChangedTimeout();
        } else if (message.command === 'mngr.costdog.changed') {
            var cdo = message.cdo;
            for (const c of ['amount', 'max_amount', 'expect_earn_rate']) {
                costDog.dogdic[cdo.key][c] = cdo[c];
            }
            this.startChangedTimeout();
        }
    }

    sendManagerMessage(message) {
        if (this.isValid()) {
            chrome.tabs.sendMessage(this.tabid, message);
        } else {
            logger.info('manager tab id is', this.tabid);
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


class ext {
    static jywghost = 'jywg.eastmoneysec.com';
    static jywgroot = 'https://' + this.jywghost + '/';

    static notify(message, sender, response) {
        if (message.command == 'emjy.contentLoaded') {
            ext.onContentLoaded(message, sender.tab.id, response);
        } else if (message.command.startsWith('emjy.')) {
            ext.onContentMessageReceived(message, sender.tab.id);
        } else if (message.command.startsWith('mngr.')) {
            if (sender.tab) {
                ext.onManagerMessageReceived(message, sender.tab.id);
            } else {
                ext.onManagerMessageReceived(message, null);
            }
        } else if (message.command.startsWith('popup.')) {
            ext.onPopupMessageReceived(message, sender, response);
        } else {
            console.log('Unknown command', message);
        }
    }

    static createMainTab() {
        chrome.tabs.query({}).then(tabs => {
            const tids = tabs.filter(tab => new URL(tab.url).host == this.jywghost).map(t=>t.id);
            chrome.tabs.remove(tids);
        }).then(() => {
            var url = accld.enableCredit ? this.jywgroot + 'MarginTrade/Buy': this.jywgroot + 'Trade/Buy';
            chrome.tabs.create({url}).then(ctab => this.mainTab = ctab);
        });
    }

    static onContentLoaded(message, tabid, response) {
        if (!this.mainTab || this.mainTab.id != tabid) {
            logger.info('onContentLoaded response false', tabid, JSON.stringify(this.mainTab));
            response(false);
            return;
        };

        this.mainTab.url = message.url;
        chrome.tabs.executeScript(this.mainTab.tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
        logger.info('onContentLoaded', this.mainTab.url);
        response(true);
    }

    static onContentMessageReceived(message, tabid) {
        logger.info('onContentMessageReceived', tabid, message.command === 'emjy.captcha' ? message.command: JSON.stringify(message));
        if (message.command == 'emjy.getValidateKey') {
            chrome.tabs.executeScript(tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
            if (accld.validateKey == message.key) {
                logger.info('getValidateKey same, skip!');
                return;
            }
            logger.info('getValidateKey =', message.key);
            accld.validateKey = message.key;
            accld.normalAccount.loadAssets();
            accld.collateralAccount.loadAssets();

            if ((new Date()).getDay() == 1 && (new Date()).getHours() <= 9) {
                // update history deals every Monday morning.
                accld.updateHistDeals();
            }
        } else if (message.command == 'emjy.captcha') {
            this.recoginzeCaptcha(message.img);
        } else if (message.command == 'emjy.loginnp') {
            this.sendLoginInfo();
        } else if (message.command == 'emjy.trade') {
            logger.info('trade message: result =', message.result, ', what =', message.what);
        } else if (message.command == 'emjy.addwatch') {
            accld.all_accounts[message.account].addWatchStock(message.code, message.strategies);
            logger.info('content add watch stock', message.account, message.code);
        } else if (message.command == 'emjy.save') {
            accld.normalAccount.save();
            accld.collateralAccount.save();
            logger.info('content message save');
        }
    }

    static sendPendingMessages() {
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
                logger.info('sendMsgToMainTabContent pending', JSON.stringify(m));
            });
            clearTimeout(this.pendingTimeout);
            delete(this.pendingTimeout);
            delete(this.pendingContentMsgs);
        }
    }

    static insertPendingMessage(data) {
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

    static sendMessageToContent(data) {
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
        logger.info('sendMsgToMainTabContent', JSON.stringify(data));
    }

    static onManagerMessageReceived(message, tabid) {
        if (!this.manager) {
            this.manager = new ManagerBack();
        }

        this.manager.onManagerMessage(message, tabid);
        if (message.command == 'mngr.init') {
            logger.info('manager initialized!');
            if (this.manager.isValid()) {
                for (var c in klPad.klines) {
                    this.manager.sendKline(c, klPad.klines[c].klines);
                }
                this.manager.sendStocks([accld.normalAccount]);
            }
            chrome.tabs.onRemoved.addListener((tid, removeInfo) => {
                if (tid == this.manager.tabid) {
                    this.manager.onManagerMessage({command: 'mngr.closed'}, tid);
                }
            });
        }
    }

    static setupWebsocketConnection() {
        var wsurl = new URL(emjyBack.fha.server);
        wsurl.pathname = '';
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
            logger.info('websocket closed with code: ' + cevt.code + ' reason: ' + cevt.reason);
            this.setupWebsocketConnection();
        }
        this.websocket.onerror = err => {
            logger.info('websocket error! ');
            this.setupWebsocketConnection();
        }
    }

    static sendWebsocketMessage(message) {
        if (this.websocket) {
            this.websocket.send(JSON.stringify(message));
        } else {
            logger.info('error websocket not setup');
        }
    }

    static onWebsocketMessageReceived(message) {
        var wsmsg = JSON.parse(message.data);
        if (wsmsg.type === 'str_available') {
            var str_available = wsmsg.strategies;
            var keys_received = [];
            for (const strategy of str_available) {
                keys_received.push(strategy.key);
            }
            svrd.getFromLocal('all_available_istr').then(all_str => {
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
                    svrd.saveToLocal({'all_available_istr': str_available});
                }
                for (const rkey of keys_saved) {
                    if (!keys_received.includes(rkey)) {
                        svrd.removeLocal('itstrategy_' + rkey);
                    }
                }
                for (const rkey of keys_received) {
                    svrd.getFromLocal('itstrategy_' + rkey).then(istr => {
                        if (istr && istr.enabled) {
                            var subjson = {action: 'subscribe', strategy: istr.key, account: istr.account, amount: istr.amount};
                            if (istr.amtkey) {
                                subjson.amtkey = istr.amtkey;
                            }
                            this.sendWebsocketMessage(subjson);
                        }
                    });
                }
            });
            return;
        }
        if (wsmsg.type == 'intrade_buy') {
            logger.info(message.data);
            logger.info(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account);
            if (!wsmsg.account) {
                accld.checkRzrq(wsmsg.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'credit';
                    accld.tryBuyStock(wsmsg.code, wsmsg.price, wsmsg.count, account, wsmsg.strategies);
                });
            } else {
                accld.tryBuyStock(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account, wsmsg.strategies);
            }
            return;
        }
        if (wsmsg.type == 'intrade_addwatch') {
            logger.info(message.data);
            if (!wsmsg.account) {
                accld.checkRzrq(message.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'collat';
                    accld.all_accounts[account].addWatchStock(wsmsg.code, wsmsg.strategies);
                });
            } else {
                accld.all_accounts[wsmsg.account].addWatchStock(wsmsg.code, wsmsg.strategies);
            }
            return;
        }
        console.log(wsmsg);
    }

    static onPopupMessageReceived(message, sender, popcb) {
        if (message.command === 'popup.costdogs') {
            popcb(costDog.dogdic);
        } else if (message.command === 'popup.buystock') {
            let code = message.code;
            let price = message.price;
            let amount = message.amount;
            let strategies = message.strategies;
            let count = strategies?.uramount?.key ? costDog.urBuyCount(strategies.uramount.key, code, amount, price).count : guang.calcBuyCount(amount, price);
            let account = message.account;
            if (!account) {
                popcb(accld.checkRzrq(message.code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    return accld.tryBuyStock(code, price, count, racc, strategies);
                }));
            } else {
                popcb(accld.tryBuyStock(code, price, count, account, strategies));
            }
        } else if (message.command === 'popup.addwatch') {
            logger.info('popup message popup.addwatch');
            let code = message.code;
            let amount = message.amount;
            let strategies = message.strategies;
            let account = message.account;

            let str0 = strategies.strinfo;
            if (!account) {
                accld.checkRzrq(code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    str0.account = racc;
                    let bstrs = {
                        "grptype":"GroupStandard", "transfers":{"0":{"transfer":"-1"}},
                        "strategies":{"0":str0}, amount, "uramount":{"key":strategies?.uramount?.key}
                    };
                    accld.all_accounts[racc].holdAccount.addWatchStock(code, bstrs);
                });
            } else {
                let bstrs = {
                    "grptype":"GroupStandard","transfers":{"0":{"transfer":"-1"}},
                    "strategies":{"0":str0},amount,"uramount":{"key":strategies?.uramount?.key}};
                accld.all_accounts[account].addWatchStock(code, bstrs);
            }
        }
    }

    static recoginzeCaptcha(img) {
        if (!emjyBack.fha) {
            console.error('server info not set!');
            return;
        }

        if (!img) {
            return;
        }
        var url = emjyBack.fha.server + 'api/captcha';
        var dfd = new FormData();
        dfd.append('img', img);
        fetch(url, {method: 'POST', body: dfd}).then(r=>r.text()).then(text => {
            this.sendMessageToContent({'command': 'emjy.captcha', text});
        });
    }

    static sendLoginInfo() {
        if (!emjyBack.unp) {
            console.error('no login info!');
            return;
        }
        this.sendMessageToContent({command:'emjy.loginnp', np: emjyBack.unp});
    }

    static clearStorage() {
        chrome.storage.local.clear();
    }

    static exportHoldStocksCode() {
        var codes = [];
        accld.normalAccount.stocks.forEach(s => {if (s.holdCount > 0) {codes.push(s.code + '\n')}});
        accld.collateralAccount.stocks.forEach(s => {if (s.holdCount > 0) {codes.push(s.code + '\n')}});
        var blob = new Blob(codes, {type: 'application/text'});
        svrd.saveToFile(blob, 'holdingstocks.txt');
    }

    static exportConfig() {
        var configs = accld.normalAccount.exportConfig();
        var colConfig = accld.collateralAccount.exportConfig();
        for (var i in colConfig) {
            configs[i] = colConfig[i];
        };
        for (const account of accld.track_accounts) {
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
            svrd.saveToFile(blob, 'stocks.config.json');
        });
    }

    static importConfig(configs) {
        for (var i in configs) {
            var cfg = {};
            cfg[i] = configs[i];
            chrome.storage.local.set(cfg);
        };
        accld.normalAccount.importConfig(configs);
        accld.collateralAccount.importConfig(configs);
        for (const account of accld.track_accounts) {
            account.importConfig(configs);
        }
    }

    static addMissedStocks(days = 1) {
        var setMaGuardPrice = function(strategygrp, prc) {
            for (var id in strategygrp.strategies) {
                if (strategygrp.strategies[id].data.key == 'StrategyMA') {
                    strategygrp.strategies[id].data.guardPrice = prc;
                }
            }
        }

        var fitBuyMA = function(code, cnt, strategies) {
            if (!klPad.klines[code]) {
                return false;
            }

            var kline = klPad.klines[code].getKline('101');
            if (kline.length < 10) {
                logger.info('new stock!', code, kline);
                return false;
            }
            for (let i = 1; i <= cnt; i++) {
                const kl = kline[kline.length - i];
                if (kl.bss18 == 'b') {
                    var low = klPad.klines[code].getLowestInWaiting('101');
                    var cutp = (kl.c - low) * 100 / kl.c;
                    if (cutp >= 14 && cutp <= 27) {
                        logger.info(code, kl.c, low, cutp);
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
                    logger.info('addStrategy', account.keyword, stocki.code, str);
                    stocki.strategies.addStrategy(str);
                }
            }
        }

        addMissed(accld.normalAccount);
        addMissed(accld.collateralAccount);
    }

    static cheatExistingStocks() {
        var cheatOperation = function(account) {
            for (let i = 0; i < account.stocks.length; i++) {
                const stocki = account.stocks[i];
                // TODO: add operations here!
            }
        }
        console.log('normal');
        cheatOperation(accld.normalAccount);
        console.log('collat');
        cheatOperation(accld.collateralAccount);
    }

    static dumpTestKl(code, kltype = '101') {
        var r = [];
        klPad.klines[code].klines[kltype].forEach(kl => {r.push({kl:kl, expect:{dcount:0}})});
        console.log(JSON.stringify(r));
    }
}

chrome.runtime.onMessage.addListener(ext.notify);
Promise.all([svrd.getFromLocal('acc_np'), svrd.getFromLocal('fha_server')]).then(([anp, fhaInfo]) => {
    emjyBack.unp = anp;
    fhaInfo.headers = {'Authorization': 'Basic ' + btoa(fhaInfo.uemail + ":" + fhaInfo.pwd)};
    emjyBack.fha = fhaInfo;
    guang.server = fhaInfo.server.replaceAll('5000/', '');
    accld.enableCredit = anp.credit;
    accld.fha = fhaInfo;
    costDog.fha = fhaInfo;
    istrManager.fha = fhaInfo;
}).then(() => {
    ext.createMainTab();
    ext.setupWebsocketConnection();
    accld.initAccounts();
    trackacc.initTrackAccounts();
    accld.all_accounts = accld.all_accounts;
    accld.track_accounts = accld.track_accounts;
    accld.normalAccount = accld.normalAccount;
    accld.collateralAccount = accld.collateralAccount;
    emjyBack.creditAccount = accld.creditAccount;
    costDog.init();
    svrd.getFromLocal('hsj_stocks').then(hsj => {
        if (hsj) {
            feng.loadSaved(hsj);
        }
    });
    svrd.getFromLocal('alarm_config').then(aconf => {
        alarmHub.config = aconf;
        alarmHub.tradeClosed = emjyBack.tradeClosed;
        alarmHub.setupAlarms();
    });
    emjyBack.Init();
});

istrManager.initExtStrs();
