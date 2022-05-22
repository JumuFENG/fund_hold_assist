'use strict';

class RetroPanelPage extends RadioAnchorPage {
    constructor() {
        super('回测');
        this.plans = [];
        emjyBack.getFromLocal('retro_plans', retros => {
            if (retros) {
                retros.forEach(r => {
                    this.plans.push(new RetroPlan(r));
                });
                if (this.plansListPanel && this.plansListPanel.childElementCount == 0) {
                    this.showPlanItems();
                }
            }
        });
    }

    show() {
        super.show();
        this.container.style.display = 'flex';
        if (this.leftPanel === undefined) {
            this.initRetroView();
        }
    }

    initRetroView() {
        this.container.style = 'display: flex; flex-direction: row; height: 100%;';

        this.leftPanel = document.createElement('div');
        this.leftPanel.style.width = '15%';
        this.container.appendChild(this.leftPanel);
        this.plansListPanel = document.createElement('div');
        this.leftPanel.appendChild(this.plansListPanel);
        if (this.plans.length > 0) {
            this.showPlanItems();
        }
        this.plansListCtrls = document.createElement('div');
        this.leftPanel.appendChild(this.plansListCtrls);
        this.initPlansListControls();
        this.newPlanBox = document.createElement('div');
        this.leftPanel.appendChild(this.newPlanBox);
        this.initNewPlanBox();

        this.contentPanel = document.createElement('div');
        this.container.appendChild(this.contentPanel);

        this.topControlBox = document.createElement('div');
        this.contentPanel.appendChild(this.topControlBox);
        this.initControlBoxPanel();

        this.dealsTable = new SortableTable(1, 0, false);
        this.contentPanel.appendChild(this.dealsTable.container);

        this.statsTable = new SortableTable();
        this.contentPanel.appendChild(this.statsTable.container);
    }

    showPlanItems() {
        if (!this.plansListPanel) {
            return;
        }

        utils.removeAllChild(this.plansListPanel);

        for (let idx = 0; idx < this.plans.length; idx++) {
            const pl = this.plans[idx];
            var pleftItem = document.createElement('div');
            var plchk = document.createElement('input');
            plchk.type = 'checkbox';
            pleftItem.appendChild(plchk);
            pleftItem.appendChild(document.createTextNode(pl.retroname));
            pleftItem.plid = idx;
            pleftItem.onclick = e => {
                e.currentTarget.style.borderColor = 'deepskyblue';
                e.currentTarget.style.borderStyle = 'solid';
                e.currentTarget.style.borderWidth = '2px';
                this.refreshPlanView(e.currentTarget.plid);
                if (e.target == e.currentTarget) {
                    e.target.firstElementChild.checked = !e.target.firstElementChild.checked;
                }
            }
            this.plansListPanel.appendChild(pleftItem);
        }
    }

    initPlansListControls() {
        var selAllBtn = document.createElement('button');
        selAllBtn.textContent = '全选';
        selAllBtn.onclick = e => {
            this.plansListPanel.childNodes.forEach(p => {
                p.firstElementChild.checked = true;
            });
        }
        this.plansListCtrls.appendChild(selAllBtn);

        var uncheckBtn = document.createElement('button');
        uncheckBtn.textContent = '清空';
        uncheckBtn.onclick = e => {
            this.plansListPanel.childNodes.forEach(p => {
                p.firstElementChild.checked = false;
            });
        }
        this.plansListCtrls.appendChild(uncheckBtn);

        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除所选';
        deleteBtn.onclick = e => {
            var toDelPl = [];
            this.plansListPanel.childNodes.forEach(p => {
                if (p.firstElementChild.checked) {
                    toDelPl.push(this.plans[p.plid].retroname);
                }
            });
            if (toDelPl.length > 0) {
                this.removePlans(toDelPl);
            }
        }
        this.plansListCtrls.appendChild(deleteBtn);
    }

    initNewPlanBox() {
        var addInput = function(fath, ele, text) {
            var eleout = document.createElement('div');
            eleout.appendChild(document.createTextNode(text));
            eleout.appendChild(ele);
            fath.appendChild(eleout);
        }

        this.newPlan_Id = document.createElement('input');
        addInput(this.newPlanBox, this.newPlan_Id, 'Plan Id');
        this.newPlan_Desc = document.createElement('input');
        addInput(this.newPlanBox, this.newPlan_Desc, '说明');
        this.newPlan_kltypes = document.createElement('input');
        addInput(this.newPlanBox, this.newPlan_kltypes, 'kltype');
        this.newPlan_StartDate = document.createElement('input');
        addInput(this.newPlanBox, this.newPlan_StartDate, '始于');
        this.newPlan_Strategy = document.createElement('textarea');
        this.newPlan_Strategy.style.width = '90%';
        addInput(this.newPlanBox, this.newPlan_Strategy, '策略');
        this.newPlan_Stocks = document.createElement('input');
        addInput(this.newPlanBox, this.newPlan_Stocks, 'Stocks');

        this.savePlanBtn = document.createElement('button');
        this.savePlanBtn.textContent = '添加/保存';
        this.savePlanBtn.onclick = e => {
            this.addCurrentRetroPlan();
        }

        this.newPlanBox.appendChild(this.savePlanBtn);
    }

    refreshPlanView(id) {
        if (this.selectedPlid !== undefined && this.selectedPlid != -1 && this.selectedPlid != id) {
            if (this.selectedPlid < this.plansListPanel.childNodes.length) {
                this.plansListPanel.childNodes[this.selectedPlid].style.border = '';
            }
        }

        if (id != this.selectedPlid) {
            this.selectedPlid = id;
            if (emjyBack.retroAccount) {
                emjyBack.retroAccount.deals = [];
            }
        }
        var pl = this.plans[id];
        this.newPlan_Id.value = pl.retroname;
        this.newPlan_Desc.value = pl.retrodesc;
        this.newPlan_kltypes.value = pl.kltype;
        this.newPlan_StartDate.value = pl.startDate;
        this.newPlan_Strategy.value = JSON.stringify(pl.strategy);
        if (pl.stocks && pl.stocks.length > 0) {
            this.newPlan_Stocks.value = pl.stocks.join(',');
        }
    }

    addCurrentRetroPlan() {
        if (this.newPlan_Id.value == '') {
            return;
        }

        var id = this.newPlan_Id.value;
        var pl = this.plans.find(p => p.retroname == id);
        var addNew = false;
        if (!pl) {
            pl = new RetroPlan(this.newPlan_Id.value);
            this.plans.push(pl);
            this.savePlanNames();
            addNew = true;
        }

        pl.retrodesc = this.newPlan_Desc.value;
        pl.kltype = this.newPlan_kltypes.value;
        pl.startDate = this.newPlan_StartDate.value;
        pl.strategy = JSON.parse(this.newPlan_Strategy.value);
        var stkval = this.newPlan_Stocks.value.trim();
        if (stkval != '' || (pl.stocks && pl.stocks.join(',') != stkval)) {
            pl.stocks = stkval.length > 0 ? stkval.split(',') : [];
        }
        pl.save();
        if (addNew) {
            this.showPlanItems();
            this.plansListPanel.lastElementChild.click();
        }
    }

    initControlBoxPanel() {
        var btnPrepareRetro = document.createElement('button');
        btnPrepareRetro.textContent = '准备';
        btnPrepareRetro.onclick = e => {
            this.prepareRetro();
        }
        this.topControlBox.appendChild(btnPrepareRetro);

        var btnDoRetro = document.createElement('button');
        btnDoRetro.textContent = '执行';
        btnDoRetro.onclick = e => {
            this.doRetro();
        }
        this.topControlBox.appendChild(btnDoRetro);

        var btnShowResults = document.createElement('button');
        btnShowResults.textContent = '成交记录';
        btnShowResults.onclick = e => {
            if (this.selectedPlid === undefined || this.selectedPlid == -1 || !this.plans[this.selectedPlid]) {
                return;
            }

            this.showDeals(this.plans[this.selectedPlid]);
        }
        this.topControlBox.appendChild(btnShowResults);

        var btnComparePlans = document.createElement('button');
        btnComparePlans.textContent = '统计对比';
        btnComparePlans.onclick = e => {
            this.showStatsTable();
        }
        this.topControlBox.appendChild(btnComparePlans);
    }

    prepareRetro() {
        if (this.selectedPlid === undefined || this.selectedPlid == -1) {
            return;
        }

        this.plans[this.selectedPlid].retroPrepare();
    }

    doRetro() {
        if (this.selectedPlid === undefined || this.selectedPlid == -1) {
            return;
        }

        this.plans[this.selectedPlid].retro();
    }

    savePlanNames() {
        var retros = [];
        this.plans.forEach(pl => {
            retros.push(pl.retroname);
        });
        emjyBack.saveToLocal({'retro_plans': retros});
    }

    removePlans(names) {
        var resPlans = [];
        while (this.plans.length > 0) {
            var pl = this.plans.shift();
            if (names.find(n => n == pl.retroname)) {
                pl.removeAll();
                continue;
            }
            resPlans.push(pl);
        }

        this.plans = resPlans;
        this.savePlanNames();
        this.showPlanItems();
    }

    addDealsOf(allDeals, code, full) {
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
            if (full) {
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
            }
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
            if (resCount == 0) {
                if (full) {
                    this.dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
                }
                partEarned = 0;
                partCost = 0;
            }
        }
        totalEarned += emjyBack.getCurrentHoldValue(code, resCount); // filtered.values().next().value
        if (resCount == 0) {
            this.dealsTable.addRow('total', code, '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        } else {
            this.dealsTable.addRow('total', code, '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), '-');
        }
        return {cost: totalCost, earn: totalEarned, fee: totalFee};
    }

    showDeals(retroplan, ignored, filtered) {
        if (!retroplan.deals || retroplan.deals.length == 0) {
            retroplan.save();
        }

        var alldeals = retroplan.deals;
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
                var result = this.addDealsOf(alldeals, ds, false);
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
        this.dealsTable.addRow('总收益', '', '', '', totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        retroplan.setTotalEarned(totalCost, totalEarned - totalFee);
        var stats = retroplan.checkDealsStatistics();
        this.dealsTable.addRow('盈亏比', '', '', '', stats.earned.toFixed(2), '', stats.lost.toFixed(2), (stats.earned / stats.lost).toFixed(2));
        this.dealsTable.addRow('胜率', '', '', '', stats.tradeCountE, '', stats.tradeCountL, (100 * stats.tradeCountE / (stats.tradeCountL + stats.tradeCountE)).toFixed(2) + '%');
        this.dealsTable.addRow('单日最大成本', '', '', '', stats.maxSdc.toFixed(2), '', '收益率', (100 * stats.netEarned / stats.maxSdc).toFixed(2) + '%');
        this.dealsTable.addRow();
    }

    showStatsTable() {
        this.dealsTable.reset();
        this.statsTable.reset();
        this.statsTable.setClickableHeader('模拟交易', '总成本', '总收益', '总收益率', '盈亏比', '清仓次数', '盈利次数', '亏损次数', '胜率', '最大单日成本', '综合收益率');
        var showChecked = Array.from(this.plansListPanel.childNodes).find(p => p.firstElementChild.checked) !== undefined;
        this.plans.forEach((pl, idx) => {
            if (!pl.stats) {
                return;
            }
            if (showChecked && !this.plansListPanel.childNodes[idx].firstElementChild.checked) {
                return;
            }
            this.statsTable.addRow(
                pl.retroname,
                pl.stats.totalCost.toFixed(2),
                pl.stats.netEarned.toFixed(2),
                (100 * (pl.stats.netEarned / pl.stats.totalCost)).toFixed(2) + '%',
                (pl.stats.earned / pl.stats.lost).toFixed(2),
                pl.stats.tradeCountL + pl.stats.tradeCountE,
                pl.stats.tradeCountE,
                pl.stats.tradeCountL,
                (100 * pl.stats.tradeCountE / (pl.stats.tradeCountL + pl.stats.tradeCountE)).toFixed(2) + '%',
                pl.stats.maxSdc.toFixed(2),
                (100 * pl.stats.netEarned / pl.stats.maxSdc).toFixed(2) + '%'
            );
        });
    }
}
