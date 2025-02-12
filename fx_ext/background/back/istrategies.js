'use strict'


EmjyBack.prototype.convertToSecu = function(code) {
    if (code.length === 6 && !isNaN(code)) {
        const prefixes = {'60': 'sh', '68': 'sh', '30': 'sz', '00': 'sz', '90': 'sh', '20': 'sz'};
        const postfixes = {'83': '.BJ', '43': '.BJ', '87': '.BJ', '92': '.BJ'}
        let beg = code.substring(0, 2);
        if (prefixes[beg]) {
            return prefixes[beg] + code;
        } else if (postfixes[beg]) {
            return code + postfixes[beg];
        }
        console.log('cant convert code', code);
        return code;
    }
    return code.startsWith('BJ') ? code.substring(2) + '.BJ' : code.toLowerCase();
}

EmjyBack.prototype.validTradeStatus = ['OCALL', 'TRADE', 'ECALL'];
EmjyBack.prototype.noTradeStatus = ['STOP', 'ENDTR', 'HALT', 'BREAK'];

class StrategyI_Base {
    constructor(istr, ktime) {
        this.kicktime = ktime
        this.istr = istr
        this.candidates = {};
        this.estr = {};
    }

    enabled() {
        return this.istr.enabled;
    }

    prepare() {
        var now = new Date();
        var ticks = new Date(now.toDateString() + ' ' + this.kicktime) - now;
        if (ticks < 0) {
            return;
        }
        this.fetchCandidates();
        setTimeout(() => {
            this.trigger();
        }, ticks);
    }

    fetchCandidates() {}

    checkCandidatesAccount() {
        if (!emjyBack.validateKey) {
            setTimeout(() => this.checkCandidatesAccount(), 1000);
            return;
        }
        for (const c in this.candidates) {
            if (!this.candidates[c].account) {
                emjyBack.checkRzrq(c, rzrq => {
                    this.candidates[c].account = rzrq.Status == -1 ? 'normal' : 'credit';
                });
            }
        }
    }

    generate_strategy_json(price) {
        let strategies = {
            "grptype": "GroupStandard",
            "strategies": {},
            "transfers": {},
            "amount": this.istr.amount
        }
        let strobjs = {
            "StrategyBuyZTBoard": { "key": "StrategyBuyZTBoard", "enabled": true },
            "StrategySellELS": {"key": "StrategySellELS", "enabled": false, "cutselltype": "all", "selltype":"all", "topprice": (price * 1.05).toFixed(2) },
            "StrategyGrid": { "key": "StrategyGrid", "enabled": false, "buycnt": 1, "stepRate": 0.05 },
            "StrategySellBE": { "key":"StrategySellBE", "enabled": false, "upRate": -0.03, "selltype":"all", 'sell_conds': 1}
        }
        let ekeys = Object.keys(this.estr);
        for (var i = 0; i < ekeys.length; i++) {
            strategies.strategies[i] = strobjs[ekeys[i]];
            for (var k in this.estr[ekeys[i]]) {
                strategies.strategies[i][k] = this.estr[ekeys[i]][k];
            }
            strategies.transfers[i] = {transfer: "-1" };
        }
        if (this.istr.amtkey) {
            strategies['uramount'] = {"key": this.istr.amtkey};
        }
        return strategies;
    }

    get_cls_stockbasics(stocks, cb) {
        let fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        var bUrl = `https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=${fields}&os=web&secu_codes=${stocks.join(',')}&sv=7.7.5`;
        xmlHttpGet(bUrl, null, xr => {
            if (typeof(cb) === 'function') {
                cb(JSON.parse(xr).data);
            }
        });
    }
}


class StrategyI_Interval extends StrategyI_Base {
    constructor(istr, period, ktime='9:26') {
        super(istr, ktime);
        this.period = period;
    }

    prepare() {
        const time_tasks = [{'start': '9:29:01', 'stop': '11:30'}, {'start': '12:59:02', 'stop': '15:01'}];
        var now = new Date();
        for (const actions of time_tasks) {
            var stopTicks = new Date(now.toDateString() + ' ' + actions['stop']) - now;
            if (stopTicks > 0) {
                setTimeout(() => {
                    this.toggleTimer('start');
                }, new Date(now.toDateString() + ' ' + actions['start']) - now);
                setTimeout(() => {
                    this.toggleTimer('stop');
                }, new Date(now.toDateString() + ' ' + actions['stop']) - now);
            } else {
                emjyBack.log('stop time expired', actions);
            }
        }
        var ticks = new Date(now.toDateString() + ' ' + this.kicktime) - now;
        setTimeout(() => {
            this.preTask();
        }, ticks);
    }

    preTask() {
        this.fetchCandidates();
    }

    toggleTimer(act) {
        emjyBack.log('strategyi_interval toggleTimer', act);
        if (!this.chkInterval && act == 'start') {
            this.chkInterval = setInterval(() => {
                this.trigger();
            }, this.period);
        } else if (this.chkInterval && act == 'stop') {
            clearInterval(this.chkInterval);
            this.chkInterval = null;
        }
    }
}


class StrategyI_Zt1WbOpen extends StrategyI_Base {
    constructor(istr) {
        super(istr, '9:24:57');
        this.pupfix = 1.03;
        this.trigger_time0 = '9:25:03'
    }

    prepare() {
        super.prepare();
        var now = new Date();
        var ticks0 = new Date(now.toDateString() + ' ' + this.trigger_time0) - now;
        if (ticks0 > 0) {
            setTimeout(() => {
                this.pupfix = 1;
                this.trigger();
            }, ticks0);
        }
    }

    fetchCandidates() {
        var url = emjyBack.fha.server + 'stock?act=getistr&key=' + this.istr.key;
        xmlHttpGet(url, null, r => {
            let rc = JSON.parse(r);
            rc.forEach(c => {
                this.candidates[c.substring(2)] = {account: this.istr.account, secu_code: emjyBack.convertToSecu(c)};
            });
            this.checkCandidatesAccount();
        });
    }

    addCandidates(stocks) {
        if (!Array.isArray(stocks)) {
            stocks = [stocks];
        }
        stocks.forEach(c => {this.candidates[c] = {account: this.istr.account, secu_code: emjyBack.convertToSecu(c)};});
        this.checkCandidatesAccount();
    }

    trigger() {
        let stocks = Object.values(this.candidates).filter(x=>!x.matched).map(x=>x.secu_code);
        this.get_cls_stockbasics(stocks, basics => {
            for (var c in basics) {
                let b = basics[c];
                if (b.cmc >= 1e11) {
                    continue;
                }
                if (!emjyBack.validTradeStatus.includes(b.trade_status)) {
                    if (!emjyBack.noTradeStatus.includes(b.trade_status)) {
                        emjyBack.log('unknown trade_status', JSON.stringify(b));
                    }
                    continue;
                }
                let open_px = b.open_px ? b.open_px : b.last_px;
                let preclose_px = b.preclose_px;
                let opchange = (open_px - preclose_px) * 100 / preclose_px;
                if ((this.pupfix > 1 && opchange < 0) || (this.pupfix == 1 && opchange < -3)) {
                    continue;
                }
                let price = this.pupfix == 1 ? open_px : (Math.min((open_px * this.pupfix).toFixed(2), b.up_price));
                let code = c.startsWith('s') ? c.substring(2) : c.substring(0, 6);
                this.candidates[code].matched = true;
                let account = this.candidates[code].account;
                let holdacc = holdAccountKey[account];
                if (emjyBack.all_accounts[holdacc].getStock(code)) {
                    emjyBack.log('istr_zt1wb stock exists', code, holdacc);
                    continue;
                }

                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                let strategy = this.generate_strategy_json(price);
                emjyBack.buyWithAccount(code, price, 0, account, strategy);
            }
        });
    }
}


class StrategyI_HotrankOpen extends StrategyI_Base {
    constructor(istr) {
        super(istr, '9:22');
        this.trigger_time0 = '9:24:56';
        this.trigger_time1 = '9:25:05';
        this.pupfix = 1.05;
        this.topranks = {};
    }

    prepare() {
        var now = new Date();
        var ticks1 = new Date(now.toDateString() + ' ' + this.trigger_time1) - now;
        if (ticks1 < 0) {
            return;
        }

        var ticks = new Date(now.toDateString() + ' ' + this.kicktime) - now;
        var ticks0 = new Date(now.toDateString() + ' ' + this.trigger_time0) - now;
        setTimeout(() => {this.fetchCandidates();}, ticks);
        if (ticks0 > 0) {
            setTimeout(() => {this.trigger();}, ticks0);
        }
        setTimeout(() => {this.trigger1();}, ticks1);
    }

    fetchCandidates() {
        var emrkUrl = 'https://data.eastmoney.com/dataapi/xuangu/list?st=POPULARITY_RANK&sr=1&ps=100&p=1&sty=SECURITY_CODE,SECURITY_NAME_ABBR,NEW_PRICE,CHANGE_RATE,VOLUME_RATIO,HIGH_PRICE,LOW_PRICE,PRE_CLOSE_PRICE,VOLUME,DEAL_AMOUNT,TURNOVERRATE,POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<=100)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&source=SELECT_SECURITIES&client=WEB'
        xmlHttpGet(emrkUrl, null, rsp => {
            let jdata = JSON.parse(rsp);
            if (jdata.code != 0 || !jdata.result || !jdata.result.data) {
                var rkUrl = emjyBack.fha.server + 'stock?act=hotrankrt&rank=40';
                xmlHttpGet(rkUrl, null, r => {
                    let rdata = JSON.parse(r);
                    for (const rrk of rdata) {
                        let code = rrk[0];
                        if (!this.candidates[code]) {
                            this.candidates[code] = {secu_code: emjyBack.convertToSecu(code)};
                        }
                        this.candidates[code].rank = rrk[1];
                        this.candidates[code].newfans = rrk[2];
                    }
                });
                return;
            }
            for (const rk of jdata.result.data) {
                let code = rk.SECURITY_CODE;
                if (!this.candidates[code]) {
                    this.candidates[code] = {secu_code: emjyBack.convertToSecu(code)};
                }
                this.candidates[code].rank = rk.POPULARITY_RANK;
                this.candidates[code].newfans = rk.NEWFANS_RATIO;
            }
        });
        var jqrkUrl = 'https://basic.10jqka.com.cn/api/stockph/popularity/top/';
        xmlHttpGet(jqrkUrl, null, rsp => {
            let jdata = JSON.parse(rsp);
            if (jdata.status_code != 0 || !jdata.data || !jdata.data.list) {
                return;
            }
            for (const rk of jdata.data.list) {
                let code = rk.code;
                if (!this.candidates[code]) {
                    this.candidates[code] = {secu_code: emjyBack.convertToSecu(code)};
                }
                this.candidates[code].rkjqka = rk.hot_rank;
            }
        });
        var r5Url = emjyBack.fha.server + 'stock?act=getistr&key=' + this.istr.key;
        xmlHttpGet(r5Url, null, rsp => {
            let rked = JSON.parse(rsp);
            this.rked5d = rked.map(x=>x.substring(2));
        });
    }

    trigger() {
        if (this.matched) {
            return;
        }
        let stocks = Object.values(this.candidates).filter(x=>x.rank && x.rank <= 40 && x.newfans - 70 >= 0).map(x=>x.secu_code);
        this.get_cls_stockbasics(stocks, basics => {
            for (var c in basics) {
                let b = basics[c];
                let name = b.secu_name
                if (name.startsWith('退市') || name.endsWith('退') || name.includes('ST')) {
                    continue
                }
                if (!emjyBack.validTradeStatus.includes(b.trade_status)) {
                    if (!emjyBack.noTradeStatus.includes(b.trade_status)) {
                        emjyBack.log('unknown trade_status', JSON.stringify(b));
                    }
                    continue;
                }
                let zdf = b.change * 100;
                let code = c.startsWith('s') ? c.substring(2) : c.substring(0, 6);
                this.topranks[code] = [code, this.candidates[code].rank, this.candidates[code].newfans, this.candidates[code].rkjqka, 0, zdf]
                let price = b.last_px;
                if (this.candidates[code].rank > 10 || this.rked5d.includes(code) || zdf > 9 || zdf < -3 || price - 1 <= 0) {
                    continue;
                }
                if (this.matched) {
                    continue;
                }
                this.matched = true;

                emjyBack.log('istr_hotrank0 binfo', JSON.stringify(b));
                price *= this.pupfix;
                price = Math.min(price, b.up_price);
                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                let strategy = this.generate_strategy_json(price);
                let account = this.istr.account;
                if (account == '') {
                    emjyBack.checkRzrq(code, rzrq => {
                        account = rzrq.Status == -1 ? 'normal' : 'credit';
                        // let hacc = holdAccountKey[account];
                        // if (emjyBack.all_accounts[hacc].getStock(code)) {
                        //     emjyBack.log('istr_hotrank0 stock exists', code, hacc);
                        //     return;
                        // }
                        emjyBack.log('istr_hotrank0 buyWithAccount', code, price, account);
                        emjyBack.buyWithAccount(code, price.toFixed(2), 0, account, strategy);
                    });
                    continue;
                }
                // let holdacc = holdAccountKey[account];
                // if (emjyBack.all_accounts[holdacc].getStock(code)) {
                //     emjyBack.log('istr_hotrank0 stock exists', code, holdacc);
                //     continue;
                // }
                emjyBack.log('istr_hotrank0 buyWithAccount', code, price, account);
                emjyBack.buyWithAccount(code, price.toFixed(2), 0, account, strategy);
            }
        });
    }

    trigger1() {
        this.pupfix = 1.018;
        this.trigger();
        if (this.topranks && Object.keys(this.topranks).length > 0) {
            var tUrl = emjyBack.fha.server + 'stock';
            var fd = new FormData();
            fd.append('act', 'setistr');
            fd.append('key', this.istr.key);
            fd.append('data', JSON.stringify(Object.values(this.topranks)));
            console.log('upload hotrank0 topranks', Object.values(this.topranks));
            xmlHttpPost(tUrl, fd, null, p => {
                emjyBack.log('istr hotrank0 update data', p);
            });
        }
    }
}


class StrategyI_3Bull_Breakup extends StrategyI_Interval {
    constructor(istr) {
        super(istr, 60000);
        this.wdays = 5;
    }

    fetchCandidates() {
        var url = emjyBack.fha.server + 'stock?act=getistr&key=' + this.istr.key + '&days=' + this.wdays;
        xmlHttpGet(url, null, r => {
            let rc = JSON.parse(r);
            rc.forEach(chl => {
                let c = chl[0];
                this.candidates[c.substring(2)] = {
                    high: chl[1],
                    low: chl[2],
                    account: this.istr.account,
                    secu_code: emjyBack.convertToSecu(c)
                };
            });
            this.checkCandidatesAccount();
        });
    }

    trigger() {
        let stocks = Object.values(this.candidates).filter(x=>!x.matched).map(x=>x.secu_code);
        this.get_cls_stockbasics(stocks, basics => {
            for (var c in basics) {
                let b = basics[c];
                if (!emjyBack.validTradeStatus.includes(b.trade_status)) {
                    if (!emjyBack.noTradeStatus.includes(b.trade_status)) {
                        emjyBack.log('unknown trade_status', JSON.stringify(b));
                    }
                    continue;
                }
                let price = b.last_px;
                let code = c.startsWith('s') ? c.substring(2) : c.substring(0, 6);
                if (price - this.candidates[code].high <= 0) {
                    continue;
                }
                emjyBack.log('istr 3b buy match', code);
                if (b.up_price - price < 0.02) {
                    price = b.up_price;
                } else {
                    price -= 1;
                    price += 1.02;
                    price = price.toFixed(2);
                }
                let account = this.candidates[code].account;
                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2), 'guardPrice': this.candidates[code].low}};
                let strategy = this.generate_strategy_json(price);
                emjyBack.buyWithAccount(code, price, 0, account, strategy);
                emjyBack.log('istr 3b buy', code, price, account);
                this.candidates[code].matched = true;
            }
        });
    }
}


class IstrFactory {
    constructor() {
        this.istrs = {};
        var now = new Date();
        if (now.getDay() > 0 && now.getDay() < 6) {
            var curl = 'https://x-quote.cls.cn/quote/stock/closest_trading_day?app=CailianpressWeb&os=web&sv=7.7.5';
            xmlHttpGet(curl, null, rtd => {
                let jrtd = JSON.parse(rtd);
                this.istradingdate = jrtd.data[0] == emjyBack.getTodayDate('-') && now.getHours() < 15;
            });
        } else {
            this.istradingdate = false;
        }
    }

    initExtStrs() {
        if (this.istradingdate === undefined) {
            setTimeout(() => {this.initExtStrs();}, 1000);
            return;
        }
        for (const extstr of ExtIstrStrategies) {
            emjyBack.getFromLocal('exstrategy_' + extstr.key, istr => {
                if (!istr) {
                    emjyBack.log('ext strategy', extstr.key, 'not configured');
                    return;
                }
                this.setupExtStrategy(istr);
            });
        }
    }

    setupExtStrategy(istr) {
        let iks = null;
        if (istr.key == 'istrategy_zt1wb') {
            iks = new StrategyI_Zt1WbOpen(istr);
        } else if (istr.key == 'istrategy_3brk') {
            iks = new StrategyI_3Bull_Breakup(istr);
        } else if (istr.key == 'istrategy_hotrank0') {
            iks = new StrategyI_HotrankOpen(istr);
        }
        if (iks) {
            this.istrs[istr.key] = iks;
            if (this.istradingdate && iks.enabled()) {
                iks.prepare();
            }
        }
    }
}
