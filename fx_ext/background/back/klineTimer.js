'use strict';

class KlineAlarms {
    constructor() {
        this.log = console.log;
        this.klineInterval = null;
        this.hitCount = 0;
        this.klineStocks = {};
    }

    addStock(code, kltype) {
        if (this.klineStocks[kltype] === undefined) {
            this.klineStocks[kltype] = new Set();
        };
        this.klineStocks[kltype].add(code);
    }

    startTimer() {
        this.klineInterval = setInterval(() => {
            this.onTimer();
        }, 60000);
    }

    stopTimer() {
        if (this.klineInterval) {
            clearInterval(this.klineInterval);
            this.klineInterval = null;
            this.hitCount = 0;
        };
    }

    onTimer() {
        this.hitCount++;
        var kltypes = ['1', '5', '15', '30', '60', '120', '101', '102', '103', '104', '105', '106'];
        var watchingKlt = [];
        for (var i = 0; i < kltypes.length; i++) {
            if (this.klineStocks[kltypes[i]] !== undefined) {
                watchingKlt.push(kltypes[i]);
            };
        };
        for (var i = 0; i < watchingKlt.length; i++) {
            var kltype = watchingKlt[i];
            var fetch = false;
            if (kltype > 100 && this.hitCount == 1) {
                fetch = true;
            } else if (kltype == '1') {
                fetch = true;
            } else if (this.hitCount % kltype == 0) {
                fetch = true;
            };
            if (fetch) {
                this.klineStocks[kltype].forEach(s => {
                    emjyBack.fetchStockKline(s, kltype);
                });
            };
        };
    }
}

class ZtBoardTimer {
    constructor() {
        this.boardInterval = null;
        this.ztStocks = new Set();
    }

    addStock(code) {
        this.ztStocks.add(code);
    }

    removeStock(code) {
        if (this.ztStocks.has(code)) {
            this.ztStocks.delete(code);
        };
        if (this.ztStocks.size == 0) {
            this.stopTimer();
        };
    }

    startTimer() {
        if (this.ztStocks.size == 0) {
            return;
        };
        this.boardInterval = setInterval(() => {
            this.onTimer();
        }, 10000);
    }

    stopTimer() {
        if (this.boardInterval) {
            clearInterval(this.boardInterval);
            this.boardInterval = null;
        };
    }

    onTimer() {
        this.ztStocks.forEach(s => {
            emjyBack.fetchStockSnapshot(s);
        });
    }
}
