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
        if (strategy.key == 'StrategyGE') {
            return new StrategyGE(strategy);
        }
    }
}

class Strategy {
    constructor(str) {
        this.data = str;
    }

    check(rtInfo) {
        return {match: false};
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

    matchResult(match, price0, pricebk) {
        if (!match) {
            return {match};
        };
        var price = (price0 == '-' ? pricebk : price0);
        return {match, price};
    }
}

class StrategyBuy extends Strategy {
    constructor(str) {
        super(str);
        this.hitCount = 0;
    }

    guardLevel() {
        return 'otp';  // one time prices;
    }

    isBuyStrategy() {
        return true;
    }

    check(rtInfo) {
        if (this.hitCount > 1) {
            return {match: false};
        };
        this.hitCount++;
        return this.matchResult(true, rtInfo.sellPrices[1], rtInfo.topprice);
    }
}

class StrategyBuyPopup extends StrategyBuy {
    guardLevel() {
        return 'rtp';
    }

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        if (!this.data.inCritical) {
            if (price <= this.data.guardPrice) {
                this.data.inCritical = true;
                stepInCritical = true
                this.data.prePeekPrice = price;
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[1], rtInfo.topprice);
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
        }
        return {match, stepInCritical, account: this.data.account};
    }
}

class StrategyBuySD extends StrategyBuy {
    guardLevel() {
        return 'kline';
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };

        if (klines.isDecreaseStoppedStrict(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            this.data.enabled = false;
            return {match: true, tradeType:'B', count: 0, price: kl.c};
        }
        return {match: false};
    }
}

class StrategySell extends Strategy {
    isBuyStrategy() {
        return false;
    }

    check(rtInfo) {
        var price = rtInfo.latestPrice;
        var match = false;
        var stepInCritical = false;
        if (!this.data.inCritical) {
            if (price > this.data.guardPrice) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                stepInCritical = true;
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price <= this.data.prePeekPrice * (1 - this.data.backRate)) {
            return this.matchResult(true, rtInfo.buyPrices[1], rtInfo.bottomprice);
        }
        if (price > this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
        }
        return {match, stepInCritical, account: this.data.account};
    }

    sellMatchUnavailable() {

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

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        var topprice = rtInfo.topprice;
        var bottomprice = rtInfo.bottomprice;
        if (!this.data.inCritical) {
            if (price < topprice) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                stepInCritical = true;
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[1], rtInfo.topprice);
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
        }
        return {match, stepInCritical, account: this.data.account};
    }
}

class StrategySellIPO extends StrategySell {
    check(rtInfo) {
        var match = false;
        if (rtInfo.openPrice == rtInfo.topprice) {
            if (rtInfo.latestPrice < rtInfo.topprice) {
                return this.matchResult(true, rtInfo.buyPrices[1], rtInfo.bottomprice);
            };
            return {match};
        };

        if (rtInfo.openPrice == rtInfo.bottomprice) {
            return this.matchResult(true, rtInfo.openPrice, rtInfo.bottomprice);
        };
        
        if (!this.data.inCritical) {
            this.data.guardPrice = rtInfo.latestPrice;
            this.data.inCritical = true;
            return {match};
        };

        if (rtInfo.latestPrice <= this.data.prePeekPrice * 0.99) {
            return this.matchResult(true, rtInfo.buyPrices[1], rtInfo.bottomprice);
        }

        if (rtInfo.latestPrice > this.data.prePeekPrice) {
            this.data.prePeekPrice = rtInfo.latestPrice;
        }
        return {match};
    }
}

class StrategyBuyZTBoard extends StrategyBuy {
    guardLevel() {
        return 'zt';
    }

    check(rtInfo) {
        if (rtInfo.sellPrices[1] == '-' && rtInfo.sellPrices[0] == rtInfo.topprice) {
            console.log(rtInfo);
            return this.matchResult(true, rtInfo.sellPrices[1], rtInfo.topprice);
        };
        if (rtInfo.latestPrice == rtInfo.topprice) {
            console.log(rtInfo);
            return this.matchResult(true, rtInfo.topprice, rtInfo.topprice);
        };
        return {match: false, stepInCritical: false, account: this.data.account};
    }
}

class StrategySellEL extends StrategySell {
    setHoldCost(price) {
        this.data.averPrice = price;
    }

    buyMatch(refer) {
        if (!this.data.averPrice || this.data.averPrice == 0) {
            this.data.averPrice = refer.price;
        } else {
            this.data.averPrice = (this.data.averPrice + refer.price) / 2;
        };
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

    check(rtInfo) {
        var latestPrice = rtInfo.latestPrice;
        var guardPrice = this.data.guardPrice;
        var averPrice = this.data.averPrice;
        if (latestPrice - averPrice * 1.18 >= 0 && latestPrice - averPrice * 0.1 - guardPrice > 0) {
            guardPrice = latestPrice - averPrice * 0.1;
        } else if (latestPrice - averPrice * 1.09 >= 0 && latestPrice - averPrice * 0.08 - guardPrice > 0 ) {
            guardPrice = latestPrice - averPrice * 0.08;
        } else if (latestPrice - averPrice * 1.07 >= 0 && averPrice - guardPrice > 0) {
            guardPrice = averPrice * 1.01;
        };
        if (guardPrice - this.data.guardPrice > 0) {
            this.data.guardPrice = guardPrice;
        };
        if (rtInfo.latestPrice - guardPrice <= 0) {
            this.data.inCritical = true;
            return this.matchResult(true, rtInfo.buyPrices[1], rtInfo.bottomprice);
        };
        return {match: false};
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined) {
            return {match: false};
        };

        if (updatedKlt.length < 1 || !updatedKlt.includes('101')) {
            return {match: false};
        };

        var nKlines = klines.getKline('101');
        if (nKlines && nKlines.length > 0) {
            var kl = nKlines[nKlines.length - 1];
            if (kl.c - kl.o * 1.065 >= 0 && kl.l - this.data.guardPrice > 0) {
                this.data.guardPrice = kl.l;
            };
        };
        return {match: false};
    }
}

class StrategySellELShort extends StrategySellEL {
    guardLevel() {
        return 'kline';
    }

    kltype() {
        return '1';
    }

    check(rtInfo) {
        return {match: false};
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined) {
            return {match: false};
        };

        if (updatedKlt.length < 1 || !updatedKlt.includes('1')) {
            return {match: false};
        };

        var kl = klines.getLatestKline('1');
        if (kl.c - this.data.guardPrice < 0) {
            this.data.enabled = false;
            return {match: true, tradeType: 'S', count: 1, price: kl.c};
        }

        var troughprice = klines.getLastTrough('1');
        if (troughprice > 0 && troughprice - this.data.guardPrice > 0) {
            this.data.guardPrice = troughprice;
        }
        return {match: false};
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

    check(rtInfo) {
        return {match:false};
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };
        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl && kl.bss18 == 'b') {
                this.data.enabled = false;
                return {match: true, tradeType: 'B', count: 0, price: kl.c};
            }
        }
        return {match: false};
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

    check(rtInfo) {
        return {match:false};
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };

        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl && kl.bss18 == 's') {
                this.data.enabled = false;
                return {match: true, tradeType: 'S', count: 1, price: kl.c};
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

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };

        var kltype = this.kltype();
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl && kl.bss18 == 'b') {
                this.data.enabled = false;
                return {match: true, tradeType: 'B', count: 0, price: kl.c};
            }
        }

        if (kltype == '60') {
            return {match: false};
        }
        
        var gklt = this.kltypeCandiList[kltype];
        if (gklt && updatedKlt.includes(gklt)) {
            var gKlines = klines.getKline(gklt);
            var tailWCount = 0;
            var gkl = klines.getIncompleteKline(gklt);
            if (gkl) {
                if (gkl.bss18 == 'w' && gkl.ma18 - gkl.o > 0 && gkl.ma18 - gkl.c > 0) {
                    tailWCount = 1;
                } else {
                    return {match: false};
                };
            };
            for (var i = gKlines.length - 1; i >= 0; i--) {
                if (gKlines[i].bss18 == 'w' && gKlines[i].ma18 - gKlines[i].o > 0 && gKlines[i].ma18 - gKlines[i].c > 0) {
                    tailWCount++;
                } else {
                    break;
                };
            };
            if (tailWCount >= 5) {
                // if (gklt == '404') {
                //     this.data.enabled = false;
                // } else {
                // };
                this.data.kltype = gklt;
            };
        };
        return {match: false};
    }
}

class StrategySellMADynamic extends StrategySellMA {
    setHoldCost(price) {
        if (this.data.price === undefined || this.data.price == 0) {
            this.data.price = price;
        };
    }

    buyMatch(refer) {
        this.data.enabled = true;
        if (refer.kltype !== undefined) {
            this.data.kltype = refer.kltype;
        }
        if (refer.kltype - 100 > 0) {
            this.data.kltype = '60';
        }
        this.data.price = refer.price;
    }

    sellMatch(refer) {
        this.data.enabled = false;
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };

        var kltype = this.kltype();
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl) {
                if (this.data.guardPrice !== undefined && this.data.guardPrice > 0) {
                    if (kl.c - this.data.guardPrice >= 0) {
                        if (kl.c - 1.05 * this.data.price > 0 && kl.bss18 == 's') {
                            this.data.enabled = false;
                            return {match: true, tradeType: 'S', count: 1, price: kl.c};
                        }
                        return {match: false};
                    }
                }
                if (kl.bss18 == 's') {
                    this.data.enabled = false;
                    return {match: true, tradeType: 'S', count: 1, price: kl.c};
                }
                return {match: false};
            };
        } else if (kltype != '4') {
            var mKlines = klines.getKline(1);
            var highPrice = mKlines[mKlines.length - 1].h;
            if (this.data.price > 0 && highPrice > this.data.price * 1.2) {
                this.data.kltype = '4';
            };
            var kl = klines.getLatestKline('101');
            if (kl) {
                var lclose = kl.c;
                if (this.data.price > 0 && highPrice > lclose * 1.085 && highPrice > this.data.price * 1.05) {
                    this.data.kltype = '4';
                };
            };
        };
        return {match: false};
    }

    sellMatchUnavailable() {
        var kltypeCandiList = {'4': '8', '8': '15', '15':'30', '30':'60', '60':'120', '120':'101', '101': '202', '202': '404'};
        var kltype = this.kltype();
        this.data.kltype = kltypeCandiList[kltype];
        this.data.enabled = true;
    }
}

class StrategyBuyBeforeEnd extends StrategyBuyMA {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return '101';
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        }

        var kltype = this.kltype();
        var inkl = klines.getIncompleteKline(kltype);
        var dKline = klines.getKline(kltype);
        if (inkl && dKline && dKline.length > 0) {
            var lkl = dKline[dKline.length - 1];
            if (lkl && lkl.c - lkl.o < 0 && inkl.c - inkl.o > 0) {
                if (inkl.v - lkl.v * 0.98 < 0) {
                    this.data.enabled = false;
                    return {match: true, tradeType: 'B', count: 1, price: kl.c};
                }
            }
        }
        return {match: false};
    }
}

class StrategyBuyMABeforeEnd extends StrategyBuyMA {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return this.data.kltype;
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };
        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                if (kl.bss18 == 'b') {
                    this.data.enabled = false;
                    return {match: true, tradeType: 'B', count: 0, price: kl.c};
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
                            this.data.enabled = false;
                            return {match: true, tradeType: 'B', count: 0, price: c};
                        }
                        if ((h - o) / o > 0.03 && (h - c) * 4 < h - o) {
                            this.data.enabled = false;
                            return {match: true, tradeType: 'B', count: 0, price: c};
                        }
                    }
                }
            };
        };
    }
}

class StrategyMA extends Strategy {
    guardLevel() {
        return 'kline';
    }

    updateGuardPrice(klines) {
        var troughprice = klines.getLastTrough('101');
        if (troughprice > 0 && (!this.data.guardPrice) || troughprice - this.data.guardPrice > 0) {
            this.data.guardPrice = troughprice;
            emjyBack.log('update guardPrice', this.data.guardPrice);
        }
    }

    cutlineAcceptable(klines, kl) {
        var kltype = this.kltype();
        var low = klines.getLowestInWaiting(kltype);
        var cutp = (kl.c - low) * 100 / kl.c;
        var cutRange = {'101':{l:15, r:27}}; //, '30':{l:4,r:11},'101':{l:14, r:24}
        if (!cutRange[kltype]) {
            this.data.guardPrice = low;
            return true;
        }
        if (cutp >= cutRange[kltype].l && cutp <= cutRange[kltype].r) {
            this.data.guardPrice = low;
            return true;
        }
        return false;
    }

    resetGuardPrice() {
        this.data.guardPrice = undefined;
    }

    checkKlines(klines, updatedKlt, buydetails) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return {match: false};
        };

        var kltype = this.kltype();
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (!this.data.guardPrice || this.data.guardPrice == 0) {
                if (kl.bss18 == 'b') {
                    if (this.cutlineAcceptable(klines, kl)) {
                        return {match: true, tradeType: 'B', count: 0, price: kl.c};
                    }
                }
                if (kl.bss18 == 's') {
                    this.resetGuardPrice();
                    var count = buydetails.availableCount();
                    if (count > 0) {
                        this.resetGuardPrice();
                        return {match: true, tradeType: 'S', count, price: kl.c};
                    }
                }
                return {match: false};
            } else if (this.data.guardPrice - kl.c > 0) {
                if (kl.bss18 == 's' || kl.bss18 == 'w') {
                    var count = buydetails.availableCount();
                    if (count > 0) {
                        this.resetGuardPrice();
                        return {match: true, tradeType: 'S', count, price: kl.c};
                    }
                }
                return {match: false};
            } else {
                if (kl.bss18 != 's' && kl.bss18 != 'b') {
                    return {match: false};
                }
                if (!buydetails || buydetails.totalCount() == 0) {
                    if (kl.bss18 == 'b') {
                        if (this.cutlineAcceptable(klines, kl)) {
                            return {match: true, tradeType: 'B', count: 0, price: kl.c};
                        }
                    }
                    return {match: false};
                }
                var pmin = buydetails.getMinBuyPrice();
                if (kl.bss18 == 'b') {
                    if (kl.c - pmin * 0.95 < 0) {
                        if (this.cutlineAcceptable(klines, kl)) {
                            return {match: true, tradeType: 'B', count: 0, price: kl.c};
                        }
                    }
                    return {match: false};
                }
                if (kl.bss18 == 's') {
                    var count = buydetails.getCountLessThan(kl.c * 0.95);
                    if (count > 0) {
                        this.resetGuardPrice();
                        return {match: true, tradeType: 'S', count, price: kl.c};
                    }
                    return {match: false};
                }
            }
        }
        return {match: false};
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

    checkMa1Buy(kl1) {
        if (kl1) {
            var kl = kl1.getLatestKline(this.skltype);
            if (this.inCritical()) {
                if (kl1.isDecreaseStopped(this.skltype)) {
                    this.data.inCritical = false;
                    this.data.guardPrice = kl.c;
                    return {match: true, tradeType:'B', count: 0, price: kl.c};
                }
                return {match: false};
            }
            if (kl.l - this.data.guardPrice * (1 - this.data.stepRate) <= 0) {
                this.data.inCritical = true;
                return {match: false, stepInCritical: true};
            }
        }
        return {match: false};
    }

    checkKlines(klines, updatedKlt, buydetails) {
        var holdCount = buydetails.totalCount();
        var kltype = this.data.kltype;
        if (holdCount == 0) {
            if (this.data.guardPrice) {
                if (updatedKlt.includes(this.skltype)) {
                    return this.checkMa1Buy(klines);
                }
                return {match: false};
            }
            if (updatedKlt.includes(kltype)) {
                var kl = klines.getLatestKline(kltype);
                if (kl.bss18 == 'b') {
                    this.data.guardPrice = kl.c;
                    return {match: true, tradeType:'B', count: 0, price: kl.c};
                }
                return {match: false};
            }
            return {match: false};
        }
        if (updatedKlt.includes(this.skltype)) {
            var obj = this.checkMa1Buy(klines);
            if (obj.match || obj.stepInCritical) {
                return obj;
            }
        }
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl.bss18 == 's') {
                var count = buydetails.getCountLessThan(kl.c * (1 - this.data.stepRate));
                if (count > 0) {
                    this.data.guardPrice = kl.c;
                    return {match: true, tradeType:'S', count, price: kl.c};
                }
            }
            return {match: false};
        }
        return {match: false};
    }
}

let strategyManager = new StrategyManager();
