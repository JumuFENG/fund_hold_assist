'use strict';

class StockInfo {
    constructor(stock) {
        this.code = stock.code;
        this.name = stock.name;
        this.market = stock.market;
        this.holdCost = stock.holdCost;
        this.holdCount = stock.holdCount;
        this.availableCount = stock.availableCount;
        this.latestPrice = null;
        this.strategies = null;
    }

    updateRtPrice(snapshot) {
        if (!this.name) {
            this.name = snapshot.name;
        }
        this.latestPrice = snapshot.realtimequote.currentPrice;
        var buysells = {};
        for (var k in snapshot.fivequote) {
            if (k == 'topprice' || k == 'bottomprice') {
                continue;
            }
            buysells[k] = snapshot.fivequote[k];
        }
        var rtInfo = {
            code: this.code, name: this.name, latestPrice: this.latestPrice,
            openPrice: snapshot.fivequote.openPrice,
            lastClose: snapshot.fivequote.yesClosePrice,
            topprice: snapshot.topprice,
            bottomprice: snapshot.bottomprice,
            buysells
        };
        if (this.strategies) {
            this.strategies.check(rtInfo);
        };
        //tradeAnalyzer.updateStockRtPrice(snapshot);
    }

    updateRtKline(updatedKlt) {
        if (this.strategies) {
            this.strategies.checkKlines(updatedKlt);
        };
    }
}
