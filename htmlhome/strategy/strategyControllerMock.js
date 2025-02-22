'use strict';

class MockStrategyManager extends StrategyManager {
    create(strategy) {
        if (strategy.key == 'StrategyBH') {
            return new MockStrategyBarginHunting(strategy);
        }
        return super.create(strategy);
    }
}

class MockStrategyBarginHunting extends StrategyBarginHunting {
    checkCutOrSell(chkInfo) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltype = this.data.kltype;
        if (updatedKlt.includes(this.skltype)) {
            return super.checkCutOrSell(chkInfo);
        }

        if (!updatedKlt.includes(kltype)) {
            return Promise.resolve();
        }

        var kl = klines.getLatestKline(kltype);
        var count = chkInfo.buydetail.availableCount();
        if ((this.data.topprice - kl.h) / this.data.topprice < this.data.upRate) {
            // sell
            this.resetall = true;
            return Promise.resolve({id: chkInfo.id, tradeType: 'S', count, price: kl.c});
        }
        if (kl.l - this.data.guardPrice < 0) {
            // cut
            var price = this.data.guardPrice;
            if (kl.o - price < 0) {
                price = kl.o;
            }
            this.resetall = true;
            return Promise.resolve({id: chkInfo.id, tradeType: 'S', count, price});
        }
        // wait
        return Promise.resolve();
    }
}
