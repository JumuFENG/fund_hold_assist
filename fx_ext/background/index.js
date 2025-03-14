'use strict';

let emjyBack = null;
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
            emjyBack.all_accounts[message.account].getStock(message.code)?.strategies?.updateKlines();
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


class ext {
    static notify(message, sender, response) {
        if (message.command == 'emjy.contentLoaded') {
            ext.onContentLoaded(message, sender.tab.id, response);
        } else if (message.command.startsWith('emjy.') && emjyBack) {
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
            const tids = tabs.filter(tab => new URL(tab.url).host == emjyBack.jywghost).map(t=>t.id);
            chrome.tabs.remove(tids);
        }).then(() => {
            emjyBack.getFromLocal('acc_np').then(anp => {
                emjyBack.unp = anp;
                var url = emjyBack.unp.credit ? emjyBack.jywgroot + 'MarginTrade/Buy': emjyBack.jywgroot + 'Trade/Buy';
                chrome.tabs.create({url}).then(ctab => this.mainTab = ctab);
            });
        });
    }

    static onContentLoaded(message, tabid, response) {
        if (!this.mainTab || this.mainTab.id != tabid) {
            emjyBack.log('onContentLoaded response false', tabid, JSON.stringify(this.mainTab));
            response(false);
            return;
        };

        this.mainTab.url = message.url;
        chrome.tabs.executeScript(this.mainTab.tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
        emjyBack.log('onContentLoaded', this.mainTab.url);
        response(true);
    }

    static onContentMessageReceived(message, tabid) {
        if (!emjyBack) {
            console.log('background not initialized');
            return;
        }

        emjyBack.log('onContentMessageReceived', tabid, message.command === 'emjy.captcha' ? message.command: JSON.stringify(message));
        if (message.command == 'emjy.getValidateKey') {
            chrome.tabs.executeScript(tabid, {code:'setTimeout(() => { location.reload(); }, 175 * 60 * 1000);'});
            if (emjyBack.validateKey == message.key) {
                emjyBack.log('getValidateKey same, skip!');
                return;
            }
            emjyBack.log('getValidateKey =', message.key);
            emjyBack.validateKey = message.key;
            emjyBack.loadAssets();
            if ((new Date()).getDay() == 1 && (new Date()).getHours() <= 9) {
                // update history deals every Monday morning.
                emjyBack.updateHistDeals();
            }
        } else if (message.command == 'emjy.captcha') {
            this.recoginzeCaptcha(message.img);
        } else if (message.command == 'emjy.loginnp') {
            this.sendLoginInfo();
        } else if (message.command == 'emjy.trade') {
            emjyBack.log('trade message: result =', message.result, ', what =', message.what);
        } else if (message.command == 'emjy.addwatch') {
            emjyBack.all_accounts[message.account].addWatchStock(message.code, message.strategies);
            emjyBack.log('content add watch stock', message.account, message.code);
        } else if (message.command == 'emjy.save') {
            emjyBack.normalAccount.save();
            emjyBack.collateralAccount.save();
            emjyBack.log('content message save');
        }
    }

    static sendPendingMessages() {
        var url = new URL(this.mainTab.url);
        if (!this.mainTab.id || url.host != emjyBack.jywghost) {
            this.pendingTimeout = setTimeout(() => {
                this.sendPendingMessages();
            }, 300);
            return;
        }
        if (this.pendingContentMsgs && this.pendingContentMsgs.length > 0) {
            this.pendingContentMsgs.forEach(m => {
                chrome.tabs.sendMessage(this.mainTab.id, m);
                emjyBack.log('sendMsgToMainTabContent pending', JSON.stringify(m));
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
        if (!this.mainTab || !this.mainTab.id || (new URL(this.mainTab.url)).host != emjyBack.jywghost) {
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
        emjyBack.log('sendMsgToMainTabContent', JSON.stringify(data));
    }

    static onManagerMessageReceived(message, tabid) {
        if (!this.manager) {
            this.manager = new ManagerBack();
        }

        this.manager.onManagerMessage(message, tabid);
        if (message.command == 'mngr.init') {
            emjyBack.log('manager initialized!');
            if (this.manager.isValid()) {
                for (var c in emjyBack.klines) {
                    this.manager.sendKline(c, emjyBack.klines[c].klines);
                }
                this.manager.sendStocks([emjyBack.normalAccount]);
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
            emjyBack.log('websocket closed with code: ' + cevt.code + ' reason: ' + cevt.reason);
            this.setupWebsocketConnection();
        }
        this.websocket.onerror = err => {
            emjyBack.log('websocket error! ');
            this.setupWebsocketConnection();
        }
    }

    static sendWebsocketMessage(message) {
        if (this.websocket) {
            this.websocket.send(JSON.stringify(message));
        } else {
            emjyBack.log('error websocket not setup');
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
                    emjyBack.saveToLocal({'all_available_istr': str_available});
                }
                for (const rkey of keys_saved) {
                    if (!keys_received.includes(rkey)) {
                        emjyBack.removeLocal('itstrategy_' + rkey);
                    }
                }
                for (const rkey of keys_received) {
                    emjyBack.getFromLocal('itstrategy_' + rkey).then(istr => {
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
            emjyBack.log(message.data);
            emjyBack.log(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account);
            if (!wsmsg.account) {
                emjyBack.checkRzrq(wsmsg.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'credit';
                    emjyBack.buyWithAccount(wsmsg.code, wsmsg.price, wsmsg.count, account, wsmsg.strategies);
                });
            } else {
                emjyBack.buyWithAccount(wsmsg.code, wsmsg.price, wsmsg.count, wsmsg.account, wsmsg.strategies);
            }
            return;
        }
        if (wsmsg.type == 'intrade_addwatch') {
            emjyBack.log(message.data);
            if (!wsmsg.account) {
                emjyBack.checkRzrq(message.code).then(rzrq => {
                    var account = rzrq.Status == -1 ? 'normal' : 'collat';
                    emjyBack.all_accounts[account].addWatchStock(wsmsg.code, wsmsg.strategies);
                });
            } else {
                emjyBack.all_accounts[wsmsg.account].addWatchStock(wsmsg.code, wsmsg.strategies);
            }
            return;
        }
        console.log(wsmsg);
    }

    static onPopupMessageReceived(message, sender, popcb) {
        if (message.command === 'popup.costdogs') {
            popcb(emjyBack.costDog.dogdic);
        } else if (message.command === 'popup.buystock') {
            let code = message.code;
            let price = message.price;
            let amount = message.amount;
            let strategies = message.strategies;
            let count = strategies?.uramount?.key ? emjyBack.costDog.urBuyCount(strategies.uramount.key, code, amount, price).count : guang.calcBuyCount(amount, price);
            let account = message.account;
            if (!account) {
                popcb(emjyBack.checkRzrq(message.code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    return emjyBack.buyWithAccount(code, price, count, racc, strategies);
                }));
            } else {
                popcb(emjyBack.buyWithAccount(code, price, count, account, strategies));
            }
        } else if (message.command === 'popup.addwatch') {
            emjyBack.log('popup message popup.addwatch');
            let code = message.code;
            let amount = message.amount;
            let strategies = message.strategies;
            let account = message.account;

            let str0 = strategies.strinfo;
            if (!account) {
                emjyBack.checkRzrq(code).then(rzrq => {
                    var racc = rzrq.Status == -1 ? 'normal' : 'credit';
                    var hacc = holdAccountKey[racc];
                    str0.account = racc;
                    let bstrs = {
                        "grptype":"GroupStandard", "transfers":{"0":{"transfer":"-1"}},
                        "strategies":{"0":str0}, amount, "uramount":{"key":strategies?.uramount?.key}
                    };
                    emjyBack.all_accounts[hacc].addWatchStock(code, bstrs);
                });
            } else {
                let bstrs = {
                    "grptype":"GroupStandard","transfers":{"0":{"transfer":"-1"}},
                    "strategies":{"0":str0},amount,"uramount":{"key":strategies?.uramount?.key}};
                emjyBack.all_accounts[account].addWatchStock(code, bstrs);
            }
        }
    }

    static recoginzeCaptcha(img) {
        if (!emjyBack.fha) {
            emjyBack.getFromLocal('fha_server').then(fhaInfo => {
                if (fhaInfo) {
                    emjyBack.fha = fhaInfo;
                    this.recoginzeCaptcha(img);
                }
            })
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
        if (emjyBack.unp) {
            this.sendMessageToContent({command:'emjy.loginnp', np: emjyBack.unp});
            return;
        }

        emjyBack.getFromLocal('acc_np').then(anp => {
            emjyBack.unp = anp;
            this.sendLoginInfo();
        });
    }

    static saveToFile(blob, filename, conflictAction = 'overwrite') {
        // conflictAction (uniquify, overwrite, prompt)
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({url, filename, saveAs:false, conflictAction});
    }

    static clearStorage() {
        chrome.storage.local.clear();
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
                emjyBack.log('new stock!', code, kline);
                return false;
            }
            for (let i = 1; i <= cnt; i++) {
                const kl = kline[kline.length - i];
                if (kl.bss18 == 'b') {
                    var low = emjyBack.klines[code].getLowestInWaiting('101');
                    var cutp = (kl.c - low) * 100 / kl.c;
                    if (cutp >= 14 && cutp <= 27) {
                        emjyBack.log(code, kl.c, low, cutp);
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
                    emjyBack.log('addStrategy', account.keyword, stocki.code, str);
                    stocki.strategies.addStrategy(str);
                }
            }
        }

        addMissed(emjyBack.normalAccount);
        addMissed(emjyBack.collateralAccount);
    }

    cheatExistingStocks() {
        var cheatOperation = function(account) {
            for (let i = 0; i < account.stocks.length; i++) {
                const stocki = account.stocks[i];
                // TODO: add operations here!
            }
        }
        console.log('normal');
        cheatOperation(emjyBack.normalAccount);
        console.log('collat');
        cheatOperation(emjyBack.collateralAccount);
    }

    dumpTestKl(code, kltype = '101') {
        var r = [];
        emjyBack.klines[code].klines[kltype].forEach(kl => {r.push({kl:kl, expect:{dcount:0}})});
        console.log(JSON.stringify(r));
    }
}

chrome.runtime.onMessage.addListener(ext.notify);
emjyBack = new EmjyBack();
ext.createMainTab();
emjyBack.Init();
alarmHub.setupAlarms();
istrManager.initExtStrs();
