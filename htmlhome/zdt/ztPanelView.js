'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停一览');
    }

    show() {
        super.show();
        this.container.style.display = 'flex';
        if (this.ztTable === undefined) {
            this.container.style = 'display: flex; flex-direction: row; height: 100%;';

            this.leftPanel = document.createElement('div');
            this.leftPanel.style.width = '33%';
            this.container.appendChild(this.leftPanel);
            this.ztTable = new SortableTable();
            this.leftPanel.appendChild(document.createTextNode('今日首板'));
            this.leftPanel.appendChild(this.ztTable.container);

            this.getZTPool();

            this.contentPanel = document.createElement('div');
            this.contentPanel.style.maxWidth = '65%';
            this.container.appendChild(this.contentPanel);

            this.contentPanel.appendChild(document.createTextNode('首板次日买入'));
            var btnUpdateZt1 = document.createElement('button');
            btnUpdateZt1.textContent = '更新';
            btnUpdateZt1.onclick = e => {
                this.updateZt1Selections();
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

    updateZt1Selections() {
        var zt1Url = emjyBack.fha.server + 'stock?act=updatepickup&key=zt1';
        utils.get(zt1Url, null, r => {
            console.log(r);
            this.getZt1Stocks();
        });
    }

    showZtTable() {
        if (!this.ztdata || !this.ztTable) {
            return;
        }

        this.ztTable.reset();
        this.ztTable.setClickableHeader('序号', '日期', '名称(代码)', '板块', '涨停概念');
        var date = this.ztdata.date;
        for (var i = 0; i < this.ztdata.pool.length; i++) {
            var stocki = this.ztdata.pool[i];
            var anchor = emjyBack.stockAnchor(stocki[0].substring(2));
            this.ztTable.addRow(
                i + 1,
                date,
                anchor,
                stocki[1],
                stocki[2]
            );
        }
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