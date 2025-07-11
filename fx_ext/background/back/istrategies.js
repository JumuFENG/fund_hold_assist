'use strict';

(function(){

const { logger, svrd } = xreq('./background/nbase.js');
const { ses } = xreq('./background/strategies_meta.js');
const { guang } = xreq('./background/guang.js');
const { feng } = xreq('./background/feng.js');
const { klPad } = xreq('./background/kline.js');
const { accld } = xreq('./background/accounts.js');

const validTradeStatus = ['OCALL', 'TRADE', 'ECALL'];
const noTradeStatus = ['STOP', 'ENDTR', 'HALT', 'BREAK'];

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
        if (!accld.validateKey) {
            setTimeout(() => this.checkCandidatesAccount(), 1000);
            return;
        }
        const rejected = [];
        const chkpromises = [];
        for (const c in this.candidates) {
            if (!this.candidates[c].account) {
                accld.checkRzrq(c).then(rzrq => {
                    this.candidates[c].account = rzrq.Status == -1 ? 'normal' : 'credit';
                });
            } else if (this.candidates[c].account == 'credit') {
                chkpromises.push(accld.checkRzrq(c).then(rzrq => {
                    if (rzrq.Status == -1) {
                        rejected.push(c);
                    }
                }));
            }
        }
        if (chkpromises.length > 0) {
            Promise.all(chkpromises).then(() => {
                if (rejected.length > 0) {
                    logger.info(this.constructor.name, 'rejected', rejected);
                    this.candidates = Object.fromEntries(Object.entries(this.candidates).filter(([c, s]) => !rejected.includes(c)));
                }
            });
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
            "StrategySellBE": { "key":"StrategySellBE", "enabled": false, "upRate": -0.03, "selltype":"all", "sell_conds": 1},
            "StrategyBuyDTBoard": { "key":"StrategyBuyDTBoard", "enabled": true},
            "StrategySellMA": { "key":"StrategySellMA", "enabled":true, 'selltype': 'egate', 'upRate':0.03, "kltype": "4"},
        }

        let ekeys = Object.keys(this.estr);
        for (var i = 0; i < ekeys.length; i++) {
            strategies.strategies[i] = Object.assign(strobjs[ekeys[i]], this.estr[ekeys[i]]);
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
        return accld.checkRzrq(code).then(rzrq => rzrq.Status == -1 ? 'normal' : 'credit');
    }

    check_holdcount(account, code) {
        const holdstock = accld.all_accounts[account].holdAccount.getStock(code);
        if (holdstock && holdstock.holdCount > 0) {
            return holdstock.holdCount;
        }
        return 0;
    }

    get_buydetail(account, code) {
        const holdstock = accld.all_accounts[account].holdAccount.getStock(code);
        return holdstock?.strategies?.buydetail;
    }

    get_cls_stockbasics(stocks) {
        if (!stocks || stocks.length === 0) {
            return Promise.resolve({});
        }

        let fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        var bUrl = `https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=${fields}&os=web&secu_codes=${stocks.join(',')}&sv=8.4.6`;
        return fetch(bUrl).then(r => r.json()).then(robj => {
            let basics = robj.data;
            let validStocks = Object.fromEntries(
                Object.entries(basics).filter(([c, s]) =>
                    validTradeStatus.includes(s.trade_status)
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
                let rkUrl = istrManager.fha.server + 'stock?act=hotrankrt&rank=40';
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
                    this.candidates[code] = { secu_code: guang.convertToSecu(code) };
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
                    this.candidates[code] = {secu_code: guang.convertToSecu(code)};
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
        var eurl = istrManager.fha.server + 'stock?act=zdtemot&days=10';
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
        const time_tasks = [{'start': '9:29:59', 'stop': '11:30'}, {'start': '12:59:59', 'stop': '15:01'}];
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
                logger.info('stop time expired', JSON.stringify(actions));
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
        logger.info(this.constructor.name, 'toggleTimer', act);
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
        var url = istrManager.fha.server + 'stock?act=getistr&key=' + this.istr.key;
        fetch(url).then(r => r.json()).then(rc => {
            if (rc.length === 0) {
                logger.error(this.constructor.name, 'No candidates found!');
                return;
            }
            rc.forEach(c => {
                this.candidates[c.substring(2)] = {account: this.istr.account, secu_code: guang.convertToSecu(c)};
            });
            this.checkCandidatesAccount();
        });
    }

    addCandidates(stocks) {
        if (!Array.isArray(stocks)) {
            stocks = [stocks];
        }
        stocks.forEach(c => {this.candidates[c] = {account: this.istr.account, secu_code: guang.convertToSecu(c)};});
        this.checkCandidatesAccount();
    }

    trigger() {
        let stocks = Object.values(this.candidates).filter(x=>!x.matched).map(x=>x.secu_code);
        if (Object.values(this.candidates).filter(x=>!x.account).length > 0) {
            this.checkCandidatesAccount();
        }

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
                    logger.info(this.istr.key, 'stock exists', code, account);
                    continue;
                }

                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                let strategy = this.generate_strategy_json(price);
                accld.tryBuyStock(code, price, 0, account, strategy);
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
        var r5Url = istrManager.fha.server + 'stock?act=getistr&key=' + this.istr.key;
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

                logger.info(this.istr.key, 'binfo', JSON.stringify(b));
                price *= this.pupfix;
                price = Math.min(price, b.up_price);
                this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                let strategy = this.generate_strategy_json(price);

                this.expected_account(this.istr.account, code).then(account => {
                    if (this.check_holdcount(account, code) > 0) {
                        logger.info(this.istr.key, 'stock exists', code, accld.all_accounts[account].holdAccount.keyword);
                    } else {
                        logger.info(this.istr.key, 'buy with account', code, price, account);
                        accld.tryBuyStock(code, price.toFixed(2), 0, account, strategy);
                    }
                });
            }
        });
    }

    trigger1() {
        this.pupfix = 1.018;
        this.trigger();
        if (this.topranks && Object.keys(this.topranks).length > 0) {
            var tUrl = istrManager.fha.server + 'stock';
            var fd = new FormData();
            fd.append('act', 'setistr');
            fd.append('key', this.istr.key);
            fd.append('data', JSON.stringify(Object.values(this.topranks)));
            fetch(tUrl, {
                method: 'POST',
                body: fd
            }).then(r => r.text()).then(p => {
                logger.info(this.istr.key, 'update data', p);
            }).catch(e => {
                logger.info(this.istr.key, 'update data error', e);
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
        var url = istrManager.fha.server + 'stock?act=getistr&key=' + this.istr.key + '&days=' + this.wdays;
        fetch(url).then(r => r.json()).then(rc => {
            rc.forEach(chl => {
                let c = chl[0];
                this.candidates[c.substring(2)] = {
                    high: chl[1],
                    low: chl[2],
                    account: this.istr.account,
                    secu_code: guang.convertToSecu(c)
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
                logger.info(this.istr.key, 'buy match', code);
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
                accld.tryBuyStock(code, price, 0, account, strategy);
                logger.info(this.istr.key, 'buy', code, price, account);
                this.candidates[code].matched = true;
            }
        }).catch(e => {
            logger.error(this.istr.key, 'get_cls_stockbasics error', e);
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
        var surl = istrManager.fha.server + 'stock?act=hotstocks&days=2';
        fetch(surl).then(r => r.json()).then(recent_zt_stocks => {
            let step = Math.max(...recent_zt_stocks.map(x=>x[3]));
            let top_zt_stocks = [];
            for (; step > 0; step--) {
                if (recent_zt_stocks.filter(x=>x[3] == step).length > top_zt_stocks.length && top_zt_stocks.length >= 8) {
                    break;
                }
                top_zt_stocks = recent_zt_stocks.filter(x=>x[3] >= step);
                if (top_zt_stocks.length >= 10) {
                    break;
                }
            }

            for (let zr of top_zt_stocks) {
                let code = zr[0].slice(-6);
                if (!this.candidates[code]) {
                    this.candidates[code] = {};
                };
                this.candidates[code].secu_code = guang.convertToSecu(code);
                this.candidates[code].ztdate = zr[1];
                this.candidates[code].days = zr[2];
                this.candidates[code].step = zr[3];
            }
        });
        this.common_get_hotranks(false);
        this.common_get_dailyzdt().then(()=>{
            this.lastzdt = this.zdtdaily[Object.keys(this.zdtdaily).sort().slice(-1)[0]];
        });
    }

    check_daiy_open_environment() {
        // 如果没有上一次的涨跌停数据，直接返回 true
        if (!this.lastzdt) {
            logger.info('no lastzdt mark as true');
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
            logger.info('last dtcnt=', this.lastzdt.dtcnt, 'today open dtcnt=', dtcnt_open);
            // 检查大盘竞价情况
            if (this.lastzdt.dtcnt > 10) {
                // 昨日跌停数大于10家，一般不买入，除非开盘竞价明显修复
                return dtcnt_open < 5 || dtcnt_open < 0.3 * this.lastzdt.dtcnt;
            } else {
                // 昨日跌停小于10家，今天开盘跌停小于3或者比昨天跌停数少
                return dtcnt_open <= 3 || dtcnt_open < this.lastzdt.dtcnt;
            }
        }).catch(err => {
            logger.error("Error fetching stock data:", err);
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
                logger.info(this.istr.key, 'open environment not valid');
                return;
            }

            this.get_cls_stockbasics(stocks).then(basics => {
                for (let code in basics) {
                    let b = basics[code];
                    let zdf = b.change * 100;

                    logger.info(this.istr.key, b.secu_code, b.secu_name, zdf.toFixed(2), this.candidates[code].rank);
                    if (zdf < -8.8) {
                        continue;
                    }

                    let price = b.last_px;
                    logger.debug(this.istr.key, 'binfo', JSON.stringify(b));
                    if (price - this.istr.amount*0.013 > 0) {
                        logger.info(this.istr.key, 'price higher than 1.3', b.secu_code, b.secu_name)
                        continue;
                    }
                    price *= this.pupfix;
                    price = Math.min(price, b.up_price);
                    this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}, 'StrategySellBE': {}};
                    let strategy = this.generate_strategy_json(price);
                    this.expected_account(this.istr.account, code).then(account => {
                        if (this.check_holdcount(account, code) > 0) {
                            // 已经有持仓，买入价低于+5%。不追高.
                            price = Math.min(price, b.preclose_px * 1.05);
                            strategy = null;
                        }
                        if (zdf < -5) {
                            logger.info(this.istr.key, 'zdf < -5', code, account);
                        } else {
                            logger.info(this.istr.key, 'buy with account', code, price, account);
                            accld.tryBuyStock(code, price.toFixed(2), 0, account, strategy);
                        }
                    });
                }
            });
        }).then(()=>{
            this.saveCandidates();
        });
    }

    saveCandidates() {
        let ohstks = []
        const date = guang.getTodayDate('-');
        for (let code in this.candidates) {
            if (this.candidates[code].rank && this.candidates[code].ztdate) {
                ohstks.push([date, code, this.candidates[code].ztdate, this.candidates[code].days, this.candidates[code].step, this.candidates[code].rank]);
            }
        }
        logger.info(this.constructor.name, 'save ohstks', ohstks);
        const url = istrManager.fha.server + 'stock';
        const fd = new FormData();
        fd.append('act', 'setistr');
        fd.append('key', this.istr.key);
        fd.append('ohstks', JSON.stringify(ohstks));
        fetch(url, {
            method: 'POST',
            body: fd
        }).catch(e => {
            logger.error(this.istr.key, 'setistr error', e);
        });
    }
}


class StrategyI_DtStocksUp extends StrategyI_Base {
    constructor(istr) {
        super(istr, '9:24:50');
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
        this.fetchCandidates();
        if (ticks0 > 0) {
            setTimeout(() => this.trigger(), ticks0);
        }
        setTimeout(() => this.trigger1(), ticks1);
        var ticks2 = new Date(now.toDateString() + ' ' + this.kicktime2) - now;
        setTimeout(() => this.trigger2(), ticks2);
    }

    fetchCandidates() {
        var surl = istrManager.fha.server + 'stock?act=hotstocks&days=5';
        fetch(surl).then(r => r.json()).then(recent_zt_stocks => {
            recent_zt_stocks = recent_zt_stocks.filter(x=>x[3] >= 3);
            for (let zr of recent_zt_stocks) {
                let code = zr[0].slice(-6);
                if (!this.candidates[code]) {
                    this.candidates[code] = {};
                };
                this.candidates[code].secu_code = guang.convertToSecu(zr[0]);
                this.candidates[code].ztdate = zr[1];
                this.candidates[code].days = zr[2];
                this.candidates[code].step = zr[3];
            }
        });
    }

    addToWatch(stocks) {
        stocks.forEach(s => {
            if (!this.candidates[s]) {
                this.candidates[s] = {watched: true};
            }
            this.expected_account(this.istr.account, s).then(account => {
                this.estr = {'StrategyBuyDTBoard': {account}};
                accld.all_accounts[account].holdAccount.addWatchStock(s, this.generate_strategy_json());
                logger.info(this.istr.key, 'add to watch', s, account);
                this.candidates[s].account = accld.all_accounts[account].holdAccount.keyword;
            });
        })
    }

    trigger() {
        if (!this.pupfix) {
            this.pupfix = 1.05;
        }
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
                logger.info('today open dtcnt=', dtstocks.length, dtstocks);
                return dtstocks.length;
            }).then(dt_today => {
                if (dt_today > 0) {
                    return [];
                }
                const date = Object.keys(this.zdtdaily).slice(-1)[0];
                const durl = istrManager.fha.server + 'api/stockdthist?date=' + date;
                return guang.fetchData(durl, {}, 6*60*60000, d => {
                    if (d.date != date) {
                        return [];
                    }
                    return d.pool;
                });
            }).then(ydl => {
                return this.get_cls_stockbasics(ydl.map(yd => guang.convertToSecu(yd[0].slice(-6))));
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
                    if (!price) {
                        logger.info('no valide price', JSON.stringify(b));
                        continue;
                    }
                    this.estr = {'StrategySellELS': {'topprice': (price * 1.05).toFixed(2)}};
                    let strategy = this.generate_strategy_json(price);
                    this.expected_account(this.istr.account, code).then(account => {
                        logger.info(this.istr.key, 'buy with account', code, price, account);
                        // accld.tryBuyStock(code, price.toFixed(2), 0, account, strategy);
                        if (!this.candidates[code]) {
                            this.candidates[code] = {};
                        }
                        this.candidates[code].watched = true;
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
                logger.info(this.istr.key, 'more stocks zdf < 10 than 15');
                return;
            }
            let dtstocks = drks.filter(r => r.f2 - feng.getStockDt(r.f12, r.f18) <= 0)
            dtstocks = dtstocks.filter(r => !r.f14.startsWith('退市') && !r.f14.endsWith('退') && !r.f14.includes('ST'));
            if (dtstocks.length > 10) {
                logger.info(this.istr.key, 'more stocks dt than 10');
                return;
            }
            // 去除连续3天一字跌停的.
            dtstocks = dtstocks.filter(r => !klPad.klines[r.f12] || klPad.klines[r.f12].continuouslyDtDays(true) < 3);
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
                return top3;
            }).then(t3 => {
                let dtcodes = dtstocks.map(r => r.f12);
                let klRequests = dtstocks.map(r => klPad.getStockKline(r.f12, '101'));
                Promise.all(klRequests).then(() => {
                    let latestPrice = Object.fromEntries(dtstocks.map(r => [r.f12, r.f2]));
                    let klpvs = dtcodes.map(c => {
                        let kl5 = klPad.klines[c].klines['101'].slice(-5);
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
                        if (t3.includes(c) && downp < 0.3) {
                            t3.splice(t3.indexOf(c), 1);
                        }
                        return [c, downp, downv];
                    });
                    // 五天内最高点至今跌幅前三
                    // 五天内最高点至今有大幅缩量者前三
                    let p3 = klpvs.sort((a, b) => b[1] - a[1]).slice(0, 3).map(x=>x[0]);
                    let v3 = klpvs.sort((a, b) => b[2] - a[2]).slice(0, 3).map(x=>x[0]);
                    return t3.concat(p3.concat(v3).filter(x => !t3.includes(x)));
                }).then(pv3 => {
                    pv3 = pv3.filter(x=>this.candidates[x] && !this.candidates[x].watched);
                    this.addToWatch(pv3);
                });
            });
        });
    }

    trigger2() {
        // 尾盘取消
        for (const c in this.candidates) {
            if (this.candidates[c].watched) {
                const account = this.candidates[c].account;
                accld.all_accounts[account].disableStrategy(c, 'StrategyBuyDTBoard');
            }
        }
    }
}


class StrategyI_IndexTracking extends StrategyI_Interval {
    constructor(istr) {
        super(istr, 60000, '9:33:59');
        this.candidates = {
            '1.000001': ['510210']
        }
        this.earnRate = 0.03;  // 止盈幅度
        this.stepRate = 0.006; // 日内价差幅度
    }

    getIndexFflow(icode) {
        const iUrl = 'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&secid=' + icode;
        return guang.fetchData(iUrl, {}, 59000, fdata => {
            return fdata.data.klines.map(f=>f.split(',').slice(0, 2)).reduce((acc, current, index, array) => {
                if (current.length < 3) {
                    current.push(0);
                }

                if (index === 0) {
                    current[2] = current[1] - 0;
                    acc.push(current);
                } else {
                    const diff = current[1] - array[index - 1][1];
                    current[2] = diff;
                    acc.push(current);
                }
                return acc;
            }, []);
        }).then(idata => {
            if (new Date(idata.slice(-1)[0][0]) - Date.now() > 30000) {
                idata.pop();
            }
            return idata;
        });
    }

    getReferPrice(buydetails) {
        const minBuy = buydetails.minBuyPrice()
        const lastRec = buydetails.full_records.slice(-1);
        if (lastRec.type == 'S' && lastRec.sid) {
            return Math.max(minBuy, lastRec.price);
        }
        return minBuy;
    }

    trigger() {
        for (const [i, s] of Object.entries(this.candidates)) {
            this.getIndexFflow(i).then(idata => {
                if (idata.slice(-1)[0][2] > 1e8) {
                    return true;
                }
                if (idata.slice(-10).reduce((acc,cur) => acc += cur[2], 0) > 5e8) {
                    return true;
                }
                return false;
            }).then(satisfied => {
                if (!satisfied) {
                    return;
                }

                return Promise.all(s.map(sc => this.expected_account(this.istr.account, sc).then(acc => {
                    const buydetails = this.get_buydetail(acc, sc);
                    return feng.getStockSnapshot(sc).then(snap => {
                        if (!buydetails || buydetails.totalCount() == 0 || snap.latestPrice - this.getReferPrice(buydetails) * (1 - this.stepRate) < 0) {
                            return {code: sc, price: snap.latestPrice, account: acc};
                        }
                    });
                }))).then(results => results.filter(Boolean));
            }).then(mpas => {
                if (!mpas || mpas.length == 0) {
                    return;
                }
                this.estr = {'StrategySellMA': {}};
                mpas.forEach(mpa => {
                    const strategy = this.generate_strategy_json(mpa.price);
                    logger.info(this.istr.key, 'buy', mpa.code, mpa.price, mpa.account);
                    accld.tryBuyStock(mpa.code, mpa.price, 0, mpa.account, strategy);
                })
            });
        }
    }
}


const istrManager = {
    fha: null,
    initExtStrs() {
        logger.info('initExtStrs');
        this.istrs = {};
        guang.isTodayTradingDay().then(trade => {
            this.isTradingDay = trade;
            this.setupExtStrategy();
        });
    },
    getIstrData(ikey) {
        if (this.iconfig) {
            return Promise.resolve(this.iconfig[ikey]);
        }
        return svrd.getFromLocal(ikey);
    },
    build_istr(istr) {
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
        } else if (istr.key == 'istrategy_idxtrack') {
            iks = new StrategyI_IndexTracking(istr);
        }
        return iks;
    },
    setupExtStrategy() {
        for (const k in ses.ExtIstrStrategies) {
            this.getIstrData('exstrategy_' + k).then(istr => {
                if (!istr) {
                    logger.info('ext strategy', k, 'not configured');
                    return;
                }
                let iks = this.build_istr(istr);
                if (iks) {
                    this.istrs[istr.key] = iks;
                    if (iks.enabled() && this.isTradingDay) {
                        iks.prepare();
                    }
                }
            });
        }
        if (!this.isTradingDay) {
            logger.info('not trading day, please prepare manually!');
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {istrManager};
} else if (typeof window !== 'undefined') {
    window.istrManager = istrManager;
}
})();

