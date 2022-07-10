'use strict';
let emStockUrl = 'http://quote.eastmoney.com/concept/';
let emStockUrlTail = '.html#fschart-k';

class GlobalManager {
    constructor() {
        this.klines = {};
        this.fha = {'server':'http://localhost/'};
        this.getFromLocal('hsj_stocks', item => {
            if (item && item['hsj_stocks']) {
                this.stockMarket = item['hsj_stocks'];
            } else {
                this.stockMarket = {};
                this.fetchStocksMarket();
            }
        });
        this.statsReport = new StatisticsReport();
        this.strategyManager = new MockStrategyManager();
    }

    log(...args) {
        var dt = new Date();
        var l = '[' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds()  + '] ' +  args.join(' ');
        console.log(l);
    }

    saveToLocal(data) {
        localforage.ready(() => {
            for (const k in data) {
                if (Object.hasOwnProperty.call(data, k)) {
                    localforage.setItem(k, JSON.stringify(data[k]));
                }
            }
        });
    }

    getFromLocal(key, cb) {
        localforage.ready(() => {
            localforage.getItem(key).then((val)=>{
                var item = null;
                if (!val) {
                    console.error('getItem', key, '=', val);
                } else {
                    item = JSON.parse(val);
                }
                if (typeof(cb) === 'function') {
                    cb(item);
                }
            }, ()=> {
                console.log('getItem error!', arguments);
            });
        });
    }

    removeLocal(key) {
        localforage.removeItem(key);
    }

    clearLocalStorage() {
        localforage.keys().then(ks => {
            console.log(ks);
        });
    }

    getSmiOffset(date) {
        if (!this.smiList || this.smiList.length == 0 || !date) {
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

    applyGuardLevel(strgrp, allklt) {
        console.log('GlobalManager.applyGuardLevel();');
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

    clearKlines() {
        for (var c in this.klines) {
            this.klines[c].removeAll();
        }
    }

    setupTestAccount() {
        this.testAccount = new TestingAccount();
        this.testAccount.loadAssets();
    }

    setupRetroAccount() {
        this.retroAccount = new RetrospectAccount();
        this.retroAccount.loadAssets();
        this.retroEngine = new RetroEngine();
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

    getLongStockCode(code) {
        if (code.length == 6 && this.stockMarket[code]) {
            return this.stockMarket[code].c;
        }
        return code;
    }

    stockEmLink(code) {
        if (this.stockMarket && this.stockMarket[code]) {
            return emStockUrl + this.stockMarket[code].c.toLowerCase() + emStockUrlTail;
        }
        return emStockUrl + (code.startsWith('00') ? 'sz' : 'sh') + code + emStockUrlTail;
    }

    stockAnchor(code) {
        var anchor = document.createElement('a');
        if (this.stockMarket && this.stockMarket[code]) {
            anchor.textContent = this.stockMarket[code].n;
        } else {
            anchor.textContent = code;
        }
        anchor.href = this.stockEmLink(code);
        anchor.target = '_blank';
        return anchor;
    }

    getCurrentHoldValue(code, count) {
        if (count > 0) {
            if (this.klines[code] && this.klines[code].klines) {
                return count * this.klines[code].getLatestKline('101').c;
            }
            console.log(code, count, 'no kline data');
        }
        return 0;
    }

    fetchStocksMarket() {
        utils.get(this.fha.server + 'api/allstockinfo', null, mkt => {
            var mktInfo = JSON.parse(mkt);
            for (var i = 0; i < mktInfo.length; ++i) {
                this.stockMarket[mktInfo[i].c.substring(2)] = mktInfo[i];
            }
            this.saveToLocal({'hsj_stocks': this.stockMarket});
        });
    }

    fetchStockKline(code, kltype, sdate) {
        var mktCode = this.getLongStockCode(code);
        var url = this.fha.server + 'api/stockhist?fqt=1&code=' + mktCode;
        if (!kltype) {
            url += '&kltype=101';
            kltype = '101';
        } else if (kltype == '30' || kltype == '60' || kltype == '120') {
            url += '&kltype=15';
            kltype = '15';
        } else if (kltype == '202' || kltype == '404' || kltype == '808') {
            url += '&kltype=101';
            kltype = '101';
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
        } else if (emjyBack.klines[code] && emjyBack.klines[code].klines && emjyBack.klines[code].klines[kltype]) {
            var ltime = emjyBack.klines[code].klines[kltype][emjyBack.klines[code].klines[kltype].length - 1].time;
            url += '&start=' + ltime.split(' ')[0];
        }

        utils.get(url, null, ksdata => {
            var kdata = JSON.parse(ksdata);
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', code, 'kltype:', kltype);
                return;
            }

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
