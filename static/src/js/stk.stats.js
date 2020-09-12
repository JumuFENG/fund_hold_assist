class EarnedChart {
    constructor(chart_div) {
        this.container = chart_div;
        this.data = null;
    }

    initialize() {
        this.chartDiv = document.createElement('div');
        this.container.appendChild(this.chartDiv);
        this.chart = new google.visualization.ComboChart(this.chartDiv);
        this.createChartOption();
    }

    days_of_latest_year(earnedArr) {
        var firstDays = utils.first_day_of_same_yr_by_delta(earnedArr[earnedArr.length - 1].dt);
        var days = 0;
        for (var i = 0; i < earnedArr.length; i++) {
            if (earnedArr[i].dt >= firstDays) {
                days ++;
            };
        };
        return days;
    }

    createChartOption() {
        this.options = {
            title: '日收益 & 累计收益',
            legend: { position: 'top' },
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                    
                },
                1: {
                }
            },
            seriesType: 'bars',
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    type: 'line',
                    targetAxisIndex: 1
                }
            }
        };
    }

    createDataTable(earnedJson, days = 0) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        data.addColumn('number', '日收益');
        data.addColumn({type: 'string', role: 'style'});
        data.addColumn('number', '累计');
        var rows = [];
        var total_earned = earnedJson.tot;
        var startIdx = 0;
        var earnedArr = earnedJson.e_a;
        if (earnedArr.length > days) {
            for (var i = 0; i < earnedArr.length; i++) {
                startIdx++;
                if (startIdx + days >= length) {
                    break;
                };
                total_earned += earnedArr[startIdx].ed;
            };
        }
        for (var i = startIdx; i < earnedArr.length; i++) {
            var ptClr = '';
            if (earnedArr[i].ed < 0) {
                ptClr = 'green';
            };
            rows.push([utils.date_by_delta(earnedArr[i].dt), earnedArr[i].ed, ptClr, total_earned]);
            if (i + 1 < earnedArr.length) {
                total_earned += earnedArr[i+1].ed;
            };
        };
        data.addRows(rows);
        this.data = data;
    }

    updateEarned(earnedJson, days) {
        if (!googleChartLoaded) {
            utils.logInfo('google chart not initialized!');
            return;
        };

        if (earnedJson === undefined) {
            return;
        };

        var dates = days;
        if (days < 0) {
            dates = earnedJson.e_a.length;
        } else if (days == 0) {
            dates = this.days_of_latest_year(earnedJson.e_a);
        };

        this.createDataTable(earnedJson, dates);
        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
    }
}

class StockStats {
    constructor() {
        this.container = null;
        this.earningContainer = null;
        this.statsJson = null;
        this.earnedJson = null;
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

    setEarnedByDate(dt, m) {
        var fd = new FormData();
        fd.append('act', 'setearned');
        fd.append('date', dt);
        fd.append('earned', m);

        utils.post('stock', fd, function(that){
            if (that.earnedJson && !utils.isEmpty(that.earnedJson)) {
                that.earnedJson.e_a.push({dt:utils.days_since_2000(dt), ed:parseFloat(m)});
            };
            that.updateEarnedChart();
        }, this);
    }

    getEarnedJson(days = 30) {
        utils.get('stock', 'act=getearned&days=' + days, function(that, rsp){
            that.earnedJson = JSON.parse(rsp);
            that.updateEarnedChart();
        }, this);
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:stockHub.stockStats.backToList()';
        this.container.appendChild(backLink);

        this.earningContainer = document.createElement('div');
        this.container.appendChild(this.earningContainer);
        this.earningContainer.appendChild(document.createTextNode('当日盈亏:'));
        var earningDate = document.createElement('input');
        earningDate.type = 'date';
        earningDate.value = utils.getTodayDate();
        this.earningContainer.appendChild(earningDate);
        var earningInput = document.createElement('input');
        earningInput.placeholder = '金额';
        this.earningContainer.appendChild(earningInput);

        var okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.that = this;
        okBtn.onclick = function(e) {
            e.target.that.setEarnedByDate(earningDate.value, earningInput.value);
        };
        this.earningContainer.appendChild(okBtn);

        var earningChartDiv = document.createElement('div');
        this.earningContainer.appendChild(earningChartDiv);

        this.earnedDaysBar = new RadioAnchorBar();
        this.earnedDaysBar.addRadio('30', function(that){
            that.getEarnedJson(30);
            that.earnedDaysBar.days = 30;
        }, this);
        this.earnedDaysBar.addRadio('60', function(that){
            that.getEarnedJson(60);
            that.earnedDaysBar.days = 60;
        }, this);
        this.earnedDaysBar.addRadio('90', function(that){
            that.getEarnedJson(90);
            that.earnedDaysBar.days = 90;
        }, this);
        this.earnedDaysBar.addRadio('200', function(that){
            that.getEarnedJson(200);
            that.earnedDaysBar.days = 200;
        }, this);
        this.earnedDaysBar.addRadio('当年', function(that){
            that.getEarnedJson(0);
            that.earnedDaysBar.days = 0;
        }, this);
        this.earnedDaysBar.addRadio('全部', function(that){
            that.getEarnedJson(-1);
            that.earnedDaysBar.days = -1;
        }, this);

        earningChartDiv.appendChild(this.earnedDaysBar.container);

        var chart_div = document.createElement('div');
        earningChartDiv.appendChild(chart_div);
        this.earnedChart = new EarnedChart(chart_div);
        this.earnedChart.initialize();
        if (!this.earnedJson) {
            this.updateEarnedChart();
        };
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
        this.statsTable.setColOffset(1);
        this.statsTable.setClickableHeader('成本', '收益', '总成本', '总额', '次数', '次均', '总', '次均(%)', '标准(%)');
        for (var i in this.statsJson) {
            this.statsTable.addRow(
                this.statsJson[i].name,
                this.statsJson[i].cost,
                this.statsJson[i].ewh,
                parseFloat(this.statsJson[i].cs.toFixed(2)),
                parseFloat(this.statsJson[i].ms.toFixed(2)),
                this.statsJson[i].srct,
                parseFloat(this.statsJson[i].perTimeCostSold.toFixed(2)),
                parseFloat(this.statsJson[i].earned.toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * 100).toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * this.statsJson[i].srct * 100).toFixed(2)));
        };
        this.statsTable.addRow('总计', cost, ewh.toFixed(2), cs.toFixed(2), ms.toFixed(2), '-', '-', earned.toFixed(2), (100 * earned / (cost + cs)).toFixed(2), '-');
    }

    updateEarnedChart() {
        if (!this.earnedJson || utils.isEmpty(this.earnedJson)) {
            this.earnedDaysBar.selectDefault();
        } else {
            this.earnedChart.updateEarned(this.earnedJson, this.earnedDaysBar.days);
        };
    }
}
