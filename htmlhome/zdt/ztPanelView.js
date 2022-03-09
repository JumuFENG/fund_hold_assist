'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停一览');
        this.getZTPool();
    }

    show() {
        super.show();
        if (this.ztTable === undefined) {
            this.ztTable = new SortableTable();
            this.container.appendChild(this.ztTable.container);
        }

        this.showZtTable();
    }

    getZTPool() {
        var ztUrl = emjyBack.fhaserver + 'api/stockzthist';
        utils.get(ztUrl, zt => {
            this.ztdata = JSON.parse(zt);
            this.showZtTable();
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
}