'use strict';

class MockStrategyManager extends StrategyManager {
    create(strategy) {
        if (strategy.key == 'StrategyBH') {
            return new MockStrategyBarginHunting(strategy);
        }
        if (strategy.key == 'StrategyZt1') {
            return new MockStrategyZt1(strategy);
        }
        return super.create(strategy);
    }
}

class MockStrategyBarginHunting extends StrategyBarginHunting {
    checkCutOrSell(chkInfo, matchCb) {
        var klines = emjyBack.klines[chkInfo.code];
        var updatedKlt = chkInfo.kltypes;
        var kltype = this.data.kltype;
        if (updatedKlt.includes(this.skltype)) {
            return super.checkCutOrSell(chkInfo, matchCb);
        }

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

class MockStrategyZt1 extends StrategyZt1 {
    checkCreateBuy(chkInfo, matchCb) {
        var updatedKlt = chkInfo.kltypes;
        var kltype = '101';
        if (!updatedKlt.includes(kltype)) {
            return false;
        }

        if (!this.data.zt0date) {
            return false;
        }
        var code = chkInfo.code;
        var klines = emjyBack.klines[code];
        var kl0 = klines.getLatestKline(kltype);
        if (kl0.time <= this.data.zt0date) {
            if (kl0.time == this.data.zt0date) {
                kl0.bss18 = 'u';
            }
            return false;
        }
        var kl1 = klines.getPrevKline(kltype);
        if (kl1.time == this.data.zt0date) {
            matchCb({id: chkInfo.id, tradeType: 'B', count: 0, price: kl0.o}, _ => {
                this.data.meta.state = 's1';
            });
            return true;
        }
        return false;
    }
}
