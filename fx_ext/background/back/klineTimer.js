'use strict';

(function(){
const { logger, svrd } = xreq('./background/nbase.js');
const { guang } = xreq('./background/guang.js');
const { feng } = xreq('./background/feng.js');
const { accld } = xreq('./background/accounts.js');

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
        logger.info(this.constructor.name, 'started!', this.ticks);
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
            logger.info(this.constructor.name, 'stopped!');
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
        logger.info('daily alarm start update daily kline');
        this.baseKlt.forEach(kltype => {
            for (const acc of Object.values(accld.all_accounts)) {
                acc.stocks.forEach( async (s) => {
                    if (s.strategies) {
                        const matched = await s.strategies.checkStockRtKlines(kltype);
                        alarmHub.onStrategyMatched(acc, s, matched);
                    }
                });
            }
        });
        logger.info('daily alarm update daily kline done!');
    }
}

class KlineTimer extends AlarmBase {
    constructor() {
        super([['9:29:56', '11:30'],['12:59:56', '14:56:58']]);
        this.baseKlt = new Set(['1', '15']);
        this.hitCount = 1;
        this.ticks = 60000;
    }

    onTimer() {
        this.baseKlt.forEach(kltype => {
            if (kltype - 1 != 0 && this.hitCount % kltype != 0) {
                return;
            }
            for (const acc of Object.values(accld.all_accounts)) {
                acc.stocks.forEach(async (s) => {
                    if (!s.strategies) {
                        return;
                    }
                    const matched = await s.strategies.checkStockRtKlines(kltype);
                    alarmHub.onStrategyMatched(acc, s, matched);
                });
            }
        });
        this.hitCount++;
    }
}

class OtpAlarm extends AlarmBase{
    constructor(start) {
        super(start);
    }

    onTimer() {
        alarmHub.updateAllSnapshots(1000).then(() => {
            for (const acc of Object.values(accld.all_accounts)) {
                acc.stocks.forEach(async (s) => {
                    if (s.strategies) {
                        const matched = await s.strategies.checkStockRtSnapshot(true, this.ticks > 2000);
                        alarmHub.onStrategyMatched(acc, s, matched);
                    }
                });
            }
        });
    }
}

class RtpTimer extends AlarmBase {
    constructor() {
        super([['9:30:01', '11:30'],['13:00:01', '14:57:02']]);
        this.ticks = 5000;
    }

    onTimer() {
        let promise;
        if (this.ticks < 2000) {
            const hcodes = Object.values(accld.all_accounts)
                .flatMap(acc => acc.stocks.filter(s => s.strategies && s.strategies.frequencyUpdating()).map(s => s.code));
            promise = feng.fetchStocksQuotes([...new Set(hcodes)], this.ticks);
        } else {
            promise = alarmHub.updateAllSnapshots(this.ticks);
        }
        promise.then(() => {
            for (const acc of Object.values(accld.all_accounts)) {
                acc.stocks.forEach(async (s) => {
                    if (s.strategies) {
                        const matched = await s.strategies.checkStockRtSnapshot(false, this.ticks > 2000);
                        alarmHub.onStrategyMatched(acc, s, matched);
                    }
                });
            }
        });
    }
}

class AccOrderTimer extends RtpTimer {
    constructor() {
        super();
        this.ticks = 10*60000;
        this.completedZt = ['已成', '已撤', '废单']; // ['待报', '已报'],
    }

    addCheckingTask(acc, deal) {
        if (!this.checkingTasks) {
            this.checkingTasks = {};
        }
        if (!this.checkingTasks[acc]) {
            this.checkingTasks[acc] = [];
        }

        this.checkingTasks[acc].push(deal);
        this.scheduleCheckingTask();
    }

    scheduleCheckingTask(delay) {
        if (!this.taskIndicator) {
            this.taskIndicator = setTimeout(() => {
                Promise.all(Object.keys(this.checkingTasks).map(acc => {
                    accld.all_accounts[acc].checkOrders().then(deals => {
                        const cmpsid = deals.filter(d => this.completedZt.includes(d.Wtzt)).map(d => d.Wtbh);
                        const finished = this.checkingTasks[acc].filter(d => cmpsid.includes(d.Wtbh));
                        logger.info(this.constructor.name, 'finished orders:', finished.length, finished);
                        this.checkingTasks[acc] = this.checkingTasks[acc].filter(d => !cmpsid.includes(d.Wtbh));
                        return deals.filter(d => !cmpsid.includes(d.Wtbh));
                    })
                })).then((deals) => {
                    const icmpdeals = deals.flat().filter(d => d);
                    if (icmpdeals.length == 0) {
                        return;
                    }
                    const lastsj = Math.max(...icmpdeals.map(d => d.Wtsj));
                    if (Object.values(this.checkingTasks).flat().length > 0) {
                        const now = new Date();
                        let diff = now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), (lastsj/10000).toFixed(), (lastsj/100%100).toFixed(), lastsj%100);
                        if (diff < 5000) {
                            diff = 5000;
                        }
                        if (diff < 10*60000) {
                            this.scheduleCheckingTask(diff);
                        }
                    }
                });
                this.taskIndicator = null;
            }, delay ?? 5000);
            this.setTick(10*60000);
        }
    }

    onTimer() {
        Promise.all(['normal', 'collat'].map(acc=>accld.all_accounts[acc].checkOrders())).then(([deals0, deals1]) => {
            const allDeals = deals0.concat(deals1);
            const waitings = allDeals.filter(d => !this.completedZt.includes(d.Wtzt));
            logger.info(this.constructor.name, 'onTimer, deals=', allDeals.length, 'waitings=', waitings.length);
            if (waitings.length == 0) {
                if (this.ticks !== 10*60000) {
                    this.setTick(10*60000);
                }
                return;
            }
        });
    }
}


const alarmHub = {
    config: null,
    setupAlarms() {
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
        if (!this.orderTimer) {
            this.orderTimer = new AccOrderTimer();
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
            alarmHub.tradeDailyRoutineTasks();
        }
        const talarm = new AlarmBase('10:00:00');
        talarm.onTimer = () => {
            this.rtpTimer.setTick(10000);
        }
        const bclose = new AlarmBase('14:59:38');
        bclose.onTimer = () => {
            accld.normalAccount.buyFundBeforeClose();
            accld.collateralAccount.buyFundBeforeClose();
        }
        const closed = new AlarmBase('15:0:10');
        closed.onTimer = () => {
            accld.normalAccount.buyFundBeforeClose();
            for (const acc of Object.values(accld.all_accounts)) {
                acc.loadDeals();
                acc.fillupGuardPrices();
            }
            const allstks = Object.values(accld.all_accounts).map(a => a.stocks.map(x=>x.code)).flat();
            let holdcached = feng.dumpCached(allstks);
            svrd.saveToLocal({'hsj_stocks': holdcached});

            try {
                accld.normalAccount.save();
                accld.collateralAccount.save();
                accld.track_accounts.forEach(acc => {acc.save()});
            } catch (e) {
                logger.err(e);
            }
            this.tradeClosed();
        }

        guang.isTodayTradingDay().then(trade => {
            if (trade) {
                const timers = [
                    ralarm, bclose, this.orderTimer,
                    talarm, closed, this.otpAlarm, this.dailyAlarm];
                if (this.config.enable_rtp_check) {
                    timers.push(this.rtpTimer);
                    timers.push(this.ztBoardTimer);
                }
                if (this.config.enable_kl_check) {
                    timers.push(this.klineAlarms);
                }
                timers.forEach(a => {
                    a.setupTimer();
                });
            } else {
                console.log('not trading day! start timer manually if necessary!');
            }
        });
    },
    startAllTimers() {
        this.ztBoardTimer?.startTimer();
        this.rtpTimer?.setTick(10000);
        this.rtpTimer?.startTimer();
        this.klineAlarms?.startTimer();
    },
    stopAllTimers() {
        this.ztBoardTimer?.stopTimer();
        this.rtpTimer?.stopTimer();
        this.klineAlarms?.stopTimer();
    },
    async updateAllSnapshots(cacheTime=60000) {
        const allstks = Array.from(new Set(
            Object.values(accld.all_accounts)
            .map(
                acc => acc.stocks.filter(s => s.strategies && s.strategies.strategies && Object.values(s.strategies.strategies).filter(t=>t.enabled()).length > 0)
                .map(s => s.code)
            ).flat()
        ));
        await feng.fetchStocksQuotes(allstks, cacheTime);
    },
    tradeDailyRoutineTasks() {
        if (alarmHub.config?.purchase_new_stocks) {
            accld.buyNewStocks();
        }
        accld.buyNewBonds();
    },
    async onStrategyMatched(acc, stock, matches) {
        for (const m of matches) {
            if (m.account && m.account != acc.keyword) {
                acc = accld.all_accounts[m.account];
            }
            const refer = await acc.doTrade(stock.code, m);
            if (refer.deal.sid) {
                this.orderTimer.addCheckingTask(acc.holdAccount.keyword, refer.deal);
            }
            stock.strategies.onTradeMatch(refer);
        }
    },
    async tradeClosed() {
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {alarmHub};
} else if (typeof window !== 'undefined') {
    window.alarmHub = alarmHub;
}
})();

