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
        if (strategy.key == 'StrategyBuyMA') {
            return new StrategyBuyMA(strategy);
        };
        if (strategy.key == 'StrategySellMA') {
            return new StrategySellMA(strategy);
        };
        if (strategy.key == 'StrategyBuyBE') {
            return new StrategyBuyBeforeEnd(strategy);
        };
        if (strategy.key == 'StrategyBuyMAE') {
            return new StrategyBuyMABeforeEnd(strategy);
        };
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
    }
}

class Strategy {
    constructor(str) {
        this.data = str;
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

    ma18BuyMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl && kl.bss18 == 'b') {
                return true;
            }
        }
        return false;
    }

    ma18SellMatch(chkInfo, kltype) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return false;
        }

        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl && kl.bss18 == 's') {
                return true;
            }
        }
        return false;
    }

    ma18CutMatch(chkInfo, kltype, guardPrice) {
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
        this.setEnabled(false);
        var rtInfo = chkInfo.rtInfo;
        var price = rtInfo.latestPrice;
        if (rtInfo.sellPrices) {
            if (rtInfo.sellPrices[1] == '-') {
                price = rtInfo.topprice;
            } else {
                price = rtInfo.sellPrices[1];
            }
        }
        matchCb({id: chkInfo.id, tradeType: 'B', count: (rtInfo.count ? rtInfo.count : 0), price}, _ => {
            this.setEnabled(false);
        });
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
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: (rtInfo.sellPrices[1] == '-' ? rtInfo.topprice : rtInfo.sellPrices[1])}, _ => {
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
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buyPrices[1] == '-' ? rtInfo.bottomprice : rtInfo.buyPrices[1]}, _ => {
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
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: (rtInfo.sellPrices[1] == '-' ? rtInfo.topprice : rtInfo.sellPrices[1])}, _ => {
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
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buyPrices[1] == '-'? rtInfo.bottomprice : rtInfo.buyPrices[1]}, _ => {
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
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: rtInfo.buyPrices[1] == '-'? rtInfo.bottomprice : rtInfo.buyPrices[1]}, _ => {
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

    check(chkInfo, matchCb) {
        if (!this.enabled() || typeof(matchCb) !== 'function') {
            return;
        }

        var rtInfo = chkInfo.rtInfo;
        if (rtInfo.latestPrice == rtInfo.topprice || (rtInfo.sellPrices[1] == '-' && rtInfo.sellPrices[0] == rtInfo.topprice)) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: rtInfo.topprice}, _ => {
                this.setEnabled(false);
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
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: (rtInfo.buyPrices[1] == '-' ? rtInfo.bottomprice : rtInfo.buyPrices[1])}, _ => {
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
        return 'kline';
    }

    kltype() {
        return '1';
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
        var count = buydetails.availableCount();
        if (kl.c - this.data.guardPrice < 0 && count > 0) {
            var kl = klines.getLatestKline(this.kltype());
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.setEnabled(false);
            });
            return;
        }

        var troughprice = klines.getLastTrough('1');
        if (troughprice > 0 && troughprice - this.data.guardPrice > 0) {
            this.data.guardPrice = troughprice;
            matchCb({id: chkInfo.id});
        }
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

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        if (this.ma18BuyMatch(chkInfo, this.kltype())) {
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

    checkKlines(chkInfo, matchCb) {
        if (typeof(matchCb) !== 'function') {
            return;
        }

        if (this.ma18SellMatch(chkInfo, this.kltype())) {
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
        if (this.ma18BuyMatch(chkInfo, this.kltype())) {
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
        if (this.ma18SellMatch(chkInfo, this.kltype())) {
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

        // 尾盘直接卖出
        if (buydetails && buydetails.buyRecords().length == 1) {
            var count = buydetails.availableCount();
            if (count > 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count: buydetails.availableCount(), price: kl.o}, _ => {
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

class StrategyMABackup extends Strategy {
    guardLevel() {
        return 'kline';
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
        if (this.ma18BuyMatch(chkInfo, kltype)) {
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
        if (this.ma18SellMatch(chkInfo, this.kltype())) {
            if (count > 0) {
                if (!this.data.guardPrice || this.data.guardPrice == 0) {
                    // 无安全线
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c});
                } else if ( kl.c - this.data.guardPrice > 0) {
                    // 有安全线
                    var xcount = buydetails.getCountLessThan(kl.c * 0.95);
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
        if (this.ma18CutMatch(chkInfo, this.kltype(), this.data.guardPrice)) {
            if (count > 0) {
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.resetGuardPrice();
                });
                return;
            }
        }
    }
}

class StrategyTD extends Strategy {
    guardLevel() {
        return 'kline';
    }

    kltype() {
        return ['15', '101'];
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
            if (this.data.meta.state == 's1') {
                var minbuy = buydetails.minBuyPrice();
                if (buyref - minbuy > 0 && minbuy > 0) {
                    buyref = minbuy;
                }
            }
            if (this.data.meta.state == 's2') {
                buyref = this.data.meta.s2price;
            }
            if (this.data.meta.downtd && this.data.meta.downtd[kltype] < -8 && kl.td > -1 && kl.td < 3 && klines.continuouslyIncreaseDays(kltype) > 2) {
                if (kl.c - (buyref - this.data.meta.s0price * this.data.backRate) < 0) {
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
                var count = buydetails.getCountLessThan(kl.c * (1 - (buydetails.buyRecords().length > 1 ? this.data.stepRate : this.data.upRate)));
                if (count > 0) {
                    // 减仓
                    this.tmps2price = kl.c;
                    this.tmpnextstate = buydetails.totalCount() > count ? 's1' : 's2';
                    matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                        this.data.meta.s2price = this.tmps2price;
                        this.data.meta.state = this.tmpnextstate;
                        delete(this.data.meta.downtd);
                        delete(this.data.meta.uptd);
                    });
                    return true;
                }
            }
        }
        return false;
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
        var kltypes = ['30', '60', '120', '101']; //['15', '30'];// 
        if (this.data.meta.state == 's0') {
            // 建仓
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
                    return;
                }
            }
            return;
        }
        this.checkTdBuySell(chkInfo, matchCb);
    }
}

class StrategyMA extends StrategyTD {
    kltype() {
        if (!this.data.meta || this.data.meta.state == 's0') {
            return '101';
        }
        return ['15', '101'];
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
        if (updatedKlt.includes('101')) {
            var kltype = '101';
            if (this.data.meta.state == 's0') {
                var kl = klines.getLatestKline(kltype);
                // 建仓
                if (this.ma18BuyMatch(chkInfo, kltype)) {
                    var drawBack = this.data.drawBack;
                    if (drawBack === undefined) {
                        drawBack = 0.15;
                    }
                    var cutline = klines.getLowestInWaiting(kltype);
                    if (klines.latestKlineDrawback(kltype) - drawBack <= 0 && this.cutlineAcceptable(cutline, kl, kltype)) {
                        this.tmpGuardPrice = cutline;
                        matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                            this.data.guardPrice = this.tmpGuardPrice;
                        });
                    }
                }
                return;
            }
            if (this.ma18SellMatch(chkInfo, kltype)) {
                if (this.data.meta.state == 's2') {
                    this.data.meta.state = 's0';
                    matchCb({id: chkInfo.id});
                    return;
                } else {
                    // TODO: 若多次做T已经盈利，可以清仓
                }
            }
            var count = buydetails ? buydetails.availableCount() : 0;
            if (count > 0 && this.ma18CutMatch(chkInfo, kltype, this.data.guardPrice)) {
                // 止损
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.resetGuardPrice();
                });
                return;
            }
        }
        if (this.checkTdBuySell(chkInfo, matchCb)) {
            return;
        }
        var kltype = '30';
        if (this.ma18SellMatch(chkInfo, kltype)) {
            var count = buydetails.getCountLessThan(kl.c * (1 - (buydetails.buyRecords().length > 1 ? this.data.stepRate : this.data.upRate)));
            if (count > 0) {
                this.tmps2price = kl.c;
                this.tmpnextstate = buydetails.totalCount() > count ? 's1' : 's2';
                matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                    this.data.meta.s2price = this.tmps2price;
                    this.data.meta.state = this.tmpnextstate;
                    delete(this.data.meta.downtd);
                    delete(this.data.meta.uptd);
                });
                return true;
            }
        }
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

    kltype() {
        return [this.skltype, this.data.kltype];
    }

    buyrecRemains() {
        return 0;
    }

    checkMa1Buy(chkInfo, matchCb) {
        var kl1 = emjyBack.klines[chkInfo.code];
        var buydetails = chkInfo.buydetail;
        if (kl1) {
            var kl = kl1.getLatestKline(this.skltype);
            if (this.inCritical()) {
                if (kl1.continuouslyIncreaseDays(this.skltype) > 2) {
                    this.tmpGuardPrice = kl.c;
                    matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl.c}, _ => {
                        this.data.inCritical = false;
                        this.data.guardPrice = this.tmpGuardPrice;
                    });
                }
                return;
            }
            var maxP = buydetails.maxBuyPrice();
            if (this.data.guardPrice - maxP > 0) {
                maxP = this.data.guardPrice;
            }
            if (kl.l - (this.data.guardPrice - maxP * this.data.stepRate) <= 0) {
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
            if (this.ma18BuyMatch(chkInfo, this.data.kltype)) {
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
        if (numBuyRec > this.buyrecRemains() && this.ma18SellMatch(chkInfo, this.data.kltype)) {
            var fac = this.data.stepRate;
            if (fac - 0.05 > 0) {
                fac = 0.05 + (this.data.stepRate - 0.05) / 2;
            }

            var count = buydetails.getCountLessThan(kl.c * (1 - fac));
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

let strategyManager = new StrategyManager();
