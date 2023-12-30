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
                var fee = -d.fee;
                if (d.feeGh !== undefined) {
                    fee -= d.feeGh;
                }
                if (d.feeYh !== undefined) {
                    fee -= d.feeYh;
                }
                fee = -fee;
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
                var fee = -d.fee;
                if (d.feeGh !== undefined) {
                    fee -= d.feeGh;
                }
                if (d.feeYh !== undefined) {
                    fee -= d.feeYh;
                }
                fee = -fee;
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
        this.strategyDeals = {};
        this.checkedCategories = new Set();
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
                for (const dc of this.dealCategories) {
                    this.dealCategorySel.appendChild(new Option(
                        dc[1]?dc[1]:dc[0], dc[0]));
                }
                this.dealCategorySel.appendChild(new Option('实盘', 'archived'));
                this.dealCategorySel.selectedIndex = -1;
            });
        }
        this.dealCategorySel.onchange = e=> {
            if (this.dealCategorySel.selectedIndex != -1) {
                this.getDealsByCategory(this.dealCategorySel.value, () => {
                    this.showCategoriedDeals();
                });
                if (this.dealCategorySel.value == 'archived') {
                    this.dealsFilter.value = 'all';
                }
            }
        }
        topControl.appendChild(this.dealCategorySel);

        this.dealsFilter = document.createElement('select');
        this.dealsFilter.appendChild(new Option('全部', 'all'));
        this.dealsFilter.appendChild(new Option('<= 5', 'le5'));
        this.dealsFilter.appendChild(new Option('阶梯增仓', 'step'));
        this.dealsFilter.appendChild(new Option('比例增仓', 'ratio'));
        this.dealsFilter.appendChild(new Option('回本增仓', 'lose'));
        this.dealsFilter.onchange = e => {
            if (this.dealsFilter.selectedIndex > 1) {
                this.showDealsFilterSetting();
                return;
            } else {
                this.hideDealsFilterSetting();
            }
            this.showCategoriedDeals();
        }
        topControl.appendChild(this.dealsFilter);
        this.dfSettings = document.createElement('div');
        topControl.appendChild(this.dfSettings);

        this.categoryKeyword = document.createElement('input');
        this.categoryKeyword.placeholder = '关键字';
        topControl.appendChild(this.categoryKeyword);
        var btnListStats = document.createElement('button');
        btnListStats.textContent = '统计结果';
        btnListStats.onclick = e => {
            if (this.categoryKeyword.value == '') {
                return;
            }
            var candidates = [];
            for (const c of this.dealCategories) {
                if (c[0].includes(this.categoryKeyword.value)) {
                    if (!this.strategyDeals[c[0]]) {
                        candidates.push(c[0]);
                    }
                }
            }
            if (candidates.length > 0) {
                candidates.forEach(c => {this.getDealsByCategory(c)});
            }
            this.listTradingStats();
        }
        topControl.appendChild(btnListStats);

        var btnShowDeals = document.createElement('button');
        btnShowDeals.textContent = '删除记录';
        btnShowDeals.onclick = e => {
            if (this.checkedCategories) {
                var rmUrl = emjyBack.fha.server + 'stock';
                var fd = new FormData();
                fd.append('act', 'rmtrackdeals');
                fd.append('name', Array.from(this.checkedCategories).join(','));
                utils.post(rmUrl, fd, null, r => {
                    console.log(r);
                });
                for (var i = this.dealCategories.length - 1; i >= 0; i--) {
                    if (this.checkedCategories.has(this.dealCategories[i][0])) {
                        this.dealCategories.splice(i, 1);
                    }
                }
                this.checkedCategories.clear();
                this.listTradingStats();
            }
        }
        topControl.appendChild(btnShowDeals);

        var dealChartContainer = document.createElement('div');
        dealChartContainer.style = 'display: table; width: 100%;';
        dealChartContainer.style.height = '600';
        this.container.appendChild(dealChartContainer);
        this.dealsLineChart = new DealsEarningLineChart(dealChartContainer, '收益率趋势图');
        var drDiv = document.createElement('div');
        drDiv.style.display = 'flex';
        this.container.appendChild(drDiv);

        this.dealsTable = new SortableTable(1, 0, false);
        drDiv.appendChild(this.dealsTable.container);
        this.tresultTable = new SortableTable();
        drDiv.appendChild(this.tresultTable.container);

        this.statsTable = new SortableTable();
        this.container.appendChild(this.statsTable.container);
    }

    showDealsFilterSetting() {
        if (!this.dfstBaseAmt) {
            this.dfstBaseAmt = document.createElement('input');
            this.dfstBaseAmt.placeholder = '买入基数';
            this.dfstBaseAmt.style.maxWidth = 80;
            this.dfSettings.appendChild(this.dfstBaseAmt);
        }
        if (!this.dfstIncrement) {
            this.dfstIncrement = document.createElement('input');
            this.dfstIncrement.style.maxWidth = 80;
            this.dfSettings.appendChild(this.dfstIncrement);
        }
        if (!this.dfstSubmit) {
            this.dfstSubmit = document.createElement('button');
            this.dfstSubmit.textContent = '重新计算';
            this.dfstSubmit.onclick = e => {
                this.showCategoriedDeals();
            }
            this.dfSettings.appendChild(this.dfstSubmit);
        }
        var dfplaceholder = {step: '增量', ratio: '增长率(小数)', 'lose': '期望收益率(小数)'};
        this.dfstIncrement.placeholder = dfplaceholder[this.dealsFilter.value];
        this.dfSettings.style.display = 'block';
    }

    hideDealsFilterSetting() {
        this.dfSettings.style.display = 'none';
    }

    getDealsByCategory(category, cb) {
        var dcUrl = emjyBack.fha.server + 'stock?act=trackdeals&name=' + category;
        var header = null;
        if (category == 'archived') {
            if (!emjyBack.fha.uemail || !emjyBack.fha.pwd) {
                console.error('user not set!');
                return;
            }
            header = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)};
        }
        utils.get(dcUrl, header, ds => {
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
            this.strategyDeals[sDeals.tname] = sDeals;
            if (typeof(cb) === 'function') {
                cb();
            }
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
        } else {
            return emjyBack.statsReport.makeupDeals(deals, fkey, this.dfstBaseAmt.value, this.dfstIncrement.value);
        }
    }

    showCategoriedDeals() {
        if (!this.dealCategorySel.value) {
            return;
        }

        var sDeals = this.strategyDeals[this.dealCategorySel.value];
        if (!sDeals) {
            this.getDealsByCategory(this.dealCategorySel.value, () => {
                this.showCategoriedDeals();
            });
            return;
        }

        var fdeals = sDeals.deals;
        if (this.dealsFilter.value != 'all') {
            fdeals = this.setDealsFilter(sDeals.deals, this.dealsFilter.value);
        }
        this.dealsLineChart.showDealsByTime(fdeals);
        emjyBack.statsReport.showDeals(this.dealsTable, fdeals, true);
        emjyBack.statsReport.showPrevTradeResult(this.tresultTable);
        this.statsTable.reset();
    }

    listTradingStats() {
        if (this.categoryKeyword.value == '') {
            return;
        }
        var candidates = [];
        for (const c of this.dealCategories) {
            if (c[0].includes(this.categoryKeyword.value)) {
                candidates.push(c[0]);
            }
        }

        for (const c of candidates) {
            if (!this.strategyDeals[c]) {
                setTimeout(e => {
                    this.listTradingStats();
                }, 2000);
                return;
            }
        }

        var dstats = [];
        for (const c of candidates) {
            var sDeals = this.strategyDeals[c];
            var fdeals = sDeals.deals;
            if (this.dealsFilter.value != 'all') {
                fdeals = this.setDealsFilter(sDeals.deals, this.dealsFilter.value);
            }

            var stats = emjyBack.statsReport.checkDealsStatistics(fdeals);
            stats.sname = c;
            stats.elr = stats.earned * stats.tradeCountL / (stats.lost * stats.tradeCountE);
            stats.erate = 100 * stats.tradeCountE / (stats.tradeCountL + stats.tradeCountE);
            stats.derate = 100 * (stats.netEarned) / stats.maxSdc;
            stats.expearn = ((stats.earned * stats.tradeCountE - stats.lost * stats.tradeCountL) / (stats.lost * (stats.tradeCountE + stats.tradeCountL)));
            dstats.push(stats);
        }

        dstats.sort((a,b) => {
            if (a.erate == b.erate) {
                return a.elr - b.elr < 0;
            }
            return a.erate - b.erate < 0;
        });
        this.statsTable.reset();
        this.statsTable.setClickableHeader('序号', '名称', '净盈利', '总盈利', '总亏损', '盈亏比', '盈利次数', '亏损次数', '胜率', '单日最大成本', '日收益率', '收益期望', '');
        this.checkedCategories.clear();
        for (var i = 0; i < dstats.length; ++i) {
            var chkbx = document.createElement('input');
            stats = dstats[i];
            chkbx.type = 'checkbox';
            chkbx.sname = stats.sname;
            chkbx.checked = true;
            this.checkedCategories.add(stats.sname);
            chkbx.onchange = e => {
                if (e.target.checked) {
                    this.checkedCategories.add(e.target.sname);
                } else {
                    this.checkedCategories.delete(e.target.sname);
                }
            }
            this.statsTable.addRow(
                i, stats.sname, stats.netEarned.toFixed(2), stats.earned.toFixed(2), stats.lost.toFixed(2), stats.elr.toFixed(2),
                stats.tradeCountE, stats.tradeCountL, stats.erate.toFixed(2) + '%', stats.maxSdc.toFixed(2),
                stats.derate.toFixed(2) + '%', stats.expearn.toFixed(4), chkbx
            );
        }
    }
}
