'use strict';

class KlineAlarms {
    constructor() {
        this.log = emjyBack.log;
        this.klineInterval = null;
        this.hitCount = 0;
        this.baseKlt = new Set(['1', '15', '101']);
        this.stocks = {};
        this.baseKlt.forEach(k => {
            this.stocks[k] = new Set();
        });
    }

    addStock(code) {
        this.baseKlt.forEach(k => {
            this.stocks[k].add(code);
        });
    }

    startTimer() {
        this.klineInterval = setInterval(() => {
            this.onTimer();
        }, 60000);
        this.onTimer();
        this.log('kline timer started!');
    }

    stopTimer() {
        if (this.klineInterval) {
            clearInterval(this.klineInterval);
            this.klineInterval = null;
            this.log('kline timer stopped! hitCount = ', this.hitCount);
            this.hitCount = 0;
        };
    }

    onTimer() {
        this.baseKlt.forEach(kltype => {
            var fetch = false;
            if (kltype == '101') {
                fetch = this.hitCount == 0;
            } else if (kltype == '1') {
                fetch = true;
            } else {
                fetch = this.hitCount % kltype == 0;
            };
            if (fetch) {
                if (kltype == '15') {
                    this.log('hitCount = ', this.hitCount);
                };
                this.stocks[kltype].forEach(s => {
                    emjyBack.fetchStockKline(s, kltype);
                });
            };
        });
        this.hitCount++;
    }
}

class DailyAlarm {
    constructor() {
        this.log = emjyBack.log;
        this.stocks = new Set();
    }

    addStock(code) {
        this.stocks.add(code);
    }

    removeStock(code) {
        if (this.stocks.has(code)) {
            this.stocks.delete(code);
        };
    }

    onTimer() {
        this.stocks.forEach(s => {
            emjyBack.fetchStockKline(s, '101');
        });
    }
}

class RtpTimer extends DailyAlarm {
    constructor() {
        super();
        this.rtInterval = null;
        this.ticks = 1000;
    }

    removeStock(code) {
        if (this.stocks.has(code)) {
            this.stocks.delete(code);
        };
        if (this.stocks.size == 0) {
            this.stopTimer();
        };
    }

    setTick(t) {
        this.ticks = t;
        if (this.rtInterval) {
            this.stopTimer();
            this.startTimer();
        };
    }

    startTimer() {
        this.log('RtpTimer started!');
        this.rtInterval = setInterval(() => {
            this.onTimer();
        }, this.ticks);
    }

    stopTimer() {
        if (this.rtInterval) {
            clearInterval(this.rtInterval);
            this.rtInterval = null;
            this.log('RtpTimer stopped!');
        };
    }

    onTimer() {
        this.stocks.forEach(s => {
            emjyBack.fetchStockSnapshot(s);
        });
    }
}

class ZtBoardTimer extends RtpTimer {
    constructor() {
        super();
        this.lazyInterval = null;
        this.lazyStocks = new Set();
    }

    removeStock(code) {
        if (this.stocks.has(code)) {
            this.stocks.delete(code);
        };
        if (this.lazyStocks.has(code)) {
            this.lazyStocks.delete(code);
        };
        if (this.stocks.size == 0 && this.lazyStocks.size == 0) {
            this.stopTimer();
        };
    }

    updateStockRtPrice(snapshot) {
        var code = snapshot.code;
        if (!this.stocks.has(code) && !this.lazyStocks.has(code)) {
            return;
        };
        var zdf = snapshot.realtimequote.zdf;
        if (zdf.charAt(zdf.length - 1) == '%') {
            zdf = zdf.substring(0, zdf.length - 1);
        };
        if (zdf > 6.5) {
            if (this.lazyStocks.has(code)) {
                this.lazyStocks.delete(code);
                this.stocks.add(code);
            };
        } else {
            if (this.stocks.has(code)) {
                this.stocks.delete(code);
                this.lazyStocks.add(code);
            };
        };
    }

    startTimer() {
        super.startTimer();
        this.lazyInterval = setInterval(() => {
            this.onLazyTimer();
        }, 180000); // 3 * 60 * 1000 (3 min)
        this.onLazyTimer();
    }

    stopTimer() {
        super.stopTimer();
        if (this.lazyInterval) {
            clearInterval(this.lazyInterval);
            this.lazyInterval = null;
        };
    }

    onLazyTimer() {
        this.lazyStocks.forEach(s => {
            emjyBack.fetchStockSnapshot(s);
        });
    }
}
