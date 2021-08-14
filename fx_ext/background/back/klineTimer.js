'use strict';

class KlineAlarms {
    constructor() {
        this.log = console.log;
        this.hourlyGuard = new Set();
        this.dailyGuard = new Set();
    }

    addStock(code, kltype) {
        if (kltype == '60') {
            this.hourlyGuard.add(code);
        };
        if (kltype == '101') {
            this.dailyGuard.add(code);
        };
    }

    setupAlarms() {
        var now = new Date();
        if (DEBUG || now.getDay() == 0 || now.getDay() == 6) {
            this.log('no kline alarms set');
            return;
        };

        var alarms = [
        {name:'kline-hourly1', tick: new Date(now.toDateString() + ' 10:30:01').getTime()},
        {name:'kline-hourly2', tick: new Date(now.toDateString() + ' 11:30:02').getTime()},
        {name:'kline-hourly3', tick: new Date(now.toDateString() + ' 14:00:03').getTime()},
        {name:'kline-hourly4', tick: new Date(now.toDateString() + ' 15:00:04').getTime()},
        {name:'kline-daily', tick: new Date(now.toDateString() + ' 15:00:05').getTime()}
        ];

        for (var i = 0; i < alarms.length; i++) {
            if (i == alarms.length - 1) {
                if (now < alarms[i].tick) {
                    this.log('setupKlineAlarms', alarms[i].name);
                    chrome.alarms.create(alarms[i].name, {when: alarms[i].tick});
                };
                break;
            };
            if (i + 1 < alarms.length && now < alarms[i + 1].tick) {
                this.log('setupKlineAlarms', alarms[i].name);
                chrome.alarms.create(alarms[i].name, {when: alarms[i].tick});
            }; 
        };
    }

    onAlarm(alarmInfo) {
        console.log('KlineAlarms alarms hit: ', alarmInfo);
        if (alarmInfo.name == 'kline-daily') {
            this.dailyGuard.forEach(s => {
                emjyBack.fetchStockKline(s, '101');
            });
            console.log('update daily kline for', this.dailyGuard);
        } else if (alarmInfo.name.startsWith('kline-')) {
            this.hourlyGuard.forEach(s => {
                emjyBack.fetchStockKline(s, '60');
            });
            console.log('update hourly kline for', this.hourlyGuard);
        };
    }
}

chrome.alarms.onAlarm.addListener(function(alarmInfo) {
    console.log('kline alarms hit: ', alarmInfo.name);
    if (emjyBack.klineAlarms) {
        emjyBack.klineAlarms.onAlarm(alarmInfo);
    };
});
