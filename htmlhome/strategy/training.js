'use strict';

class TrainingPanelPage extends RadioAnchorPage {
    constructor() {
        super('策略调优');
        this.trainingStats = [];
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initTrainingView();
        }
    }

    initTrainingView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
        var topControl = document.createElement('div');
        topControl.style.display = 'flex';
        this.topPanel.appendChild(topControl);

        this.codeIpt = document.createElement('input');
        this.codeIpt.placeholder = '股票代码';
        this.codeIpt.style.maxWidth = 85;
        topControl.appendChild(this.codeIpt);

        this.strSel = document.createElement('select');
        for (var i = 0; i < ComplexStrategyKeyNames.length; i++) {
            this.strSel.appendChild(new Option(ComplexStrategyKeyNames[i].name, ComplexStrategyKeyNames[i].key));
        }
        this.strSel.selectedIndex = -1;
        this.strSel.onchange = e=> {
            if (this.strSel.selectedIndex != -1) {
                this.layoutStrategyConfig(this.strSel.value);
            }
            if (this.codeIpt.value) {
                emjyBack.loadKlines(this.codeIpt.value);
            }
        }
        topControl.appendChild(this.strSel);

        var btnStart = document.createElement('button');
        btnStart.textContent = '开始';
        btnStart.onclick = e => {
            if (this.codeIpt.value && this.strSel.selectedIndex != -1) {
                this.startTraining(this.codeIpt.value, this.strSel.value);
            }
        }
        topControl.appendChild(btnStart);

        var btnListStats = document.createElement('button');
        btnListStats.textContent = '统计结果';
        btnListStats.onclick = e => {
            this.listTrainingStats();
        }
        topControl.appendChild(btnListStats);

        var btnShowDeals = document.createElement('button');
        btnShowDeals.textContent = '成交记录';
        btnShowDeals.onclick = e => {
            this.listRetroDeals();
        }
        topControl.appendChild(btnShowDeals);

        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
    }

    layoutStrategyConfig(strname) {
        if (!this.topStrCtrl) {
            this.topStrCtrl = document.createElement('div');
            this.topPanel.appendChild(this.topStrCtrl);
        }
        utils.removeAllChild(this.topStrCtrl);
        this.topStrCtrl.cfgRows = [];

        var str = emjyBack.strategyManager.create({"key":strname,"enabled":true, 'kltype':'101'});
        var cfg = str.getconfig();
        var createCfgDiv = function(val) {//valmin, valmax, valstep
            var ipt = document.createElement('input');
            ipt.value = val;
            ipt.style.width = 50;
            ipt.style.margin = 2;
            return ipt;
        }
        var createLabelDiv = function(text, width) {
            var d = document.createElement('div');
            d.textContent = text;
            d.style.width = width;
            return d;
        }
        var tdiv = document.createElement('div');
        tdiv.style.display = 'flex';
        tdiv.appendChild(createLabelDiv('', 70));
        tdiv.appendChild(createLabelDiv('最小', 50));
        tdiv.appendChild(createLabelDiv('最大', 50));
        tdiv.appendChild(createLabelDiv('增幅', 50));
        this.topStrCtrl.appendChild(tdiv);
        for (var k in cfg) {
            var cfg0 = cfg[k];
            var kdiv = document.createElement('div');
            kdiv.cfgName = k;
            kdiv.style.display = 'flex';
            kdiv.appendChild(createLabelDiv(k, 70));
            kdiv.minIpt = createCfgDiv(cfg0.min);
            kdiv.appendChild(kdiv.minIpt);
            kdiv.maxIpt = createCfgDiv(cfg0.max);
            kdiv.appendChild(kdiv.maxIpt);
            kdiv.stepIpt = createCfgDiv(cfg0.step);
            kdiv.appendChild(kdiv.stepIpt);

            this.topStrCtrl.appendChild(kdiv);
            this.topStrCtrl.cfgRows.push(kdiv);
        }
    }

    getStrategyConfig() {
        if (!this.topStrCtrl) {
            return {};
        }

        var cfg = {};
        this.topStrCtrl.cfgRows.forEach(xk => {
            var min = xk.minIpt.value;
            var max = xk.maxIpt.value;
            var step = xk.stepIpt.value;
            cfg[xk.cfgName] = {min, max, step}
        });
        return cfg;
    }

    startTraining(code, strname) {
        if (!emjyBack.retroEngine || !emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        if (this.trainingStats.length > 0 && this.trainingStats[this.trainingStats.length - 1].length == 2) {
            this.trainingStats = [];
        }
        var str = emjyBack.strategyManager.create({"key":strname,"enabled":true, 'kltype':'101'});
        if (this.trainingStats.length == 0) {
            var cfg = this.getStrategyConfig();
            this.prepareStrategies(str, cfg);
        }
        emjyBack.loadKlines(code, _=> {
            this.trainingStrategy(str, code);
            this.listTrainingStats();
        });
    }

    prepareStrategies(str, cfg) {
        var keys = Object.keys(cfg);
        if (keys.length == 0) {
            var fc = str.getconfig();
            var sd = {};
            Object.keys(fc).forEach(k => {
                sd[k] = Number.isInteger(str.data[k]) || typeof(str.data[k]) === 'string' ? str.data[k] : str.data[k].toFixed(3);
            });
            this.trainingStats.push([sd]);
            return;
        }
        var k0 = keys[0];
        var cfg0 = cfg[k0];
        var remcfg = {};
        for (var k in cfg) {
            if (k == k0) {
                continue;
            }
            remcfg[k] = cfg[k];
        }
        var cfgk = {};
        for (var x = cfg0.max; x - cfg0.min >= 0; x -= cfg0.step) {
            cfgk[k0] = x;
            str.setconfig(cfgk);
            this.prepareStrategies(str, remcfg);
        }
    }

    trainingStrategy(str, code) {
        for (var i = 0; i < this.trainingStats.length; ++i) {
            if (this.trainingStats[i].length > 1) {
                continue;
            }
            var strdata = this.trainingStats[i][0];
            if (str.data.meta) {
                delete(str.data.meta);
            }
            str.setconfig(strdata);
            var strgrp = {
                "grptype":"GroupStandard",
                "strategies":{"0":str.data},
                "transfers":{"0":{"transfer":"-1"}},
                "amount":10000};
            emjyBack.retroAccount.deals = [];
            emjyBack.retroEngine.retroStrategySingleKlt(code, strgrp);
            this.trainingStats[i].push(emjyBack.statsReport.checkDealsStatistics(emjyBack.retroAccount.deals.slice(0)));
        }
    }

    listTrainingStats() {
        console.log(this.trainingStats.length);
        emjyBack.statsReport.showStrategyStats(this.dealsTable, this.trainingStats);
    }

    listRetroDeals() {
        if (!emjyBack.retroAccount || !emjyBack.retroAccount.deals || emjyBack.retroAccount.deals.length == 0) {
            return;
        }

        emjyBack.statsReport.showDeals(this.dealsTable, emjyBack.retroAccount.deals, true)
    }
}
