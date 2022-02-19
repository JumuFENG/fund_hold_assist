'use strict';

class GlobalManager {
    constructor() {
        this.klines = {};
        this.serverhost = 'http://localhost/';
        this.getFromLocal('hsj_stocks', item => {
            if (item && item['hsj_stocks']) {
                this.stockMarket = item['hsj_stocks'];
            } else {
                this.stockMarket = {};
                this.fetchStocksMarket();
            }
        });
    }

    log(...args) {
        var dt = new Date();
        var l = '[' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds()  + '] ' +  args.join(' ');
        console.log(l);
    }

    saveToLocal(data) {
        for (const k in data) {
            if (Object.hasOwnProperty.call(data, k)) {
                localStorage.setItem(k, JSON.stringify(data[k]));
            }
        }
    }

    getFromLocal(key, cb) {
        var item = JSON.parse(localStorage.getItem(key));
        if (typeof(cb) === 'function') {
            var r = {};
            r[key] = item;
            cb(r);
        }
    }

    removeLocal(key) {
        localStorage.removeItem(key);
    }

    applyGuardLevel(strgrp, allklt) {
        console.log('GlobalManager.applyGuardLevel();');
    }

    loadKlines(code) {
        if (!this.klines[code]) {
            this.klines[code] = new KLine(code);
            this.klines[code].loadSaved();
        }
    }

    setupTestAccount() {
        this.testAccount = new TestingAccount();
        this.testAccount.loadAssets();
    }

    setupRetroAccount() {
        this.retroAccount = new RetrospectAccount();
        this.retroAccount.loadAssets();
    }

    trySellStock(code, price, count, account, cb) {
        var sellAccount = this.normalAccount;
        if (account) {
            if (this.retroAccount && account == this.retroAccount.keyword) {
                sellAccount = this.retroAccount;
            } else if (this.testAccount && account == this.testAccount.keyword) {
                sellAccount = this.testAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        sellAccount.sellStock(code, price, count, cb);
    }

    tryBuyStock(code, price, count, account, cb) {
        var buyAccount = this.normalAccount;
        if (account) {
            if (this.retroAccount && account == this.retroAccount.keyword) {
                buyAccount = this.retroAccount;
            } else if (this.testAccount && account == this.testAccount.keyword) {
                buyAccount = this.testAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        buyAccount.buyStock(code, price, count, cb);
    }

    getMkCode(code) {
        if (code.length == 6 && this.stockMarket[code]) {
            return this.stockMarket[code].c;
        }
        return code;
    }

    fetchStocksMarket() {
        utils.get(this.serverhost + 'api/allstockinfo', mkt => {
            var mktInfo = JSON.parse(mkt);
            for (var i = 0; i < mktInfo.length; ++i) {
                this.stockMarket[mktInfo[i].c.substring(2)] = mktInfo[i];
            }
            this.saveToLocal({'hsj_stocks': this.stockMarket});
        });
    }

    fetchStockKline(code, kltype, sdate) {
        var mktCode = this.getMkCode(code);
        var url = this.serverhost + 'api/stockhist?fqt=1&code=' + mktCode;
        if (!kltype) {
            url += '&kltype=101';
        } else if (kltype == '30' || kltype == '60' || kltype == '120') {
            url += '&kltype=15';
        } else if (kltype == '202' || kltype == '404' || kltype == '808') {
            url += '&kltype=101';
        } else {
            url += '&kltype=' + kltype;
        }

        if (sdate !== undefined) {
            if (sdate.length != 8 && sdate.length != 10) {
                console.error('invalid start date', sdate);
                return;
            }
            var dashdate = sdate;
            if (!sdate.includes('-')) {
                dashdate = sdate.substring(0,4) + '-' + sdate.substring(4,6) + '-' + sdate.substring(6,8);
            }
            url += '&start=' + dashdate;
        }

        utils.get(url, ksdata => {
            var kdata = JSON.parse(ksdata);
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', code, 'kltype:', kltype);
                return;
            }

            console.log(kdata);
            var klmessage = {kltype, kline:{data:{klines:[]}}};
            kdata.forEach(kl => {
                klmessage.kline.data.klines.push(kl[1] + ',' + kl[5] + ',' + kl[2] + ',' + kl[3] + ',' + kl[4] + ',' +kl[8]);
            });
            if (!this.klines[code]) {
                this.klines[code] = new KLine(code);
            }
            this.klines[code].updateRtKline(klmessage);
            this.klines[code].save();
        });
    }
}

var emjyBack = new GlobalManager();
