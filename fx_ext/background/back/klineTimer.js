'use strict';

class DailyAlarm {
    constructor() {
        this.baseKlt = new Set(['1', '15', '101']);
    }

    onTimer() {
        emjyBack.log('daily alarm start update daily kline');
        this.baseKlt.forEach(kltype => {
            for (const acc of Object.values(emjyBack.all_accounts)) {
                acc.stocks.forEach(s => {
                    if (s.strategies) {
                        s.strategies.checkStockRtKlines(kltype);
                    }
                });
            }
        });
        emjyBack.log('daily alarm update daily kline done!');
    }
}

class KlineAlarms extends DailyAlarm {
    constructor() {
        super();
        this.baseKlt = new Set(['1', '15']);
        this.hitCount = 0;
        this.klineInterval = null;
    }

    startTimer() {
        this.klineInterval = setInterval(() => {
            this.onTimer();
        }, 60000);
        this.onTimer();
        emjyBack.log('kline timer started!');
    }

    stopTimer() {
        if (this.klineInterval) {
            clearInterval(this.klineInterval);
            this.klineInterval = null;
            emjyBack.log('kline timer stopped! hitCount = ', this.hitCount);
        };
    }

    onTimer() {
        this.baseKlt.forEach(kltype => {
            var fetch = false;
            if (kltype == '1') {
                fetch = true;
            } else {
                fetch = this.hitCount % kltype == 0;
            };
            if (fetch) {
                for (const acc of Object.values(emjyBack.all_accounts)) {
                    acc.stocks.forEach(s => {
                        if (s.strategies) {
                            s.strategies.checkStockRtKlines(kltype);
                        }
                    });
                }
            };
        });
        this.hitCount++;
    }
}

class OtpAlarm {
    onTimer() {
        for (const acc of Object.values(emjyBack.all_accounts)) {
            acc.stocks.forEach(s => {
                if (s.strategies) {
                    s.strategies.checkStockRtSnapshot(true);
                }
            });
        }
    }
}

class RtpTimer {
    constructor(ticks=5000) {
        this.rtInterval = null;
        this.ticks = ticks;
    }

    setTick(t) {
        this.ticks = t;
        if (this.rtInterval) {
            this.stopTimer();
            this.startTimer();
        };
    }

    startTimer() {
        emjyBack.log('RtpTimer started!');
        this.rtInterval = setInterval(() => {
            this.onTimer();
        }, this.ticks);
    }

    stopTimer() {
        if (this.rtInterval) {
            clearInterval(this.rtInterval);
            this.rtInterval = null;
            emjyBack.log('RtpTimer stopped!');
        };
    }

    onTimer() {
        for (const acc of Object.values(emjyBack.all_accounts)) {
            acc.stocks.forEach(s => {
                if (s.strategies) {
                    s.strategies.checkStockRtSnapshot(false, this.ticks > 2000);
                }
            });
        }
    }
}

class ZtBoardTimer extends RtpTimer {
    constructor() {
        super(300);
    }
}
