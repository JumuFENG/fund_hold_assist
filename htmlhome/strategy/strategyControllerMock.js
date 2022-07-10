'use strict';

class MockStrategyManager extends StrategyManager {
    create(strategy) {
        if (strategy.key == 'StrategyBH') {
            return new MockStrategyBarginHunting(strategy);
        };
        return super.create(strategy);
    }
}

class MockStrategyBarginHunting extends StrategyBarginHunting {
    checkCutOrSell(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltype = this.data.kltype;
        if (!updatedKlt.includes(kltype)) {
            return;
        }

        var kl = klines.getLatestKline(kltype);
        var count = chkInfo.buydetail.availableCount();
        if ((this.data.topprice - kl.h) / this.data.topprice < this.data.upRate) {
            // sell
            matchCb({id: chkInfo.id, tradeType: 'S', count, price: kl.c}, _ => {
                this.resetToS0();
            });
            return;
        }
        if (kl.l - this.data.guardPrice < 0) {
            // cut
            var price = this.data.guardPrice;
            if (kl.o - price < 0) {
                price = kl.o;
            }
            matchCb({id: chkInfo.id, tradeType: 'S', count, price}, _ => {
                this.resetToS0();
            });
            return;
        }
        // wait
    }
}
