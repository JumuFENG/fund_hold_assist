'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停一览');
        this.zt1KeyWords = {'zt1' : '今日首板', 'zt1_1': '首板一字涨停', 'dzt': '昨跌停今涨停', 'maconv': 'MA收敛突破', 'ust': '摘星摘帽'};
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
                if (this.candidatesArea.filteredStks && this.candidatesArea.filteredStks.size > 0) {
                    this.candidatesArea.filteredStks.clear();
                }
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

    getZtdztStocks() {
        var dztUrl = emjyBack.fha.server + 'stock?act=pickup&key=dzt&date=' + this.ztdata.date;
        utils.get(dztUrl, null, dzt => {
            this.dztstocks = JSON.parse(dzt);
            if (this.dztstocks.length > 0) {
                this.showDztTable();
            }
        });
    }

    getMaConvStocks() {
        var mcUrl = emjyBack.fha.server + 'stock?act=pickup&key=maconv';
        utils.get(mcUrl, null, mc => {
            this.maconvstocks = JSON.parse(mc);
            if (this.maconvstocks.length > 0) {
                this.showMaConvTable();
            }
        })
    }

    getUstStocks() {
        var ustUrl = emjyBack.fha.server + 'stock?act=pickup&key=ust';
        utils.get(ustUrl, null, mc => {
            this.ustStocks = JSON.parse(mc);
            if (this.ustStocks.length > 0) {
                this.showUstTable();
            }
        })
    }

    showZtTable(skey) {
        if (skey === undefined) {
            skey = 'zt1';
        }
        if (!this.ztdata || !this.ztTable) {
            return;
        }
        if (skey == 'dzt') {
            this.showDztTable();
            return;
        }
        if (skey == 'maconv') {
            this.showMaConvTable();
            return;
        }
        if (skey == 'ust') {
            this.showUstTable();
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
            var sel = this.createSelCheckbox(code);
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

    createSelCheckbox(code) {
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
        return sel;
    }

    showDztTable() {
        this.ztTable.reset();
        this.candidatesArea.textContent = '';
        this.ztTable.setClickableHeader('序号', '日期', '名称(代码)', '昨跌幅', '今涨幅', '');
        if (!this.dztstocks) {
            this.getZtdztStocks();
            return;
        }

        var n = 1;
        for (var i = 0; i < this.dztstocks.length; ++i) {
            var stocki = this.dztstocks[i];
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            this.ztTable.addRow(
                n++,
                stocki[3],
                anchor,
                stocki[2],
                stocki[4],
                sel
            );
        }
    }

    showMaConvTable() {
        this.ztTable.reset();
        this.candidatesArea.textContent = '';
        this.ztTable.setClickableHeader('序号', '日期', '名称(代码)', '');
        if (!this.maconvstocks) {
            this.getMaConvStocks();
            return;
        }

        var n = 1;
        for (var i = 0; i < this.maconvstocks.length; ++i) {
            var stocki = this.maconvstocks[i];
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            this.ztTable.addRow(
                n++,
                stocki[1],
                anchor,
                sel
            );
        }
    }

    showUstTable() {
        this.ztTable.reset();
        this.candidatesArea.textContent = '';
        this.ztTable.setClickableHeader('序号', '名称(代码)', '申请日期', '摘帽/星日期', '公告', '');
        if (!this.ustStocks) {
            this.getUstStocks();
            return;
        }

        var n = 1;
        for (const stocki of this.ustStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            this.ztTable.addRow(
                n++,
                anchor,
                stocki[2] ? stocki[2] : stocki[1],
                stocki[4] ? stocki[4] : (stocki[3] ? stocki[3] : ''),
                emjyBack.stockNoticeAnchor(code),
                sel
            )
        }
    }

    createStrategyFor(code, skey) {
        var date = this.candidatesArea.date;
        var strategy = undefined;
        if (skey == 'dzt') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyBuy","enabled":true, 'bway':'lg', 'rate0':0.03, 'rate1':-0.05}).data;
        } else if (skey == 'zt1_1') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyZt1","enabled":false,'kltype':'101',zt0date:date}).data;
        } else if (skey == 'maconv') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyBuyMA","enabled":false,'kltype':'101'}).data;
        }

        if (strategy === undefined) {
            return
        }

        var strategies = {"0":strategy}
        var transfers = {"0":{"transfer":"-1"}};
        var gmeta = {};
        if (skey == 'dzt') {
            strategies['1'] = {"key":"StrategySellELS","enabled":false,"cutselltype":"single"};
            transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}};
            gmeta = {"setguard": true, "guardid": "1", "settop": true};
        } else if (skey == 'maconv') {
            strategies['1'] = {"key":"StrategySellMA","enabled":false,"cutselltype":"single"};
            strategies['2'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
            transfers = {"0":{"transfer":"1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};
        }

        var strgrp = {"grptype":"GroupStandard", strategies, transfers, gmeta, "amount":10000};
        if (emjyBack.klines[code]) {
            var kl = emjyBack.klines[c].getLatestKline('101');
            if (kl) {
                strgrp['count0'] = Math.ceil(100/kl.c) * 100;
            }
        }
        return strgrp;
    }

    setStrategyForSelected() {
        this.candidatesArea.textContent = '';
        var skey = this.zt1Selector.value;
        if (skey == 'zt1' || !this.candidatesArea.filteredStks || this.candidatesArea.filteredStks.size == 0) {
            return;
        }
        var candidatesObj = {};
        this.candidatesArea.filteredStks.forEach(c => {
            candidatesObj[c] = this.createStrategyFor(c, skey);
        })
        this.candidatesArea.textContent = JSON.stringify(candidatesObj, null, 1);
    }

    showZt1Table() {
        if (!this.zt1stocks || !this.zt1Table) {
            return;
        }

        this.zt1Table.reset();
        this.zt1Table.setClickableHeader('序号', '日期', '名称(代码)', '上板强度', '放量程度');
        for (var i = 0; i < this.zt1stocks.length; i++) {
            var zti = this.zt1stocks[i];
            var anchor = emjyBack.stockAnchor(zti[0].substring(2));
            this.zt1Table.addRow(i, zti[1], anchor, zti[2], zti[3]);
        }
    }
}
