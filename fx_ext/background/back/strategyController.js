'use strict';

class StrategyManager {
    create(strategy) {
        if (strategy.key == 'StrategyBuy') {
            return new StrategyBuy(strategy);
        };
        if (strategy.key == 'StrategyBuyPopup') {
            return new StrategyBuyPopup(strategy);
        };
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
    }
}

class Strategy {
    constructor(str) {
        this.data = str;
    }

    flush() {
        var data = {};
        data[this.storeKey] = this.tostring();
        chrome.storage.local.set(data);
    }

    check(rtInfo) {

    }

    enabled() {
        return this.data.enabled;
    }

    setEnabled(val) {
        this.data.enabled = val;
        this.data.inCritical = false;
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
        this.data.inCritical = false;
    }

    sellMatch(peek) {
        this.data.inCritical = false;
    }

    tostring() {
        return JSON.stringify(this.data);
    }

    guardLevel() {
        return 'rtp'; // real time prices;
    }

    calcCount(amount, price) {
        var ct = (amount / 100) / price;
        var d = ct - Math.floor(ct);
        if (d <= ct * 0.15) {
            return 100 * Math.floor(ct);
        };
        return 100 * Math.ceil(ct);
    }

    matchResult(match, price0, pricebk) {
        if (!match) {
            return {match};
        };
        var price = (price0 == '-' ? pricebk : price0);
        var result = {match, price};
        result.account = this.data.account;
        if (this.data.count && this.data.count != 0) {
            result.count = this.data.count;
        } else if (this.count && this.count != 0) {
            result.count = this.count;
        } else if (this.data.amount && this.data.amount != 0) {
            result.count = this.calcCount(this.data.amount, price);
        } else {
            result.count = this.calcCount(40000, price);
        };
        return result;
    }
}

class StrategyBuy extends Strategy {
    constructor(str) {
        super(str);
        this.hitCount = 0;
    }

    isBuyStrategy() {
        return true;
    }

    check(rtInfo) {
        if (this.hitCount > 1) {
            return {match: false};
        };
        this.hitCount++;
        return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
    }
}

class StrategyBuyPopup extends StrategyBuy {
    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        if (!this.data.inCritical) {
            if (price <= this.data.guardPrice) {
                this.data.inCritical = true;
                stepInCritical = true
                this.data.prePeekPrice = price;
                this.flush();
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            this.flush();
        }
        return {match, stepInCritical, account: this.data.account};
    }
}

class StrategySell extends Strategy {
    isBuyStrategy() {
        return false;
    }

    setHoldCount(count) {
        this.count = count;
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
                this.flush();
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price <= this.data.prePeekPrice * (1 - this.data.backRate)) {
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        }
        if (price > this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            this.flush();
        }
        return {match, stepInCritical, account: this.data.account};
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
                this.flush();
            }
            return {match, stepInCritical, account: this.data.account};
        }
        if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
        }
        if (price < this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            this.flush();
        }
        return {match, stepInCritical, account: this.data.account};
    }
}

class StrategySellIPO extends StrategySell {
    check(rtInfo) {
        var match = false;
        if (rtInfo.openPrice == rtInfo.topprice) {
            if (rtInfo.latestPrice < rtInfo.topprice) {
                return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
            };
            return {match};
        };

        if (rtInfo.openPrice == rtInfo.bottomprice) {
            return this.matchResult(true, rtInfo.openPrice, rtInfo.bottomprice);
        };
        
        if (!this.data.inCritical) {
            this.data.guardPrice = rtInfo.latestPrice;
            this.data.inCritical = true;
            this.flush();
            return {match};
        };

        if (rtInfo.latestPrice <= this.data.prePeekPrice * 0.99) {
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        }

        if (rtInfo.latestPrice > this.data.prePeekPrice) {
            this.data.prePeekPrice = rtInfo.latestPrice;
            this.flush();
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
            return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
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
            this.flush();
        };
        if (rtInfo.latestPrice - guardPrice <= 0) {
            this.data.inCritical = true;
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        };
        return {match: false};
    }

    checkKlines(klines, updatedKlt) {
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
                this.flush();
            };
        };
    }
}

class StrategySellELShort extends StrategySellEL {
    check(rtInfo) {
        var latestPrice = rtInfo.latestPrice;
        var guardPrice = this.data.guardPrice;
        var averPrice = this.data.averPrice;
        if (latestPrice == rtInfo.topprice) {
            guardPrice = latestPrice;
        } else if (latestPrice - averPrice * 1.08 >= 0 && guardPrice - latestPrice / 2 - averPrice / 2 < 0) {
            guardPrice = - (- latestPrice - averPrice) / 2;
        } else if (latestPrice - averPrice * 1.03 >= 0 && averPrice - guardPrice > 0) {
            guardPrice = averPrice;
        };
        if (guardPrice - this.data.guardPrice > 0) {
            this.data.guardPrice = guardPrice;
            this.flush();
        };
        if (rtInfo.latestPrice - guardPrice < 0) {
            this.data.inCritical = true;
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        };
        return {match: false};
    }
}

class StrategyBuyMA extends StrategyBuy {
    buyMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    sellMatch(refer) {
        this.data.enabled = true;
        this.data.inCritical = false;
    }

    guardLevel() {
        return 'kline';
    }

    check(rtInfo) {
        if (this.data.inCritical) {
            return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
        };
        return {match:false};
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };
        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                this.data.inCritical = kl.bss18 == 'b';
            };
        };
    }
}

class StrategySellMA extends StrategySell {
    setHoldCount(count) {
        this.data.count = count;
    }

    buyMatch(refer) {
        this.data.enabled = true;
        this.data.inCritical = false;
    }

    sellMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    guardLevel() {
        return 'kline';
    }

    check(rtInfo) {
        if (this.data.inCritical) {
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        };
        return {match:false};
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };

        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                this.data.inCritical = kl.bss18 == 's';
                return;
            };
        };
    }
}

class StrategyBuyMADynamic extends StrategyBuyMA {
    constructor(str) {
        super(str);
        this.kltypeCandiList = {'4': '8', '8': '15', '15':'30', '30':'60', '60':'120', '120':'101', '101': '202', '202': '404'};
    }

    buyMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    sellMatch(refer) {
        this.data.enabled = true;
        this.data.inCritical = false;
        this.data.kltype = refer.kltype;
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };

        var kltype = this.kltype();
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                this.data.inCritical = kl.bss18 == 'b';
            };
        };
        if (this.data.inCritical) {
            return;
        };

        var gklt = this.kltypeCandiList[kltype];
        if (gklt && updatedKlt.includes(gklt)) {
            var gKlines = klines.getKline(gklt);
            var tailWCount = 0;
            var gkl = klines.getIncompleteKline(gklt);
            if (gkl) {
                if (gkl.bss18 == 'w' && gkl.ma18 - gkl.o > 0 && gkl.ma18 - gkl.c > 0) {
                    tailWCount = 1;
                } else {
                    return;
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
                if (gklt == '404') {
                    this.enabled = false;
                } else {
                    this.data.kltype = gklt;
                };
            };
        };
    }
}

class StrategySellMADynamic extends StrategySellMA {
    setHoldCost(price) {
        if (this.data.price === undefined) {
            this.data.price = price;
        };
    }

    buyMatch(refer) {
        this.data.enabled = true;
        this.data.inCritical = false;
        this.data.kltype = refer.kltype;
        if (refer.kltype - 100 > 0) {
            this.data.kltype = '60';
        }
        this.data.price = refer.price;
    }

    sellMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };

        var kltype = this.kltype();
        if (updatedKlt.includes(kltype)) {
            var kl = klines.getLatestKline(kltype);
            if (kl) {
                this.data.inCritical = kl.bss18 == 's';
            };
        } else if (kltype != '4') {
            var mKlines = klines.getKline(1);
            var highPrice = mKlines[mKlines.length - 1].h;
            if (highPrice > this.data.price * 1.2) {
                this.data.kltype = '4';
            };
            var dKlines = klines.getKline('101');
            var kl = klines.getLatestKline('101');
            if (kl) {
                var lclose = kl.c;
                if (highPrice > lclose * 1.085 && highPrice > this.data.price * 1.05) {
                    this.data.kltype = '4';
                };
            };
        };
    }
}

class StrategyBuyBeforeEnd extends StrategyBuyMA {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return '101';
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined) {
            return;
        };

        var kltype = this.kltype();
        var inkl = klines.getIncompleteKline(kltype);
        var dKline = klines.getKline(kltype);
        if (inkl && dKline && dKline.length > 0) {
            var lkl = dKline[dKline.length - 1];
            if (lkl && lkl.c - lkl.o < 0 && inkl.c - inkl.o > 0) {
                this.data.inCritical = inkl.v - lkl.v * 0.98 < 0;
            };
        };
    }
}

class StrategyBuyMABeforeEnd extends StrategyBuyMA {
    guardLevel() {
        return 'kday';
    }

    kltype() {
        return this.data.kltype;
    }

    checkKlines(klines, updatedKlt) {
        if (klines === undefined || updatedKlt === undefined || updatedKlt.length < 1) {
            return;
        };
        if (updatedKlt.includes(this.kltype())) {
            var kl = klines.getLatestKline(this.kltype());
            if (kl) {
                if (kl.bss18 == 'b') {
                    this.data.inCritical = true;
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
                            this.data.inCritical = true;
                            return;
                        }
                        if ((h - o) / o > 0.03 && (h - c) * 4 < h - o) {
                            this.data.inCritical = true;
                            return;
                        }
                    }
                }
            };
        };
    }
}

let strategyManager = new StrategyManager();
