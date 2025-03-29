'use strict';

class RandomColor {
    next() {
        const arr = [];
        for (var i = 0; i < 3; i++) {
            arr.push(Math.floor(Math.random() * 128 + 128));
        }
        const [r,g,b] = arr;
        const rgbClr = `#${
            r.toString(16).length > 1 ? r.toString(16) : "0" + r.toString(16)
        }${g.toString(16).length > 1 ? g.toString(16) : "0" + g.toString(16)}${
            b.toString(16).length > 1 ? b.toString(16) : "0" + b.toString(16)
        }`;
        if (this.exists && this.exists.has(rgbClr)) {
            return this.next();
        }
        if (!this.exists) {
            this.exists = new Set();
        }
        this.exists.add(rgbClr);
        return rgbClr;
    }
}

class ZtLeadLbcChart {
    constructor(parent) {
        this.container = parent;
        this.chartdiv = document.createElement('div');
        this.chartdiv.style.height = '600px';
        this.container.appendChild(this.chartdiv);
        this.chart = echarts.init(this.chartdiv);
    }

    setupChart() {
        let option = {
            grid: [{top:'10', height: '40%'}, {top: '42%', height: '48%'}],
            xAxis: [{type: 'category', gridIndex: 0}, {type: 'category', gridIndex: 1}],
            yAxis: [
                {type: 'value', gridIndex: 0},
                {type: 'value', gridIndex: 1, splitLine: { show: false }},
                {type: 'value', gridIndex: 1, splitLine: { show: false }},
                {type: 'value', gridIndex: 1, axisLabel: { show: false }}],
            series: [],
            tooltip: {
                trigger: 'axis',
                axisPointer: {type: 'cross'},
                formatter: function(params) {
                    const tipseries = {'ztcnt': '连板', 'zt1cnt': '首板', 'dtcnt': '跌停', 'ztamt':'成交'};
                    let result = '';
                    params.forEach(p => {
                        if (tipseries[p.seriesName]) {
                            result += p.marker + tipseries[p.seriesName] + p.value[1] + (p.seriesName == 'ztamt' ? '亿': '') + '<br>';
                        }
                    });
                    if (result.length > 0) {
                        result = params[0].value[0] + '<br>' + result;
                    }
                    return result;
                }
            },
            dataZoom: [{
                type: 'inside',
                show: true,
                xAxisIndex: [0, 1],
                end: 100,
                zoomLock: true
            }, {
                type: 'slider',
                brushSelect: false
            }]
        };

        this.chart.setOption(option);
    }

    lbcSeries() {
        let series = [];
        let seriescnt = {};
        for (let si of emjyBack.lbc_series) {
            if (!seriescnt[si.code]) {
                seriescnt[si.code] = 0;
            } else {
                seriescnt[si.code] += 1;
            }
            si.sname = si.code + '_' + seriescnt[si.code];
        }

        var day_lbc = function(d, l) {
            if (d == l) {
                return d == 1 ? '首板' : `${d}连板`;
            }
            return `${d}天${l}板`;
        }
        for (const si of emjyBack.lbc_series) {
            let s = {};
            s.name = si.sname;
            s.type = 'line';
            s.step = 'middle';
            s.yAxisIndex = 0;
            s.xAxisIndex = 0;
            s.data = si.daylbc.sort((a, b) => a[0] > b[0]);
            s.showSymbol = false;
            s.label = {
                show: true,
                position: 'top',
                color: 'inherit',
                formatter: function(param) {
                    var result = emjyBack.stockName(param.seriesName.split('_')[0].substring(2));
                    result += '\n' + day_lbc(param.data[2], param.data[1]);
                    return result;
                }
            }
            s.labelLayout = {
                moveOverlap: 'shiftY'
            }
            series.push(s);
        }
        return series;
    }

    statsSeries() {
        if (!emjyBack.zdtDailyStats) {
            return [];
        }
        let series = [];
        series[0] = {
            name:'zt1cnt', type:'bar', stack:'zt', xAxisIndex:1, yAxisIndex:1, showSymbol: false,
            data: emjyBack.zdtDailyStats.map(x=>[x[0], x[2]])
        };
        series[1] = {
            name:'ztcnt', type:'bar', stack:'zt', xAxisIndex:1, yAxisIndex:1, showSymbol: false,
            data: emjyBack.zdtDailyStats.map(x=>[x[0], x[1]-x[2]])
        };
        series[2] = {
            name:'dtcnt', type:'bar', stack:'dt', xAxisIndex:1, yAxisIndex:2, showSymbol: false,
            data: emjyBack.zdtDailyStats.map(x=>[x[0], x[3]])
        };
        series[3] = {
            name:'ztamt', type:'line', xAxisIndex:1, yAxisIndex:3, showSymbol: false,
            label: {show:true, formatter: function(params) {return params.value[1].toFixed(2) + '亿'}},
            data: emjyBack.zdtDailyStats.map(x=>[x[0], x[4]/10000])
        };
        return series;
    }

    showAll() {
        let s1 = this.lbcSeries();
        let s2 = this.statsSeries();
        var option = {series: s1.concat(s2)};
        var xAxis = [{data: []}, {data: []}];
        var dates = [];
        for (const si of emjyBack.lbc_series) {
            si.daylbc.forEach(dn => {
                if (!dates.includes(dn[0])) {
                    dates.push(dn[0]);
                }
            });
        }
        if (emjyBack.zdtDailyStats) {
            emjyBack.zdtDailyStats.forEach(x => {if(!dates.includes(x[0])) dates.push(x[0]);});
        }
        dates.sort();
        xAxis[0].data = dates;
        xAxis[1].data = dates;
        option.xAxis = xAxis;
        if (dates.length > 120) {
            option.dataZoom = [{
                start: (dates.length - 120) * 100 / dates.length,
                minSpan: 4000/dates.length,
            }]
        }
        if (s2.length > 0) {
            option.legend = {
                top: '42%',
                right: '10',
                orient: 'vertical',
                data: s2.map(x => x.name)
            }
        }
        if (this.chart.getWidth() == 0) {
            this.chart.resize();
        }
        this.chart.setOption(option);
    }
}


class ZtConceptsPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停热度');
        this.conceptBk = {};
        this.dailyZtStocks = {};
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.colorGenerator = new RandomColor();
            this.conceptBk['border'] = 'red';
            this.ztLbcPanel = document.createElement('div');
            this.ztlbcChart = new ZtLeadLbcChart(this.ztLbcPanel);
            this.ztlbcChart.setupChart();
            this.getZtLbcHistory();
            this.container.appendChild(this.ztLbcPanel);
            const btnLoadMore = document.createElement('button');
            btnLoadMore.textContent = '更多';
            btnLoadMore.onclick = () => this.getZtLbcHistory();
            this.container.appendChild(btnLoadMore);

            var title = document.createElement('h3');
            title.textContent = '涨停分布';
            title.style.textAlign = 'center';
            title.style.color = this.colorGenerator.next();
            this.container.appendChild(title);
            this.topPanel = document.createElement('div');
            this.topPanel.style.overflowY = 'scroll';
            this.topPanel.style.maxHeight = 600;
            this.container.appendChild(this.topPanel);
            this.getZtConcepts();
            this.getStocksRank();

            this.ztConceptPanel = document.createElement('div');
            this.ztConceptPanel.style.display = 'flex';
            this.container.appendChild(this.ztConceptPanel);
            this.ztConceptTable = new SortableTable();
            this.ztConceptPanel.appendChild(this.ztConceptTable.container);

            var candiToolsPanel = document.createElement('div');
            candiToolsPanel.style.maxWidth = 1000;
            this.ztConceptPanel.appendChild(candiToolsPanel);
            var btnExportChecked = document.createElement('button');
            btnExportChecked.textContent = '导出所选';
            btnExportChecked.onclick = e => {
                this.setStrategyForSelected();
            }
            candiToolsPanel.appendChild(btnExportChecked);
            this.candidatesArea = document.createElement('div');
            candiToolsPanel.appendChild(this.candidatesArea);

            this.ztChartPanel = document.createElement('div');
            this.container.appendChild(this.ztChartPanel);
        }
    }

    getZtConcepts() {
        var ztUrl = emjyBack.fha.server + 'stock?act=ztconcept&days=50';
        fetch(ztUrl).then(r=>r.json()).then(cdata => {
            this.ztconcepts = cdata;
            this.showZtConcepts();
        });
    }

    getDailyZt(date, concept, cb) {
        var ztUrl = emjyBack.fha.server + 'api/stockzthist?date=' + date + '&concept=' + concept;
        fetch(ztUrl).then(r=>r.json()).then(zdata => {
            if (!this.dailyZtStocks[date]) {
                this.dailyZtStocks[date] = {};
            }
            this.dailyZtStocks[date][concept] = zdata;
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    getStocksRank(code) {
        if (!this.rankClient) {
            this.rankClient = new StockRankClient();
        }
        if (!this.rankClient.ranks) {
            this.rankClient.getRanks();
        } else {
            var rc = this.rankClient.ranks.find(r => r.code == code);
            if (rc) {
                return rc.rank;
            }
        }
        return '-';
    }

    getDailyZtStats() {
        var ztUrl = emjyBack.fha.server + '/api/stockzthist?daily=1';
        fetch(ztUrl).then(r.r.json()).then(zst => {
            this.showDailyZtStats(zst);
        });
    }

    getZtLbcHistory() {
        let ldate = this.hdate ? new Date(this.hdate) : new Date();
        this.hdate = new Date(ldate - 90*24*60*60000).toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, '-');
        var lbcUrl = emjyBack.fha.server + 'stock?act=ztlbc&date=' + this.hdate;
        fetch(lbcUrl).then(r=>r.json()).then(lrsp => {
            emjyBack.lbc_series = lrsp;
            this.ztlbcChart.showAll();
        });
        var sUrl = emjyBack.fha.server + 'stock?act=zdtemot&date=' + this.hdate;
        fetch(sUrl).then(r=>r.json()).then(lrsp => {
            emjyBack.zdtDailyStats = lrsp;
            this.ztlbcChart.showAll();
        });
    }

    showZtConcepts() {
        if (!this.ztconcepts) {
            return;
        }
        var concpetdict = {};
        this.ztconcepts.forEach(ac => {
            if (!concpetdict[ac[0]]) {
                concpetdict[ac[0]] = [[ac[1], ac[2]]];
            } else {
                concpetdict[ac[0]].push([ac[1], ac[2]]);
            }
        });

        var conceptsBand = document.createElement('div');
        this.topPanel.appendChild(conceptsBand);
        for (var d in concpetdict) {
            conceptsBand.appendChild(this.createConceptsRow(d, concpetdict[d]));
        }
        // conceptsBand.lastElementChild.scrollIntoView();
    }

    createConceptsCol(date, concepts) {
        var col = document.createElement('div');
        col.style.width = '20px';
        col.style.margin = 0;
        var lbl = document.createElement('div');
        lbl.style.writingMode = 'tb';
        lbl.style.margin = 0;
        lbl.appendChild(document.createTextNode(date.substring(5)));
        col.appendChild(lbl);

        concepts = concepts.sort((a,b) => {return a[1] < b[1]});
        var n5 = concepts[4][1];
        var bars = [];
        var sum = 0;
        concepts.forEach(x => {
            if (x[1] < n5 || x[0] == 'ST股' || x[0] == '公告') {
                return;
            }
            sum += x[1];
            bars.push(x);
        });
        bars.forEach(x => {
            var con = document.createElement('div');
            con.style.writingMode = 'tb';
            con.style.textAlign = 'center';
            con.style.margin = 0;
            if (!this.conceptBk[x[0]]) {
                this.conceptBk[x[0]] = this.colorGenerator.next();
            }
            con.style.background = this.conceptBk[x[0]];
            con.appendChild(document.createTextNode(x[0] + ' ' + x[1]));
            con.style.height = x[1] * 700 / sum;
            col.appendChild(con);
        });
        return col;
    }

    createConceptsRow(date, concepts) {
        var row = document.createElement('div');
        row.style.display = 'flex';
        row.style.height = '25px';
        row.style.margin = 0;
        var lbl = document.createElement('div');
        lbl.style.margin = 0;
        lbl.appendChild(document.createTextNode(date));
        row.appendChild(lbl);

        concepts = concepts.sort((a,b) => {return a[1] < b[1]});
        var n5 = concepts[5][1];
        var bars = [];
        var sum = 0;
        concepts.forEach(x => {
            if (x[1] < n5 || x[0] == 'ST股' || x[0] == '公告') {
                return;
            }
            sum += x[1];
            bars.push(x);
        });

        bars.forEach(x => {
            var con = document.createElement('div');
            con.style.textAlign = 'center';
            con.style.margin = 0;
            if (!this.conceptBk[x[0]]) {
                this.conceptBk[x[0]] = this.colorGenerator.next();
            }
            con.style.background = this.conceptBk[x[0]];
            con.appendChild(document.createTextNode(`${x[1]} ${x[0]}`));
            con.style.width = x[1] * this.topPanel.clientWidth / sum;
            con.style.border = '3px solid';
            con.style.borderColor = con.style.backgroundColor;
            con.style.textWrap = 'nowrap';
            con.concept = x[0];
            con.date = date;
            con.onmouseenter = e => {
                this.setBorderColorFor(e.target.concept, this.conceptBk['border']);
            }
            con.onmouseleave = e => {
                this.setBorderColorFor(e.target.concept, e.target.style.backgroundColor);
            }
            con.onclick = e => {
                this.onConceptClicked(e.target.concept, e.target.date);
            }
            row.appendChild(con);
        });

        var lbl2 = document.createElement('div');
        lbl2.style.margin = 0;
        lbl2.appendChild(document.createTextNode(date));
        row.appendChild(lbl2);
        return row;
    }

    setBorderColorFor(concept, clr) {
        var ele = this.topPanel.firstElementChild.firstElementChild;
        while(ele) {
            var bele = ele.firstElementChild;
            while(bele) {
                if (bele.concept == concept) {
                    bele.style.borderColor = clr;
                }
                bele = bele.nextElementSibling;
            }
            ele = ele.nextElementSibling;
        }
    }

    onConceptClicked(concept, date) {
        if (!this.dailyZtStocks[date] || !this.dailyZtStocks[date][concept]) {
            this.getDailyZt(date, concept, _ => {
                this.showDailyZtStocks(date, concept);
            });
            return;
        }
        this.showDailyZtStocks(date, concept);
    }

    showDailyZtStocks(date, concept) {
        if (!this.dailyZtStocks[date] || !this.dailyZtStocks[date][concept]) {
            return;
        }

        this.ztConceptTable.reset();
        this.ztConceptTable.setClickableHeader('序号', '日期', '名称(代码)', '涨停概念', '连板数', '人气', '')
        var n = 1;
        for (const stocki of this.dailyZtStocks[date][concept]) {
            var code = stocki[0].substring(2);
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
                    if (!emjyBack.klines[e.target.code]) {
                        emjyBack.prepareKlines(e.target.code, guang.dateToString(new Date(), '-'), '101');
                    }
                } else {
                    if (this.candidatesArea.filteredStks) {
                        this.candidatesArea.filteredStks.delete(e.target.code);
                    }
                }
            }
            var rank = this.getStocksRank(code);
            this.ztConceptTable.addRow(
                n++,
                date,
                anchor,
                stocki[2],
                stocki[1],
                rank,
                sel
            );
        }
    }

    showDailyZtStats(dailyZtStats) {
        if (!this.ztHeightCountChart) {
            var stCheck = document.createElement('input');
            stCheck.type = 'checkbox';
            stCheck.onchange = e => {
                if (this.ztHeightCountChart) {
                    this.ztHeightCountChart.draw(e.target.checked);
                }
            }
            var stCheckDiv = document.createElement('div');
            stCheckDiv.appendChild(stCheck);
            stCheckDiv.appendChild(document.createTextNode('ST股'));
            this.ztChartPanel.appendChild(stCheckDiv);

            var ztContainer = document.createElement('div');
            ztContainer.style = 'display: table; width: 100%;';
            ztContainer.style.height = '480px';
            this.ztChartPanel.appendChild(ztContainer);
            this.ztHeightCountChart = new ZtHeightCountChart(ztContainer);
            this.ztHeightCountChart.setdata(dailyZtStats);
        }

        if (this.ztHeightCountChart) {
            this.ztHeightCountChart.draw(false);
        }
    }

    setStrategyForSelected() {
        this.candidatesArea.textContent = '';
        var candidatesObj = {};
        this.candidatesArea.filteredStks.forEach(c => {
            var strategy = emjyBack.strategyManager.create({"key":"StrategyBuy","enabled":true, 'bway':'direct'}).data;
            var kl = emjyBack.klines[c] ? emjyBack.klines[c].getLatestKline('101') : null;
            var count0 = kl && kl.c ? Math.ceil(100/kl.c) * 100 : 500;
            var strgrp = {
                "grptype":"GroupStandard",
                "strategies":{"0":strategy, "1":{"key":"StrategySellELS","enabled":false,"cutselltype":"single"}},
                "transfers":{"0":{"transfer":"-1"}, "1":{"transfer":"-1"}},
                "gmeta": {"setguard": true, "guardid": "1", "settop": true},
                count0,
                "amount":10000};
            candidatesObj[c] = strgrp;
        })
        this.candidatesArea.textContent = JSON.stringify(candidatesObj, null, 1);
    }
}
