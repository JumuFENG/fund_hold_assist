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
                this.purchaseNewStocks = pns;
            });
            this.getFromLocal('cost_dog').then(cd => {
                this.costDog = new CostDog(cd);
            });
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
    codeFromMktZqdm(market, zqdm) {
        const mdic = {'HA':'SH', 'SA': 'SZ', 'B': 'BJ'};
        if (market === 'TA') {
            emjyBack.log('退市股买卖不记录!');
            return;
        }
        if (!mdic[market]) {
            throw new Error(`unknown market ${market}`);
        }
        return mdic[market] + zqdm;
    }

    tradeTypeFromMmsm(Mmsm) {
        const ignored = ['担保品划入', '担保品划出', '融券', ]
        if (ignored.includes(Mmsm)) {
            return '';
        }
        const sells = ['证券卖出'];
        if (sells.includes(Mmsm)) {
            return 'S';
        }
        const buys = ['证券买入', '配售申购', '配股缴款', '网上认购'];
        if (buys.includes(Mmsm)) {
             return 'B';
        }
        return;
    }

    addHistDeals(deals) {
        var fetchedDeals = [];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            var tradeType = this.tradeTypeFromMmsm(deali.Mmsm)
            if (tradeType === undefined) {
                this.log('unknown trade type', deali.Mmsm, JSON.stringify(deali));
                continue;
            }
            if (!tradeType) {
                continue;
            }

            var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
            if (!code) {
                continue;
            }

            var time = this.getDealTime(deali.Cjrq, deali.Cjsj);
            const {Cjsl: count, Cjjg: price, Sxf: fee, Yhs: feeYh, Ghf: feeGh, Wtbh: sid} = deali;
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
            uptosvrDeals = fetchedDeals.filter(deali => !this.savedDeals.find(d => d.time == deali.time && d.code == deali.code && d.sid == deali.sid));
            this.savedDeals.concat(uptosvrDeals);
            this.savedDeals.sort((a, b) => a.time > b.time);
        }
        this.saveToLocal({'hist_deals': this.savedDeals});
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

            var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
            if (!code) {
                continue;
            }
            var time = this.getDealTime(
                deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,
                deali.Fssj === undefined || deali.Fssj == '0' ? deali.Cjsj : deali.Fssj);
            if (sm == '红利入账' && time.endsWith('0:0')) {
                time = this.getDealTime(deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,'150000');
            }
            const {Cjsl: count, Cjjg: price, Sxf: fee, Yhs: feeYh, Ghf: feeGh, Htbh: sid} = deali;
            if (fsjeSm.includes(sm)) {
                count = 1;
                price = deali.Fsje;
            }
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

    uploadTodayDeals(deals, acc) {
        var fetchedDeals = [];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (deali.Wtzt != '已成' && deali.Wtzt != '部撤') {
                emjyBack.log('uploadTodayDeals unknown deal:', JSON.stringify(deali));
                continue;
            }
            var tradeType = this.tradeTypeFromMmsm(deali.Mmsm)
            if (tradeType === undefined) {
                this.log('unknown trade type', deali.Mmsm, JSON.stringify(deali));
                continue;
            }
            if (!tradeType) {
                continue;
            }

            var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
            if (!code) {
                continue;
            }

            var time = this.getDealTime(deali.Wtrq, deali.Wtsj);
            const {Cjsl: count, Cjjg: price, Wtbh: sid} = deali;
            fetchedDeals.push({time, sid, code, tradeType, price, count});
        }
        fetchedDeals.reverse();
        this.uploadDeals(fetchedDeals, acc);
    }

    testFhaServer() {
        var url = this.fha.server + 'stock?act=test';
        var headers = {}
        if (this.fha) {
            headers['Authorization'] = 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd);
        }
        return fetch(url, {headers}).then(r=>r.text());
    }

    uploadDeals(deals, acc) {
        if (deals.length == 0 || !this.fha) {
            return;
        }

        this.testFhaServer().then(txt => {
            if (txt != 'OK') {
                emjyBack.log('testFhaServer, failed.!');
                return;
            }

            var url = this.fha.server + 'stock';
            var dfd = new FormData();
            dfd.append('act', 'deals');
            if (acc) {
                dfd.append('acc', acc);
            }
            dfd.append('data', JSON.stringify(deals));
            var headers = {'Authorization': 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd)};
            this.log('uploadDeals', JSON.stringify(deals));
            fetch(url, {method: 'POST', headers, body: dfd}).then(r=>r.text()).then(p => {
                this.log('upload deals to server,', p);
            });
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

        let curDeals = this.savedDeals.filter(d => this.normalAccount.getStock(d.code.substring(2)) || this.collateralAccount.getStock(d.code.substring(2)));
        curDeals.sort((a, b) => a.time > b.time);
        this.savedDeals = curDeals;
        this.saveToLocal({'hist_deals': this.savedDeals});
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

        const prm = Object.values(emjyBack.all_accounts).map(acc=>acc.stocks.filter(s=>s.strategies).map(s=>s.strategies.updateKlines())).flat();

        Promise.all(prm).then(()=>{
            this.normalAccount.save();
            this.collateralAccount.save();
            this.track_accounts.forEach(acc => {acc.save()});
            if (this.costDog) {
                this.costDog.save();
            }
            Object.values(this.klines).forEach(kl => kl.save());
            if (this.logs.length > 0) {
                this.flushLogs();
            }
            this.running = false;
        });
    }

    flushLogs() {
        this.log('flush log!');
        var blob = new Blob(this.logs, {type: 'application/text'});
        this.saveToFile(blob, 'logs/stock.assist' + guang.getTodayDate() + '.log');
        this.logs = [];
    }

    static saveToFile(blob, filename, conflictAction = 'overwrite') {
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

// export default new EmjyBack();
