'use strict';

class RetrospectAccount extends TrackingAccount {
    constructor() {
        super();
        this.keyword = 'retro';
        this.key_deals = 'retro_deals';
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    loadAssets() {
    }

    addWatchStock(code, strgrp) {
        emjyBack.loadKlines(code);
        var stock = this.stocks.find(s => {return s.code == code;});

        if (stock) {
            this.addStockStrategy(stock, strgrp);
            return;
        };

        var name = '';
        var market = '';
        var stock = new StockInfo({ code, name, holdCount: 0, availableCount: 0, market});
        this.addStockStrategy(stock, strgrp);
        this.stocks.push(stock);
    }

    save() {
    }
}

class RetroEngine {
    constructor() {

    }

    initRetro(code, str, startDate, endDate = null) {
        this.code = code;
        this.startDate = startDate;
        this.endDate = endDate;
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        if (emjyBack.retroAccount.stocks.find(s=>s.code == code)) {
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }
        this.initKlines(code, startDate);
    }

    retroStrategySingleKlt(code, str, startDate, kltype = '101', endDate = null) {
        this.kltype = kltype;
        this.code = code;
        this.startDate = startDate;
        this.endDate = endDate;
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        if (emjyBack.retroAccount.stocks.find(s=>s.code == code)) {
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        this.startRetro();
    }

    retroStrategyGe(code, kltype = '30') {
        this.kltype = kltype;
        this.code = code;
        var str = {
            "grptype":"GroupStandard",
            "strategies":{"0":{"key":"StrategyGE","enabled":true,"stepRate":0.04, kltype, "period":"l"}},
            "transfers":{"0":{"transfer":"-1"}},
            "amount":10000};
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (stock) {
            stock.strategies = null;
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        var skltype = '1';
        var dKline = emjyBack.klines[this.code].klines[this.kltype];
        var rKline = emjyBack.klines[this.code].klines[skltype];
        var startIdx = dKline.findIndex(kl => kl.time >= rKline[0].time);
        var resKline = dKline.splice(startIdx);
        var resRtKline = rKline.splice(0);
        var j = 0;
        for (var i = 0; i < resRtKline.length; i++) {
            rKline.push(resRtKline[i]);
            emjyBack.retroAccount.tradeTime = resRtKline[i].time;
            if (j < resKline.length && resRtKline[i].time == resKline[j].time) {
                dKline.push(resKline[j]);
                j++;
                stock.strategies.checkKlines([skltype, this.kltype]);
            } else {
                stock.strategies.checkKlines([skltype]);
            }
        }
    }

    retroStrategyBuySD(code, kltype = '30') {
        this.kltype = kltype;
        this.code = code;
        var str = {
            "grptype":"GroupStandard",
            "strategies":{"0":{"key":"StrategyBuySD","enabled":true, kltype}},
            "transfers":{"0":{"transfer":"-1"}},
            "amount":10000};
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (stock) {
            stock.strategies = null;
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        this.startRetro();
    }

    startRetro() {
        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (!stock) {
            console.log('stock not exists')
            return;
        }
        if (!emjyBack.klines[this.code] || !emjyBack.klines[this.code].klines) {
            console.log('stock klines not find!');
            return;
        }

        var dKline = emjyBack.klines[this.code].klines[this.kltype];

        var startIdx = 0
        if (this.startDate) {
            startIdx = dKline.findIndex(k => k.time >= this.startDate);
        }
        if (startIdx < 0) {
            console.log('can not find kl data at', this.startDate);
            return;
        }
        var resKline = dKline.splice(startIdx);
        for (var i = 0; i < resKline.length; i++) {
            dKline.push(resKline[i]);
            emjyBack.retroAccount.tradeTime = resKline[i].time;
            stock.strategies.buydetail.archiveRecords();
            stock.strategies.checkKlines([this.kltype]);
        }
    }
}
