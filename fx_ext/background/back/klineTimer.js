'use strict';


class AlarmBase {
    constructor(periods) {
        this.periods = [];
        if (typeof periods === 'string') {
            this.periods.push({start: periods});
        } else if (Array.isArray(periods)) {
            if (typeof periods[0] === 'string') {
                this.periods = periods.map(p => {return {start: p}; });
            } else if (Array.isArray(periods[0])) {
                this.periods = periods.map(p => {return {start: p[0], end: p[1]}; });
            }
        }
    }

    setupTimer() {
        const toPeriods = this.periods.filter(p => !p.end && !p.due);
        toPeriods.forEach(p => {
            const startTicks = this.getTicksTo(p.start);
            if (startTicks > 0) {
                setTimeout(() => {this.onTimer()}, startTicks);
            }
            p.due = true;
        });
        const lPeriods = this.periods.filter(p => p.end && !p.due);
        if (lPeriods.length == 0) {
            return;
        }
        const hp = lPeriods[0];
        const endTicks = this.getTicksTo(hp.end);
        const startTicksh = this.getTicksTo(hp.start);
        if (endTicks > 0) {
            setTimeout(() => this.startTimer(), startTicksh);
            setTimeout(() => {
                this.stopTimer();
                hp.due = true;
                this.setupTimer();
            }, endTicks);
        } else {
            hp.due = true;
            this.setupTimer();
        }
    }

    getTicksTo(tm) {
        let now = new Date();
        return new Date(now.toDateString() + ' ' + tm) - now;
    }

    setTick(t) {
        this.ticks = t;
        if (this.rtInterval) {
            this.stopTimer();
            this.startTimer();
        };
    }

    startTimer() {
        emjyBack.log(this.constructor.name, 'started!');
        if (!this.ticks) {
            this.ticks = 1000;
        }
        this.rtInterval = setInterval(() => {
            this.onTimer();
        }, this.ticks);
    }

    stopTimer() {
        if (this.rtInterval) {
            clearInterval(this.rtInterval);
            this.rtInterval = null;
            emjyBack.log(this.constructor.name, 'stopped!');
        };
    }

    onTimer() {
        console.log(this.constructor.name, 'onTimer');
    }
}

class DailyAlarm extends AlarmBase {
    constructor() {
        super('14:56:45');
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

class KlineTimer extends AlarmBase {
    constructor() {
        super([['9:30:55', '11:30'],['12:59:56', '14:56:58']]);
        this.baseKlt = new Set(['1', '15']);
        this.hitCount = 0;
        this.ticks = 60000;
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

class OtpAlarm extends AlarmBase{
    constructor(start) {
        super(start);
    }

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

class RtpTimer extends AlarmBase {
    constructor() {
        super([['9:30:01', '11:30'],['13:00:01', '14:57:02']]);
        this.ticks = 5000;
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


class alarmHub {
    static setupAlarms() {
        if (!this.klineAlarms) {
            this.klineAlarms = new KlineTimer();
        };
        if (!this.ztBoardTimer) {
            this.ztBoardTimer = new RtpTimer();
            this.ztBoardTimer.setTick(300);
        };
        if (!this.rtpTimer) {
            this.rtpTimer = new RtpTimer();
        };
        if (!this.dailyAlarm) {
            this.dailyAlarm = new DailyAlarm();
        };
        if (!this.otpAlarm) {
            this.otpAlarm = new OtpAlarm('9:30:2');
        }

        const randomTime = function() {
            const r = Math.floor(Math.random() * 100);
            var h = 9 + Math.floor(r/60);
            var m = (35 + r) % 60;
            if (m < 35) {
                h += 1;
            }
            return `${h}:${m}`;
        }
        const ralarm = new AlarmBase(randomTime());
        ralarm.onTimer = () => {
            emjyBack.tradeDailyRoutineTasks();
        }
        const talarm = new AlarmBase('10:00:00');
        talarm.onTimer = () => {
            this.rtpTimer.setTick(10000);
        }
        const bclose = new AlarmBase('14:59:38');
        bclose.onTimer = () => {
            emjyBack.tradeBeforeClose();
        }
        const closed = new AlarmBase('15:0:10');
        closed.onTimer = () => {
            emjyBack.tradeClosed();
        }

        guang.isTodayTradingDay().then(trade => {
            if (trade) {
                [talarm, talarm, bclose, closed,
                    this.klineAlarms, this.dailyAlarm, this.otpAlarm, this.rtpTimer, this.ztBoardTimer,
                ].forEach(a => {
                    a.setupTimer();
                });
            } else {
                console.log('not trading day! start timer manually if necessary!');
            }
        });
    }

    static startAllTimers() {
        this.ztBoardTimer?.startTimer();
        this.rtpTimer?.setTick(10000);
        this.rtpTimer?.startTimer();
        this.klineAlarms?.startTimer();
    }

    static stopAllTimers() {
        this.ztBoardTimer?.stopTimer();
        this.rtpTimer?.stopTimer();
        this.klineAlarms?.stopTimer();
    }
}
