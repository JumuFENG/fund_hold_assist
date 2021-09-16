'use strict';

class StrategyManager {
    create(strategy, skey) {
        if (strategy.key == 'StrategyBuy') {
            return new StrategyBuy(strategy, skey);
        };
        if (strategy.key == 'StrategySell') {
            return new StrategySell(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyIPO') {
            return new StrategyBuyIPO(strategy, skey);
        };
        if (strategy.key == 'StrategySellIPO') {
            return new StrategySellIPO(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyR') {
            return new StrategyBuyRepeat(strategy, skey);
        };
        if (strategy.key == 'StrategySellR') {
            return new StrategySellRepeat(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyZT') {
            return new StrategyBuyZT2(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyZTBoard') {
            return new StrategyBuyZTBoard(strategy, skey);
        };
        if (strategy.key == 'StrategySellEL') {
            return new StrategySellEL(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyMA') {
            return new StrategyBuyMA(strategy, skey);
        };
        if (strategy.key == 'StrategySellMA') {
            return new StrategySellMA(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyMAR') {
            return new StrategyBuyMARepeat(strategy, skey);
        };
        if (strategy.key == 'StrategySellMAR') {
            return new StrategySellMARepeat(strategy, skey);
        };
        if (strategy.key == 'StrategyBuyMAD') {
            return new StrategyBuyMADynamic(strategy, skey);
        };
        if (strategy.key == 'StrategySellMAD') {
            return new StrategySellMADynamic(strategy, skey);
        };
    }
}

class Strategy {
    constructor(str, storeKey) {
        this.data = str;
        this.storeKey = storeKey;
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
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    sellMatch(peek) {
        this.data.enabled = false;
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
        } else if (this.data.amount && this.data.amount != 0) {
            result.count = this.calcCount(this.data.amount, price);
        } else {
            result.count = this.calcCount(40000, price);
        };
        return result;
    }
}

class StrategyBuy extends Strategy {
    isBuyStrategy() {
        return true;
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

class StrategyBuyRepeat extends StrategyBuy {
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

class StrategyBuyZT2 extends StrategyBuy {
    buyMatch(refer) {
        this.data.buyRound++;
        this.data.guardPrice = refer.price * (1 - this.data.stepRate);
        if (this.data.buyRound >= 2) {
            this.data.enabled = false;
        };
    }

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        if (this.data.buyRound >= 2) {
            return {match, stepInCritical, account: this.data.account};
        };
        if (this.data.buyRound == 0) {
            return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
        };
        if (this.data.buyRound == 1) {
            var price = rtInfo.latestPrice;
            var topprice = rtInfo.topprice;
            var bottomprice = rtInfo.bottomprice;
            if (!this.data.inCritical) {
                if (price < this.data.guardPrice) {
                    this.data.inCritical = true;
                    stepInCritical = true;
                    this.data.prePeekPrice = price;
                    this.flush();
                };
                return {match, stepInCritical, account: this.data.account};
            };
            if (price >= this.data.prePeekPrice * (1 + this.data.backRate)) {
                return this.matchResult(true, rtInfo.sellPrices[0], rtInfo.topprice);
            }
            if (price < this.data.prePeekPrice) {
                this.data.prePeekPrice = price;
                this.flush();
            }
            return {match, stepInCritical, account: this.data.account};
        };
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

class StrategySellEL  extends StrategySell {
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

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        if (this.data.averPrice * (1 - this.data.backRate) >= price) {
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        };

        if (this.data.guardPrice && this.data.guardPrice > 0) {
            if (price <= this.data.guardPrice) {
                return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
            };
        };

        if (!this.data.inCritical) {
            if (this.data.averPrice * (1 + this.data.stepRate) <= price) {
                this.data.inCritical = true;
                this.data.prePeekPrice = price;
                stepInCritical = true;
                this.flush();
            }
            return {match, stepInCritical, account: this.data.account};
        };

        var dynPeek = this.data.prePeekPrice - (this.data.prePeekPrice - this.data.averPrice) * 0.2;        
        if (price <= dynPeek && (!this.data.guardPrice || this.data.guardPrice == 0)) {
            return this.matchResult(true, rtInfo.buyPrices[0], rtInfo.bottomprice);
        };
        if (price > this.data.prePeekPrice) {
            this.data.prePeekPrice = price;
            this.flush();
        };
        return {match, stepInCritical, account: this.data.account};
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
            var nKlines = klines.getKline(this.kltype());
            if (nKlines && nKlines.length > 0) {
                this.data.inCritical = nKlines[nKlines.length - 1].bss18 == 'b';
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
            var nKlines = klines.getKline(this.kltype());
            if (nKlines && nKlines.length > 0) {
                this.data.inCritical = nKlines[nKlines.length - 1].bss18 == 's';
            };
        };
    }
}

class StrategyBuyMARepeat extends StrategyBuyMA {
    buyMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }

    sellMatch() {

    }
}

class StrategySellMARepeat extends StrategySellMA {
    buyMatch(refer) {

    }

    sellMatch(refer) {
        this.data.enabled = false;
        this.data.inCritical = false;
    }
}

class StrategyBuyMADynamic extends StrategyBuyMA {
    constructor(str, storeKey) {
        super(str, storeKey);
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
        var gkl = this.kltypeCandiList[kltype];
        if (updatedKlt.includes(kltype)) {
            var nKlines = klines.getKline(kltype);
            if (nKlines && nKlines.length > 0) {
                this.data.inCritical = nKlines[nKlines.length - 1].bss18 == 'b';
            };
        } else if (gkl && updatedKlt.includes(gkl)) {
            var gKlines = klines.getKline(gkl);
            var tailWCount = 0;
            for (var i = gKlines.length - 1; i >= 0; i--) {
                if (gKlines[i].bss18 != 'w') {
                    break;
                };
            };
            if (tailWCount == 5) {
                if (gKl == '404') {
                    this.enabled = false;
                } else {
                    this.data.kltype = gkl;
                };
            };
        };
    }
}

class StrategySellMADynamic extends StrategySellMA {
    buyMatch(refer) {
        this.data.enabled = true;
        this.data.inCritical = false;
        this.data.kltype = refer.kltype;
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
            var nKlines = klines.getKline(kltype);
            if (nKlines && nKlines.length > 0) {
                this.data.inCritical = nKlines[nKlines.length - 1].bss18 == 's';
            };
        } else if (kltype != '4') {
            var mKlines = klines.getKline(1);
            var highPrice = mKlines[mKlines.length - 1].h;
            if (highPrice > this.data.price * 1.2) {
                this.data.kltype = '4';
            };
            var dKlines = klines.getKline('101');
            if (dKlines && dKlines.length > 0) {
                var klLatest = dKlines[dKlines.length - 1];
                var lclose = klLatest.c;
                if (highPrice > lclose * 1.085) {
                    this.data.kltype = '4';
                };
            };
        };
    }
}

let strategyManager = new StrategyManager();
