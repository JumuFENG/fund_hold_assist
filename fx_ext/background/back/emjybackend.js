'use strict';

try {
    const logger = require('./nbase.js');
    const { NormalAccount, CollateralAccount, CreditAccount } = require('./accounts.js');
    const { TrackingAccount } = require('./trackAccount.js');
    const { klPad } = require('../kline.js');
    const { CostDog } = require('./strategyGroup.js');
    const { feng } = require('./feng.js');
} catch (err) {

}


class EmjyBack {
    constructor() {
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
        this.klines = klPad.klines;
        this.fha = null;
    }

    log(...args) {
        logger.log(...args);
    }

    Init() {
        this.running = true;
        this.normalAccount = new NormalAccount();
        this.collateralAccount = new CollateralAccount();
        this.creditAccount = new CreditAccount();
        this.all_accounts = {};
        this.all_accounts[this.normalAccount.keyword] = this.normalAccount;
        this.all_accounts[this.collateralAccount.keyword] = this.collateralAccount;
        this.all_accounts[this.creditAccount.keyword] = this.creditAccount;
        return this.getFromLocal('fha_server').then(fhaInfo => {
            if (fhaInfo) {
                this.fha = fhaInfo;
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
            this.getFromLocal('purchase_new_stocks').then(pns => {
                if (!alarmHub.config) {
                    alarmHub.config = {}
                }
                alarmHub.config.purchaseNewStocks = pns;
            });
            if (emjyBack.fha.save_on_server) {
                const url = emjyBack.fha.server + 'stock?act=costdog';
                const headers = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)};
                fetch(url, {headers}).then(r=>r.json()).then(cd => {
                    this.costDog = new CostDog(cd);
                });
            } else {
                this.getFromLocal('cost_dog').then(cd => {
                    this.costDog = new CostDog(cd);
                });
            }
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
                account.loadAssets();
            }
        });
    }

    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
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
        this.normalAccount.loadHistDeals(date);
        this.collateralAccount.loadHistDeals(date);
    }

    loadOtherDeals(date) {
        this.normalAccount.loadOtherDeals(date);
        this.collateralAccount.loadOtherDeals(date);
    }

    testFhaServer() {
        var url = this.fha.server + 'stock?act=test';
        var headers = {}
        if (this.fha) {
            headers['Authorization'] = 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd);
        }
        return fetch(url, {headers}).then(r=>r.text());
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
            var holdacc = this.all_accounts[account].holdAccount();
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
            var holdacc = this.all_accounts[account].holdAccount();
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
        var holdacc = this.all_accounts[account].holdAccount();
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

    isTradeTime() {
        var now = new Date();
        if (now > new Date(now.toDateString() + ' 9:30') && now < new Date(now.toDateString() + ' 15:00')) {
            return true;
        }
        return false;
    }

    removeStock(account, code) {
        this.all_accounts[account].removeStock(code);
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

        const prm = Object.values(emjyBack.all_accounts).map(acc=>acc.stocks.filter(s=>s.strategies).map(s=>s.strategies.updateKlines())).flat();

        Promise.all(prm).then(()=>{
            this.normalAccount.save();
            this.collateralAccount.save();
            this.track_accounts.forEach(acc => {acc.save()});
            if (this.costDog) {
                this.costDog.save();
            }
            Object.values(this.klines).forEach(kl => kl.save());
            this.flushLogs();
            this.running = false;
        });
    }

    flushLogs() {
        this.log('flush log!');
        if (logger.logs && logger.logs.length > 0) {
            var blob = new Blob(logger.logs, {type: 'application/text'});
            this.saveToFile(blob, 'logs/stock.assist' + guang.getTodayDate() + '.log');
            logger.logs = [];
        }
    }

    saveToFile(blob, filename, conflictAction = 'overwrite') {
        // conflictAction (uniquify, overwrite, prompt)
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({url, filename, saveAs:false, conflictAction});
    }

    getFromLocal(key) {
        return chrome.storage.local.get(key).then(item => {
            if (!key) return item;
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = new EmjyBack();
} else {
    window.emjyBack = new EmjyBack();
}
