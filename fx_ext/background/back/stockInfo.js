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
        this.klines = new KLine(this.code);
    }

    updateRtPrice(snapshot) {
        if (!this.name) {
            this.name = snapshot.name;
        }
        this.latestPrice = snapshot.realtimequote.currentPrice;
        var rtInfo = {code: this.code, name: this.name};
        rtInfo.latestPrice = this.latestPrice;
        rtInfo.openPrice = snapshot.fivequote.openPrice;
        var buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
        rtInfo.buyPrices = buyPrices;
        var sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
        rtInfo.sellPrices = sellPrices;
        rtInfo.topprice = snapshot.topprice;
        rtInfo.bottomprice = snapshot.bottomprice;
        if (this.strategies) {
            this.strategies.check(rtInfo);
        };
        //tradeAnalyzer.updateStockRtPrice(snapshot);
    }

    updateRtKline(message) {
        var updatedKlt = this.klines.updateRtKline(message);
        if (this.strategies) {
            this.strategies.checkKlines(this.klines, updatedKlt);
        };
    }

    loadKlines() {
        if (this.klines) {
            this.klines.loadSaved();
        };
    }

    saveKlines() {
        if (this.klines) {
            this.klines.save();
        };
    }

    deleteKlines() {
        if (this.klines) {
            this.klines.removeAll();
        };
    }
}
