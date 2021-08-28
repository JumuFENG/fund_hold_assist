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

    updateRtPrice(snapshot) {
        if (!this.name) {
            this.name = snapshot.name;
        }
        this.latestPrice = snapshot.realtimequote.currentPrice;
        var rtInfo = {};
        rtInfo.latestPrice = this.latestPrice;
        rtInfo.openPrice = snapshot.fivequote.openPrice;
        var buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
        rtInfo.buyPrices = buyPrices;
        var sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
        rtInfo.sellPrices = sellPrices;
        rtInfo.topprice = snapshot.topprice;
        rtInfo.bottomprice = snapshot.bottomprice;
        this.rtInfo = rtInfo;
        this.checkStrategies();
        tradeAnalyzer.updateStockRtPrice(snapshot);
    }

    parseKlines(kline) {
        var klines = [];
        for (var i = 0; kline && i < kline.length; i++) {
            var kl = kline[i].split(',');
            var time = kl[0];
            if (new Date() < new Date(time)) {
                continue;
            };
            var o = kl[1];
            var c = kl[2];
            var h = kl[3];
            var l = kl[4];
            klines.push({time, o, c, h, l});
        };
        return klines;
    }

    applyStockKlines(klines, fecthed) {
        var sum5 = 0;
        for (var i = 1; i <= 5 && i <= klines.length; i++) {
            sum5 += parseFloat(klines[klines.length - i].c);
        };
        var sum18 = 0;
        for (var i = 1; i <= 18 && i <= klines.length; i++) {
            sum18 += parseFloat(klines[klines.length - i].c);
        };
        var len5 = klines.length >= 5 ? 5 : klines.length;
        var len18 = klines.length >= 18 ? 18 : klines.length;
        var lastTime = klines[klines.length - 1].time;
        fecthed.forEach(k => {
            if (k.time > lastTime) {
                sum5 += parseFloat(k.c);
                if (len5 < 5) {
                    len5 ++;
                } else {
                    sum5 -= klines[klines.length - 6].c;
                };
                k.ma5 = (sum5 / len5).toFixed(3);

                sum18 += parseFloat(k.c);
                if (len18 < 18) {
                    len18 ++;
                } else {
                    sum18 -= klines[klines.length - 19].c;
                };
                k.ma18 = (sum18 / len18).toFixed(3);

                k.bss18 = this.getBss18(klines[klines.length - 1], k);
                klines.push(k);
            };
        });
    }

    klineApproximatelyAboveMa18(kl) {
        if (kl.l > kl.ma18) {
            return true;
        };
        if (kl.h - kl.l >= 0.02 * kl.o && 5 * (kl.ma18 - kl.l) <= kl.h - kl.ma18) {
            return true;
        };
        return false;
    }

    klineApproximatelyBellowMa18(kl) {
        if (kl.h < kl.ma18) {
            return true;
        };

        if (kl.h - kl.l >= 0.02 * kl.o && (kl.ma18 - kl.l) >= 5 * (kl.h - kl.ma18)) {
            return true;
        };
        return false;
    }

    getBss18(kl1, kl2) {
        var bss18 = 'u';
        if (kl1.l > kl1.ma18 && this.klineApproximatelyAboveMa18(kl2)) {
            bss18 = kl1.bss18 == 'h' ? 'h' : 'b';
        } else if (kl1.h < kl1.ma18 && this.klineApproximatelyBellowMa18(kl2)) {
            bss18 = kl1.bss18 == 'w' ? 'w' : 's';
        } else {
            bss18 = kl1.bss18;
            if (kl1.bss18 == 'b') {
                bss18 = 'h';
            } else if (kl1.bss18 == 's') {
                bss18 = 'w';
            };
        };
        return bss18;
    }

    calcKlineMA(klines) {
        var len = 0;
        var sum = 0;
        var len5 = 0;
        var sum5 = 0;
        for (var i = 0; i < klines.length; i++) {
            sum += parseFloat(klines[i].c);
            sum5 += parseFloat(klines[i].c);
            if (len5 < 5) {
                len5 ++;
            } else {
                if (i >= 5) {
                    sum5 -= klines[i - 5].c;
                };
            };
            klines[i].ma5 = (sum5 / len5).toFixed(3);
            if (len < 18) {
                len ++;
            } else {
                if (i >= 18) {
                    sum -= klines[i - 18].c;
                };
            };
            klines[i].ma18 = (sum / len).toFixed(3);
        };

        // bss18 (for next kline buy sell state: u/unknown, b/buy, s/sell, h/hold, w/wait)
        if (klines.length < 2) {
            return;
        };
        klines[0].bss18 = 'u';
        klines[1].bss18 = 'u';
        for (var i = 1; i < klines.length; i++) {
            klines[i].bss18 = this.getBss18(klines[i - 1], klines[i]);
        };
    }

    updateRtKline(message) {
        var kltype = message.kltype;
        var klines = this.parseKlines(message.kline.data.klines);
        if (this.buyStrategy && this.buyStrategy.shouldGetKline() && this.buyStrategy.kltype == kltype) {
            if (this.buyStrategy.klines === undefined || this.buyStrategy.klines.length == 0) {
                this.buyStrategy.klines = klines;
                this.calcKlineMA(this.buyStrategy.klines);
            } else {
                this.applyStockKlines(this.buyStrategy.klines, klines);
            };
            this.buyStrategy.checkKlines();
            strategyManager.flushStrategy(this.buyStrategy);
            if (this.buyStrategy.inCritical && (new Date()).getHours() < 15) {
                emjyBack.fetchStockSnapshot(this.code);
            };
        };
        if (this.sellStrategy && this.sellStrategy.shouldGetKline() && this.sellStrategy.kltype == kltype) {
            if (this.sellStrategy.klines === undefined || this.sellStrategy.klines.length == 0) {
                this.sellStrategy.klines = klines;
                this.calcKlineMA(this.sellStrategy.klines);
            } else {
                this.applyStockKlines(this.sellStrategy.klines, klines);
            };
            strategyManager.flushStrategy(this.sellStrategy);
            this.sellStrategy.checkKlines();
            if (this.sellStrategy.inCritical && (new Date()).getHours() < 15) {
                emjyBack.fetchStockSnapshot(this.code);
            };
        };
    }

    checkStrategies() {
        if (this.buyStrategy && this.buyStrategy.enabled) {
            var checkResult = this.buyStrategy.check(this.rtInfo);
            if (checkResult.match) {
                emjyBack.log('checkStrategies', this.code, 'buy match', JSON.stringify(this.buyStrategy));
                emjyBack.tryBuyStock(this.code, this.name, checkResult.price, checkResult.count, checkResult.account);
                if (this.buyStrategy.guardZtBoard()) {
                    emjyBack.ztBoardTimer.removeStock(this.code);
                };
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
