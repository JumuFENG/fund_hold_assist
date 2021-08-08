'use strict';

class StockInfo {
    constructor(stock) {
        this.code = stock.code;
        this.name = stock.name;
        this.market = stock.market;
        this.holdCost = stock.holdCost;
        this.holdCount = stock.holdCount;
        this.availableCount = stock.availableCount;
        this.costDetail = [];
        this.latestPrice = null;
        this.buyStrategy = null;
        this.sellStrategy = null;
    }

    checkStrategies() {
        if (this.buyStrategy && this.buyStrategy.enabled) {
            var checkResult = this.buyStrategy.check(this.rtInfo);
            if (checkResult.match) {
                emjyBack.log('checkStrategies', this.code, 'buy match', JSON.stringify(this.buyStrategy));
                emjyBack.tryBuyStock(this.code, this.name, checkResult.price, checkResult.count, checkResult.account);
                this.buyStrategy.buyMatch(checkResult.price);
                if (this.sellStrategy) {
                    this.sellStrategy.buyMatch(checkResult.price);
                };
            } else if (checkResult.stepInCritical) {
                emjyBack.checkAvailableMoney(this.rtInfo.latestPrice, checkResult.account);
            }
        }
        if (this.sellStrategy && this.sellStrategy.enabled) {
            var checkResult = this.sellStrategy.check(this.rtInfo);
            if (checkResult.match) {
                emjyBack.log('checkStrategies', 'sell match', this.code, JSON.stringify(this.sellStrategy));
                emjyBack.trySellStock(this.code, checkResult.price, checkResult.count, checkResult.account);
                this.sellStrategy.sellMatch(checkResult.price);
                if (this.buyStrategy) {
                    this.buyStrategy.sellMatch(checkResult.price);
                };
            }
        }
    }
}
