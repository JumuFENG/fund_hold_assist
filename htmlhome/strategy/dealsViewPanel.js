'use strict';

class DealsEarningLineChart {
    constructor(cont, title) {
        this.container = cont;
        this.option = {
            legend: {
                left: 'right'
            },
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'}},
            title: {text: title, left: 'center', textStyle: {color: 'rgb(133, 146, 232)'}},
            grid: [{left: '10%', right: '8%', height: '60%'}, {left: '10%', right: '8%', top: '75%', height: '15%'}],
            xAxis: [
                {type: 'category', axisLabel: {show: true}},
                {type: 'category', gridIndex: 1, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }}
            ],
            axisPointer: {link: {xAxisIndex: 'all'}},
            yAxis: [
                {scale: true},
                {scale: true, gridIndex: 1, axisTick: { show: false }, axisLabel: { show: false }}
            ]
        }
    }

    showDealsByTime(deals) {
        var sortdeals = deals.sort((a,b) => {
            if (a.time == b.time) {
                return a.code > b.code;
            }
            return a.time > b.time;
        });
        var earnings = [];
        var accountStocks = {};
        for (const d of sortdeals) {
            if (d.tradeType == 'B') {
                if (!accountStocks[d.code]) {
                    accountStocks[d.code] = {count: 0, cost: 0, amount: 0};
                }
                accountStocks[d.code].count += d.count;
                accountStocks[d.code].cost += d.price * d.count
                var fee = -(-d.fee - d.feeGh - d.feeYh);
                if (isNaN(fee)) {
                    fee = 0;
                }
                accountStocks[d.code].cost += fee;
            } else {
                if (!accountStocks[d.code] || accountStocks[d.code].count < d.count) {
                    console.error('error sell deal', d);
                    continue;
                }
                accountStocks[d.code].count -= d.count;
                var amount = d.price * d.count;
                var fee = -(-d.fee - d.feeGh - d.feeYh);
                if (isNaN(fee)) {
                    fee = 0;
                }
                amount -= fee;
                if (accountStocks[d.code].count == 0) {
                    earnings.push({code: d.code, time: d.time, earn: amount + accountStocks[d.code].amount - accountStocks[d.code].cost});
                    accountStocks[d.code].amount = 0;
                    accountStocks[d.code].cost = 0;
                } else {
                    accountStocks[d.code].amount += amount;
                }
            }
        }
        var dailyEarning = [];
        for (const er of earnings) {
            if (dailyEarning.length == 0 || er.time != dailyEarning[dailyEarning.length - 1].time) {
                dailyEarning.push({time: er.time, earn: er.earn});
            } else {
                dailyEarning[dailyEarning.length - 1].earn += er.earn;
            }
        }
        var tearn = 0;
        dailyEarning.forEach(er => {
            er.earn = Math.round(er.earn, 2);
            tearn += er.earn;
            er.tearn = tearn;
        });
        console.log(dailyEarning);
        if (this.chart === undefined) {
            this.chart = echarts.init(this.container);
        }
        this.option.dataset = {source: dailyEarning};
        this.option.series = [
            {
                type: 'line', xAxisIndex: 0, yAxisIndex: 0,
                encode: {x: 'time', y: 'earn'}
            },
            {
                type: 'line', xAxisIndex: 0, yAxisIndex: 0,
                encode: {x: 'time', y: 'tearn'}
            }
        ];
        this.option.dataZoom = {
            show: true
        }
        this.chart.setOption(this.option);
    }
}

class DealsPanelPage extends RadioAnchorPage {
    constructor() {
        super('交易记录');
        this.strategyDeals = [];
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initDealsView();
        }
    }

    initDealsView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
        var topControl = document.createElement('div');
        topControl.style.display = 'flex';
        this.topPanel.appendChild(topControl);

        this.dealCategorySel = document.createElement('select');
        if (!this.dealCategories) {
            var dcUrl = emjyBack.fha.server + 'stock?act=dealcategory';
            utils.get(dcUrl, null, dt => {
                this.dealCategories = JSON.parse(dt);
                for (var i in this.dealCategories) {
                    this.dealCategorySel.appendChild(new Option(
                        this.dealCategories[i][1]?this.dealCategories[i][1]:this.dealCategories[i][0], this.dealCategories[i][0]));
                }
                this.dealCategorySel.appendChild(new Option('实盘', 'archived'));
                this.dealCategorySel.selectedIndex = -1;
            });
        }
        this.dealCategorySel.onchange = e=> {
            if (this.dealCategorySel.selectedIndex != -1) {
                this.getDealsByCategory(this.dealCategorySel.value);
                if (this.dealCategorySel.value == 'archived') {
                    this.dealsFilter.value = 'all';
                }
            }
        }
        topControl.appendChild(this.dealCategorySel);

        this.dealsFilter = document.createElement('select');
        this.dealsFilter.appendChild(new Option('全部', 'all'));
        this.dealsFilter.appendChild(new Option('<= 5', 'le5'));
        this.dealsFilter.onchange = e => {
            this.showCategoriedDeals();
        }
        topControl.appendChild(this.dealsFilter);

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

        var dealChartContainer = document.createElement('div');
        dealChartContainer.style = 'display: table; width: 100%;';
        dealChartContainer.style.height = '600';
        this.container.appendChild(dealChartContainer);
        this.dealsLineChart = new DealsEarningLineChart(dealChartContainer, '收益率趋势图');
        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
    }

    getDealsByCategory(category) {
        var dcUrl = emjyBack.fha.server + 'stock?act=trackdeals&name=' + category;
        utils.get(dcUrl, null, ds => {
            var sDeals = JSON.parse(ds);
            var deals = sDeals.deals;
            if (deals[0].count == 0) {
                var fcounts = {};
                for (var d of deals) {
                    if (d.count != 0) {
                        continue;
                    }
                    var code = d.code;
                    if (d.count == 0) {
                        if (d.tradeType == 'B') {
                            d.count = 100 * Math.round(100/d.price);
                            if (!fcounts[code]) {
                                fcounts[code] = d.count;
                            } else {
                                fcounts[code] += d.count;
                            }
                        } else {
                            d.count = fcounts[code];
                            delete(fcounts[code])
                        }
                    }
                }
            }
            this.strategyDeals.push(sDeals);
            this.showCategoriedDeals();
        });
    }

    setDealsFilter(deals, fkey) {
        if (fkey == 'le5') {
            // 每日买入数量 <= 5
            var dealsByCode = {};
            for (const d of deals) {
                if (!dealsByCode[d.code]) {
                    dealsByCode[d.code] = [];
                }
                dealsByCode[d.code].push(d);
            }
            var dealsByDate = {};
            for (var c in dealsByCode) {
                var count = 0;
                var cdeals = [];
                for (const d of dealsByCode[c]) {
                    if (d.tradeType == 'B') {
                        count += d.count;
                    } else {
                        count -= d.count;
                    }
                    cdeals.push(d);
                    if (count == 0) {
                        if (!dealsByDate[cdeals[0].time]) {
                            dealsByDate[cdeals[0].time] = [];
                        }
                        dealsByDate[cdeals[0].time].push(cdeals);
                        cdeals = [];
                    }
                }
            }
            var fdeals = [];
            for (var t in dealsByDate) {
                if (dealsByDate[t].length <= 5) {
                    for (const dd of dealsByDate[t]) {
                        for (const d of dd) {
                            fdeals.push(d);
                        }
                    }
                }
            }
            return fdeals;
        }
    }

    showCategoriedDeals() {
        var sDeals = null;
        for (var i in this.strategyDeals) {
            if (this.strategyDeals[i].tname == this.dealCategorySel.value) {
                sDeals = this.strategyDeals[i];
                break;
            }
        }
        if (!sDeals) {
            this.getDealsByCategory(this.dealCategorySel.value);
            return;
        }

        var fdeals = sDeals.deals;
        if (this.dealsFilter.value != 'all') {
            fdeals = this.setDealsFilter(sDeals.deals, this.dealsFilter.value);
        }
        this.dealsLineChart.showDealsByTime(fdeals);
        emjyBack.statsReport.showDeals(this.dealsTable, fdeals, true);
    }
}
