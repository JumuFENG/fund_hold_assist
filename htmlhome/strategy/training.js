'use strict';

class TrainingPanelPage extends RadioAnchorPage {
    constructor() {
        super('策略调优');
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initTrainingView();
        }
    }

    initTrainingView() {
        this.topPanel = document.createElement('div');
        this.topPanel.style.display = 'flex';
        this.container.appendChild(this.topPanel);

        this.codeIpt = document.createElement('input');
        this.codeIpt.placeholder = '股票代码';
        this.codeIpt.style.maxWidth = 85;
        this.topPanel.appendChild(this.codeIpt);

        this.strSel = document.createElement('select');
        for (var i = 0; i < ComplexStrategyKeyNames.length; i++) {
            this.strSel.appendChild(new Option(ComplexStrategyKeyNames[i].name, ComplexStrategyKeyNames[i].key));
        }
        this.strSel.selectedIndex = -1;
        this.strSel.onchange = e=> {
            if (!this.codeIpt.value) {
                this.strSel.selectedIndex = -1;
                return;
            }
            this.trainingStrategy(this.codeIpt.value, this.strSel.value);
        }
        this.topPanel.appendChild(this.strSel);

        var btnStart = document.createElement('button');
        btnStart.textContent = '开始';
        btnStart.onclick = e => {
            if (this.codeIpt.value && this.strSel.selectedIndex != -1) {
                this.trainingStrategy(this.codeIpt.value, this.strSel.value);
            }
        }
        this.topPanel.appendChild(btnStart);

        var btnListDeals = document.createElement('button');
        btnListDeals.textContent = '成交记录';
        btnListDeals.onclick = e => {
            this.listRetroDeals();
        }
        this.topPanel.appendChild(btnListDeals);

        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
    }

    trainingStrategy(code, strname) {
        if (!emjyBack.retroEngine || !emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        emjyBack.retroAccount.deals = [];
        var str = {
            "grptype":"GroupStandard",
            "strategies":{"0":{"key":strname,"enabled":true, 'kltype':'101'}},
            "transfers":{"0":{"transfer":"-1"}},
            "amount":10000};
        emjyBack.retroEngine.retroStrategySingleKlt(code, str);
    }

    listRetroDeals() {
        if (!emjyBack.retroAccount || !emjyBack.retroAccount.deals || emjyBack.retroAccount.deals.length == 0) {
            return;
        }

        emjyBack.statsReport.showDeals(this.dealsTable, emjyBack.retroAccount.deals, true)
    }
}
