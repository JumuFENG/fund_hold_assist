class Strategy {
    constructor(log) {
        this.log = log;
        this.guardPrice = null;
        this.backRate = null;
        this.prePeekPrice = null;
        this.inCritical = false;
    }

    setup(guard, back) {
        this.guardPrice = guard;
        this.backRate = back;
    }

    check(price) {
        this.log('check Strategy');
    }
}

class StrategyBuy extends Strategy {
    check(price) {
        if (!this.inCritical) {
            if (price < this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
            }
            return false;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return true;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
        }
        return false;
    }
}

class StrategySell extends Strategy {
    check(price) {
        if (!this.inCritical) {
            if (price > this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
            }
            return false;
        }
        if (price <= this.prePeekPrice * (1 - this.backRate)) {
            return true;
        }
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
        }
        return false;
    }
}

class StrategyBuyIPO extends StrategyBuy {

}

class StrategySellIPO extends StrategySell {

}