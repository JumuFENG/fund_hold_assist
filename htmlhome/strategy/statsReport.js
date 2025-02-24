'use strict';

class StatisticsReport {
    maxSingleDayCost(deals) {
        if (!deals || deals.length == 0) {
            return 0;
        }

        var allDeals = deals.slice(0);
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

    checkDealsStatistics(deals) {
        if (!deals || deals.length == 0) {
            return;
        }

        var dealsEarned = (dls) => {
            var cost = 0;
            var sold = 0;
            var tfee = 0;
            dls.forEach(d => {
                var fee = -d.fee;
                if (d.feeGh !== undefined) {
                    fee -= d.feeGh;
                }
                if (d.feeYh !== undefined) {
                    fee -= d.feeYh;
                }
                fee = -fee;
                if (isNaN(fee)) {
                    fee = 0;
                }
                tfee += fee;
                if (d.tradeType == 'B') {
                    cost += d.count * d.price;
                } else {
                    sold += d.count * d.price;
                }
            });
            return sold - cost - tfee;
        }

        var i = 0;
        var tdeal = {};
        var tcount = 0;
        var earned = 0, lost = 0;
        var tradeCountE = 0, tradeCountL = 0;

        while (i < deals.length) {
            if (!tdeal[deals[i].code]) {
                tdeal[deals[i].code] = {count:0, deals:[]};
            }
            tdeal[deals[i].code].deals.push(deals[i]);
            if (deals[i].tradeType == 'B') {
                tdeal[deals[i].code].count -= -deals[i].count;
            } else {
                tdeal[deals[i].code].count -= deals[i].count;
            }
            if (tdeal[deals[i].code].count == 0) {
                var ed = dealsEarned(tdeal[deals[i].code].deals);
                if (ed > 0) {
                    earned += ed;
                    tradeCountE ++;
                } else if (ed < 0) {
                    lost += ed;
                    tradeCountL ++; 
                }

                delete(tdeal[deals[i].code]);
            }
            i++;
        }

        lost = -lost;
        var maxSdc = this.maxSingleDayCost(deals);
        var netEarned = earned - lost;
        return {earned, lost, netEarned, tradeCountE, tradeCountL, maxSdc};
    }

    addDealsOf(dealsTable, deals, code, full) {
        if (!deals || deals.length == 0) {
            return;
        }

        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        var totalCost = 0;
        var partEarned = 0;
        var partCost = 0;
        var buydates = [];
        var selldates = [];
        var allDeals = deals.filter(d => d.code == code);
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            var anchor = emjyBack.stockAnchor(deali.code);
            var fee = -deali.fee;
            if (deali.feeGh !== undefined) {
                fee -= deali.feeGh;
            }
            if (deali.feeYh !== undefined) {
                fee -= deali.feeYh;
            }
            fee = -fee;
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
                buydates.push(deali.time);
            } else {
                amount -= fee;
                partEarned += amount;
                totalEarned += amount;
                selldates.push(deali.time);
            }
            amount = amount.toFixed(2);
            if (full) {
                dealsTable.addRow(
                    deali.time,
                    deali.code,
                    anchor,
                    deali.tradeType,
                    deali.price,
                    deali.count,
                    fee,
                    amount
                );
            }
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
            if (resCount == 0) {
                if (full) {
                    dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
                }
                if (!this.tradeResults) {
                    this.tradeResults = [];
                }
                this.tradeResults.push([code, buydates, selldates, partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%']);
                partEarned = 0;
                partCost = 0;
                buydates = [];
                selldates = [];
            }
        }
        totalEarned += emjyBack.getCurrentHoldValue(code, resCount); // filtered.values().next().value
        if (resCount == 0) {
            dealsTable.addRow('total', code, '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        } else {
            dealsTable.addRow('total', code, '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), '-');
        }
        return {cost: totalCost, earn: totalEarned, fee: totalFee};
    }

    showDeals(dealsTable, deals, showFullDeals, ignored, filtered) {
        var toShow = new Set();
        if (filtered && filtered.size > 0) {
            toShow = filtered;
        } else {
            for (let i = 0; i < deals.length; i++) {
                const deali = deals[i];
                if (ignored && ignored.has(deali.code)) {
                    continue;
                }
                toShow.add(deali.code);
            }
        }

        dealsTable.reset();
        dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var collections = [];
        this.tradeResults = [];
        toShow.forEach(ds => {
            if (!ignored || !ignored.has(ds)) {
                var result = this.addDealsOf(dealsTable, deals, ds, showFullDeals);
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
            dealsTable.addRow(i, collecti.code, emjyBack.stockAnchor(collecti.code), '', collecti.cost.toFixed(2), collecti.fee.toFixed(2), collecti.earn.toFixed(2), (100 * (collecti.earn / collecti.cost)).toFixed(2) + '%');
        }
        dealsTable.addRow('总成本', totalCost.toFixed(2), '手续费', '', totalFee.toFixed(2), '', '','');
        dealsTable.addRow('总收益', totalEarned.toFixed(2), '收益率', '', (100 * (totalEarned / totalCost)).toFixed(2) + '%', '','','')
        var stats = this.checkDealsStatistics(deals);
        if (!stats) {
            return;
        }
        dealsTable.addRow('总盈利', stats.earned.toFixed(2), '总亏损', '', stats.lost.toFixed(2), '', '盈亏比', (stats.earned * stats.tradeCountL / (stats.tradeCountE * stats.lost)).toFixed(2));
        dealsTable.addRow('盈利次数', stats.tradeCountE, '亏损次数', '', stats.tradeCountL, '', '胜率', (100 * stats.tradeCountE / (stats.tradeCountL + stats.tradeCountE)).toFixed(2) + '%');
        dealsTable.addRow('单日最大成本', stats.maxSdc.toFixed(2), '日收益率', '', (100 * (stats.netEarned) / stats.maxSdc).toFixed(2) + '%', '', '期望', ((stats.earned * stats.tradeCountE - stats.lost * stats.tradeCountL) / (stats.lost * (stats.tradeCountE + stats.tradeCountL))).toFixed(4));
    }

    showPrevTradeResult(trtable) {
        if (!this.tradeResults || this.tradeResults.length == 0) {
            return;
        }

        trtable.reset();
        trtable.setClickableHeader('代码','名称','收益','收益率','买入日期','卖出日期');
        this.tradeResults.sort((a,b) => a[3] - b[3] > 0);
        this.tradeResults.forEach(r => {
            var bdiv = document.createElement('div');
            bdiv.style.maxWidth = '500px';
            bdiv.textContent = r[1].join(',');
            var sdiv = document.createElement('div');
            sdiv.style.maxWidth = '160px';
            sdiv.textContent = r[2].join(',');
            trtable.addRow(
                r[0],
                emjyBack.stockAnchor(r[0]),
                r[3],
                r[4],
                bdiv,
                sdiv
            );
        });
    }

    showStrategyStats(stable, stats) {
        if (!stats || stats.length == 0) {
            return;
        }
        if (stats[0].length < 2) {
            return;
        }

        console.log(stats);
        stable.reset();
        stable.setClickableHeader('策略', '收益','亏损', '净收益', '盈利次数', '亏损次数', '胜率(%)', '单日最大成本', '收益率(%)');
        stats.forEach(s => {
            var stati = s[1];
            if (!stati) {
                return;
            }
            if (stati.tradeCountE + stati.tradeCountL < 5) {
                return;
            }
            var earn_percent = stati.tradeCountE * 100 / (stati.tradeCountE + stati.tradeCountL);
            if (earn_percent < 35) {
                return;
            }
            stable.addRow(
                JSON.stringify(s[0]),
                stati.earned.toFixed(2),
                stati.lost.toFixed(2),
                stati.netEarned.toFixed(2),
                stati.tradeCountE,
                stati.tradeCountL,
                earn_percent.toFixed(2),
                stati.maxSdc.toFixed(2),
                (100 * (stati.netEarned) / stati.maxSdc).toFixed(2)
                );
        });
    }

    makeupDeals(deals, key, base, inc) {
        if (!base || !inc) return deals;
        var dlbs = {};
        for (const deali of deals) {
            if (!dlbs[deali.code]) {
                dlbs[deali.code] = [];
            }
            dlbs[deali.code].push({'code': deali.code, 'price': deali.price, 'time': deali.time, 'tradeType': deali.tradeType});
        }
        for (var c in dlbs) {
            dlbs[c].sort((a, b) => {
                // 时间升序，相同时间先卖后买
                if (a.time == b.time) {
                    return a.tradeType < b.tradeType;
                }
                return a.time > b.time;
            });
            for (var i = dlbs[c].length - 1; i >= 0; i--) {
                if (dlbs[c][i].tradeType == 'S') {
                    break;
                }
                dlbs[c].pop();
            }
        }
        var bslist = [];
        for (var c in dlbs) {
            for (var dl of dlbs[c]) {
                bslist.push(dl);
            }
        }
        bslist.sort((a, b) => {
            // 时间升序，相同时间先买后卖
            if (a.time == b.time) {
                return a.tradeType > b.tradeType;
            }
            return a.time > b.time;
        });

        var buyDealWithCount = function(dl, amount) {
            var count = utils.calcBuyCount(amount, dl.price);
            return {'code':dl.code, 'price': dl.price, 'time': dl.time, 'tradeType': dl.tradeType, count};
        }
        var sellDealWithCount = function(dl, count) {
            return {'code':dl.code, 'price':dl.price, 'time':dl.time, 'tradeType': dl.tradeType, count};
        }
        var buyDelta = function(bkey, val, base) {
            if (bkey == 'step') {
                return val;
            }
            if (bkey == 'ratio') {
                return base * val;
            }
            if (bkey == 'lose') {
                return base / val;
            }
            return val;
        }
        var mdeals = [];
        var buyAmount = parseInt(base);
        var holdings = {};
        var sellEarned = 0;
        for (var i = 0; i < bslist.length; i++) {
            var bstd = [bslist[i]];
            for (var j = i + 1; j < bslist.length; j++) {
                if (bslist[j].time != bslist[i].time) {
                    break;
                }
                bstd.push(bslist[j]);
            }
            i += bstd.length - 1;
            var bholdings = {};
            for (var j = 0; j < bstd.length; j++) {
                if (bstd[j].tradeType == 'B') {
                    var bdeal = buyDealWithCount(bstd[j], buyAmount);
                    if (!bholdings[bstd[j].code]) {
                        bholdings[bstd[j].code] = {count: 0};
                    }
                    mdeals.push(bdeal);
                    bholdings[bstd[j].code].count += bdeal.count;
                    bholdings[bstd[j].code].price = bdeal.price;
                } else {
                    if (!holdings[bstd[j].code]) {
                        continue;
                    }
                    var sdeal = sellDealWithCount(bstd[j], holdings[bstd[j].code].count);
                    mdeals.push(sdeal);
                    sellEarned += (sdeal.price - holdings[bstd[j].code].price) * holdings[bstd[j].code].count;
                    delete(holdings[bstd[j].code]);
                }
            }
            for (var c in bholdings) {
                if (!holdings[c]) {
                    holdings[c] = bholdings[c];
                } else {
                    holdings[c].count += bholdings[c].count;
                    holdings[c].price = bholdings[c].price;
                }
            }
            if (sellEarned > 0) {
                buyAmount = parseInt(base);
                sellEarned = 0;
            } else if (key == 'lose') {
                buyAmount = Math.max(base, parseFloat(buyDelta(key, inc, -sellEarned)));
            } else {
                buyAmount += parseFloat(buyDelta(key, inc, buyAmount));
            }
        }
        return mdeals;
    }
}
