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

    loadSaved() {
        emjyBack.getFromLocal(this.retroStoreKey(), item => {
            if (item && item[this.retroStoreKey()]) {
                var rpo = item[this.retroStoreKey()];
                this.retrodesc = rpo.desc;
                this.kltype = rpo.kltype;
                this.startDate = rpo.startDate;
                this.strategy = rpo.strategy;
            }
        });
        emjyBack.getFromLocal(this.retroStocksKey(), item => {
            if (item && item[this.retroStocksKey()]) {
                this.stocks = item[this.retroStocksKey()];
            }
        });
        emjyBack.getFromLocal(this.retroDealsKey(), item => {
            if (item && item[this.retroDealsKey()]) {
                this.deals = item[this.retroDealsKey()];
            }
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
        if (this.stocks && this.stocks.length > 0) {
            saveObj[this.retroStocksKey()] = this.stocks;
        }
        this.deals = this.getCompletedDeals();
        if (this.deals && this.deals.length > 0) {
            saveObj[this.retroDealsKey()] = this.deals;
        }
        emjyBack.saveToLocal(saveObj);
    }

    retroPrepare() {
        if (this.stocks && this.stocks.length > 0) {
            this.stocks.forEach(code => {
                emjyBack.loadKlines(code,() => {
                    if (!emjyBack.klines[code].klines) {
                        emjyBack.fetchStockKline(code, this.kltype, this.startDate);
                        return;
                    }
                });
            });
        } else {
            for (const code in emjyBack.stockMarket) {
                if (Object.hasOwnProperty.call(emjyBack.stockMarket, code)) {
                    const stk = emjyBack.stockMarket[code];
                    if (stk.t != 'AB') {
                        continue;
                    }

                    emjyBack.loadKlines(code, ()=>{
                        if (!emjyBack.klines[code].klines) {
                            emjyBack.fetchStockKline(code, this.kltype, this.startDate);
                        }
                    });
                }
            }
        }
    }

    retro() {
        if (!emjyBack.retroEngine || emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        emjyBack.retroAccount.deals = [];

        if (this.stocks && this.stocks.length > 0) {
            this.stocks.forEach(code => {
                emjyBack.retroEngine.retroStrategySingleKlt(code, this.strategy, this.startDate);
            });
        } else {
            for (const code in emjyBack.stockMarket) {
                if (Object.hasOwnProperty.call(emjyBack.stockMarket, code)) {
                    const stk = emjyBack.stockMarket[code];
                    if (stk.t != 'AB') {
                        continue;
                    }

                    emjyBack.retroEngine.retroStrategySingleKlt(code, this.strategy, this.startDate);
                }
            }
        }
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
        return alldeals;
    }

    countMaxAmount() {
        if (!this.deals || this.deals.length == 0) {
            return 0;
        }

        var allDeals = this.deals;
        allDeals.sort((a, b) => {return a.time > b.time});
        var amount = 0;
        var maxMt = 0;
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            if (deali.tradeType == 'B') {
                amount += (deali.count * deali.price);
            } else {
                amount -= (deali.count * deali.price);
            }
            if (amount > maxMt) {
                maxMt = amount;
            }
        }
        return maxMt;
    }
}