'use strict';

class StrategyManager {
    create(strategy) {
        if (strategy.key == 'StrategyBuy') {
            return new StrategyBuy(strategy);
        };
        if (strategy.key == 'StrategyBuyPopup') {
            return new StrategyBuyPopup(strategy);
        };
        if (strategy.key == 'StrategyBuySD') {
            return new StrategyBuySD(strategy);
        }
        if (strategy.key == 'StrategySell') {
            return new StrategySell(strategy);
        };
        if (strategy.key == 'StrategyBuyIPO') {
            return new StrategyBuyIPO(strategy);
        };
        if (strategy.key == 'StrategySellIPO') {
            return new StrategySellIPO(strategy);
        };
        if (strategy.key == 'StrategyBuyR') {
            return new StrategyBuyRepeat(strategy);
        };
        if (strategy.key == 'StrategySellR') {
            return new StrategySellRepeat(strategy);
        };
        if (strategy.key == 'StrategyBuyZTBoard') {
            return new StrategyBuyZTBoard(strategy);
        };
        if (strategy.key == 'StrategySellEL') {
            return new StrategySellEL(strategy);
        };
        if (strategy.key == 'StrategySellELS') {
            return new StrategySellELShort(strategy);
        };
        if (strategy.key == 'StrategySellELTop') {
            return new StrategySellELTop(strategy);
        }
        if (strategy.key == 'StrategyBuyMA') {
            return new StrategyBuyMA(strategy);
        };
        if (strategy.key == 'StrategySellMA') {
            return new StrategySellMA(strategy);
        };
        if (strategy.key == 'StrategyBuyBE') {
            return new StrategyBuyBeforeEnd(strategy);
        };
        if (strategy.key == 'StrategySellBE') {
            return new StrategySellBeforeEnd(strategy);
        };
        if (strategy.key == 'StrategyBuyMAE') {
            return new StrategyBuyMABeforeEnd(strategy);
        };
        if (strategy.key == 'StrategyBuySupport') {
            return new StrategyBuySupport(strategy);
        }
        if (strategy.key == 'StrategyBuyMAD') {
            return new StrategyBuyMADynamic(strategy);
        };
        if (strategy.key == 'StrategySellMAD') {
            return new StrategySellMADynamic(strategy);
        };
        if (strategy.key == 'StrategyMA') {
            return new StrategyMA(strategy);
        }
        if (strategy.key == 'StrategyTD') {
            return new StrategyTD(strategy);
        }
        if (strategy.key == 'StrategyGE') {
            return new StrategyGE(strategy);
        }
        if (strategy.key == 'StrategyGEMid') {
            return new StrategyGEMid(strategy);
        }
        if (strategy.key == 'StrategyBH') {
            return new StrategyBarginHunting(strategy);
        }
        if (strategy.key == 'StrategySD') {
            return new StrategySD(strategy);
        }
        if (strategy.key == 'StrategyBias') {
            return new StrategyBias(strategy);
        }
        if (strategy.key == 'StrategyIncDec') {
            return new StrategyIncDec(strategy);
        }
        if (strategy.key == 'StrategyZt0') {
            return new StrategyZt0(strategy);
        }
        if (strategy.key == 'StrategyZt1') {
            return new StrategyZt1(strategy);
        }
    }
}

class Strategy {
    constructor(str) {
        this.data = str;
    }

    getconfig() {
    }

    initconfig() {
        var cfgs = this.getconfig();
        if (!cfgs) {
            return;
        }
        for (var k in cfgs) {
            if (this.data[k] === undefined) {
                this.data[k] = cfgs[k].val;
            }
        }
    }

    setconfig(cfgs) {
        for (var k in cfgs) {
            this.data[k] = cfgs[k];
        }
    }

    check(chkInfo, matchCb) {
        return;
    }

    enabled() {
        return this.data.enabled;
    }

    setEnabled(val) {
        this.data.enabled = val;
    }

    key() {
        return this.data.key;
    }

    kltype() {
        return this.data.kltype;
    }

    inCritical() {
        return this.data.inCritical;
    }

    buyMatch(peek) {
    }

    sellMatch(peek) {
    }

    tostring() {
        return JSON.stringify(this.data);
    }

    guardLevel() {
        return 'rtp'; // real time prices;
    }

    klvars() {
        return;
    }

    bss18BuyMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (updatedKlt.includes(kltype)) {
            var bss = klines.getLatestBss(18, kltype);
            if (bss == 'b') {
                return true;
            }
        }
        return false;
    }

    bss18SellMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (updatedKlt.includes(kltype)) {
            var bss = 'u';
            if (!this.bss0date) {
                bss = klines.getLatestBss(18, kltype);
            } else {
                var kline = klines.getKlinesSince(this.bss0date, kltype);
                var kl = klines.getIncompleteKline(kltype);
                var okline = kline;
                if (!kl) {
                    kl = kline[kline.length - 1];
                    okline = kline.slice(0, kline.length - 1);
                }
                klines.calcKlineBss(okline, 18);
                bss = klines.getNextKlBss(okline, kl, 18);
            }
            if (bss == 's') {
                return true;
            }
        }
        return false;
    }

    bss18CutMatch(chkInfo, kltype, guardPrice) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl.bss18 == 's' || kl.bss18 == 'w') {
                if (klines.continuouslyBellowPrcDays(guardPrice, kltype) > 10) {
                    return true;
                }
            }
        }
        return false;
    }

    cutlineAcceptable(cutline, kl, kltype) {
        var cutp = (kl.c - cutline) * 100 / kl.c;
        var cutRange = {'101':{l:15, r:27}}; //, '30':{l:4,r:11},'101':{l:14, r:24}
        if (!cutRange[kltype]) {
            return true;
        }
        if (cutp >= cutRange[kltype].l && cutp <= cutRange[kltype].r) {
            return true;
        }
        return false;
    }

    bhBuyMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (!this.data.backRate) {
            this.data.backRate = 0.02;
        }
        if (!this.data.upBound) {
            this.data.upBound = -0.03;
        }
        if (!this.data.trackDays) {
            this.data.trackDays = 5;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            var s0kl = klines.lastDownKl(this.data.upBound, kltype);
            if (!s0kl) {
                return false;
            }
            var lowkl = klines.lowestKlSince(s0kl.time, kltype);
            if (lowkl.time == kl.time || kl.l - lowkl.l <= 0) {
                return false;
            }
            var topprice = klines.lastClosePrice(s0kl.time, kltype);
            topprice = topprice - s0kl.o > 0 ? topprice : s0kl.o;
            if (klines.everRunAboveSince(lowkl.time, topprice, kltype)) {
                return false;
            }
            if (klines.KlineNumSince(lowkl.time) - this.data.trackDays > 0) {
                return false;
            }
            if ((kl.c - lowkl.l) / lowkl.l - this.data.backRate < 0) {
                this.data.topprice = topprice;
                this.data.guardPrice = lowkl.l;
                return true;
            }
        }
        return false;
    }

    decBuyMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (!this.data.backRate) {
            this.data.backRate = 0.03;
        }

        if (updatedKlt.includes(kltype)) {
            var downRate = -this.data.backRate;
            var kl = klines.getLatestKline(kltype);
            var lc = klines.lastClosePrice(kl.time, kltype);
            if ((kl.c - lc) / lc - downRate < 0) {
                return true;
            }
        }
        return false;
    }

    incSellMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (!this.data.upRate) {
            this.data.upRate = 0.05;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            var lc = klines.lastClosePrice(kl.time, kltype);
            if ((kl.c - lc) / lc - this.data.upRate > 0) {
                return true;
            }
        }
        return false;
    }

    targetPriceReachBuy(kl, price, backRate = 0) {
        // 收盘价接近目标价, 收盘买入
        if ((price - kl.l) / price - backRate > 0) {
            return false;
        }
        return (kl.c - price) / price - backRate <= 0;
    }

    targetPriceReachSell(kl, price, upRate = 0) {
        // 最高价接近目标价且收盘价回落不大, 收盘卖出
        return (price - kl.h) / price - upRate <= 0 && (price - kl.c) / price - 2 * upRate <= 0;
    }

    cutPriceReached(kl, cutprice) {
        return kl.c - cutprice < 0;
    }

    lowPriceStopGrowingSell(klines, kltype, topprice=0) {
        // 低点抬高法卖出
        if (topprice === undefined || topprice == 0) {
            return false;
        }
        if (klines.isLowPriceStopIncreasing(kltype)) {
            var kl1 = klines.getLastNKlines(kltype, 1);
            if (kl1 && kl1.length > 0 && kl1[0].h - topprice > 0) {
                return true;
            }
        }
        return false;
    }

    biasSellMatch(klines, kltype) {
        if (!this.data.upBias) {
            this.data.upBias = 15;
        }

        var kl = klines.getLatestKline(kltype);
        if (kl.bias18 === undefined) {
            var prekls = klines.getLastNKlines(kltype, 18);
            kl.bias18 = klines.getNextKlBias(prekls, kl, 18);
        }
        return kl.bias18 - this.data.upBias > 0;
    }

    zt1VolMinBuyMatch(chkInfo, kltype) {
        // 首板一字涨停， 缩量买入
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (!this.data.guardVol) {
            this.data.guardVol = 10000;
        }
        if (!this.data.backRate) {
            this.data.backRate = 0.02;
        }

        if (updatedKlt.includes(kltype)) {
            var lowvkl = klines.minVolKlSince(this.data.zt0date, kltype);
            var hprc = klines.highestPriceSince(this.data.zt0date, kltype);
            var lowkl = klines.lowestKlSince(this.data.zt0date, kltype);
            var lprc = lowkl.l;
            var kl = klines.getLatestKline(kltype);
            if (lowkl.time == kl.time) {
                // 最低价当日更新区间最高价, 即为目标价
                this.data.topprice = hprc;
            }
            if (kl.l - lprc <= 0) {
                // 当日最低价为区间最低价不买入
                return false;
            }
            var prekl = klines.getPrevKline(kltype);
            if (prekl.time == this.data.zt0date) {
                // 涨停次日不买入
                return false;
            }
            if (this.data.topprice && hprc - this.data.topprice > 0) {
                // 最低价之后的最高价已经超过目标价
                this.setEnabled(false);
                return false;
            }
            var num = klines.KlineNumSince(this.data.zt0date);
            if (num >= 60) {
                var ztkl = klines.getKlineByTime(this.data.zt0date);
                if (!ztkl) {
                    emjyBack.log('error zt1VolMinBuyMatch', chkInfo.code, kltype, this.data.zt0date);
                    return false;
                }
                if (lprc - ztkl.c > 0) {
                    // 涨停后60个交易日都运行在涨停日价格之上, 不再关注
                    this.setEnabled(false);
                    return false;
                }
            }
            if (lowvkl.v - this.data.guardVol > 0) {
                // 最低成交量大于参考量
                return false;
            }
            if (kl.h - hprc >= 0) {
                // 超出最高价 不再关注
                this.setEnabled(false);
                return false;
            }
            if (hprc - 1.1 * kl.c < 0) {
                // 目标价获利空间不足10% 放弃
                return false;
            }
            // 成交量跌破参考量当日 或 收盘价低于最低成交量当日的收盘价 或 收盘价在区间最低价以上backRate之内买入
            if (kl.c - lowvkl.c <= 0 || (kl.c - lprc) / lprc <= this.data.backRate) {
                this.data.guardPrice = lprc;
                if (!this.data.topprice) {
                    this.data.topprice = hprc;
                }
                return true;
            }
        }
        return false;
    }

    volSellMatch(klines, kltype) {
        // 成交量 > 1.5 * 10日均量的阳线
        var kl = klines.getLatestKline(kltype);
        var kline = klines.getLastNKlines(kltype, 10);
        var mv10 = klines.getNextKlMV(kline, kl, 10);
        return kl.v - 1.5 * mv10 > 0 && kl.c - kl.o > 0;
    }
}

class StrategyComplexBase extends Strategy {
    checkCreateBuy(chkInfo, matchCb) {
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        return false;
    }

    onCutDone(code) {
        return;
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var buydetails = chkInfo.buydetail;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        }

        this.checkMeta(buydetails);
        if (this.data.meta.state == 's0') {
            this.checkCreateBuy(chkInfo, matchCb);
            return;
        }

        if (this.checkCutOrSell(chkInfo, matchCb)) {
            return;
        }

        this.checkConsecutiveBuySell(chkInfo, matchCb);
    }
}

class StrategyBuy extends Strategy {
    constructor(str) {
        super(str);
    }

    guardLevel() {
        return 'otp';  // one time prices;
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }
        if (this.guardLevel() != 'otp') {
            return;
        }

        this.setEnabled(false);
        var rtInfo = chkInfo.rtInfo;
        var price = rtInfo.latestPrice;
        if (rtInfo.buysells) {
            if (rtInfo.buysells.sale2 == '-') {
                price = rtInfo.topprice;
            } else {
                price = rtInfo.buysells.sale2;
            }
        }
        if (!this.data.bway) {
            this.data.bway = 'direct';
        }
        // 'direct': '直接买入', 'ge': '高于', 'le':'低于', 'lg': '介于', 'nlg': '不介于'
        if (this.data.bway == 'direct') {
            matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
                this.setEnabled(false);
            });
            return;
        }

        var lclose = rtInfo.lastClose;
        if (this.data.bway == 'ge') {
            if (rtInfo.latestPrice - lclose * (1 + this.data.rate0) >= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
        if (this.data.bway == 'le') {
            if (rtInfo.latestPrice - lclose * (1 + this.data.rate0) <= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
        if (this.data.bway == 'lg') {
            if (this.data.rate0 - this.data.rate1 < 0) {
                emjyBack.log('wrong data setting for StrategyBuy, upband rate:', this.data.rate0, 'lowband rate:', this.data.rate1);
                return;
            }
            if (rtInfo.latestPrice - lclose * (1 + this.data.rate0) <= 0 && rtInfo.latestPrice - lclose * (1 + this.data.rate1) >= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
        if (this.data.bway == 'nlg') {
            if (this.data.rate0 - this.data.rate1 < 0) {
                emjyBack.log('wrong data setting for StrategyBuy, upband rate:', this.data.rate0, 'lowband rate:', this.data.rate1);
                return;
            }
            if (rtInfo.latestPrice - lclose * (1 + this.data.rate0) >= 0 || rtInfo.latestPrice - lclose * (1 + this.data.rate1) <= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
    }
}

class StrategyBuyPopup extends StrategyBuy {
    guardLevel() {
        return 'rtp';
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        var price = rtInfo.latestPrice;
        if (!this.data.inCritical) {
            if (price <= this.data.guardPrice) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                matchCb({id: chkInfo.id});
            }
            return;
        }
        if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: (rtInfo.buysells.sale2 == '-' ? rtInfo.topprice : rtInfo.buysells.sale2)}, _ => {
                this.setEnabled(false);
            });
            return;
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            matchCb({id: chkInfo.id});
        }
    }
}

class StrategyBuySD extends StrategyBuy {
    guardLevel() {
        return 'kline';
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        }

        if (klines.isDecreaseStoppedStrict(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.setEnabled(false);
            });
        }
    }
}

class StrategySell extends Strategy {
    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        var price = rtInfo.latestPrice;
        if (!this.data.inCritical) {
            if (price > this.data.guardPrice) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                matchCb({id: chkInfo.id});
            }
            return;
        }
        var buydetail = chkInfo.buydetail;
        var count = buydetail.availableCount();
        if (price <= this.data.prePeekPrice * (1 - this.data.backRate) && count > 0) {
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buysells.buy2 == '-' ? rtInfo.bottomprice : rtInfo.buysells.buy2}, _ => {
                this.setEnabled(false);
            });
            return;
        }
        if (price > this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            matchCb({id: chkInfo.id});
        }
    }
}

class StrategyBuyRepeat extends StrategyBuyPopup {
    buyMatch(refer) {
        this.data.inCritical = false;
        this.data.guardPrice = refer.price * (1 - this.data.stepRate);
    }

    sellMatch(refer) {
        this.data.inCritical = false;
        this.data.guardPrice = refer.price * (1 - this.data.stepRate);
    }
}

class StrategySellRepeat extends StrategySell {
    buyMatch(refer) {
        this.data.inCritical = false;
        this.data.guardPrice = refer.price * (1 + this.data.stepRate);
    }

    sellMatch(refer) {
        this.data.inCritical = false;
        this.data.guardPrice = refer.price * (1 + this.data.stepRate);
    }
}

class StrategyBuyIPO extends StrategyBuy {
    guardLevel() {
        return 'rtp';
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var price = rtInfo.latestPrice;
        var topprice = rtInfo.topprice;
        if (!this.data.inCritical) {
            if (price < topprice) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                matchCb({id: chkInfo.id});
            }
            return;
        }
        if (price - this.data.prePeekPrice * (1 + this.data.backRate) >= 0) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: (rtInfo.buysells.sale2 == '-' ? rtInfo.topprice : rtInfo.buysells.sale2)}, _ => {
                this.setEnabled(false);
            });
            return;
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            matchCb({id: chkInfo.id});
        }
    }
}

class StrategySellIPO extends StrategySell {
    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        var buydetail = chkInfo.buydetail;

        var count = buydetail.availableCount();

        if (rtInfo.openPrice == rtInfo.topprice) {
            if (rtInfo.latestPrice - rtInfo.topprice < 0 && count > 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buysells.buy2 == '-'? rtInfo.bottomprice : rtInfo.buysells.buy2}, _ => {
                    this.setEnabled(false);
                });
            };
            return;
        };

        if (rtInfo.openPrice - rtInfo.bottomprice == 0 && count > 0) {
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.bottomprice}, _ => {
                this.setEnabled(false);
            });
            return;
        };

        if (rtInfo.latestPrice - this.data.prePeekPrice * 0.99 <= 0 && count > 0) {
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buysells.buy2 == '-'? rtInfo.bottomprice : rtInfo.buysells.buy2}, _ => {
                this.setEnabled(false);
            });
            return;
        }

        if (rtInfo.latestPrice - this.data.prePeekPrice > 0) {
            this.data.prePeekPrice = rtInfo.latestPrice;
            matchCb({id: chkInfo.id});
        }
    }
}

class StrategyBuyZTBoard extends StrategyBuy {
    guardLevel() {
        return 'zt';
    }

    is_zt_reaching(bs, topprice) {
        var topshown = false;
        for (var i = 5; i > 0; i--) {
            if (bs['sale'+i] == '-') {
                topshown = true;
                break;
            }
        }
        if (!topshown) {
            topshown = bs.sale5 - topprice == 0;
        }
        if (topshown) {
            var scount = 0;
            for (var i = 5; i > 0; i--) {
                scount += bs['sale' + i + '_count'];
            }
            return scount < 20000;
        }
        return false;
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || this.tmpbuyonzt || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        if (rtInfo.buysells.buy1 == rtInfo.buysells.sale1) {
            // 集合竞价
            return;
        }

        if (rtInfo.latestPrice == rtInfo.topprice) {
            if (rtInfo.topprice == rtInfo.openPrice && this.tmpztbroken === undefined) {
                this.tmpztbroken = false;
            }
            if (!this.tmpztbroken) {
                return;
            }
        } else {
            this.tmpztbroken = true;
        }

        if ((rtInfo.latestPrice == rtInfo.topprice && (this.tmpztbroken || this.tmpztbroken === undefined)) ||
            (rtInfo.buysells.sale2 == '-' && rtInfo.buysells.sale1 == rtInfo.topprice) ||
            this.is_zt_reaching(rtInfo.buysells, rtInfo.topprice)) {
            this.tmpbuyonzt = true;
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: rtInfo.topprice}, _ => {
                this.setEnabled(false);
                delete(this.tmpbuyonzt);
            });
        };
    }
}

class StrategySellEL extends StrategySell {
    buyMatch(refer) {
        this.data.enabled = true;
    }

    sellMatch(refer) {
        this.data.enabled = false;
    }

    guardLevel() {
        return 'kzt';
    }

    kltype() {
        return '101';
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        var buydetail = chkInfo.buydetail;
        var latestPrice = rtInfo.latestPrice;
        var guardPrice = this.data.guardPrice;
        var averPrice = buydetail.averPrice();
        if (latestPrice - averPrice * 1.18 >= 0 && latestPrice - averPrice * 0.1 - guardPrice > 0) {
            guardPrice = latestPrice - averPrice * 0.1;
        } else if (latestPrice - averPrice * 1.09 >= 0 && latestPrice - averPrice * 0.08 - guardPrice > 0 ) {
            guardPrice = latestPrice - averPrice * 0.08;
        } else if (latestPrice - averPrice * 1.07 >= 0 && averPrice - guardPrice > 0) {
            guardPrice = averPrice * 1.01;
        };
        if (guardPrice - this.data.guardPrice > 0) {
            this.data.guardPrice = guardPrice;
            matchCb({id: chkInfo.id});
        };
        var count = buydetail.availableCount();
        if (rtInfo.latestPrice - guardPrice <= 0 && count > 0) {
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: (rtInfo.buysells.buy2 == '-' ? rtInfo.bottomprice : rtInfo.buysells.buy2)}, _ => {
                this.setEnabled(false);
            });
            return;
        };
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined) {
            return;
        };

        if (updatedKlt.length < 1 || !updatedKlt.includes('101')) {
            return;
        };

        var nKlines = klines.getKline('101');
        if (nKlines && nKlines.length > 0) {
            var kl = nKlines[nKlines.length - 1];
            if (kl.c - kl.o * 1.065 >= 0 && kl.l - this.data.guardPrice > 0) {
                this.data.guardPrice = kl.l;
                matchCb({id: chkInfo.id});
            };
        };
    }
}

class StrategySellELShort extends StrategySellEL {
    guardLevel() {
        return 'kzt';
    }

    kltype() {
        return '1';
    }

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        var buydetails = chkInfo.buydetail;
        var latestPrice = rtInfo.latestPrice;
        if (this.data.topprice !== undefined && latestPrice - this.data.topprice < 0) {
            return;
        }

        if (latestPrice == rtInfo.topprice && rtInfo.buysells.sale1 == '-') {
            this.tmpztreached = true;
        }

        if (this.tmpztreached) {
            if (rtInfo.buysells.buy1 == rtInfo.buysells.sale1) {
                // 集合竞价
                return;
            }
            if (!this.tmpmaxb1count) {
                this.tmpmaxb1count = rtInfo.buysells.buy1_count;
            } else {
                if (rtInfo.buysells.buy1_count > this.tmpmaxb1count) {
                    this.tmpmaxb1count = rtInfo.buysells.buy1_count;
                }
            }
            if (this.tmpmaxb1count < 10000) {
                return;
            }
            // 涨停之后 打开或者封单减少到当日最大封单量的1/10 卖出.
            if (rtInfo.buysells.sale1 != '-' || rtInfo.buysells.buy1_count < this.tmpmaxb1count * 0.1) {
                var count = buydetails.getCountMatched(this.data.cutselltype, latestPrice);
                if (count > 0) {
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: (rtInfo.buysells.buy2 == '-' ? rtInfo.bottomprice : rtInfo.buysells.buy2)}, _ => {
                        this.setEnabled(false);
                    });
                    return;
                }
            }
        }
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined) {
            return;
        };

        if (updatedKlt.length < 1 || !updatedKlt.includes('1')) {
            return;
        };

        var kl = klines.getLatestKline('1');
        var buydetails = chkInfo.buydetail;
        if (!this.data.cutselltype) {
            this.data.cutselltype = 'all';
        }
        if (this.data.topprice !== undefined) {
            if (kl.c - this.data.topprice <= 0 && kl.c - this.data.guardPrice >= 0) {
                return;
            }
            delete(this.data.topprice);
        }
        var count = buydetails.getCountMatched(this.data.cutselltype, kl.c);
        if (kl.c - this.data.guardPrice < 0 && count > 0) {
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.setEnabled(false);
            });
            return;
        }

        var troughprice = klines.getLastTrough('1');
        if (emjyBack.stockZdtPrices && emjyBack.stockZdtPrices[chkInfo.code]) {
            if (kl.c - kl.l == 0 && kl.c - emjyBack.stockZdtPrices[chkInfo.code].ztprice >= 0 && kl.c * 0.98 - troughprice > 0) {
                troughprice = kl.c * 0.96;
            }
        }
        if (troughprice > 0 && troughprice - this.data.guardPrice > 0) {
            this.data.guardPrice = troughprice;
            matchCb({id: chkInfo.id});
        }
    }
}

class StrategySellELTop extends StrategySell {
    constructor(str) {
        super(str);
        this.dkltype = '101';
    }

    guardLevel() {
        return 'klines';
    }

    kltype() {
        return [this.dkltype, this.data.kltype];
    }

    checkMeta(buydetail) {
        if (!this.data.kltype) {
            this.data.kltype = '4';
        }
        if (!this.data.upRate) {
            this.data.upRate = 0.01;
        }
        if (!this.data.selltype) {
            this.data.selltype = 'single';
        }
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        this.checkMeta(chkInfo.buydetail);

        var kltype = this.data.kltype;
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined) {
            return;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            var topprice = this.data.topprice;
            if (this.lowPriceStopGrowingSell(klines, kltype, topprice)) {
                // sell.
                var count = chkInfo.buydetail.getCountMatched(this.data.selltype, kl.c);
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
            if (this.data.guardPrice !== undefined) {
                if (this.cutPriceReached(kl, this.data.guardPrice)) {
                    // cut
                    var selltype = this.data.selltype;
                    if (this.data.cutselltype !== undefined) {
                        selltype = this.data.cutselltype;
                    }
                    var count = chkInfo.buydetail.getCountMatched(selltype, kl.c);
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                        this.setEnabled(false);
                    });
                    return;
                }
            }
        };

        if (updatedKlt.includes(this.dkltype)) {
            var kl = klines.getLatestKline(this.dkltype);
            if (emjyBack.stockZdtPrices && emjyBack.stockZdtPrices[chkInfo.code]) {
                if (kl.c - emjyBack.stockZdtPrices[chkInfo.code].ztprice >= 0) {
                    // 涨停不卖出
                    return;
                }
            } else if (klines.latestKlinePercentage() - 0.09 > 0 && kl.c - kl.h == 0) {
                // 涨停不卖出
                return;
            }

            if (this.targetPriceReachSell(kl, this.data.topprice, this.data.upRate)) {
                // sell.
                var count = chkInfo.buydetail.getCountMatched(this.data.selltype, kl.c);
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
        // wait
    }
}

class StrategyBuyMA extends StrategyBuy {
    buyMatch(refer) {
        this.data.enabled = false;
    }

    sellMatch(refer) {
        this.data.enabled = true;
    }

    guardLevel() {
        return 'kline';
    }

    klvars() {
        return 'bss18';
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        if (this.bss18BuyMatch(chkInfo, this.kltype())) {
            var kl = emjyBack.klines[chkInfo.code].getLatestKline(this.kltype())
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.setEnabled(false);
            });
        }
    }
}

class StrategySellMA extends StrategySell {
    buyMatch(refer) {
        this.data.enabled = true;
    }

    sellMatch(refer) {
        this.data.enabled = false;
    }

    guardLevel() {
        return 'kline';
    }

    klvars() {
        return 'bss18';
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        if (this.bss18SellMatch(chkInfo, this.kltype())) {
            var count = chkInfo.buydetail.availableCount();
            if (count > 0) {
                var klines = emjyBack.klines[chkInfo.code];
                var kl = klines.getLatestKline(this.kltype());
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
            }
        }
    }
}

class StrategyBuyMADynamic extends StrategyBuyMA {
    constructor(str) {
        super(str);
        this.kltypeCandiList = {'4': '8', '8': '15', '15':'30', '30':'60', '60':'120', '120':'101', '101': '202', '202': '404'};
    }

    klvars() {
        return ['ma18', 'bss18'];
    }

    buyMatch(refer) {
        this.data.enabled = false;
    }

    sellMatch(refer) {
        this.data.enabled = true;
        if (refer.kltype !== undefined) {
            this.data.kltype = refer.kltype;
        }
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        if (klines === undefined) {
            return;
        }
        if (this.bss18BuyMatch(chkInfo, this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.setEnabled(false);
            });
            return;
        }
        var kltype = this.kltype();
        if (kltype == '60') {
            return;
        }
        
        var updatedKlt = chkInfo.kltypes;
        if (updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };

        var gklt = this.kltypeCandiList[kltype];
        if (gklt && updatedKlt.includes(gklt)) {
            if (klines.continuouslyBellowMaDays(gklt) >= 5) {
                // if (gklt == '404') {
                //     this.data.enabled = false;
                // } else {
                // };
                this.data.kltype = gklt;
                matchCb({id: chkInfo.id});
            }
        };
        return;
    }
}

class StrategySellMADynamic extends StrategySellMA {
    buyMatch(refer) {
        this.data.enabled = true;
        if (refer.kltype !== undefined) {
            this.data.kltype = refer.kltype;
        }
        if (refer.kltype - 100 > 0) {
            this.data.kltype = '60';
        }
    }

    sellMatch(refer) {
        this.data.enabled = false;
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        if (klines === undefined) {
            return;
        }
        var kl = klines.getLatestKline(this.kltype());
        if (this.bss18SellMatch(chkInfo, this.kltype())) {
            var count = chkInfo.buydetail.availableCount();
            if ((this.data.guardPrice === undefined || this.data.guardPrice == 0) && count > 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }

            if (kl.c - 1.05 * averPrice > 0 && kl.bss18 == 's') {
                if (count > 0) {
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                        this.setEnabled(false);
                    });
                } else if (buydetails.totalCount() > 0) {
                    this.sellMatchUnavailable();
                    matchCb({id: chkInfo});
                }
            }
            return;
        }

        var buydetails = chkInfo.buydetail;
        if (!buydetails) {
            return;
        }
        var kltype = this.kltype();
        var averPrice = buydetails.averPrice();
        if (kltype != '4') {
            var mKlines = klines.getKline(1);
            if (mKlines) {
                var highPrice = mKlines[mKlines.length - 1].h;
                if (averPrice > 0 && highPrice > averPrice * 1.2) {
                    this.data.kltype = '4';
                    matchCb({id: chkInfo});
                }
            }
            var kl = klines.getLatestKline('101');
            if (kl) {
                var lclose = kl.c;
                if (averPrice > 0 && highPrice > lclose * 1.085 && highPrice > averPrice * 1.05) {
                    this.data.kltype = '4';
                    matchCb({id: chkInfo});
                }
            }
        }
    }

    sellMatchUnavailable() {
        var kltypeCandiList = {'4': '8', '8': '15', '15':'30', '30':'60', '60':'120', '120':'101', '101': '202', '202': '404'};
        var kltype = this.kltype();
        this.data.kltype = kltypeCandiList[kltype];
        this.setEnabled(true);
    }
}

class StrategyBuyBeforeEnd extends Strategy {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return '101';
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var buydetails = chkInfo.buydetail;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        }

        var kltype = this.kltype();
        var kl = klines.getLatestKline(kltype);
        if (!buydetails || buydetails.buyRecords().length == 0) {
            var backRate = this.data.backRate;
            if (backRate === undefined) {
                backRate = 0.15;
            }
            var decDays = this.data.decDays;
            if (decDays === undefined) {
                decDays = 3;
            }
            // 当日收盘价回撤小于backRate， 且连续上涨天数=decDays
            if (klines.latestKlineDrawback(kltype) - backRate > 0) {
                return;
            }
            if (klines.continuouslyIncreaseDays() - decDays == 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
            }
            return;
        }
    }
}

class StrategySellBeforeEnd extends Strategy {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return '101';
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var buydetails = chkInfo.buydetail;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        }

        var kltype = this.kltype();
        if (!updatedKlt.includes(kltype)) {
            return;
        }

        if (!buydetails || buydetails.buyRecords().length == 0) {
            // 没有买入记录
            return;
        }

        var count = buydetails.availableCount();
        if (count <= 0) {
            return;
        }
        if (!this.data.sell_conds) {
            return;
        }

        const conditions = {'not_zt': 1,  'h_and_l_dec': 1<<1, 'h_or_l_dec':1<<2};
        var kl = klines.getLatestKline(kltype);
        if (!this.data.selltype) {
            this.data.selltype = 'single';
        }
        count = chkInfo.buydetail.getCountMatched(this.data.selltype, kl.c);
        if (this.data.sell_conds & conditions['not_zt']) {
            if (emjyBack.stockZdtPrices && emjyBack.stockZdtPrices[chkInfo.code] && kl.c - emjyBack.stockZdtPrices[chkInfo.code].ztprice < 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }

        var prekl = klines.getPrevKline(kltype);
        if (prekl.time == kl.time) {
            emjyBack.log('invalid prev kline data!');
            return;
        }

        var zt = emjyBack.stockZdtPrices && emjyBack.stockZdtPrices[chkInfo.code] && kl.c - emjyBack.stockZdtPrices[chkInfo.code].ztprice >= 0
        var hinc = kl.h - prekl.h > 0 || zt;
        var linc = kl.l - prekl.l > 0;
        if (this.data.sell_conds & conditions['h_and_l_dec']) {
            // 最高价和最低价都不增加时卖出
            if (!hinc && !linc) {
                emjyBack.log('StrategySellBeforeEnd kl &&', this.data.sell_conds, JSON.stringify(kl), 'prekl', JSON.stringify(prekl));
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
        if (this.data.sell_conds & conditions['h_or_l_dec']) {
            // 最高价或最低价不增加时卖出
            if (!hinc || !linc) {
                emjyBack.log('StrategySellBeforeEnd kl ||', this.data.sell_conds, JSON.stringify(kl), 'prekl', JSON.stringify(prekl));
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return;
            }
        }
    }
}

class StrategyBuyMABeforeEnd extends StrategyBuyMA {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return this.data.kltype;
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };
        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                if (kl.bss18 == 'b') {
                    matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                        this.setEnabled(false);
                    });
                    return;
                }
                if (kl.bss18 == 'h') {
                    var h = kl.h;
                    var c = kl.c;
                    var o = kl.o;
                    var dKline = klines.getKline(this.kltype())
                    if (dKline && dKline.length > 0) {
                        var klb = dKline[dKline.length - 1];
                        for (var i = dKline.length - 1; i >= 0; i--) {
                            if (dKline[i].h - h > 0) {
                                h = dKline[i].h;
                            }
                            if (dKline[i].bss18 == 'b') {
                                klb = dKline[i];
                                o = klb.o;
                                if (i >= 1) {
                                    o = dKline[i - 1].c;
                                }
                                break;
                            }
                        }
                        if ((h - o) / o < 0.03 && c - o > 0) {
                            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: c}, _ => {
                                this.setEnabled(false);
                            });
                            return;
                        }
                        if ((h - o) / o > 0.03 && (h - c) * 4 < h - o) {
                            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: c}, _ => {
                                this.setEnabled(false);
                            });
                            return;
                        }
                    }
                }
            };
        };
    }
}

class StrategyBuySupport extends StrategyBuy {
    guardLevel() {
        return 'kline';
    }

    isLowReverseKl(kl) {
        if (Math.abs(kl.o - kl.c) / kl.c < 0.001) {
            return true;
        }
        if (Math.abs(kl.o - kl.c) / kl.c < 0.01 && (kl.h - kl.l) / kl.c > 0.04) {
            return true;
        }

        return false;
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        if (!this.data.guardPrice) {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        }

        var kltype = this.data.kltype;
        if (!updatedKlt.includes(kltype)) {
            return;
        }

        var kl = klines.getLatestKline(kltype);

        if (kl.l - this.data.guardPrice < 0) {
            // 最低价创新低
            this.data.guardPrice = kl.l;
            if (this.data.guardBreakBuyReverse) {
                // 底部反转k线买入
                if (this.isLowReverseKl(kl)) {
                    matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                        this.setEnabled(false);
                    });
                    return;
                }
            }
            matchCb({id: chkInfo.id});
            return;
        }

        if (this.data.backRate === undefined) {
            this.data.backRate = 0.02;
        }
        if (this.targetPriceReachBuy(kl, this.data.guardPrice, this.data.backRate)) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.setEnabled(false);
            });
        }
    }
}

class StrategyMABackup extends Strategy {
    guardLevel() {
        return 'kline';
    }

    klvars() {
        return ['bss18']
    }

    resetGuardPrice() {
        if (this.data.guardPrice !== undefined) {
            delete(this.data.guardPrice);
        }

        if (this.data.guardDate !== undefined) {
            delete(this.data.guardDate);
        }
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var klines = emjyBack.klines[chkInfo.code];
        if (klines === undefined) {
            return;
        }

        var kltype = this.kltype();
        var kl = klines.getLatestKline(kltype);
        // 买入
        if (this.bss18BuyMatch(chkInfo, kltype)) {
            var backRate = this.data.backRate;
            if (backRate === undefined) {
                backRate = 0.15;
            }
            var cutline = klines.getLowestInWaiting(kltype);
            if (klines.latestKlineDrawback(kltype) - backRate <= 0 && this.cutlineAcceptable(cutline, kl, kltype)) {
                this.tmpGuardPrice = cutline;
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.guardPrice = this.tmpGuardPrice;
                });
            }
            return;
        }

        var buydetails = chkInfo.buydetail;
        var count = 0;
        if (buydetails) {
            count = buydetails.availableCount();
        }
        // 卖出
        if (this.bss18SellMatch(chkInfo, this.kltype())) {
            if (count > 0) {
                if (!this.data.guardPrice || this.data.guardPrice == 0) {
                    // 无安全线
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c});
                } else if ( kl.c - this.data.guardPrice > 0) {
                    // 有安全线
                    var xcount = buydetails.getCountLessThan(kl.c, 0.05);
                    if (xcount > 0) {
                        if (xcount < buydetails.totalCount()) {
                            this.tmpGuardDate = kl.time;
                            matchCb({id: chkInfo.id, tradeType: 'S', count: xcount, price: kl.c}, _ => {
                                this.data.guardDate = this.tmpGuardDate;
                            });
                        } else {
                            matchCb({id: chkInfo.id, tradeType: 'S', count: xcount, price: kl.c}, _ => {
                                this.resetGuardPrice();
                            });
                        }
                    }
                }
            }
        }

        // 止损
        if (this.bss18CutMatch(chkInfo, this.kltype(), this.data.guardPrice)) {
            if (count > 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.resetGuardPrice();
                });
                return;
            }
        }
    }
}

class StrategyTD extends StrategyComplexBase {
    guardLevel() {
        return 'klines';
    }

    kltype() {
        return ['15', '101'];
    }

    klvars() {
        return ['td'];
    }

    checkMeta(buydetails) {
        if (!this.data.meta) {
            this.data.meta = {};
            // s0: 未建仓/清仓， s1: 建仓/有持仓 s2: 反T卖出无持仓
            if (!buydetails || buydetails.totalCount() == 0) {
                this.data.meta.state = 's0';
            } else {
                this.data.meta.state = 's1';
                this.data.meta.s0price = buydetails.maxBuyPrice();
            }
        }

        if (!this.data.backRate) {
            this.data.backRate = 0.15;
        }
        if (!this.data.upRate) {
            this.data.upRate = 0.25;
        }
        if (!this.data.stepRate) {
            this.data.stepRate = 0.08;
        }
    }

    checkCreateBuy(chkInfo, matchCb) {
        // 建仓
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltypes = ['30', '60', '120', '101']; //['15', '30'];// 
        for (var i in kltypes) {
            var kltype = kltypes[i];
            if (!updatedKlt.includes(kltype)) {
                continue;
            }

            var kl = klines.getLatestKline(kltype);
            if (kl.td < -6) {
                if (!this.data.meta.downtd) {
                    this.data.meta.downtd = {};
                }
                if (!this.data.meta.downtd[kltype] || kl.td < this.data.meta.downtd[kltype]) {
                    this.data.meta.downtd[kltype] = kl.td;
                }
            }
            if (this.data.meta.downtd && this.data.meta.downtd[kltype] < -8 && kl.td > -1 && kl.td < 3 && klines.continuouslyIncreaseDays(kltype) > 2) {
                this.tmps0price = kl.c;
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.meta.state = 's1';
                    delete(this.data.meta.downtd);
                    delete(this.data.meta.uptd);
                    this.data.meta.s0price = this.tmps0price;
                });
                return true;
            }
        }
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        return this.checkTdBuySell(chkInfo, matchCb);
    }

    checkTdBuySell(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var buydetails = chkInfo.buydetail;
        var kltypes = ['30', '60', '120', '101']; //['15', '30'];// 
        for (var i in kltypes) {
            var kltype = kltypes[i];
            if (!updatedKlt.includes(kltype)) {
                continue;
            }

            var kl = klines.getLatestKline(kltype);
            if (kl.td > 6) {
                if (!this.data.meta.uptd) {
                    this.data.meta.uptd = {};
                }
                if (!this.data.meta.uptd[kltype] || kl.td > this.data.meta.uptd[kltype]) {
                    this.data.meta.uptd[kltype] = kl.td;
                }
            } else if (kl.td < -6) {
                if (!this.data.meta.downtd) {
                    this.data.meta.downtd = {};
                }
                if (!this.data.meta.downtd[kltype] || kl.td < this.data.meta.downtd[kltype]) {
                    this.data.meta.downtd[kltype] = kl.td;
                }
            }
            var buyref = this.data.meta.s0price;
            var smioff = 0;
            if (this.data.meta.state == 's1') {
                var minbuy = buydetails.minBuyPrice();
                if (buyref - minbuy > 0 && minbuy > 0) {
                    buyref = minbuy;
                }
                smioff = emjyBack.getSmiOffset(buydetails.latestBuyDate());
            }
            if (this.data.meta.state == 's2') {
                buyref = this.data.meta.s2price;
            }
            if (this.data.meta.downtd && this.data.meta.downtd[kltype] < -8 && kl.td > -1 && kl.td < 3 && klines.continuouslyIncreaseDays(kltype) > 2) {
                if (kl.c - (buyref - this.data.meta.s0price * (this.data.backRate - smioff)) < 0) {
                    // 加仓
                    matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                        this.data.meta.state = 's1';
                        delete(this.data.meta.downtd);
                        delete(this.data.meta.uptd);
                    });
                    return true;
                }
            }

            if (this.data.meta.uptd && this.data.meta.uptd[kltype] > 8 && kl.td < 1 && kl.td > -3 && klines.continuouslyDecreaseDays(kltype) > 2) {
                var count = buydetails.getCountLessThan(kl.c, buydetails.buyRecords().length > 1 ? this.data.stepRate : this.data.upRate);
                if (count > 0) {
                    // 减仓
                    this.tmps2price = kl.c;
                    this.tmpnextstate = buydetails.totalCount() > count ? 's1' : 's2';
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                        this.data.meta.s2price = this.tmps2price;
                        this.data.meta.state = this.tmpnextstate;
                        if (this.data.meta.tcount === undefined) {
                            this.data.meta.tcount = 0;
                        }
                        this.data.meta.tcount++;
                        delete(this.data.meta.downtd);
                        delete(this.data.meta.uptd);
                    });
                    return true;
                }
            }
        }
        return false;
    }
}

class StrategyMA extends StrategyTD {
    kltype() {
        if (!this.data.meta || this.data.meta.state == 's0') {
            return ['101'];
        }
        return ['15', '101'];
    }

    klvars() {
        return ['bss18', 'td'];
    }

    resetGuardPrice() {
        if (this.data.guardPrice !== undefined) {
            delete(this.data.guardPrice);
        }

        if (this.data.guardDate !== undefined) {
            delete(this.data.guardDate);
        }

        if (this.data.meta !== undefined) {
            delete(this.data.meta);
        }
    }

    checkCreateBuy(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        var kltype = '101';
        if (this.bss18BuyMatch(chkInfo, kltype)) {
            var drawBack = this.data.drawBack;
            if (drawBack === undefined) {
                drawBack = 0.15;
            }
            var kl = klines.getLatestKline(kltype);
            var cutline = klines.getLowestInWaiting(kltype);
            var bkl = klines.getLastBssBuyKline(kltype);
            if (bkl && (kl.c - bkl.c / bkl.c) - 0.5 >= 0 ) {
                return false;
            }
            if (klines.latestKlineDrawback(kltype) - drawBack <= 0 && this.cutlineAcceptable(cutline, kl, kltype)) {
                this.tmpGuardPrice = cutline;
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.guardPrice = this.tmpGuardPrice;
                    this.data.meta.state = 's1';
                });
                return true;
            }
        }
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var buydetails = chkInfo.buydetail;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        var kltype = '101';
        var kl = klines.getLatestKline(kltype);
        if (this.bss18SellMatch(chkInfo, kltype)) {
            if (this.data.meta.state == 's2') {
                this.data.meta.state = 's0';
                matchCb({id: chkInfo.id});
                return true;
            } else if (this.data.meta.state == 's1') {
                var count = buydetails ? buydetails.availableCount() : 0;
                if (count > 0 && this.data.meta.tcount && this.data.meta.tcount > 8) {
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                        this.resetGuardPrice();
                    });
                    return true;
                }
            }
        }
        var count = buydetails ? buydetails.availableCount() : 0;
        var smioff = emjyBack.getSmiOffset(buydetails.highestBuyDate());
        if (count > 0 && this.bss18CutMatch(chkInfo, kltype, this.data.guardPrice * (1 + smioff))) {
            // 止损
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.resetGuardPrice();
            });
            return true;
        }
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        if (this.checkTdBuySell(chkInfo, matchCb)) {
            return true;
        }

        var buydetails = chkInfo.buydetail;
        var kltype = '30';
        if (this.bss18SellMatch(chkInfo, kltype)) {
            var upRate = this.data.upRate;
            if (this.data.meta && this.data.meta.tcount) {
                upRate = this.data.upRate - this.data.meta.tcount * this.data.stepRate;
                if (upRate - this.data.stepRate < 0) {
                    upRate = this.data.stepRate;
                }
            }

            var klines = emjyBack.klines[chkInfo.code];
            var kl = klines.getLatestKline(kltype);
            var count = buydetails.getCountLessThan(kl.c, buydetails.buyRecords().length > 1 ? this.data.stepRate : upRate);
            if (count > 0) {
                this.tmps2price = kl.c;
                this.tmpnextstate = buydetails.totalCount() > count ? 's1' : 's2';
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.data.meta.s2price = this.tmps2price;
                    this.data.meta.state = this.tmpnextstate;
                    if (this.data.meta.tcount === undefined) {
                        this.data.meta.tcount = 0;
                    }
                    this.data.meta.tcount++;
                    delete(this.data.meta.downtd);
                    delete(this.data.meta.uptd);
                });
                return true;
            }
        }
        return false;
    }
}

class StrategyGE extends Strategy {
    constructor(str) {
        super(str);
        this.skltype = '1';
    }

    guardLevel() {
        return 'klines';
    }

    klvars() {
        return ['bss18'];
    }

    kltype() {
        return [this.skltype, this.data.kltype];
    }

    buyrecRemains() {
        return 0;
    }

    checkMa1Buy(chkInfo, matchCb) {
        var kl1 = emjyBack.klines[chkInfo.code];
        var buydetails = chkInfo.buydetail;
        var smioff = 0; // emjyBack.getSmiOffset(buydetails.latestBuyDate());
        if (kl1) {
            var kl = kl1.getLatestKline(this.skltype);
            var maxP = buydetails.maxBuyPrice();
            if (this.data.guardPrice - maxP > 0) {
                maxP = this.data.guardPrice;
            }
            if (this.inCritical()) {
                if (kl.c - (this.data.guardPrice - maxP * (this.data.stepRate - smioff) * 0.8) > 0) {
                    this.data.inCritical = false;
                    matchCb({id: chkInfo.id});
                    return;
                }
                if (kl1.continuouslyIncreaseDays(this.skltype) > 2) {
                    this.tmpGuardPrice = kl.c;
                    matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                        this.data.inCritical = false;
                        this.data.guardPrice = this.tmpGuardPrice;
                    });
                }
                return;
            }
            if (kl.l - (this.data.guardPrice - maxP * (this.data.stepRate - smioff)) <= 0) {
                this.data.inCritical = true;
                matchCb({id: chkInfo.id});
            }
        }
    }

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        var buydetails = chkInfo.buydetail;
        var numBuyRec = buydetails ? buydetails.buyRecords().length : 0;
        if (numBuyRec > 0 && (!this.data.guardPrice || buydetails.minBuyPrice() - this.data.guardPrice > 0)) {
            this.data.guardPrice = buydetails.minBuyPrice();
        }

        var kl = emjyBack.klines[chkInfo.code].getLatestKline(this.data.kltype);
        if (!this.data.guardPrice || this.data.guardPrice == 0 || !buydetails || (this.buyrecRemains() == 0 && buydetails.buyRecords().length == 0)) {
            // 建仓
            if (this.bss18BuyMatch(chkInfo, this.data.kltype)) {
                this.tmpGuardPrice = kl.c;
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.guardPrice = this.tmpGuardPrice;
                });
            }
            return;
        }

        var updatedKlt = chkInfo.kltypes;
        if (numBuyRec > 0 && updatedKlt.includes(this.skltype)) {
            this.checkMa1Buy(chkInfo, matchCb);
        }
        if (numBuyRec > this.buyrecRemains() && this.bss18SellMatch(chkInfo, this.data.kltype)) {
            var fac = this.data.stepRate;
            if (fac - 0.05 > 0) {
                fac = 0.05 + (this.data.stepRate - 0.05) / 2;
            }
            var count = buydetails.getCountLessThan(kl.c, fac, false);
            if (count > 0) {
                this.tmpGuardPrice = kl.c;
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.data.guardPrice = this.tmpGuardPrice;
                });
            }
        }
    }
}

class StrategyGEMid extends StrategyGE {
    buyrecRemains() {
        return 1;
    }
}

class StrategyBarginHunting extends StrategyComplexBase {
    constructor(str) {
        super(str);
        this.skltype = '4';
    }

    getconfig() {
        return {
            backRate: {min:0.01, max:0.05, step:0.005, val:0.02},
            upRate: {min:0.01, max:0.05, step:0.005, val:0.01},
            trackDays: {min:1, max:10, step:1, val:5},
            upBound: {min:-0.05, max:-0.01, step:0.01, val:-0.03}
        }
    }

    guardLevel() {
        return 'klines';
    }

    kltype() {
        if (this.data.meta && this.data.meta.state == 's1') {
            return [this.skltype, this.data.kltype];
        }
        return [this.data.kltype];
    }

    checkMeta(buydetails) {
        if (!this.data.meta) {
            this.data.meta = {};
            // s0: 未建仓/清仓， s1: 买入有持仓
            this.data.meta.state = 's0';
        }
        if (!this.data.kltype) {
            this.data.kltype = '101';
        }

        this.initconfig();
        if (!this.data.selltype) {
            this.data.selltype = 'single';
        }
    }

    resetToS0() {
        this.data.meta.state = 's0';
        if (this.data.meta.s2price !== undefined) {
            delete(this.data.meta.s2price);
        }
        if (this.data.guardPrice !== undefined) {
            delete(this.data.guardPrice);
        }
        if (this.data.guardDate !== undefined) {
            delete(this.data.guardDate);
        }
        if (this.resetall) {
            if (this.data.topprice !== undefined) {
                delete(this.data.topprice);
            }
        }
    }

    checkCreateBuy(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        if (this.bhBuyMatch(chkInfo, kltype)) {
            var klines = emjyBack.klines[chkInfo.code];
            var kl = klines.getLatestKline(kltype);
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
        }
    }

    checkCutOrSellShort(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltype = this.skltype;
        if (!updatedKlt.includes(kltype)) {
            return;
        }

        var kl = klines.getLatestKline(kltype);
        var count = chkInfo.buydetail.availableCount();
        if (this.cutPriceReached(kl, this.data.guardPrice) && count > 0) {
            // cut
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, cutdeal => {
                this.onCutDone(cutdeal.code);
                this.resetall = false;
                this.resetToS0();
            });
            return;
        }

        count = chkInfo.buydetail.getCountMatched(this.data.selltype, kl.c);
        if (this.lowPriceStopGrowingSell(klines, kltype, this.data.topprice) && count > 0) {
            // sell.
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.resetall = true;
                this.resetToS0();
            });
            return;
        }
    }

    checkCutOrSell(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltype = this.data.kltype;
        if (!updatedKlt.includes(kltype)) {
            this.checkCutOrSellShort(chkInfo, matchCb);
            return;
        }

        var kl = klines.getLatestKline(kltype);
        var count = chkInfo.buydetail.getCountMatched(this.data.selltype, kl.c);
        if (this.targetPriceReachSell(kl, this.data.topprice, this.data.upRate) && count > 0) {
            // sell
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.resetall = true;
                this.resetToS0();
            });
            return;
        }
        count = chkInfo.buydetail.availableCount();
        if (this.cutPriceReached(kl, this.data.guardPrice) && count > 0) {
            // cut
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, cutdeal => {
                this.onCutDone(cutdeal.code);
                this.resetall = false;
                this.resetToS0();
            });
            return;
        }
        // wait
    }
}

class StrategySD extends StrategyBarginHunting {
    getconfig() {
        return {
            backRate: {min:0.01, max:0.05, step:0.005, val:0.02},
            upRate: {min:0.01, max:0.05, step:0.005, val:0.01}
        }
    }

    checkCreateBuy(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        var klines = emjyBack.klines[chkInfo.code];
        var kl = klines.getLatestKline(kltype);
        if (!this.data.guardPrice) {
            return false;
        }

        if (kl.l - this.data.guardPrice < 0) {
            this.data.guardPrice = kl.l;
            matchCb({id: chkInfo.id});
            return false;
        }

        if (this.targetPriceReachBuy(kl, this.data.guardPrice, this.data.backRate)) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
        }
    }
}

class StrategyBias extends StrategyComplexBase {
    getconfig() {
        return {
            upBias: {min: 5, max: 15, step: 1, val: 10},
            backRate: {min: 0.01, max: 0.05, step: 0.01, val: 0.02},
            upBound: {min:-0.05, max:-0.01, step:0.01, val:-0.03},
            stepRate: {min: 0.03, max: 0.15, step:0.01, val: 0.06}
       }
    }

    guardLevel() {
        return 'kline';
    }

    klvars() {
        return 'bias18';
    }

    checkMeta(buydetails) {
        if (!this.data.meta) {
            this.data.meta = {};
            // s0: 未建仓/清仓， s1: 买入有持仓
            if (!buydetails || buydetails.totalCount() == 0) {
                this.data.meta.state = 's0';
            } else {
                this.data.meta.state = 's1';
            }
        }
        if (!this.data.kltype) {
            this.data.kltype = '101';
        }

        this.initconfig();
    }

    checkCreateBuy(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        if (this.bhBuyMatch(chkInfo, kltype)) {
            var klines = emjyBack.klines[chkInfo.code];
            var kl = klines.getLatestKline(kltype);
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
            return true;
        }
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        var klines = emjyBack.klines[chkInfo.code];
        if (this.biasSellMatch(klines, kltype)) {
            var kl = klines.getLatestKline(kltype);
            var count = chkInfo.buydetail.getCountLessThan(kl.c, this.data.stepRate);
            if (count > 0) {
                if (chkInfo.buydetail.totalCount() - count == 0) {
                    this.tmpnextstate = 's0';
                }
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    if (this.tmpnextstate) {
                        this.data.meta.state = this.tmpnextstate;
                    }
                });
                return true;
            }
        }
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        if (this.bhBuyMatch(chkInfo, kltype)) {
            var klines = emjyBack.klines[chkInfo.code];
            var kl = klines.getLatestKline(kltype);
            var minp = chkInfo.buydetail.minBuyPrice();
            if (minp * (1 - this.data.stepRate) - kl.c >= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.meta.state = 's1';
                });
                return true;
            }
        }

        return this.checkCutOrSell(chkInfo, matchCb);
    }
}

class StrategyIncDec extends StrategyComplexBase {
    getconfig() {
        return {
            upRate: {min: 0.01, max: 0.08, step: 0.01, val: 0.05},
            backRate: {min: 0.01, max: 0.08, step: 0.01, val: 0.03},
            stepRate: {min: 0.03, max: 0.10, step:0.01, val: 0.05}
       }
    }

    guardLevel() {
        return 'kline';
    }

    checkMeta(buydetails) {
        if (!this.data.meta) {
            this.data.meta = {};
            // s0: 未建仓/清仓， s1: 买入有持仓
            if (!buydetails || buydetails.totalCount() == 0) {
                this.data.meta.state = 's0';
            } else {
                this.data.meta.state = 's1';
            }
        }
        if (!this.data.kltype) {
            this.data.kltype = '101';
        }

        this.initconfig();
    }

    checkCreateBuy(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        if (this.decBuyMatch(chkInfo, kltype)) {
            var klines = emjyBack.klines[chkInfo.code];
            var kl = klines.getLatestKline(kltype);
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
            return true;
        }
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        var klines = emjyBack.klines[chkInfo.code];
        var kl = klines.getLatestKline(kltype);
        var count = chkInfo.buydetail.getCountLessThan(kl.c, this.data.stepRate);
        if (this.incSellMatch(chkInfo, kltype)) {
            if (count > 0) {
                if (chkInfo.buydetail.totalCount() - count == 0) {
                    this.tmpnextstate = 's0';
                }
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    if (this.tmpnextstate) {
                        this.data.meta.state = this.tmpnextstate;
                    }
                });
                return true;
            }
        }
        count = chkInfo.buydetail.getCountLessThan(kl.c, this.data.stepRate * 2);
        if (count > 0) {
            if (chkInfo.buydetail.totalCount() - count == 0) {
                this.tmpnextstate = 's0';
            }
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                if (this.tmpnextstate) {
                    this.data.meta.state = this.tmpnextstate;
                }
            });
            return true;
        }
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        var kltype = this.data.kltype;
        var klines = emjyBack.klines[chkInfo.code];
        var kl = klines.getLatestKline(kltype);
        if (this.decBuyMatch(chkInfo, kltype)) {
            var minp = chkInfo.buydetail.minBuyPrice();
            if (minp * (1 - this.data.stepRate) - kl.c >= 0) {
                matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                    this.data.meta.state = 's1';
                });
                return true;
            }
        }
        var ldate = chkInfo.buydetail.latestBuyDate();
        var lkl = klines.getKlineByTime(ldate);
        if (lkl && lkl.c * (1 - this.data.stepRate * 1.5) - kl.c >= 0) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
            return true;
        }

        return this.checkCutOrSell(chkInfo, matchCb);
    }
}

class StrategyZt0 extends StrategyComplexBase {
    getconfig() {
        return {
            upRate: {min: 0.01, max: 0.08, step: 0.01, val: 0.05},
            backRate: {min: 0.01, max: 0.08, step: 0.01, val: 0.03},
            stepRate: {min: 0.03, max: 0.10, step:0.01, val: 0.05}
       }
    }

    guardLevel() {
        return 'kline';
    }

    checkMeta(buydetails) {
        if (!this.data.meta) {
            this.data.meta = {};
            // s0: 未建仓/清仓， s1: 买入有持仓
            if (!buydetails || buydetails.totalCount() == 0) {
                this.data.meta.state = 's0';
            } else {
                this.data.meta.state = 's1';
            }
        }
        if (!this.data.kltype) {
            this.data.kltype = '101';
        }

        this.initconfig();
    }

    checkCreateBuy(chkInfo, matchCb) {
        // not create buy.
        return false;
    }

    checkCutOrSell(chkInfo, matchCb) {
        this.bss0date = this.data.zt0date;
        if (this.bss18SellMatch(chkInfo, '101')) {
            var count = chkInfo.buydetail.availableCount();
            if (count > 0) {
                var klines = emjyBack.klines[chkInfo.code];
                var kl = klines.getLatestKline(this.kltype());
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.setEnabled(false);
                });
                return true;
            }
        }
        return false;
    }

    checkConsecutiveBuySell(chkInfo, matchCb) {
        return false;
    }
}

class StrategyZt1 extends StrategyBarginHunting {
    getconfig() {
        return {
            backRate: {min:0.01, max:0.05, step:0.005, val:0.02},
            upRate: {min:0.01, max:0.05, step:0.005, val:0.01}
        }
    }

    checkVol(code) {
        if (!this.data.zt0date) {
            return;
        }
        this.data.guardVol = emjyBack.klines[code].getMinVolBefore(this.data.zt0date, 30, this.data.kltype);
    }

    checkCreateBuy(chkInfo, matchCb) {
        var code = chkInfo.code;
        var kltype = this.data.kltype;
        if (emjyBack.klines[code].getLatestKline(kltype).time <= this.data.zt0date) {
            return false;
        }

        if (!this.data.guardVol) {
            this.checkVol(code);
        }

        if (this.zt1VolMinBuyMatch(chkInfo, kltype)) {
            var klines = emjyBack.klines[code];
            var kl = klines.getLatestKline(kltype);
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                this.data.meta.state = 's1';
            });
            return true;
        }
        return false;
    }

    onCutDone(code) {
        if (!this.data.meta.cutNum) {
            this.data.meta.cutNum = 1;
        } else {
            this.data.meta.cutNum++;
        }
        if (this.data.meta.cutNum > 5) {
            this.setEnabled(false);
            return;
        }
        var mvkl = emjyBack.klines[code].minVolKlSince(this.data.zt0date, this.data.kltype);
        this.data.guardVol = mvkl.v - this.data.guardVol < 0 ? mvkl.v : this.data.guardVol;
    }
}
