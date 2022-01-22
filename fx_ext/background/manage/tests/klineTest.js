'use strict';

class MonkKline extends KLine {
    constructor() {
        super();
        this.klines = {};
    }

    loadSaved(cb) {
        if (typeof(cb) === 'function') {
            cb();
        }
    }

    save() {}

    removeAll() {}

    getNowTime() {
        return this._now;
    }

    setNowTime(dt) {
        this._now = dt;
    }

    monkSetKlines(kltype, klarr) {
        this.klines[kltype] = klarr;
        this.klines['1'] = klarr;
    }
}

class KlineTests {
    constructor() {
        this.kline = new MonkKline('test');
    }

    EQ(tname, expect, act) {
        if (expect != act) {
            console.log(tname, 'Failed! expect', expect, 'actual', act );
        }
    }

    testKlines1() {
        var oldKline =
        [{ "time": "2022-01-21 14:41", "o": "46.33", "c": "46.26", "h": "46.41", "l": "46.26", "v": "1235", "ma5": "46.282", "ma18": "46.402", "bss18": "w" },
        { "time": "2022-01-21 14:42", "o": "46.27", "c": "46.28", "h": "46.33", "l": "46.25", "v": "1221", "ma5": "46.288", "ma18": "46.386", "bss18": "w" },
        { "time": "2022-01-21 14:43", "o": "46.29", "c": "46.36", "h": "46.40", "l": "46.27", "v": "1597", "ma5": "46.306", "ma18": "46.378", "bss18": "w" },
        { "time": "2022-01-21 14:44", "o": "46.35", "c": "46.26", "h": "46.35", "l": "46.26", "v": "911", "ma5": "46.304", "ma18": "46.365", "bss18": "w" },
        { "time": "2022-01-21 14:45", "o": "46.25", "c": "46.22", "h": "46.29", "l": "46.21", "v": "1403", "ma5": "46.276", "ma18": "46.350", "bss18": "w" },
        { "time": "2022-01-21 14:46", "o": "46.22", "c": "46.21", "h": "46.30", "l": "46.10", "v": "3186", "ma5": "46.266", "ma18": "46.336", "bss18": "w" },
        { "time": "2022-01-21 14:47", "o": "46.20", "c": "46.19", "h": "46.24", "l": "46.02", "v": "2521", "ma5": "46.248", "ma18": "46.322", "bss18": "w" },
        { "time": "2022-01-21 14:48", "o": "46.21", "c": "46.17", "h": "46.24", "l": "46.17", "v": "1967", "ma5": "46.210", "ma18": "46.298", "bss18": "w" },
        { "time": "2022-01-21 14:49", "o": "46.18", "c": "46.12", "h": "46.19", "l": "46.12", "v": "1664", "ma5": "46.182", "ma18": "46.277", "bss18": "w" },
        { "time": "2022-01-21 14:50", "o": "46.12", "c": "46.16", "h": "46.19", "l": "46.11", "v": "2403", "ma5": "46.170", "ma18": "46.264", "bss18": "w" },
        { "time": "2022-01-21 14:51", "o": "46.16", "c": "46.17", "h": "46.25", "l": "46.10", "v": "3243", "ma5": "46.162", "ma18": "46.248", "bss18": "w" },
        { "time": "2022-01-21 14:52", "o": "46.16", "c": "46.10", "h": "46.16", "l": "46.08", "v": "2457", "ma5": "46.144", "ma18": "46.235", "bss18": "w" },
        { "time": "2022-01-21 14:53", "o": "46.12", "c": "46.13", "h": "46.17", "l": "46.12", "v": "2946", "ma5": "46.136", "ma18": "46.228", "bss18": "w" },
        { "time": "2022-01-21 14:54", "o": "46.12", "c": "46.04", "h": "46.12", "l": "46.02", "v": "1830", "ma5": "46.120", "ma18": "46.212", "bss18": "w" },
        { "time": "2022-01-21 14:55", "o": "46.03", "c": "46.05", "h": "46.10", "l": "46.03", "v": "1900", "ma5": "46.098", "ma18": "46.201", "bss18": "w" }];
        this.kline.monkSetKlines('1', oldKline);

        var klmessage1 = {"rc":0,"rt":17,"svr":181669475,"lt":1,"full":0,"data":{"code":"600085","market":1,"name":"同仁堂","klines":["2022-01-21 14:56,46.04,46.05,46.07,45.99,5327", "2022-01-21 14:57,46.05,46.02,46.07,46.02,2325"]}};
        this.kline.setNowTime(new Date('2022-01-21 14:56:50'));
        var pklines = this.kline.parseKlines(klmessage1.data.klines, '2022-01-21 14:55', '1');
        this.EQ('parseKlines', 1, pklines.length);
        var kl = this.kline.getIncompleteKline('1');
        if (!kl) {
            console.log('parseKlines error');
            return;
        }
        this.kline.appendKlines(this.kline.klines['1'], pklines);
        this.EQ('appendKlines', 16, this.kline.klines['1'].length);
        this.EQ('parseKlines imcomplete time', kl.time, '2022-01-21 14:57');
        this.EQ('kline 1 baseon 2', true, this.kline.fillUpKlinesBaseOn('1', 2));
        this.EQ('kline 1 baseon 2', 8, this.kline.klines['2'].length);
        var kl2 = this.kline.getIncompleteKline('2');
        this.EQ('kl2 incomplete', null, kl2);

        var klmessage2 = {"rc":0,"rt":17,"svr":181669475,"lt":1,"full":0,"data":{"code":"600085","market":1,"name":"同仁堂","klines":["2022-01-21 14:57,46.05,46.02,46.07,46.02,2325","2022-01-21 14:58,46.02,46.02,46.02,46.02,18"]}};
        this.kline.setNowTime(new Date('2022-01-21 14:57:50'));
        pklines = this.kline.parseKlines(klmessage2.data.klines, '2022-01-21 14:56', '1');
        this.EQ('parseKlines', 1, pklines.length);
        kl = this.kline.getIncompleteKline('1');
        if (!kl) {
            console.log('parseKlines error');
            return;
        }
        this.kline.appendKlines(this.kline.klines['1'], pklines);
        this.EQ('appendKlines', 17, this.kline.klines['1'].length);
        this.EQ('parseKlines imcomplete time', kl.time, '2022-01-21 14:58');
        this.EQ('kline 1 baseon 2', true, this.kline.fillUpKlinesBaseOn('1', 2));
        this.EQ('kline 1 baseon 2', 8, this.kline.klines['2'].length);
        kl2 = this.kline.getIncompleteKline('2');
        if (!kl2) {
            console.log('kl2 incomplete error');
            return;
        }
        this.EQ('kl2 incomplete', '2022-01-21 14:58', kl2.time);

        this.kline.setNowTime(new Date('2022-01-21 14:58:50'));
        var klmessage3 = {"rc":0,"rt":17,"svr":181669475,"lt":1,"full":0,"data":{"code":"600085","market":1,"name":"同仁堂","klines":["2022-01-21 14:58,46.02,46.02,46.02,46.02,18", "2022-01-21 14:59,46.02,46.02,46.02,46.02,0"]}};
        pklines = this.kline.parseKlines(klmessage3.data.klines, '2022-01-21 14:57', '1');
        this.EQ('parseKlines', 1, pklines.length);
        kl = this.kline.getIncompleteKline('1');
        if (!kl) {
            console.log('parseKlines error');
            return;
        }
        this.kline.appendKlines(this.kline.klines['1'], pklines);
        this.EQ('appendKlines', 18, this.kline.klines['1'].length);
        this.EQ('parseKlines imcomplete time', kl.time, '2022-01-21 14:59');
        this.EQ('kline 1 baseon 2', false, this.kline.fillUpKlinesBaseOn('1', 2));
        this.EQ('kline 1 baseon 2', 9, this.kline.klines['2'].length);
        kl2 = this.kline.getIncompleteKline('2');
        this.EQ('kl2 imcomplete', null, kl2);

        this.kline.setNowTime(new Date('2022-01-21 14:59:50'));
        var klmessage4 = {"rc":0,"rt":17,"svr":181669475,"lt":1,"full":0,"data":{"code":"600085","market":1,"name":"同仁堂","klines":["2022-01-21 14:59,46.02,46.02,46.02,46.02,0", "2022-01-21 15:00,45.95,45.95,45.95,45.95,6326"]}};
        pklines = this.kline.parseKlines(klmessage4.data.klines, '2022-01-21 14:58', '1');
        this.EQ('parseKlines 2', 1, pklines.length);
        kl = this.kline.getIncompleteKline('1');
        if (!kl) {
            console.log('parseKlines error');
            return;
        }
        this.kline.appendKlines(this.kline.klines['1'], pklines);
        this.EQ('appendKlines', 19, this.kline.klines['1'].length);
        this.EQ('parseKlines imcomplete time', kl.time, '2022-01-21 15:00');
        this.EQ('kline 1 baseon 2', true, this.kline.fillUpKlinesBaseOn('1', 2));
        this.EQ('kline 1 baseon 2', 9, this.kline.klines['2'].length);
        kl2 = this.kline.getIncompleteKline('2');
        if (kl2) {
            this.EQ('kl2 imcomplete time', kl2.time, '2022-01-21 15:00');
        } else {
            console.log('kl2 incompleted error!');
        }

        this.kline.setNowTime(new Date('2022-01-21 15:00:09'));
        pklines = this.kline.parseKlines(klmessage4.data.klines, '2022-01-21 14:59', '1');
        this.EQ('parseKlines 3', 1, pklines.length);
        this.EQ('kl imcomplete', null, this.kline.getIncompleteKline('1'));
        this.kline.appendKlines(this.kline.klines['1'], pklines);
        this.EQ('appendKlines', 20, this.kline.klines['1'].length);
        this.EQ('kline 1 baseon 2', false, this.kline.fillUpKlinesBaseOn('1', 2));
        this.EQ('kline 1 baseon 2', 10, this.kline.klines['2'].length);
        this.EQ('kl imcomplete 2', null, this.kline.getIncompleteKline('2'));
    }

    testKlines101() {
        
    }
}

function runAllTests() {
    var kt = new KlineTests();
    kt.testKlines1();
}
