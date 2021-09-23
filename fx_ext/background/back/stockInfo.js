'use strict';

class KLine {
    constructor(code) {
        this.code = code;
        this.storeKey = 'kline_' + this.code;
        this.baseKlt = new Set(['1', '15', '101']);
        this.factors = [2, 4, 8];
    }

    loadSaved() {
        chrome.storage.local.get(this.storeKey, item => {
            if (item && item[this.storeKey]) {
                this.klines = item[this.storeKey];
            };
        });
    }

    save() {
        if (this.klines) {
            var stockKlines = {};
            stockKlines[this.storeKey] = this.klines;
            chrome.storage.local.set(stockKlines);
        };
    }

    removeAll() {
        chrome.storage.local.remove(this.storeKey);
    }

    getKline(kltype) {
        return this.klines[kltype];
    }

    parseKlines(kline, stime = '0', kltype = '1') {
        var klines = [];
        for (var i = 0; kline && i < kline.length; i++) {
            var kl = kline[i].split(',');
            var time = kl[0];
            var tDate = new Date(time);
            if (kltype == '101') {
                tDate.setHours(15);
            };
            if (time <= stime || new Date() < tDate) {
                continue;
            };

            var o = kl[1];
            var c = kl[2];
            var h = kl[3];
            var l = kl[4];
            var vr = kl[5];
            klines.push({time, o, c, h, l,vr});
        };
        return klines;
    }

    calcKlineMA(klines) {
        var len = 0;
        var sum = 0;
        var len5 = 0;
        var sum5 = 0;
        for (var i = 0; i < klines.length; i++) {
            sum += parseFloat(klines[i].c);
            sum5 += parseFloat(klines[i].c);
            if (len5 < 5) {
                len5 ++;
            } else {
                if (i >= 5) {
                    sum5 -= klines[i - 5].c;
                };
            };
            klines[i].ma5 = (sum5 / len5).toFixed(3);
            if (len < 18) {
                len ++;
            } else {
                if (i >= 18) {
                    sum -= klines[i - 18].c;
                };
            };
            klines[i].ma18 = (sum / len).toFixed(3);
        };

        // bss18 (for next kline buy sell state: u/unknown, b/buy, s/sell, h/hold, w/wait)
        if (klines.length < 2) {
            return;
        };
        klines[0].bss18 = 'u';
        klines[1].bss18 = 'u';
        for (var i = 1; i < klines.length; i++) {
            klines[i].bss18 = this.getBss18(klines[i - 1], klines[i]);
        };
    }

    appendKlines(klines, fecthed) {
        var sum5 = 0;
        for (var i = 1; i <= 5 && i <= klines.length; i++) {
            sum5 += parseFloat(klines[klines.length - i].c);
        };
        var sum18 = 0;
        for (var i = 1; i <= 18 && i <= klines.length; i++) {
            sum18 += parseFloat(klines[klines.length - i].c);
        };
        var len5 = klines.length >= 5 ? 5 : klines.length;
        var len18 = klines.length >= 18 ? 18 : klines.length;
        var lastTime = klines[klines.length - 1].time;
        fecthed.forEach(k => {
            if (k.time > lastTime) {
                sum5 += parseFloat(k.c);
                if (len5 < 5) {
                    len5 ++;
                } else {
                    sum5 -= klines[klines.length - 5].c;
                };
                k.ma5 = (sum5 / len5).toFixed(3);

                sum18 += parseFloat(k.c);
                if (len18 < 18) {
                    len18 ++;
                } else {
                    sum18 -= klines[klines.length - 18].c;
                };
                k.ma18 = (sum18 / len18).toFixed(3);

                k.bss18 = this.getBss18(klines[klines.length - 1], k);
                klines.push(k);
            };
        });
    }

    klineApproximatelyAboveMa18(kl) {
        if (kl.l - kl.ma18 > 0) {
            return true;
        };
        
        if (Math.min(kl.o, kl.c) - kl.ma18 > 0 && (kl.h - kl.l) * 0.8 <= Math.abs(kl.o - kl.c)) {
            return true;
        };
        return false;
    }

    klineApproximatelyBellowMa18(kl) {
        if (kl.h - kl.ma18 < 0) {
            return true;
        };

        if (Math.max(kl.o, kl.c) - kl.ma18 < 0 && (kl.h - kl.l) * 0.8 <= Math.abs(kl.o - kl.c)) {
            return true;
        };
        return false;
    }

    getBss18(klpre, klnew) {
        var bss18 = 'u';
        if (klnew.l - klnew.ma18 > 0 && this.klineApproximatelyAboveMa18(klpre)) {
            if (klpre.bss18 == 'u') {
                bss18 = 'b';
            } else {
                bss18 = klpre.bss18 == 'w' ? 'b' : 'h';
            };
        } else if (klnew.h - klnew.ma18 < 0 && this.klineApproximatelyBellowMa18(klpre)) {
            if (klpre.bss18 == 'u') {
                bss18 = 's';
            } else {
                bss18 = klpre.bss18 == 'h' ? 's' : 'w';
            };
        } else {
            bss18 = klpre.bss18;
            if (klpre.bss18 == 'b') {
                bss18 = 'h';
            } else if (klpre.bss18 == 's') {
                bss18 = 'w';
            };
        };
        return bss18;
    }

    updateRtKline(message) {
        var kltype = message.kltype;
        var stime = '0';
        if (this.klines && this.klines[kltype] && this.klines[kltype].length > 0) {
            stime = this.klines[kltype][this.klines[kltype].length - 1].time;
        };
        var klines = this.parseKlines(message.kline.data.klines, stime, kltype);
        var updatedKlt = [];
        if (klines.length > 0) {
            updatedKlt.push(kltype);
        };
        if (!this.klines) {
            this.klines = {};
        };
        if (this.klines[kltype] === undefined || this.klines[kltype].length == 0) {
            this.klines[kltype] = klines;
            this.calcKlineMA(this.klines[kltype]);
        } else {
            this.appendKlines(this.klines[kltype], klines);
        };
        if (this.baseKlt.has(kltype)) {
            this.factors.forEach(f => {
                if (this.fillUpKlinesBaseOn(kltype, f)) {
                    updatedKlt.push((kltype * f).toString());
                };
            });
        };
        return updatedKlt;
    }

    getFactoredKlines(klines, fac, stime = '0') {
        var fklines = [];
        var startIdx = 0;
        if (stime) {
            for (; startIdx < klines.length; startIdx++) {
                if (klines[startIdx].time > stime) {
                    break;
                };
            };
        };

        for (var i = startIdx; i < klines.length; i += fac) {
            if (klines.length - i >= fac) {
                var o = klines[i].o;
                var c = klines[i + fac - 1].c;
                var time = klines[i + fac - 1].time;
                var h = klines[i].h;
                var l = klines[i].l;
                var vr = 0;
                for (var j = 0; j < fac; j++) {
                    vr -= klines[i + j].vr;
                    if (klines[i + j].h > h) {
                        h = klines[i + j].h;
                    };
                    if (klines[i + j].l < l) {
                        l = klines[i + j].l;
                    };
                };
                if (vr < 0) {
                    vr = -vr;
                };
                fklines.push({time, o, c, h, l, vr});
            };
        };
        return fklines;
    }

    fillUpKlinesBaseOn(kltype, fac) {
        if (this.klines[kltype] === undefined || this.klines[kltype].length < fac) {
            return false;
        };

        var fklt = kltype * fac;
        if (this.klines[fklt] === undefined || this.klines[fklt].length == 0) {
            var fklines = this.getFactoredKlines(this.klines[kltype], fac);
            this.klines[fklt] = fklines;
            this.calcKlineMA(this.klines[fklt]);
            return fklines.length > 0;
        } else {
            var stime = this.klines[fklt][this.klines[fklt].length - 1].time;
            var fklines = this.getFactoredKlines(this.klines[kltype], fac, stime);
            this.appendKlines(this.klines[fklt], fklines);
            return fklines.length > 0;
        };
        return false;
    }
}

class StockInfo {
    constructor(stock) {
        this.code = stock.code;
        this.name = stock.name;
        this.market = stock.market;
        this.watching = stock.watching === undefined ? false : stock.watching;
        this.holdCost = stock.holdCost;
        this.holdCount = stock.holdCount;
        this.availableCount = stock.availableCount;
        this.costDetail = [];
        this.latestPrice = null;
        this.strategies = null;
        this.klines = new KLine(this.code);
    }

    updateRtPrice(snapshot) {
        if (!this.name) {
            this.name = snapshot.name;
        }
        this.latestPrice = snapshot.realtimequote.currentPrice;
        var rtInfo = {code: this.code, name: this.name};
        rtInfo.latestPrice = this.latestPrice;
        rtInfo.openPrice = snapshot.fivequote.openPrice;
        var buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
        rtInfo.buyPrices = buyPrices;
        var sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
        rtInfo.sellPrices = sellPrices;
        rtInfo.topprice = snapshot.topprice;
        rtInfo.bottomprice = snapshot.bottomprice;
        if (this.strategies) {
            this.strategies.check(rtInfo);
        };
        tradeAnalyzer.updateStockRtPrice(snapshot);
    }

    updateRtKline(message) {
        var updatedKlt = this.klines.updateRtKline(message);
        if (this.strategies) {
            this.strategies.checkKlines(this.klines, updatedKlt);
        };
    }

    loadKlines() {
        if (this.klines) {
            this.klines.loadSaved();
        };
    }

    saveKlines() {
        if (this.klines) {
            this.klines.save();
        };
    }

    deleteKlines() {
        if (this.klines) {
            this.klines.removeAll();
        };
    }
}
