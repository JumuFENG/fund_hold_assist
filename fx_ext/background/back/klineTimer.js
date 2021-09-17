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

    addStock(code, kltype) {
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
            this.hitCount = 0;
            this.log('kline timer stopped!');
        };
    }

    onTimer() {
        this.baseKlt.forEach(kltype => {
            var fetch = false;
            if (kltype == '101' && this.hitCount == 0) {
                fetch = true;
            } else if (kltype == '1') {
                fetch = true;
            } else if (this.hitCount % kltype == 0) {
                fetch = true;
            };
            if (fetch) {
                this.stocks[kltype].forEach(s => {
                    emjyBack.fetchStockKline(s, kltype);
                });
            };
        });
        this.hitCount++;
    }
}

class RtpTimer {
    constructor() {
        this.log = emjyBack.log;
        this.rtInterval = null;
        this.ticks = 1000;
        this.stocks = new Set();
    }

    addStock(code) {
        this.stocks.add(code);
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
        this.onTimer();
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

