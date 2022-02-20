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

    addDealsOf(allDeals, code) {
        if (!allDeals || allDeals.length == 0) {
            return;
        }

        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        var totalCost = 0;
        var partEarned = 0;
        var partCost = 0;
        var deals = allDeals.filter(d => d.code == code);
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            var anchor = emjyBack.stockAnchor(deali.code);
            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            if (isNaN(fee)) {
                fee = 0;
            }
            totalFee += fee;
            fee  = fee.toFixed(2);
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
                totalEarned -= amount;
                totalCost += amount;
                partEarned -= amount;
                partCost += amount;
            } else {
                amount -= fee;
                partEarned += amount;
                totalEarned += amount;
            }
            amount = amount.toFixed(2);
            this.dealsTable.addRow(
                deali.time,
                deali.code,
                anchor,
                deali.tradeType,
                deali.price,
                deali.count,
                fee,
                amount
            );
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
            if (resCount == 0) {
                this.dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
                partEarned = 0;
                partCost = 0;
            }
        }
        totalEarned += emjyBack.getCurrentHoldValue(code, resCount); // filtered.values().next().value
        if (resCount == 0) {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        } else {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), '-');
        }
        return {cost: totalCost, earn: totalEarned, fee: totalFee};
    }

    showDeals(ignored, filtered) {
        if (!this.deals || this.deals.length == 0) {
            return 0;
        }

        var allDeals = this.deals;
        if (!allDeals || allDeals.length == 0) {
            return;
        }

        var toShow = new Set();
        if (filtered && filtered.size > 0) {
            toShow = filtered;
        } else {
            for (let i = 0; i < allDeals.length; i++) {
                const deali = allDeals[i];
                if (ignored && ignored.has(deali.code)) {
                    continue;
                }
                toShow.add(deali.code);
            }
        }

        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var collections = [];
        toShow.forEach(ds => {
            if (!ignored || !ignored.has(ds)) {
                var result = this.addDealsOf(allDeals, ds);
                if (!result || result.cost == 0) {
                    return;
                }
                result.code = ds;
                collections.push(result);
            }
        });
        var totalCost = 0, totalEarned = 0, totalFee = 0;
        collections.sort((a, b) => {return a.earn - b.earn > 0;});
        for (let i = 0; i < collections.length; i++) {
            const collecti = collections[i];
            totalCost += collecti.cost;
            totalEarned += collecti.earn;
            totalFee += collecti.fee;
            this.dealsTable.addRow(i, collecti.code, emjyBack.stockAnchor(collecti.code), '', collecti.cost.toFixed(2), collecti.fee.toFixed(2), collecti.earn.toFixed(2), (100 * (collecti.earn / collecti.cost)).toFixed(2) + '%');
        }
        this.dealsTable.addRow('TOTAL', '', '', '', totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
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