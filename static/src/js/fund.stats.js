class FundStats {
    constructor() {
        this.container = null;
        this.statsJson = null;
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:fundstats.backToList()';
        this.container.appendChild(backLink);

        this.container.appendChild(document.createTextNode(' '));

        var getAllLink = document.createElement('a');
        getAllLink.textContent = '全部关联账户';
        getAllLink.href = 'javascript:fundstats.getFundStats(false)';
        this.container.appendChild(getAllLink);
    }

    backToList () {
        this.container.style.display = 'none';
        fundSummary.show();
    }

    getFundStats(curAccount = true) {
        utils.get('fundmisc', 'action=' + (curAccount ? 'fundstats':'allfundstats'), function(rsp){
            fundstats.statsJson = JSON.parse(rsp);
            fundstats.showFundStats();
        });
    }

    showFundStats() {
        if (!this.statsJson) {
            return;
        };

        var cost = 0, ewh = 0, cs = 0, acs = 0, earned = 0;
        for (var i in this.statsJson) {
            cost += this.statsJson[i].cost;
            ewh += this.statsJson[i].ewh;
            cs += this.statsJson[i].cs;
            acs += this.statsJson[i].acs;
            this.statsJson[i].earned = this.statsJson[i].acs - this.statsJson[i].cs + this.statsJson[i].ewh;
            this.statsJson[i].perDayEarned = this.statsJson[i].earned / this.statsJson[i].hds;
            earned += this.statsJson[i].earned;
            this.statsJson[i].perTimeCostSold = (this.statsJson[i].cost + this.statsJson[i].cs) / this.statsJson[i].srct
            this.statsJson[i].earnedRate = this.statsJson[i].earned / (this.statsJson[i].cost + this.statsJson[i].cs);
            this.statsJson[i].perDayEarnedRate = this.statsJson[i].earnedRate / this.statsJson[i].hds;
        };
        
        if (!this.statsTable) {
            this.statsTable = new SortableTable(2, 1);
            this.container.appendChild(this.statsTable.container);
        };
        
        this.statsTable.reset();

        this.statsTable.setSpanHeader({'name':'基金名称', row:2}, {'name':'持有信息', col:3}, {'name':'售出信息', col:4}, {'name':'收益', col:2}, {'name':'收益率', col:3});
        this.statsTable.setColOffset(1);
        this.statsTable.setClickableHeader('成本', '收益', '天数', '总成本', '总额', '次数', '次均', '总', '日均', '次均(%)', '标准(%)', '日均(‱)');
        for (var i in this.statsJson) {
            this.statsTable.addRow(
                this.statsJson[i].name,
                this.statsJson[i].cost,
                this.statsJson[i].ewh,
                this.statsJson[i].hds,
                this.statsJson[i].cs,
                parseFloat(this.statsJson[i].acs.toFixed(2)),
                this.statsJson[i].srct,
                parseFloat(this.statsJson[i].perTimeCostSold.toFixed(2)),
                parseFloat(this.statsJson[i].earned.toFixed(2)),
                parseFloat(this.statsJson[i].perDayEarned.toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * 100).toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * this.statsJson[i].srct * 100).toFixed(2)),
                parseFloat((this.statsJson[i].perDayEarnedRate * 10000).toFixed(2)));
        };
        this.statsTable.addRow('总计', cost, ewh.toFixed(2), '-', cs, acs.toFixed(2), '-', '-', earned.toFixed(2), '-', (100 * earned / (cost + cs)).toFixed(2), '-', '-');
    }
}

var fundstats = null; 
