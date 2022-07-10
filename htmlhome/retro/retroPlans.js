'use strict';

class RetroPlan {
    constructor(rname) {
        this.retroname = rname;
        this.loadSaved();
    }

    retroStoreKey() {
        return 'retro_pl_' + this.retroname;
    }

    retroStocksKey() {
        return 'retro_stk_' + this.retroname;
    }

    retroDealsKey() {
        return 'retro_deals_' + this.retroname;
    }

    retroStatsKey() {
        return 'retro_stats_' + this.retroname;
    }

    loadSaved() {
        emjyBack.getFromLocal(this.retroStoreKey(), rpo => {
            if (rpo) {
                this.retrodesc = rpo.desc;
                this.kltype = rpo.kltype;
                this.startDate = rpo.startDate;
                this.strategy = rpo.strategy;
            }
        });
        emjyBack.getFromLocal(this.retroStocksKey(), stocks => {
            this.stocks = stocks;
        });
        emjyBack.getFromLocal(this.retroDealsKey(), deals => {
            this.deals = deals;
        });
        emjyBack.getFromLocal(this.retroStatsKey(), stats => {
            this.stats = stats;
        });
    }

    save() {
        var retroPlanObj = {};
        retroPlanObj.name = this.retroname;
        retroPlanObj.desc = this.retrodesc;
        retroPlanObj.kltype = this.kltype;
        retroPlanObj.startDate = this.startDate;
        retroPlanObj.strategy = this.strategy;
        var saveObj = {};
        saveObj[this.retroStoreKey()] = retroPlanObj;
        saveObj[this.retroStocksKey()] = this.stocks;
        if (emjyBack.retroAccount !== undefined && emjyBack.retroAccount.deals && emjyBack.retroAccount.deals.length > 0) {
            this.deals = this.getCompletedDeals();
        }
        saveObj[this.retroDealsKey()] = this.deals;
        if (this.stats !== undefined) {
            saveObj[this.retroStatsKey()] = this.stats;
        }
        emjyBack.saveToLocal(saveObj);
    }

    removeAll() {
        emjyBack.removeLocal(this.retroStoreKey());
        emjyBack.removeLocal(this.retroStocksKey());
        emjyBack.removeLocal(this.retroDealsKey());
        emjyBack.removeLocal(this.retroStatsKey());
    }

    getActualStocks() {
        var stocks = [];
        var stype = 'ALL';
        if (this.stocks && this.stocks.length == 1) {
            stype = this.stocks[0].toUpperCase();
        }

        for (const code in emjyBack.stockMarket) {
            if (Object.hasOwnProperty.call(emjyBack.stockMarket, code)) {
                const stk = emjyBack.stockMarket[code];
                if (stype == 'ALL') {
                    if (stk.t == 'AB') {
                        stocks.push(code);
                    }
                } else if (stype == 'ZB') {
                    if (code.startsWith('00') || code.startsWith('60')) {
                        stocks.push(code);
                    }
                } else if (stype == 'CYB') {
                    if (code.startsWith('30')) {
                        stocks.push(code);
                    }
                } else if (stype == 'KCB') {
                    if (code.startsWith('68')) {
                        stocks.push(code);
                    }
                }
            }
        }
        return stocks;
    }

    retroPrepare() {
        var stocks = this.stocks;
        if (!this.stocks || (this.stocks.length == 1 && this.stocks[0].length < 6)) {
            stocks = this.getActualStocks();
        }

        stocks.forEach(code => {
            emjyBack.loadKlines(code,() => {
                if (!emjyBack.klines[code].klines) {
                    emjyBack.fetchStockKline(code, this.kltype, this.startDate);
                    return;
                }
            });
        });
    }

    retro() {
        if (!emjyBack.retroEngine || !emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        emjyBack.retroAccount.deals = [];

        var stocks = this.stocks;
        if (!this.stocks || (this.stocks.length == 1 && this.stocks[0].length < 6)) {
            stocks = this.getActualStocks();
        }

        stocks.forEach(code => {
            emjyBack.retroEngine.retroStrategySingleKlt(code, this.strategy, this.startDate);
        });
    }
    
    getCompletedDeals() {
        var deals = emjyBack.retroAccount.deals;
        var alldeals = [];
        var dcodes = new Set();
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (!dcodes.has(deali.code)) {
                dcodes.add(deali.code);
            }
        }

        dcodes.forEach(code => {
            var cdeals = deals.filter(d => d.code == code);
            var partDeals = [];
            var resCount = 0;
            for (let j = 0; j < cdeals.length; j++) {
                partDeals.push(cdeals[j]);
                if (cdeals[j].tradeType == 'S') {
                    resCount -= cdeals[j].count;
                } else if (cdeals[j].tradeType == 'B') {
                    resCount -= -cdeals[j].count;
                }
                if (resCount == 0) {
                    partDeals.forEach(d => {
                        alldeals.push(d);
                    });
                    partDeals = [];
                }
            }
        });
        emjyBack.retroAccount.deals = [];
        return alldeals;
    }
}