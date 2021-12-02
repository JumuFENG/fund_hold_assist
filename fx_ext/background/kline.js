'use strict';

class KLine {
    constructor(code) {
        this.code = code;
        this.storeKey = 'kline_' + this.code;
        this.baseKlt = new Set(['1', '15', '101']);
        this.factors = [2, 4, 8];
        this.incompleteKline = {};
    }

    loadSaved() {
        chrome.storage.local.get(this.storeKey, item => {
            if (item && item[this.storeKey]) {
                this.klines = item[this.storeKey];
                for (var i in this.klines) {
                    if (this.klines[i].length > 600 && i - 15 < 0) {
                        this.klines[i] = this.klines[i].slice(this.klines[i].length - 600);
                    }
                }
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
        if (this.klines !== undefined) {
            this.klines = {};
        };
        chrome.storage.local.remove(this.storeKey);
    }

    getKline(kltype) {
        return this.klines[kltype];
    }

    getIncompleteKline(kltype) {
        if (this.incompleteKline) {
            return this.incompleteKline[kltype];
        };
        return null;
    }

    getLatestKline(kltype) {
        var kl = this.getIncompleteKline(kltype);
        if (kl) {
            return kl;
        };
        if (this.klines[kltype] && this.klines[kltype].length > 0) {
            return this.klines[kltype][this.klines[kltype].length - 1];
        };
        return null;
    }

    parseKlines(kline, stime = '0', kltype = '1') {
        var klines = [];
        this.incompleteKline[kltype] = null;
        for (var i = 0; kline && i < kline.length; i++) {
            var kl = kline[i].split(',');
            var time = kl[0];
            var tDate = new Date(time);
            var o = kl[1];
            var c = kl[2];
            var h = kl[3];
            var l = kl[4];
            var v = kl[5];
            if (kltype == '101') {
                tDate.setHours(15);
            };
            if (time <= stime) {
                continue;
            }
            if (new Date() < tDate) {
                if (kltype == '15' && (tDate - new Date()) > 200000) {
                    continue;
                }
                if (kltype == '101' && (tDate - new Date()) > 600000) {
                    continue;
                }
                this.incompleteKline[kltype] = {time, o, c, h, l, v};
                continue;
            };
            klines.push({time, o, c, h, l, v});
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

    incompleteMA(klines, kl, len) {
        var ma = parseFloat(kl.c);
        if (klines.length < len - 1) {
            for (var i = 0; i < klines.length; i++) {
                ma += parseFloat(klines[i].c);
            };
            return ma / (klines.length + 1);
        };
        for (var i = klines.length - len + 1; i < klines.length; i++) {
            ma += parseFloat(klines[i].c);
        };
        return ma / len;
    }

    calcIncompleteKlineMA() {
        for (var kltype in this.incompleteKline) {
            var kl = this.incompleteKline[kltype];
            if (!kl) {
                continue;
            };
            var klines = this.klines[kltype];
            if (!klines || klines.length < 1) {
                this.incompleteKline[kltype].ma5 = kl.c;
                this.incompleteKline[kltype].ma18 = kl.c;
                this.incompleteKline[kltype].bss18 = 'u';
            } else {
                kl.ma5 = this.incompleteMA(klines, kl, 5);
                kl.ma18 = this.incompleteMA(klines, kl, 18);
                this.incompleteKline[kltype].ma5 = kl.ma5;
                this.incompleteKline[kltype].ma18 = kl.ma18;
                this.incompleteKline[kltype].bss18 = this.getBss18(klines[klines.length - 1], kl);
            };
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
        this.calcIncompleteKlineMA();
        return updatedKlt;
    }

    getFactoredKlines(kltype, fac, stime = '0') {
        var klines = this.klines[kltype];
        var fklines = [];
        var startIdx = 0;
        if (stime) {
            for (; startIdx < klines.length; startIdx++) {
                if (klines[startIdx].time > stime) {
                    break;
                };
            };
        };

        var inkl = this.getIncompleteKline(kltype);
        this.incompleteKline[kltype * fac] = null;
        for (var i = startIdx; i < klines.length; i += fac) {
            var o = klines[i].o;
            var c = 0;
            var time = klines[i].time;
            var h = klines[i].h;
            var l = klines[i].l;
            var v = 0;
            if (klines.length - i >= fac) {
                c = klines[i + fac - 1].c;
                time = klines[i + fac - 1].time;
                for (var j = 0; j < fac; j++) {
                    v -= klines[i + j].v;
                    if (klines[i + j].h - h > 0) {
                        h = klines[i + j].h;
                    };
                    if (klines[i + j].l - l < 0) {
                        l = klines[i + j].l;
                    };
                };
                if (v < 0) {
                    v = -v;
                };
                fklines.push({time, o, c, h, l, v});
            } else if (klines.length - i + 1 == fac && inkl) {
                time = inkl.time;
                c = inkl.c;
                h = inkl.h;
                l = inkl.l;
                v -= inkl.v;
                for (var j = i; j < klines.length; ++j) {
                    v -= klines[j].v;
                    if (klines[j].h - h > 0) {
                        h = klines[j].h;
                    };
                    if (klines[j].l - l < 0) {
                        l = klines[j].l;
                    };
                };
                if (v < 0) {
                    v = -v;
                };
                this.incompleteKline[kltype * fac] = {time, o, c, h, l, v};
            };
        };
        return fklines;
    }

    fillUpKlinesBaseOn(kltype, fac) {
        if (this.klines[kltype] === undefined || this.klines[kltype].length < fac - 1) {
            return false;
        };

        if (this.klines[kltype].length == fac - 1 && !this.getIncompleteKline(kltype)) {
            return false;
        };

        var fklt = kltype * fac;
        if (this.klines[fklt] === undefined || this.klines[fklt].length == 0) {
            var fklines = this.getFactoredKlines(kltype, fac);
            this.klines[fklt] = fklines;
            this.calcKlineMA(this.klines[fklt]);
            return fklines.length > 0 || this.getIncompleteKline(fklt);
        } else {
            var stime = this.klines[fklt][this.klines[fklt].length - 1].time;
            var fklines = this.getFactoredKlines(kltype, fac, stime);
            this.appendKlines(this.klines[fklt], fklines);
            return fklines.length > 0 || this.getIncompleteKline(fklt);
        };
        return false;
    }

    getVolScale(kltype, time, n) {
        // get v scale for time based on mvol(n)
        var kline = this.klines[kltype];
        var tidx = kline.findIndex(kl => kl.time == time);
        if (tidx < 1) {
            console.log('error: no kline for code = ', this.code, ' time=', time);
            return 1;
        }
        var totalVol = 0;
        for (var i = 1; i <= n; i++) {
            if (tidx - i < 0) {
                break;
            }
            totalVol -= kline[tidx - i].v;
        }
        if (totalVol < 0) {
            totalVol = - totalVol;
        }
        var va = totalVol / n;
        if (tidx < n) {
            va = totalVol / tidx;
        }
        return kline[tidx].v / va;
    }

    continuouslyBellow(kltype='101', n = 5) {
        var kline = this.klines[kltype];
        if (kline.length < n) {
            return false;
        }
        for (var i = 1; i <= n; i++) {
            var kl = kline[kline.length - i];
            if (kl.bss18 - kl.o > 0 && kl.bss18 - kl.c > 0) {
                continue;
            } else {
                return false;
            }
        }
        return true;
    }
}
