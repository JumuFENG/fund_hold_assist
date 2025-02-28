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
                emjyBack.checkRzrq(c).then(rzrq => {
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
            "StrategySellBE": { "key":"StrategySellBE", "enabled": false, "upRate": -0.03, "selltype":"all", 'sell_conds': 1},
            "StrategyBuyDTBoard": { "key":"StrategyBuyDTBoard", "enabled": true}
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

    expected_account(account, code) {
        if (account) {
            return Promise.resolve(account);
        }
        return emjyBack.checkRzrq(code).then(rzrq => rzrq.Status == -1 ? 'normal' : 'credit');
    }

    check_holdcount(account, code) {
        let holdacc = holdAccountKey[account];
        let holdstock = emjyBack.all_accounts[holdacc].getStock(code);
        if (holdstock && holdstock.holdCount > 0) {
            return holdstock.holdCount;
        }
        return 0;
    }

    get_cls_stockbasics(stocks) {
        if (!stocks || stocks.length === 0) {
            return Promise.resolve({});
        }

        let fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        var bUrl = `https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=${fields}&os=web&secu_codes=${stocks.join(',')}&sv=7.7.5`;
        return fetch(bUrl).then(r => r.json()).then(robj => {
            let basics = robj.data;
            let validStocks = Object.fromEntries(
                Object.entries(basics).filter(([c, s]) =>
                    emjyBack.validTradeStatus.includes(s.trade_status)
                && !s.secu_name.startsWith('退市') && !s.secu_name.endsWith('退') && !s.secu_name.includes('ST'))
                .map(([c,s]) => [c.startsWith('s') ? c.substring(2) : c.substring(0, 6), s])
            );

            return validStocks;
        });
    }

    common_get_hotranks(fetchth=true) {
        // var emrkUrl = 'https://data.eastmoney.com/dataapi/xuangu/list?st=POPULARITY_RANK&sr=1&ps=100&p=1&sty=SECURITY_CODE,SECURITY_NAME_ABBR,NEW_PRICE,CHANGE_RATE,VOLUME_RATIO,HIGH_PRICE,LOW_PRICE,PRE_CLOSE_PRICE,VOLUME,DEAL_AMOUNT,TURNOVERRATE,POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<=100)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&source=SELECT_SECURITIES&client=WEB'
        var emrkUrl = 'http://datacenter-web.eastmoney.com/wstock/selection/api/data/get?type=RPTA_PCNEW_STOCKSELECT&sty=POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<=100)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&p=1&ps=100&st=POPULARITY_RANK&sr=1&source=SELECT_SECURITIES&client=WEB';
        guang.fetchData(emrkUrl, {}, 10 * 60000, jdata => {
            // 数据初选：如果 jdata.code 不为 0 或缺少必要数据，则进行第二次请求
            if (jdata.code !== 0 || !jdata.result || !jdata.result.data) {
                let rkUrl = emjyBack.fha.server + 'stock?act=hotrankrt&rank=40';
                // 返回第二次请求的数据处理
                return guang.fetchData(rkUrl, {}, 10 * 60000, rdata => {
                    return rdata.map(x => ({
                        SECURITY_CODE: x[0],
                        POPULARITY_RANK: x[1],
                        NEWFANS_RATIO: x[2]
                    }));
                });
            }

            // 如果数据有效，直接返回结果
            return jdata.result.data;
        }).then(rkdata => {
            for (const rk of rkdata) {
                let code = rk.SECURITY_CODE;
                if (!this.candidates[code]) {
                    this.candidates[code] = { secu_code: emjyBack.convertToSecu(code) };
                }
                this.candidates[code].rank = rk.POPULARITY_RANK;
                this.candidates[code].newfans = rk.NEWFANS_RATIO;
            }
        }).catch(error => {
            console.error("数据请求失败:", error);
        });

        if (!fetchth) {
            return;
        }

        // 获取同花顺人气排行
        var jqrkUrl = 'https://basic.10jqka.com.cn/api/stockph/popularity/top/';
        guang.fetchData(jqrkUrl, {}, 10*60000, jdata => {
            if (jdata.status_code != 0 || !jdata.data || !jdata.data.list) {
                return;
            }
            return jdata.data.list;
        }).then(rkdata => {
            for (const rk of rkdata) {
                let code = rk.code;
                if (!this.candidates[code]) {
                    this.candidates[code] = {secu_code: emjyBack.convertToSecu(code)};
                }
                this.candidates[code].rkjqka = rk.hot_rank;
            }
        }).catch(error => {
            console.error("获取同花顺人气排行失败:", error);
        });
    }

    async common_get_zdfranks_em(n=500) {
        if (n == 0) {
            return;
        }

        const params = {
            pn: 1,
            np: 1,
            ut: 'bd1d9ddb04089700cf9c27f6f7426281',
            fltt: '2',
            invt: '2',
            wbp2u: '|0|0|0|web',
            fid: 'f3',
            fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
            fields: 'f2,f3,f4,f5,f6,f7,f8,f12,f13,f14,f15,f16,f18',
            pz: Math.abs(n),
            po: n > 0 ? 1 : 0,
        };

        let url = 'http://33.push2.eastmoney.com/api/qt/clist/get';
        return guang.fetchData(url, params, 60000);
    }

    async common_get_dailyzdt() {
        var eurl = emjyBack.fha.server + 'stock?act=zdtemot&days=10';
        const zdtarr = await guang.fetchData(eurl, {}, 6 * 60 * 60000);
        this.zdtdaily = zdtarr.reduce((acc, curr) => {
            acc[curr[0]] = { ztcnt: curr[1], ztcnt0: curr[2], dtcnt: curr[3] };
            return acc;
        }, {});
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
                emjyBack.log('stop time expired', JSON.stringify(actions));
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
        fetch(url).then(r => r.json()).then(rc => {
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
        this.get_cls_stockbasics(stocks).then(basics => {
            for (let code in basics) {
                let b = basics[code];
                if (b.cmc >= 1e11) {
                    continue;
                }

                let open_px = b.open_px ? b.open_px : b.last_px;
                let preclose_px = b.preclose_px;
                let opchange = (open_px - preclose_px) * 100 / preclose_px;
                if ((this.pupfix > 1 && opchange < 0) || (this.pupfix == 1 && opchange < -3)) {
                    continue;
                }
                let price = this.pupfix == 1 ? open_px : (Math.min((open_px * this.pupfix).toFixed(2), b.up_price));
                this.candidates[code].matched = true;
                let account = this.candidates[code].account;
                if (this.check_holdcount(account, code) > 0) {
                    emjyBack.log(this.istr.key, 'stock exists', code, account);
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
        this.common_get_hotranks();
        var r5Url = emjyBack.fha.server + 'stock?act=getistr&key=' + this.istr.key;
        fetch(r5Url).then(r => r.json()).then(rked => {
            this.rked5d = rked.map(x=>x.substring(2));
        });
    }

    trigger() {
        if (this.matched) {
            return;
        }
        let stocks = Object.values(this.candidates).filter(x=>x.rank && x.rank <= 40 && x.newfans - 70 >= 0).map(x=>x.secu_code);
        this.get_cls_stockbasics(stocks).then(basics => {
            for (let code in basics) {
                let b = basics[code];
                let name = b.secu_name
                if (name.startsWith('退市') || name.endsWith('退') || name.includes('ST')) {
                    continue
                }

                let zdf = b.change * 100;
                this.topranks[code] = [code, this.candidates[code].rank, this.candidates[code].newfans, this.candidates[code].rkjqka, 0, zdf]
                let price = b.last_px;
                if (this.candidates[code].rank > 10 || this.rked5d.includes(code) || zdf > 9 || zdf < -3 || price - 1 <= 0) {
                    continue;
                }
                if (this.matched) {
                    continue;
                }
                this.matched = true;

                emjyBack.log(this.istr.key, 'binfo', JSON.stringify(b));
                price *= this.pupfix;
                price = Math.min(price, b.up_price);
                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                let strategy = this.generate_strategy_json(price);

                this.expected_account(this.istr.account, code).then(account => {
                    if (this.check_holdcount(account, code) > 0) {
                        emjyBack.log(this.istr.key, 'stock exists', code, holdacc);
                    } else {
                        emjyBack.log(this.istr.key, 'buy with account', code, price, account);
                        emjyBack.buyWithAccount(code, price.toFixed(2), 0, account, strategy);
                    }
                });
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
            fetch(tUrl, {
                method: 'POST',
                body: fd
            }).then(r => r.text()).then(p => {
                emjyBack.log(this.istr.key, 'update data', p);
            }).catch(e => {
                emjyBack.log(this.istr.key, 'update data error', e);
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
        fetch(url).then(r => r.json()).then(rc => {
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
        this.get_cls_stockbasics(stocks).then(basics => {
            for (let code in basics) {
                let b = basics[code];

                let price = b.last_px;
                if (price - this.candidates[code].high <= 0) {
                    continue;
                }
                emjyBack.log(this.istr.key, 'buy match', code);
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
                emjyBack.log(this.istr.key, 'buy', code, price, account);
                this.candidates[code].matched = true;
            }
        });
    }
}


class StrategyI_HotStocksOpen extends StrategyI_Base {
    constructor(istr){
        super(istr, '9:22');
        this.trigger_time0 = '9:24:55';
        this.pupfix = 1.05;
        this.topranks = {};
    }

    prepare() {
        var now = new Date();
        var ticks0 = new Date(now.toDateString() + ' ' + this.trigger_time0) - now;
        if (ticks0 < 0) {
            return;
        }

        var ticks = new Date(now.toDateString() + ' ' + this.kicktime) - now;
        setTimeout(() => {this.fetchCandidates();}, ticks);
        setTimeout(() => {this.trigger();}, ticks0);
    }

    fetchCandidates() {
        var surl = emjyBack.fha.server + 'stock?act=hotstocks&days=2';
        fetch(surl).then(r => r.json()).then(recent_zt_stocks => {
            let step = Math.max(...recent_zt_stocks.map(x=>x[3]));
            let top_zt_stocks = [];
            for (; step > 0; step--) {
                top_zt_stocks = recent_zt_stocks.filter(x=>x[3] >= step);
                if (top_zt_stocks.length >= 10) {
                    break;
                }
            }

            for (let zr of top_zt_stocks) {
                let code = zr[0].length == 6 ? zr[0] : zr[0].substring(2);
                if (!this.candidates[code]) {
                    this.candidates[code] = {};
                };
                this.candidates[code].secu_code = emjyBack.convertToSecu(code);
                this.candidates[code].ztdate = zr[1];
                this.candidates[code].days = zr[2];
                this.candidates[code].step = zr[3];
            }
        });
        this.common_get_hotranks(false);
        this.common_get_dailyzdt().then(()=>{
            this.lastzdt = this.zdtdaily[Math.max(Object.keys(this.zdtdaily))];
        });
    }

    check_daiy_open_environment() {
        // 如果没有上一次的涨跌停数据，直接返回 true
        if (!this.lastzdt) {
            return Promise.resolve(true);
        }

        let pfetches = [
            this.common_get_zdfranks_em(500),
            this.common_get_zdfranks_em(-200)
        ];

        return Promise.all(pfetches).then(([jz, jd]) => {
            let zrks = jz.data.diff.filter(r => r.f3 >= 8);
            let drks = jd.data.diff.filter(r => r.f3 <= -8);

            let dtcnt_open = drks.filter(r => r.f2 - feng.getStockDt(r.f12, r.f18) <= 0).length;
            emjyBack.log('last dtcnt=', this.lastzdt.dtcnt, 'today open dtcnt=', dtcnt_open);
            // 检查大盘竞价情况
            if (this.lastzdt.dtcnt > 10) {
                // 昨日跌停数大于10家，一般不买入，除非开盘竞价明显修复
                return dtcnt_open < 5 || dtcnt_open < 0.3 * this.lastzdt.dtcnt;
            } else {
                // 昨日跌停小于10家，今天开盘跌停小于3或者比昨天跌停数少
                return dtcnt_open <= 3 || dtcnt_open < this.lastzdt.dtcnt;
            }
        }).catch(err => {
            console.error("Error fetching stock data:", err);
            return false; // 如果请求失败，返回false
        });
    }

    trigger() {
        // this.candidates = Object.fromEntries(Object.entries(this.candidates).filter(([c, s]) => s.ztdate && s.rank));
        let cans = Object.values(this.candidates).filter(v => v.ztdate && v.rank);
        cans.sort((a,b) => a.rank - b.rank);
        let stocks = cans.slice(0, 5).map(x=>x.secu_code);

        this.check_daiy_open_environment().then(env_valid => {
            if (!env_valid) {
                return;
            }

            this.get_cls_stockbasics(stocks).then(basics => {
                for (let code in basics) {
                    let b = basics[code];
                    let zdf = b.change * 100;
                    if (zdf < -8) {
                        continue;
                    }

                    let price = b.last_px;
                    emjyBack.log(this.istr.key, 'binfo', JSON.stringify(b));
                    price *= this.pupfix;
                    price = Math.min(price, b.up_price);
                    this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}, 'StrategySellBE': {}};
                    let strategy = this.generate_strategy_json(price);
                    this.expected_account(this.istr.account, code).then(account => {
                        if (this.check_holdcount(account, code) > 0) {
                            // 已经有持仓，买入价低于+5%。不追高.
                            price = Math.min(price, b.preclose_px * 1.05);
                        }
                        emjyBack.log(this.istr.key, 'buy with account', code, price, account);
                        emjyBack.buyWithAccount(code, price.toFixed(2), 0, account, strategy);
                    });
                }
            });
        })
    }
}


class StrategyI_DtStocksUp extends StrategyI_Base {
    constructor(istr) {
        super(istr, '9:24');
        this.kicktime1 = '9:33';
        this.kicktime2 = '14:30';
    }

    prepare() {
        var now = new Date();
        var ticks0 = new Date(now.toDateString() + ' ' + this.kicktime) - now;
        var ticks1 = new Date(now.toDateString() + ' ' + this.kicktime1) - now;
        if (ticks1 < 0) {
            return;
        }
        if (ticks0 > 0) {
            setTimeout(() => this.trigger(), ticks0);
        }
        setTimeout(() => this.trigger1(), ticks1);
        var ticks2 = new Date(now.toDateString() + ' ' + this.kicktime2) - now;
        setTimeout(() => this.trigger2(), ticks2);
    }

    addToWatch(stocks) {
        stocks.forEach(s => {
            if (!this.candidates[s]) {
                this.candidates[s] = {watched: true};
            }
            this.expected_account(this.istr.account, s).then(account => {
                let hacc = holdAccountKey[account];
                this.estr = {'StrategyBuyDTBoard': {account}};
                emjyBack.all_accounts[hacc].addWatchStock(s, this.generate_strategy_json());
                this.candidates[s].account = hacc;
            });
        })
    }

    trigger() {
        // 竞价结束前
        this.common_get_dailyzdt().then(()=>{
            const lastzdt = this.zdtdaily[Object.keys(this.zdtdaily).slice(-1)[0]];
            return lastzdt.dtcnt;
        }).then(dtcnt => {
            if (dtcnt < 5) {
                return;
            }
            this.common_get_zdfranks_em(-50).then(jd => {
                let drks = jd.data.diff.filter(r => r.f3 <= -8);
                let dtstocks = drks.filter(r => r.f2 - feng.getStockDt(r.f12, r.f18) <= 0);
                if (dtstocks.length > 0) {
                    return;
                }
            }).then(() => {
                const date = Object.keys(this.zdtdaily).slice(-1)[0];
                const durl = emjyBack.fha.server + 'api/stockdthist?date=' + date;
                return guang.fetchData(durl, {}, 6*60*60000, d => {
                    if (d.date != date) {
                        return [];
                    }
                    return d.pool;
                });
            }).then(ydl => {
                for (const yd of ydl) {
                    const code = yd[0].substring('2');
                    if (!this.candidates[code]) {
                        this.candidates[code] = {secu_code: emjyBack.convertToSecu(code)};
                    }
                }
            }).then(()=>{
                return this.get_cls_stockbasics(Object.values(this.candidates).map(x=>x.secu_code));
            }).then(basics => {
                for (let code in basics) {
                    let b = basics[code];
                    let zdf = b.change * 100;
                    if (zdf > -5.5) {
                        continue;
                    }

                    let price = b.last_px;
                    price *= this.pupfix;
                    price = Math.min(price, b.preclose_px * 0.95);
                    this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                    let strategy = this.generate_strategy_json(price);
                    this.expected_account(this.istr.account, code).then(account => {
                        emjyBack.log(this.istr.key, 'buy with account', code, price, account);
                        emjyBack.buyWithAccount(code, price.toFixed(2), 0, account, strategy);
                    });
                }
            });
        });
    }

    trigger1() {
        // 开盘三分钟
        this.common_get_zdfranks_em(-50).then(jd=>{
            let drks = jd.data.diff.filter(r => r.f3 <= -8);
            if (drks.filter(r => r.f3 <= -10).length > 15) {
                emjyBack.log(this.istr.key, 'more stocks zdf < 10 than 15');
                return;
            }
            let dtstocks = drks.filter(r => r.f2 - feng.getStockDt(r.f12, r.f18) <= 0)
            dtstocks = dtstocks.filter(r => !r.f14.startsWith('退市') && !r.f14.endsWith('退') && !r.f14.includes('ST'));
            if (dtstocks.length > 10) {
                emjyBack.log(this.istr.key, 'more stocks dt than 10');
                return;
            }
            // 封单金额最大前三
            let snapRequests = dtstocks.map(r => feng.getStockSnapshot(r.f12));
            Promise.all(snapRequests).then((snaps) => {
                let top3 = snaps.sort((a, b) => {
                    if (a.buysells.buy1 != '-') {
                        return 1;
                    }
                    if (b.buysells.buy1 != '-') {
                        return -1;
                    }
                    return b.buysells.sale1 * b.buysells.sale1_count - a.buysells.sale1 * a.buysells.sale1_count;
                }).slice(0, 3).map(x=>x.code);
                this.addToWatch(top3);
                return top3;
            }).then(t3 => {
                let dtcodes = dtstocks.map(r => r.f12);
                let klRequests = dtstocks.map(r => feng.getStockKline(r.f12, '101'));
                Promise.all(klRequests).then(() => {
                    let latestPrice = Object.fromEntries(dtstocks.map(r => [r.f12, r.f2]));
                    let klpvs = dtcodes.map(c => {
                        let kl5 = emjyBack.klines[c].klines['101'].slice(-5);
                        let mxhigh = Math.max(...kl5.map(x=>x.h))
                        let downp = (mxhigh - latestPrice[c]) / mxhigh;
                        let mxVol = Math.max(...kl5.map(x=>x.v));
                        let minVol = kl5[kl5.length - 1].v;
                        for (let i = kl5.length - 2; i >= 0; --i) {
                            if (kl5[i].v - minVol < 0) {
                                minVol = kl5[i].v;
                            }
                            if (kl5[i].v == mxVol) {
                                break;
                            }
                        }
                        let downv = (mxVol - minVol) / mxVol;
                        return [c, downp, downv];
                    });
                    // 五天内最高点至今跌幅前三
                    // 五天内最高点至今有大幅缩量者前三
                    let p3 = klpvs.sort((a, b) => b[1] - a[1]).slice(0, 3).map(x=>x[0]);
                    let v3 = klpvs.sort((a, b) => b[2] - a[2]).slice(0, 3).map(x=>x[0]);
                    return p3.concat(v3).filter(x => !t3.includes(x));
                }).then(pv3 => {
                    this.addToWatch(pv3);
                });
            });
        });
    }

    trigger2() {
        // 尾盘取消
        for (const c in this.candidates) {
            const account = this.candidates[c].account;
            emjyBack.all_accounts[account].disableStrategy(c, 'StrategyBuyDTBoard');
        }
    }
}


class istrManager {
    static initExtStrs() {
        this.istrs = {};
        var now = new Date();
        if (now.getDay() == 6 || now.getDay() == 0) {
            return;
        }
        var curl = 'https://x-quote.cls.cn/quote/stock/closest_trading_day?app=CailianpressWeb&os=web&sv=7.7.5';
        guang.fetchData(curl, {}, 60*60000).then(jrtd => {
            let istradingdate = jrtd.data[0] == guang.getTodayDate('-') && now.getHours() < 15;
            if (istradingdate) {
                this.setupExtStrategy();
            }
        }).catch(err => {
            throw err;
        });
    }

    static setupExtStrategy() {
        const build_istr = function (istr) {
            let iks = null;
            if (istr.key == 'istrategy_zt1wb') {
                iks = new StrategyI_Zt1WbOpen(istr);
            } else if (istr.key == 'istrategy_3brk') {
                iks = new StrategyI_3Bull_Breakup(istr);
            } else if (istr.key == 'istrategy_hotrank0') {
                iks = new StrategyI_HotrankOpen(istr);
            } else if (istr.key == 'istrategy_hotstks_open') {
                iks = new StrategyI_HotStocksOpen(istr);
            } else if (istr.key == 'istrategy_dtstocks') {
                iks = new StrategyI_DtStocksUp(istr);
            }
            return iks;
        }

        for (const extstr of ExtIstrStrategies) {
            emjyBack.getFromLocal('exstrategy_' + extstr.key, istr => {
                if (!istr) {
                    emjyBack.log('ext strategy', extstr.key, 'not configured');
                    return;
                }
                let iks = build_istr(istr);
                if (iks) {
                    this.istrs[istr.key] = iks;
                    if (iks.enabled()) {
                        iks.prepare();
                    }
                }
            });
        }
    }
}
