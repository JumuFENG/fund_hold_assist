'use strict';
let emStockUrl = 'http://quote.eastmoney.com/concept/';
let emStockUrlTail = '.html#fullScreenChart';

class GlobalManager {
    constructor() {
        this.klines = {};
        this.fha = {'server':'http://localhost/'};
        this.getFromLocal('fha_server', fha => {
            if (fha) {
                this.fha = fha;
            }
        });
        this.getFromLocal('hsj_stocks', item => {
            if (item) {
                this.stockMarket = item;
            } else {
                this.stockMarket = {};
                this.fetchStocksMarket();
            }
        });
        this.statsReport = new StatisticsReport();
        this.strategyManager = new MockStrategyManager();
    }

    log(...args) {
        console.log(`[${new Date().toLocaleTimeString('zh',{hour12:false})}] ${args.join(' ')}`);
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

    saveToFile(data, filename) {
        const lnk = document.createElement('a');
        var blob = new Blob(data, {type: 'application/text'});
        lnk.href = URL.createObjectURL(blob);
        lnk.download = filename;
        lnk.click();
        URL.revokeObjectURL(lnk.href);
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

    calcBuyCount(amount, price) {
        var ct = (amount / 100) / price;
        var d = ct - Math.floor(ct);
        if (d <= ct * 0.15) {
            return 100 * Math.floor(ct);
        };
        return 100 * Math.ceil(ct);
    }

    getStockZdf(code, name='') {
        if (code.startsWith('68') || code.startsWith('30')) {
            return 20;
        }
        if (code.startsWith('60') || code.startsWith('00')) {
            return 10;
        }
        return 30;
    }

    calcZtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.floor(lclose * 130) / 100;
        }
        return Math.round(lclose * 100 + lclose * zdf + 0.00000001) / 100;
    }

    calcDtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.ceil(lclose * 70) / 100;
        }
        return Math.round(lclose * 100 - lclose * zdf + 0.00000001) / 100;
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
                cb(code);
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

    trySellStock(code, price, count, account) {
        var sellAccount = this.normalAccount;
        if (account) {
            if (this.retroAccount && account == this.retroAccount.keyword) {
                sellAccount = this.retroAccount;
            } else if (this.testAccount && account == this.testAccount.keyword) {
                sellAccount = this.testAccount;
            } else {
                console.log('Error, no valid account', account);
                return Promise.resolve();
            }
        };

        return sellAccount.sellStock(code, price, count).then(sd => {
            var stk = sellAccount.getStock(code);
            if (stk) {
                if (!stk.strategies) {
                    sellAccount.applyStrategy(code, {grptype: 'GroupStandard', strategies: {'0': {key: 'StrategySellELS', enabled: false, cutselltype: 'all', selltype: 'all'}}, transfers: {'0': {transfer: '-1'}}, amount: '5000'});
                }
                if (sd) {
                    stk.strategies.buydetail.addSellDetail(sd);
                }
            }
            return sd;
        });
    }

    tryBuyStock(code, price, count, account) {
        let buyAccount = this.normalAccount;
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

        return buyAccount.buyStock(code, price, count).then(bd => {
            var stk = buyAccount.getStock(code);
            if (stk) {
                if (!stk.strategies) {
                    buyAccount.addStockStrategy(stk, strgrp);
                }
                stk.strategies.buydetail.addBuyDetail(bd);
            }
            return bd;
        });
    }

    getLongStockCode(code) {
        if (code.length == 6) {
            if (this.stockMarket[code]) {
                return this.stockMarket[code].c;
            } else {
                return ((code.startsWith('60') || code.startsWith('68')) ? 'SH' : 'SZ') + code;
            }
        }
        return code;
    }

    stockEmLink(code) {
        if (this.stockMarket && this.stockMarket[code]) {
            return emStockUrl + this.stockMarket[code].c.toLowerCase() + emStockUrlTail;
        }
        return emStockUrl + (code.startsWith('60') || code.startsWith('68') ? 'sh' : 'sz') + code + emStockUrlTail;
    }

    stockName(code) {
        if (this.stockMarket && this.stockMarket[code]) {
            return this.stockMarket[code].n;
        }
        return code;
    }

    stockAnchor(code) {
        var anchor = document.createElement('a');
        if (code.length > 6) {
            code = code.substring(2);
        }
        anchor.textContent = this.stockName(code);
        anchor.href = this.stockEmLink(code);
        anchor.target = '_blank';
        return anchor;
    }

    stockNoticeAnchor(code) {
        var anchor = document.createElement('a');
        if (code.length > 6) {
            code = code.substring(2);
        }
        anchor.textContent = '公告';
        anchor.href = 'https://data.eastmoney.com/notices/stock/' + code + '.html';
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
        fetch(this.fha.server + 'api/allstockinfo').then(r=>r.json()).then(mkt => {
            for (var i = 0; i < mkt.length; ++i) {
                this.stockMarket[mkt[i].c.substring(2)] = mkt[i];
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

        fetch(url).then(r=>r.json()).then(kdata => {
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', code, 'kltype:', kltype);
                return;
            }

            var klmessage = {kltype, kline:{data:{klines:[]}}};
            kdata.forEach(kl => {
                klmessage.kline.data.klines.push(kl[1] + ',' + kl[5] + ',' + kl[2] + ',' + kl[3] + ',' + kl[4] + ',' + kl[8] + ',' + kl[6] + ',' + kl[7]);
            });
            if (!this.klines[code]) {
                this.klines[code] = new KLine(code);
            }
            this.klines[code].updateRtKline(klmessage);
            this.klines[code].save();
        });
    }

    fetchStockBks(stocks) {
        const ssize = 440;
        if (stocks.length > ssize) {
            let i = 0;
            while (i < stocks.length) {
                let stks = stocks.slice(i, i + ssize);
                this.fetchStockBks(stks);
                i += ssize;
            }
            return;
        }
        var url = this.fha.server + 'stock?act=stockbks&stocks=' + stocks.join(',');
        fetch(url).then(r=>r.json()).then(sbks => {
            if (!this.stock_bks) {
                this.stock_bks = {};
            }
            for (let c in sbks) {
                this.stock_bks[c] = sbks[c];
            }
        });
    }

    getDailyKlineSinceMonthAgo(code, kltype, sdate) {
        var zdate = new Date(sdate);
        zdate.setMonth(zdate.getMonth() - 1);
        this.fetchStockKline(code, kltype, utils.dateToString(zdate));
    }

    checkExistingKlines(code, sdate, kltype, klnocheckold) {
        if (klnocheckold && this.klines[code].klines[kltype][0].time == sdate) {
            return
        }
        if (this.klines[code].klines[kltype][0].time >= sdate) {
            this.klines[code].klines[kltype] = [];
            console.log(code, sdate);
            this.getDailyKlineSinceMonthAgo(code, kltype, sdate);
        }
    }

    checkExistingKlineLatest(code, kltype, edate) {
        if (!edate) {
            edate = guang.getTodayDate('-');
        }

        var kl = this.klines[code].getLatestKline(kltype);
        if (!kl) {
            this.getDailyKlineSinceMonthAgo(code, kltype, edate);
            return false;
        }
        if (kl.time == edate) {
            return true;
        }
        this.fetchStockKline(code, kltype, kl.time);
        return false;
    }

    getKlData(code, kltype, start, end) {
        if (!this.klines[code] || !this.klines[code].klines[kltype]) {
            return;
        }

        var klines = this.klines[code].klines[kltype];
        var sidx = klines.findIndex(kl => kl.time == start);
        if (sidx < 0) {
            return;
        }
        var eidx = klines.length;
        if (end) {
            var t = klines.findIndex(kl => kl.time == end);
            if (t > 0) {
                eidx = t + 1;
            }
        }
        return klines.slice(sidx, eidx);
    }

    prepareKlines(code, sdate, kltype, klnocheckold) {
        if (!this.klines[code]) {
            this.loadKlines(code, lcode => {
                if (!this.klines[lcode] || !this.klines[lcode].klines || !this.klines[code].klines[kltype]) {
                    this.getDailyKlineSinceMonthAgo(lcode, kltype, sdate);
                } else {
                    this.checkExistingKlines(lcode, sdate, kltype, klnocheckold);
                }
            });
        } else {
            this.checkExistingKlines(code, sdate, kltype, klnocheckold);
        }
    }
}

var emjyBack = new GlobalManager();
window.addEventListener('load', _ => {
    emjyBack.fha.server = location.origin + '/';
});
