'use strict';

class localSavedViewPage extends RadioAnchorPage {
    constructor() {
        super('已存数据');
        this.klchecked = {};
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initView();
        }
    }

    initView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
        var topControl = document.createElement('div');
        topControl.style.display = 'flex';
        this.topPanel.appendChild(topControl);

        this.stkKeySelector = document.createElement('select');
        local_saved_stocks.forEach(lss => {
            this.stkKeySelector.options.add(new Option(lss.name, lss.key));
        });
        this.stkKeySelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.stkKeySelector);

        var btnDoRetro = document.createElement('button');
        btnDoRetro.textContent = '模拟交易';
        btnDoRetro.onclick = e => {
            this.doRetroStrategy();
        }
        topControl.appendChild(btnDoRetro);

        this.contentPanel = document.createElement('div');
        this.container.appendChild(this.contentPanel);

        this.viewTable = new SortableTable();
        this.contentPanel.appendChild(this.viewTable.container);
        this.onStkKeySelected();
    }

    getSavedStocks() {
        var k = this.stkKeySelector.value;
        for (var i = 0; i < local_saved_stocks.length; ++i) {
            if (local_saved_stocks[i].key == k) {
                return local_saved_stocks[i];
            }
        }
    }

    onStkKeySelected() {
        var lss = this.getSavedStocks();
        if (!lss || !lss.stocks) {
            return;
        }

        var mktstocks = lss.stocks;
        this.viewTable.reset();
        this.viewTable.setClickableHeader('日期', '代码', '名称', '上板强度', '放量程度', '建仓日期', '清仓日期', '买入价', '卖出价', '收益(%)');
        var erate = 0;
        mktstocks.forEach(s => {
            var code = s[0].substring(2);
            var date = s[1];
            var sname = emjyBack.stockAnchor(code);
            this.viewTable.addRow(date, code, sname, s[2], s[3], s[4], s[5], s[6], s[7], s[8].toFixed(2));
            erate += s[8];
            if (emjyBack.stockMarket) {
                this.prepareKlines(code, date, '101', lss.klnocheckold);
            }
        });
        console.log(erate.toFixed(4) + '%');
    }

    prepareKlines(code, sdate, kltype, klnocheckold) {
        if (this.klchecked[code] === undefined || sdate < this.klchecked[code]) {
            this.klchecked[code] = sdate;
            if (!emjyBack.klines[code]) {
                emjyBack.loadKlines(code, _ => {
                    if (!emjyBack.klines[code] || !emjyBack.klines[code].klines || !emjyBack.klines[code].klines[kltype]) {
                        emjyBack.getDailyKlineSinceMonthAgo(code, kltype, sdate);
                    } else {
                        emjyBack.checkExistingKlines(code, sdate, kltype, klnocheckold);
                    }
                });
            } else {
                emjyBack.checkExistingKlines(code, sdate, kltype, klnocheckold);
            }
        }
    }

    doRetroStrategy() {
        if (!emjyBack.retroEngine || !emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        var lss = this.getSavedStocks();
        if (!lss || !lss.stocks) {
            return;
        }

        var mktstocks = lss.stocks;
        emjyBack.retroAccount.deals = [];
        for (var i = 0; i < mktstocks.length; ++i) {
            var code = mktstocks[i][0].substring(2);
            var str = emjyBack.strategyManager.create({"key":lss.strategy,"enabled":true, 'kltype':'101'});
            if (!emjyBack.klines[code]) {
                var kltype = str.data.kltype;
                this.prepareKlines(code, mktstocks[i][1], kltype, lss.klnocheckold);
                continue;
            }
            str.data.zt0date = mktstocks[i][1];
            var strgrp = {
                "grptype":"GroupStandard",
                "strategies":{"0":str.data},
                "transfers":{"0":{"transfer":"-1"}},
                "amount":10000};
            emjyBack.retroEngine.retroStrategySingleKlt(code, strgrp, mktstocks[i][1]);
        }
        emjyBack.statsReport.showDeals(this.viewTable, emjyBack.retroAccount.deals, true);
    }
}