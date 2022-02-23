'use strict';

class RetroPanelPage extends RadioAnchorPage {
    constructor() {
        super('回测');
    }

    show() {
        super.show();
        if (this.iptRetroCode === undefined) {
            this.initRetroPanel();
        }
    }

    initRetroPanel() {
        this.iptRetroCode = document.createElement('input');
        this.iptRetroCode.placeholder = '股票代码';
        this.container.appendChild(this.iptRetroCode);

        var btnStartRetro = document.createElement('button');
        btnStartRetro.textContent = '初始化';
        btnStartRetro.onclick = e => {
            this.initRetroPlan();
        }
        this.container.appendChild(btnStartRetro);

        var btnRetroDeals = document.createElement('button');
        btnRetroDeals.textContent = '准备';
        btnRetroDeals.onclick = e => {
            this.preRetro();
        }
        this.container.appendChild(btnRetroDeals);

        var btnDoRetro = document.createElement('button');
        btnDoRetro.textContent = '执行';
        btnDoRetro.onclick = e => {
            this.doRetro();
        }
        this.container.appendChild(btnDoRetro);

        var btnSavePlan = document.createElement('button');
        btnSavePlan.textContent = '保存';
        btnSavePlan.onclick = e => {
            this.savePlan();
        }
        this.container.appendChild(btnSavePlan);

        var btnShowDeals = document.createElement('button');
        btnShowDeals.textContent = '显示交易记录';
        btnShowDeals.onclick = e => {
            if (this.retroPlan) {
                this.showDeals(this.retroPlan.deals);
            }
        }
        this.container.appendChild(btnShowDeals);

        var btnMaxDayCost = document.createElement('button');
        btnMaxDayCost.textContent = '最大单日成本:';
        btnMaxDayCost.onclick = e => {
            if (!this.retroPlan) {
                return;
            }
            e.target.textContent = '最大单日成本: ' + this.retroPlan.countMaxAmount().toFixed(2);
        }
        this.container.appendChild(btnMaxDayCost);

        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
    }

    initRetroPlan() {
        if (!this.retroPlan) {
            this.retroPlan = new RetroPlan('strategyMA');
            // this.retroPlan = new RetroPlan('strategyMAPick1');
            // this.retroPlan.retrodesc = '';
            // this.retroPlan.kltype = '101';
            // this.retroPlan.startDate = '2020-01-01';
            // this.retroPlan.strategy = { "grptype": "GroupStandard", "strategies": { "0": { "key": "StrategyMAPick", "enabled": true, "kltype": "101" } }, "amount": 40000 };
            // this.retroPlan.stocks = [];
        }
    }

    preRetro() {
        if (this.retroPlan) {
            this.retroPlan.retroPrepare();
        }
    }

    doRetro() {
        if (this.retroPlan) {
            this.retroPlan.retro();
        }
    }

    savePlan() {
        if (this.retroPlan) {
            this.retroPlan.save();
        }
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

    showDeals(alldeals, ignored, filtered) {
        if (!alldeals || alldeals.length == 0) {
            return;
        }

        var toShow = new Set();
        if (filtered && filtered.size > 0) {
            toShow = filtered;
        } else {
            for (let i = 0; i < alldeals.length; i++) {
                const deali = alldeals[i];
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
                var result = this.addDealsOf(alldeals, ds);
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
}
