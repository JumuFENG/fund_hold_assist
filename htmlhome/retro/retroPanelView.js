'use strict';

class RetroPanelPage extends RadioAnchorPage {
    constructor() {
        super('回测');
    }

    show() {
        super.show();
        if (this.retroEngine === undefined) {
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

        var btnMaxDayCost = document.createElement('button');
        btnMaxDayCost.textContent = '执行';
        btnMaxDayCost.onclick = e => {
            this.doRetro();
        }
        this.container.appendChild(btnMaxDayCost);

        var btnSavePlan = document.createElement('button');
        btnSavePlan.textContent = '保存';
        btnSavePlan.onclick = e => {
            this.savePlan();
        }
        this.container.appendChild(btnSavePlan);

        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
    }

    initRetroPlan() {
        if (!this.retroPlan) {
            this.retroPlan = new RetroPlan('strategyMA');
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
}
