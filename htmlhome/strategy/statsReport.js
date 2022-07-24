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
                var fee = -(-d.fee - d.feeGh - d.feeYh);
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
        var tdeal = [];
        var tcount = 0;
        var earned = 0, lost = 0;
        var tradeCountE = 0, tradeCountL = 0;

        while (i < deals.length) {
            tdeal.push(deals[i]);
            if (deals[i].tradeType == 'B') {
                tcount -= -deals[i].count;
            } else {
                tcount -= deals[i].count;
            }
            if (tcount == 0) {
                var ed = dealsEarned(tdeal);
                if (ed > 0) {
                    earned += ed;
                    tradeCountE ++;
                } else if (ed < 0) {
                    lost += ed;
                    tradeCountL ++;
                }

                tdeal = [];
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
        var allDeals = deals.filter(d => d.code == code);
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
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
                partEarned = 0;
                partCost = 0;
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
        dealsTable.addRow('总收益', '', '', '', totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        var stats = this.checkDealsStatistics(deals);
        if (!stats) {
            return;
        }
        dealsTable.addRow('盈亏比', '', '', '', stats.earned.toFixed(2), '', stats.lost.toFixed(2), (stats.earned / stats.lost).toFixed(2));
        dealsTable.addRow('胜率', '', '', '', stats.tradeCountE, '', stats.tradeCountL, (100 * stats.tradeCountE / (stats.tradeCountL + stats.tradeCountE)).toFixed(2) + '%');
        dealsTable.addRow('单日最大成本', '', '', '', stats.maxSdc.toFixed(2), '', '收益率', (100 * (stats.netEarned) / stats.maxSdc).toFixed(2) + '%');
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
}
