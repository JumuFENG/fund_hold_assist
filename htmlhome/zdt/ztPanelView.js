'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停一览');
        this.zt1KeyWords = {'zt1' : '今日首板', 'zt1_1': '首板一字涨停'};
    }

    show() {
        super.show();
        this.container.style.display = 'flex';
        if (this.ztTable === undefined) {
            this.container.style = 'display: flex; flex-direction: row; height: 100%;';

            this.leftPanel = document.createElement('div');
            this.leftPanel.style.width = '33%';
            this.container.appendChild(this.leftPanel);
            this.zt1Selector = document.createElement('select');
            for (var k in  this.zt1KeyWords) {
                this.zt1Selector.options.add(new Option(this.zt1KeyWords[k], k));
            };
            this.zt1Selector.onchange = e => {
                this.showZtTable(this.zt1Selector.value);
            }
            this.ztTable = new SortableTable();
            this.leftPanel.appendChild(this.zt1Selector);
            this.leftPanel.appendChild(this.ztTable.container);

            var btnExportChecked = document.createElement('button');
            btnExportChecked.textContent = '导出所选';
            btnExportChecked.onclick = e => {
                this.setStrategyForSelected();
            }
            this.leftPanel.appendChild(btnExportChecked);
            this.candidatesArea = document.createElement('div');
            this.candidatesArea.style.paddingRight = 8;
            this.leftPanel.appendChild(this.candidatesArea);

            this.getZTPool();

            this.contentPanel = document.createElement('div');
            this.contentPanel.style.maxWidth = '65%';
            this.container.appendChild(this.contentPanel);

            this.contentPanel.appendChild(document.createTextNode('首板次日买入'));
            var btnUpdateZt1 = document.createElement('button');
            btnUpdateZt1.textContent = '更新';
            btnUpdateZt1.onclick = e => {
                this.updateZt1Pickups();
            }
            this.contentPanel.appendChild(btnUpdateZt1);
            this.zt1Table = new SortableTable(1, 0, false);
            this.contentPanel.appendChild(this.zt1Table.container);
            
            this.getZt1Stocks();
        }
    }

    getZTPool() {
        var ztUrl = emjyBack.fha.server + 'api/stockzthist';
        utils.get(ztUrl, null, zt => {
            this.ztdata = JSON.parse(zt);
            this.showZtTable();
        });
    }

    getZt1Stocks() {
        var zt1Url = emjyBack.fha.server + 'stock?act=pickup&key=zt1';
        utils.get(zt1Url, null, zt1 => {
            this.zt1stocks = JSON.parse(zt1);
            this.showZt1Table();
        });
    }

    updateZt1Pickups() {
        var zt1Url = emjyBack.fha.server + 'stock?act=updatepickup&key=zt1';
        utils.get(zt1Url, null, r => {
            this.getZt1Stocks();
        });
    }

    showZtTable(skey) {
        if (skey === undefined) {
            skey = 'zt1';
        }
        if (!this.ztdata || !this.ztTable) {
            return;
        }

        var zt1stock_code = function(zt1stocks, code) {
            if (!zt1stocks) {
                return;
            }

            for (var i = zt1stocks.length - 1; i >= 0 ; i--) {
                if (zt1stocks[i][0].endsWith(code)) {
                    return zt1stocks[i];
                }
            }
        }

        this.ztTable.reset();
        this.candidatesArea.textContent = '';
        this.ztTable.setClickableHeader('序号', '日期', '名称(代码)', '板块', '涨停概念', '');
        var date = this.ztdata.date;
        this.candidatesArea.date = date;
        var n = 1;
        for (var i = 0; i < this.ztdata.pool.length; i++) {
            var stocki = this.ztdata.pool[i];
            var code = stocki[0].substring(2);
            var ztinfo = zt1stock_code(this.zt1stocks, code);
            if (skey == 'zt1_1') {
                // 首板一字涨停
                if (ztinfo && (ztinfo[2] != 0 || ztinfo[1] != date)) {
                    continue;
                }
            }
            if (skey == 'zt1') {
                // 首板
                if (ztinfo && ztinfo[1] != date) {
                    continue;
                }
            }
            var anchor = emjyBack.stockAnchor(code);
            var sel = document.createElement('input');
            sel.type = 'checkbox';
            sel.code = code;
            sel.onchange = e => {
                if (e.target.checked) {
                    if (!this.candidatesArea.filteredStks) {
                        this.candidatesArea.filteredStks = new Set();
                    }
                    this.candidatesArea.filteredStks.add(e.target.code);
                } else {
                    if (this.candidatesArea.filteredStks) {
                        this.candidatesArea.filteredStks.delete(e.target.code);
                    }
                }
            }
            this.ztTable.addRow(
                n++,
                date,
                anchor,
                stocki[1],
                stocki[2],
                sel
            );
        }
    }

    setStrategyForSelected() {
        this.candidatesArea.textContent = '';
        var skey = this.zt1Selector.value;
        if (skey == 'zt1' || !this.candidatesArea.filteredStks || this.candidatesArea.filteredStks.size == 0) {
            return;
        }
        var candidatesObj = {};
        var date = this.candidatesArea.date;
        if (skey == 'zt1_1') {
            this.candidatesArea.filteredStks.forEach(c => {
                var strategy = emjyBack.strategyManager.create({"key":"StrategyZt1","enabled":false,'kltype':'101',zt0date:date}).data;
                var strgrp = {
                    "grptype":"GroupStandard",
                    "strategies":{"0":strategy},
                    "transfers":{"0":{"transfer":"-1"}},
                    "amount":10000
                }
                if (emjyBack.klines[c]) {
                    var kl = emjyBack.klines[c].getLatestKline('101');
                    if (kl) {
                        strgrp['count0'] = Math.ceil(100/kl.c) * 100;
                    }
                }
                candidatesObj[c] = strgrp;
            })
        }
        this.candidatesArea.textContent = JSON.stringify(candidatesObj, null, 1);
    }

    showZt1Table() {
        if (!this.zt1stocks || !this.zt1Table) {
            return;
        }

        this.zt1Table.reset();
        this.zt1Table.setClickableHeader('序号', '日期', '名称(代码)', '上板强度', '放量程度', '建仓日期', '实盘', '买卖记录');
        for (var i = 0; i < this.zt1stocks.length; i++) {
            var zti = this.zt1stocks[i];
            var anchor = emjyBack.stockAnchor(zti[0].substring(2));
            var traderecs = JSON.parse(zti[4]);
            this.zt1Table.addRow(i, zti[1], anchor, zti[2], zti[3], traderecs && traderecs.length > 0 ? traderecs[0].date : '', zti[5]?'是':'否', zti[4]);
        }
    }
}
