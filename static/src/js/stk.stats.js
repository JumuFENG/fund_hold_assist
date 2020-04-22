class StockStats {
    constructor() {
        this.container = null;
        this.statsJson = null;
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:stockHub.stockStats.backToList()';
        this.container.appendChild(backLink);
    }

    backToList() {
        this.container.style.display = 'none';
        stockHub.show();
    }

    getStockStats() {
        utils.get('stock', 'act=stats', function(that, rsp){
            that.statsJson = JSON.parse(rsp);
            that.showStockStats();
        }, this);
    }

    showStockStats() {
        if (!this.statsJson) {
            return;
        };

        var cost = 0, ewh = 0, cs = 0, ms = 0, earned = 0;
        for (var i in this.statsJson) {
            var code = i;
            if (stockRtData[code] && stockRtData[code].rtprice) {
                this.statsJson[i].ewh = parseFloat((all_stocks[code].ptn * (stockRtData[code].rtprice - all_stocks[code].avp)).toFixed(2));
            } else {
                this.statsJson[i].ewh = 0;
            }
            cost += this.statsJson[i].cost;
            ewh += this.statsJson[i].ewh;
            cs += this.statsJson[i].cs;
            ms += this.statsJson[i].ms;
            this.statsJson[i].earned = this.statsJson[i].ms - this.statsJson[i].cs + this.statsJson[i].ewh;
            earned += this.statsJson[i].earned;
            this.statsJson[i].perTimeCostSold = (this.statsJson[i].cost + this.statsJson[i].cs) / this.statsJson[i].srct
            this.statsJson[i].earnedRate = this.statsJson[i].earned / (this.statsJson[i].cost + this.statsJson[i].cs);
        };
        
        if (!this.statsTable) {
            this.statsTable = new SortableTable(2, 1);
            this.container.appendChild(this.statsTable.container);
        };
        
        this.statsTable.reset();
        this.statsTable.setSpanHeader({'name':'名称', row:2}, {'name':'持有信息', col:2}, {'name':'售出信息', col:4}, {'name':'收益'}, {'name':'收益率', col:2});
        this.statsTable.setClickableHeader('成本', '收益', '总成本', '总额', '次数', '次均', '总', '次均(%)', '标准(%)');
        this.statsTable.setColOffset(1);
        for (var i in this.statsJson) {
            this.statsTable.addRow(
                this.statsJson[i].name,
                this.statsJson[i].cost,
                this.statsJson[i].ewh,
                this.statsJson[i].cs,
                parseFloat(this.statsJson[i].ms.toFixed(2)),
                this.statsJson[i].srct,
                parseFloat(this.statsJson[i].perTimeCostSold.toFixed(2)),
                parseFloat(this.statsJson[i].earned.toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * 100).toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * this.statsJson[i].srct * 100).toFixed(2)));
        };
        this.statsTable.addRow('总计', cost, ewh.toFixed(2), cs, ms.toFixed(2), '-', '-', earned.toFixed(2), (100 * earned / (cost + cs)).toFixed(2), '-');
    }
}
