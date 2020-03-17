// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(function(){
    chartWrapperChart = new FundChart();
});

var chartWrapperChart = null;

class FundLine {
    constructor(code, name, indexCode = null, indexName = null) {
        this.code = code;
        this.name = name;
        this.indexCode = indexCode;
        this.indexName = indexName;
        this.average = null;
        this.short_term_rate = null;
        this.maxValue = null;
        this.minValue = null;
        this.maxIndex = null;
        this.minIndex = null;
    }

    updateMinMaxVal(val) {
        if (!this.maxValue || val > this.maxValue) {
            this.maxValue = val;
        };
        if (!this.minValue || val < this.minValue) {
            this.minValue = val;
        };
    }

    updateMinMaxIdxVal(val) {
        if (!this.maxIndex || val > this.maxIndex || (this.maxIndex == '' && val)) {
            this.maxIndex = val;
        };
        if (!this.minIndex || val < this.minIndex || (this.minIndex == '' && val)) {
            this.minIndex = val;
        };
    }
};

class FundChart {
    constructor() {
        // Instantiate and draw our chart, passing in some options.
        this.chartDiv = null;
        this.chart = null;
        this.data = null;
        this.fund = null;
        this.ticks = [];
        this.marks = [];
    }

    setChartDiv(chart_div) {
        this.chartDiv = chart_div;
        this.chart = new google.visualization.LineChart(chart_div);
        google.visualization.events.addListener(this.chart, 'ready', this.drawVticks);
        google.visualization.events.addListener(this.chart, 'select', this.selectChartPoint);
    }

    createChartOption() {
        // Set chart options
        this.marks = [];
        var average = this.fund.average;
        if (average != 0 && average !== undefined) {
            var short_term_rate = this.fund.short_term_rate ? this.fund.short_term_rate : 0.03;
            this.marks.push(average * (1 - short_term_rate));
            this.marks.push(average * (1 - short_term_rate / 3.0));                
            this.marks.push(average);
            this.marks.push(average * (1 + short_term_rate / 3.0));
            this.marks.push(average * (1 + short_term_rate));
        }

        this.ticks = [];
        for (var i = 0; i < this.marks.length; i++) {
            this.ticks.push(this.marks[i]);
        };

        var markMax = this.marks.length > 0 ? this.marks[this.marks.length - 1] : 0;
        var markMin = this.marks.length > 0 ? this.marks[0] : 0;
        var minValue = this.fund.minValue;
        if (this.marks.length > 0 && minValue > markMin) {
            minValue = markMin;
        };
        var maxValue = this.fund.maxValue;
        if (this.marks.length > 0 && maxValue < markMax) {
            maxValue = markMax;
        };
        var minTick = Math.round(minValue * 100 - 1) / 100;
        var maxTick = Math.round(maxValue * 100 + 1) / 100;
        var delta = (maxTick - minTick) / 6;
        for (var i = 0; i < 7; i++) {
            var v = minTick + i * delta;
            if (this.marks.length > 0) {
                if (v <= markMax && v >= markMin) {
                    continue;
                };
            };
            this.ticks.push(v);
        };

        this.ticks.sort();

        if (this.marks.length > 0) {
            for (var i = this.ticks.length - 1; i > 0; i--) {
                if (this.ticks[i] - this.ticks[i - 1] <= delta * 0.1) {
                    if (this.marks.indexOf(this.ticks[i]) === -1) {
                        this.ticks.splice(i,1);
                    } else if (this.marks.indexOf(this.ticks[i - 1]) === -1) {
                        this.ticks.splice(i - 1, 1);
                    }
                }
            }
        };

        var v0ticks = [];
        for (var i = 0; i < this.ticks.length; i++) {
            v0ticks.push({v: this.ticks[i], f: this.ticks[i].toFixed(this.marks.indexOf(this.ticks[i]) === -1 ? 2 : 4)});
        };

        this.options = {
            title: this.fund.name,
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
                    ticks: v0ticks
                },
                1: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0,
                    pointSize: 1
                }
            }
        };
        if (this.fund.indexCode && fundSummary.chartWrapper.showTrackedIndexChart()) {
            var v1ticks = [];
            var minTick1 = Math.round(this.fund.minIndex - 1);
            var maxTick1 = Math.round(this.fund.maxIndex + 1);
            var delta1 = (maxTick1 - minTick1) / 6;
            for (var i = 0; i < 7; i++) {
                var v = minTick1 + i * delta1;
                v1ticks.push({v: v, f: v.toFixed()});
            };

            this.options.vAxes["1"].ticks = v1ticks
            this.options.series["1"] = {
                targetAxisIndex: 1,
                pointSize: 0,
                lineWidth: 1
            }
        };
    }

    createDataRow(histIdx) {
        var date = all_hist_data[histIdx][0];
        var strDate = utils.date_by_delta(date);
        var r = [strDate];
        var valIdx = all_hist_data[0].indexOf(this.fund.code) * 2 - 1;
        var val = all_hist_data[histIdx][valIdx];
        if (val == '') {
            utils.logInfo(this.fund.name, strDate, "value not found!");
            if (histIdx - 1 > 0) {
                all_hist_data[histIdx][valIdx] = all_hist_data[histIdx - 1][valIdx];
                all_hist_data[histIdx][valIdx + 1] = '0';
                val = all_hist_data[histIdx][valIdx];
            } else {
                val = 0;
            }
        };
        r.push(val);
        this.fund.updateMinMaxVal(val);
        var ptstyle = 'point {visible: false }';
        var pttooltip = strDate + "\n" + val + ": " + all_hist_data[histIdx][valIdx + 1] + "%";
        if (ftjson[this.fund.code] !== undefined) {
            var buytable = ftjson[this.fund.code].buy_table;
            if (buytable) {
                var buyrec = buytable.find(function(curVal) {
                    return curVal.date == date;
                });
                if (buyrec) {
                    pttooltip += "\n买入:" + buyrec.cost;
                    var ptsize = 3;
                    var ptclr = '#FF4500';
                    var aver_cost = ftjson[this.fund.code].holding_aver_cost;
                    if (buyrec.cost > 2000 || (aver_cost > 0 && buyrec.cost > 2 * aver_cost)) { 
                        ptsize = 5
                    };
                    if (buyrec.sold == 1) {
                        ptclr = '#FFD39B';
                    };
                    ptstyle = 'point {size: ' + ptsize + '; fill-color: ' + ptclr + ';}';
                };
            };
            var selltable = ftjson[this.fund.code].sell_table;
            if (selltable) {
                var sellrec = selltable.find(function(curVal) {
                    return curVal.date == date;
                });
                if (sellrec) {
                    pttooltip += "\n卖出:" + sellrec.cost;
                    ptstyle = 'point {size: 4; fill-color: #8B6914;}';
                };
            };
        }
        r.push(ptstyle);
        r.push(pttooltip);
        if (this.fund.indexCode && fundSummary.chartWrapper.showTrackedIndexChart()) {
            var valIdx = all_hist_data[0].indexOf(this.fund.indexCode) * 2 - 1;
            var val = all_hist_data[histIdx][valIdx];
            if (val == '') {
                utils.logInfo(this.fund.indexCode, strDate, "value not found!");
                if (histIdx - 1 > 0) {
                    all_hist_data[histIdx][valIdx] = all_hist_data[histIdx - 1][valIdx];
                    all_hist_data[histIdx][valIdx + 1] = '0';
                    val = all_hist_data[histIdx][valIdx];
                } else {
                    val = 0;
                }
            };
            if (val == '') {
                val = null;
            };
            r.push(val);
            this.fund.updateMinMaxIdxVal(val);
        };

        return r;
    }

    createDataTable(days = 0) {
        if (all_hist_data.length < 1) {
            return;
        };

        if (ftjson && ftjson[this.fund.code] !== undefined) {
            this.fund.average = ftjson[this.fund.code].avp;
            this.fund.short_term_rate = parseFloat(ftjson[this.fund.code].str);
        }

        var showLen = 0;
        if (days > 0) {
            showLen = days + 1;
        } else if (days == 0) {
            showLen = 11;
            var buytable = null;
            if (ftjson != null && ftjson[this.fund.code] !== undefined) {
                buytable = ftjson[this.fund.code].buy_table;
            }

            if (buytable) {
                var fundDateIdx = 0;
                var firstnotsell = buytable.find(function(curVal) {
                    return curVal.sold == 0;
                });
                if (!firstnotsell) {
                    firstnotsell = buytable[buytable.length - 1];
                };
                var notselldate = firstnotsell.date;
                var startDateArr = all_hist_data.find(function(curVal) {
                    return curVal[fundDateIdx] == notselldate;
                });
                showLen = all_hist_data.length - all_hist_data.indexOf(startDateArr) + 2;
            };
        } else if (days == -1) {
            showLen = this.getMaxHistoryLen();
        }
        var maxHistLen = this.getMaxHistoryLen();
        showLen = maxHistLen >= showLen? showLen: maxHistLen;

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        data.addColumn('number', this.fund.code);
        data.addColumn({type: 'string', role: 'style'});
        data.addColumn({type: 'string', role: 'tooltip'});
        if (this.fund.indexCode && fundSummary.chartWrapper.showTrackedIndexChart()) {
            data.addColumn('number', this.fund.indexName);
        };

        var rows = [];
        var len = all_hist_data.length;
        if (this.fund.code) {
            var valIdx = all_hist_data[0].indexOf(this.fund.code) * 2 - 1;
            var val = all_hist_data[len - showLen + 1][valIdx];
            this.fund.minValue = null;
            this.fund.maxValue = null;
            this.fund.updateMinMaxVal(val);
        };
        if (this.fund.indexCode && fundSummary.chartWrapper.showTrackedIndexChart()) {
            var valIdx = all_hist_data[0].indexOf(this.fund.indexCode) * 2 - 1;
            var val = all_hist_data[len - showLen + 1][valIdx];
            this.fund.maxIndex = null;
            this.fund.minIndex = null;
            this.fund.updateMinMaxIdxVal(val);
        };
        for (var i = 1; i < showLen; i++) {
            var r = this.createDataRow(len - showLen + i);
            rows.push(r);
        };

        var addLatestVal = false;
        if (ftjson[this.fund.code] !== undefined) {
            var jsonp = ftjson[this.fund.code].rtgz;
            if (jsonp && jsonp.gsz) {
                addLatestVal = true;
            };
        };

        if (addLatestVal) {
            var r = [utils.getTodayDate()];
            var funddata = ftjson[this.fund.code];
            if (funddata !== undefined && funddata.rtgz && funddata.rtgz.gsz) {
                var gz = parseFloat(funddata.rtgz.gsz);
                r.push(parseFloat(gz));
                r.push('point {visible: false }');
                r.push("最新估值:" + funddata.rtgz.gsz); // tooltip
                this.fund.updateMinMaxVal(gz);
            }
            if (this.fund.indexCode && fundSummary.chartWrapper.showTrackedIndexChart()) {
                var icode = this.fund.indexCode;
                if(irjson[icode] && irjson[icode].rtgz) {
                    r.push(irjson[icode].rtgz);
                    this.fund.updateMinMaxIdxVal(irjson[icode].rtgz);
                } else {
                    r.push(null);
                }
            }
            rows.push(r);
        };

        if (ftjson[this.fund.code].isIndex) {
            var icode = this.fund.code;
            if(irjson[icode] && irjson[icode].rtgz) {
                var r = [irjson[icode].date];
                r.push(irjson[icode].rtgz);
                r.push('point {visible: false }');
                r.push("最新估值:" + irjson[icode].rtgz + '\n日期:' + irjson[icode].date + '\n涨幅:' + parseFloat((irjson[icode].percent * 100).toFixed(4)) + '%');
                this.fund.updateMinMaxVal(irjson[icode].rtgz);
                rows.push(r);
            }
        };

        data.addRows(rows);
        this.data = data;
    }

    drawVticks() {
        chartWrapperChart.onDrawVticks();
    }

    selectChartPoint() {
        fundSummary.chartWrapper.onChartPointSelected();
    }

    onDrawVticks() {
        var tRects = this.chartDiv.getElementsByTagName('rect');
        var tickRects = [];
        for (var i = 0; i < tRects.length; i++) {
            if (tRects[i].getAttribute('height') === '1') {
                tickRects.push(tRects[i]);
            }
        };
        for (var i = 0; i < this.marks.length; i++) {
            tickRects[this.ticks.indexOf(this.marks[i])].setAttribute('fill', '#ff0000');
        };
        for (var i = this.ticks.length; i < tickRects.length; i++) {
            tickRects[i].setAttribute('opacity','0.15');
        };
    }

    getMaxHistoryLen() {
        return all_hist_data.length - this.getLeftLimitIndex() + 1;
    }

    getLeftLimitIndex() {
        var valIdx = all_hist_data[0].indexOf(this.fund.code) * 2 - 1;
        for (var i = 1; i < all_hist_data.length; i++) {
            if (all_hist_data[i][valIdx] != '') {
                return i;
            };
        };
        return i;
    }

    canShiftLeft() {
        var beginDate = this.data.getValue(0, 0);
        var date = utils.days_since_2000(beginDate);
        var beginIdx = -1 + all_hist_data.findIndex(function(curVal) {
            return curVal[0] == date;
        });
        if (beginIdx >= this.getLeftLimitIndex()) {
            return true;
        };
        return false;
    }

    canShiftRight() {
        var latestDate = this.data.getValue(this.data.getNumberOfRows() - 1, 0);
        var date = utils.days_since_2000(latestDate);
        var latestIdx = all_hist_data.findIndex(function(curVal) {
            return curVal[0] == date;
        });
        return latestIdx > 0 && latestIdx != all_hist_data.length - 1;
    }

    leftShift() {
        if (!this.canShiftLeft()) {
            return;
        };
        var offset = parseInt(this.data.getNumberOfRows() / 4);
        if (offset <= 0) {
            return;
        };
        var strDate = this.data.getValue(0, 0);
        var date = utils.days_since_2000(strDate);
        var endIdx = all_hist_data.findIndex(function(curVal) {
            return curVal[0] == date;
        });
        if (endIdx <= 1) {
            return;
        };
        var beginIdx = endIdx - offset;
        var leftIdx = this.getLeftLimitIndex();
        beginIdx = beginIdx > leftIdx ? beginIdx : leftIdx;
        offset = endIdx - beginIdx;

        var len = this.data.getNumberOfRows();
        for (var i = 0; i < offset; i++) {
            this.data.removeRow(len - 1 - i);
        };

        var rows = [];
        for (var i = beginIdx; i < endIdx; i++) {
            var r = this.createDataRow(i);
            rows.push(r);
        };

        this.data.insertRows(0, rows);
        this.chart.draw(this.data, this.options);
    }

    rightShift() {
        var offset = parseInt(this.data.getNumberOfRows() / 4);
        if (offset <= 0) {
            return;
        };
        var strDate = this.data.getValue(this.data.getNumberOfRows() - 1, 0);
        var date = utils.days_since_2000(strDate);
        var beginIdx = 1 + all_hist_data.findIndex(function(curVal) {
            return curVal[0] == date;
        });

        if (beginIdx == all_hist_data.length || beginIdx == 0) {
            return;
        };

        var endIdx = beginIdx + offset;
        endIdx = endIdx < all_hist_data.length ? endIdx : all_hist_data.length;
        offset = endIdx - beginIdx;

        for (var i = 0; i < offset; i++) {
            this.data.removeRow(0);
        };

        var rows = [];
        for (var i = beginIdx; i < endIdx; i++) {
            var r = this.createDataRow(i);
            rows.push(r);
        };

        this.data.addRows(rows);
        this.chart.draw(this.data, this.options);
    }

    drawChart(days = 0) {
        this.createDataTable(days);
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
    }

    getSelectedItem() {
        return this.chart.getSelection()[0];
    }
};

class TradeOption {
    constructor(tdiv) {
        this.tradeDiv = tdiv;
        this.tradeOptBar = null;
        this.tradeType = null;
        this.datePicker = null;
        this.costInput = null;
        this.submitBtn = null;
    }

    show() {
        this.tradeDiv.style.display = 'block';
    }

    hide() {
        this.tradeDiv.style.display = 'none';
    }

    createTradeOptions() {
        this.tradeOptBar = new RadioAnchorBar();
        this.tradeOptBar.addRadio('买入', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Buy);
        });
        this.tradeOptBar.addRadio('卖出', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Sell);
        });
        this.tradeOptBar.addRadio('加预算', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Budget);
        });
        this.tradeDiv.appendChild(this.tradeOptBar.container);

        var tradePanel = document.createElement('div');
        this.tradeDiv.appendChild(tradePanel);
        this.datePicker = document.createElement('input');
        this.datePicker.type = 'date';
        this.datePicker.value = utils.getTodayDate();
        tradePanel.appendChild(this.datePicker);
        this.costInput = document.createElement('input');
        this.costInput.placeholder = '金额';
        tradePanel.appendChild(this.costInput);
        this.submitBtn = document.createElement('button');
        this.submitBtn.textContent = '确定';
        this.submitBtn.onclick = function(e) {
            fundSummary.chartWrapper.tradeOption.onSubmitClicked();
        }
        tradePanel.appendChild(this.submitBtn);

        this.tradeOptBar.selectDefault();
    }

    setTradeOption(tradeTp) {
        this.tradeType = tradeTp;
        this.changeTradePanel(tradeTp == TradeType.Sell);
    }

    changeTradePanel(bSell) {
        if (bSell) {
            this.costInput.style.display = "none";
            this.submitBtn.textContent = "卖出";
        } else {
            this.costInput.style.display = "inline";
            this.submitBtn.textContent = "确定";
        }
    }

    onSubmitClicked() {
        var code = fundSummary.chartWrapper.code;
        var date = this.datePicker.value;
        var cost = parseFloat(this.costInput.value);
        if (this.tradeType == TradeType.Budget) {
            request.addBudget(code, date, cost);
        } else if (this.tradeType == TradeType.Sell) {
            var sellRadios = document.getElementsByName("sell_row_" + code);
            var strbuydates = "";
            for (var i = 0; i < sellRadios.length; i++) {
                if (sellRadios[i].checked) {
                    strbuydates = sellRadios[i].value;
                    break;
                }
            };

            if (strbuydates == "") {
                alert("No sell dates selected.");
                return;
            };
            
            request.sellFund(code, date, strbuydates);
        } else {
            var budget_dates = [];
            var budgetRadios = document.getElementsByName("budget_row_" + code);
            for (var i = 0; i < budgetRadios.length; i++) {
                if (budgetRadios[i].checked) {
                    budget_dates.push(budgetRadios[i].value);
                }
            };

            var rollin_date = null;
            var rollinRadios = document.getElementsByName("rollin_row_" + code);
            for (var i = 0; i < rollinRadios.length; i++) {
                if (rollinRadios[i].checked) {
                    rollin_date = rollinRadios[i].value;
                    break;
                }
            };
            request.buyFund(code, date, cost, budget_dates, rollin_date);
        }
    }
}

class ChartWrapper {
    constructor() {
        this.code = null;
        this.chartDiv = null;
        this.selectionDiv = null;
        this.selectedData = null;
        this.interactionDiv = null;
        this.daysOpt = null;
        this.tradeOption = null;
        this.googleChartDiv = null;
        this.leftBtn = null;
        this.rightBtn = null;
        this.checkboxShowIdx = null;
    }

    createChartsDiv(parentDiv) {
        if (!parentDiv) {
            return;
        };

        this.chartDiv = document.createElement('div');
        parentDiv.appendChild(this.chartDiv);
        this.interactionDiv = document.createElement('div');
        this.selectionDiv = document.createElement('div');
        this.interactionDiv.appendChild(this.selectionDiv);
        this.chartDiv.appendChild(this.interactionDiv);

        this.daysOpt = new RadioAnchorBar();
        this.chartDiv.appendChild(this.daysOpt.container);
        this.daysOpt.addRadio('默认', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(0);
        });
        this.daysOpt.addRadio('30', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(30);
        });
        this.daysOpt.addRadio('60', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(60);
        });
        this.daysOpt.addRadio('100', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(100);
        });
        this.daysOpt.addRadio('300', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(300);
        });
        this.daysOpt.addRadio('1000', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(1000);
        });
        this.daysOpt.addRadio('最大', function(){
            fundSummary.chartWrapper.redrawHistoryGraphs(-1);
        });

        this.daysOpt.container.appendChild(document.createElement('br'));
        var chartControlDiv = document.createElement('div');
        this.leftBtn = document.createElement('button');
        this.leftBtn.textContent = '<-';
        chartControlDiv.appendChild(this.leftBtn);
        this.leftBtn.onclick = function(e) {
            fundSummary.chartWrapper.leftShiftChart();
        }
        this.rightBtn = document.createElement('button');
        this.rightBtn.textContent = '->'
        chartControlDiv.appendChild(this.rightBtn);
        this.rightBtn.onclick = function(e) {
            fundSummary.chartWrapper.rightShiftChart();
        }

        this.checkboxShowIdx = document.createElement('input');
        this.checkboxShowIdx.type = 'checkbox';
        this.checkboxShowIdx.onclick = function(e) {
            fundSummary.chartWrapper.drawFundHistory();
        }
        chartControlDiv.appendChild(this.checkboxShowIdx);
        chartControlDiv.appendChild(document.createTextNode('隐藏指数'));
        this.daysOpt.container.appendChild(chartControlDiv);

        this.googleChartDiv = document.createElement('div');
        this.chartDiv.appendChild(this.googleChartDiv);

        this.tradeOption = new TradeOption(document.createElement('div'));
        this.tradeOption.createTradeOptions();
        this.chartDiv.appendChild(this.tradeOption.tradeDiv);
    }

    setParent(p) {
        this.chartDiv.parentElement.removeChild(this.chartDiv);
        p.appendChild(this.chartDiv);
    }

    hide() {
        this.chartDiv.style.display = 'none';
    }

    show() {
        this.chartDiv.style.display = 'block';
    }

    initGoogleChart() {
        
    }

    showTrackedIndexChart() {
        return !this.checkboxShowIdx.checked;
    }

    drawFundHistory() {
        if (!chartWrapperChart) {
            utils.logInfo('google chart not initialized!');
            return;
        };

        this.interactionDiv.style.display = "none";
        if (!chartWrapperChart.chartDiv) {
            chartWrapperChart.setChartDiv(this.googleChartDiv);
        };
        chartWrapperChart.fund = new FundLine(this.code, ftjson[this.code].name, ftjson[this.code].ic, ftjson[this.code].in);

        if (chartWrapperChart.fund.indexCode && ( all_hist_data.length < 1 || all_hist_data[0].indexOf(chartWrapperChart.fund.indexCode) < 0)) {
            request.getHistoryData(chartWrapperChart.fund.indexCode, 'index', function(){
                fundSummary.chartWrapper.daysOpt.selectDefault();
            });
        }
        
        if (all_hist_data.length == 0 || all_hist_data[0].indexOf(this.code) < 0) {
            request.getHistoryData(this.code, ftjson[this.code].isIndex? 'index': 'fund', function(){
                fundSummary.chartWrapper.daysOpt.selectDefault();
            });
            return;
        };
        this.daysOpt.selectDefault();
    }

    redrawHistoryGraphs(days) {
        if (chartWrapperChart) {
            chartWrapperChart.drawChart(days);
            this.leftBtn.disabled = false;
            this.rightBtn.disabled = true;
        }
    }

    leftShiftChart() {
        if (chartWrapperChart) {
            chartWrapperChart.leftShift();
            this.leftBtn.disabled = !chartWrapperChart.canShiftLeft();
            this.rightBtn.disabled = !chartWrapperChart.canShiftRight();
        };
    }

    rightShiftChart() {
        if (chartWrapperChart) {
            chartWrapperChart.rightShift();
            this.leftBtn.disabled = !chartWrapperChart.canShiftLeft();
            this.rightBtn.disabled = !chartWrapperChart.canShiftRight();
        };
    }

    showSelectedPointInfo(textInfo) {
        this.selectionDiv.textContent = textInfo;
        this.selectedData = null;
    }

    onChartPointSelected() {
        var selectedItem = chartWrapperChart.getSelectedItem();
        if (selectedItem) {
            var date = chartWrapperChart.data.getValue(selectedItem.row, 0);
            var val = chartWrapperChart.data.getValue(selectedItem.row, 1);
            var code = this.code;
            this.interactionDiv.style.display = "block";
            if (!ftjson[code] || (!ftjson[code].buy_table && !ftjson[code].sell_table)) {
                this.showSelectedPointInfo(date +" 净值: "+ val);
                return;
            }
            var buytable = ftjson[code].buy_table;
            var datedelta = utils.days_since_2000(date);
            var buyrec = buytable? buytable.find(function(curVal) {
                return curVal.date == datedelta;
            }) : null;
            var selltable = ftjson[code].sell_table;
            var sellrec = selltable? selltable.find(function(curVal) {
                return curVal.date == datedelta;
            }) : null;

            if (!buyrec && !sellrec) {
                this.showSelectedPointInfo(date +" 净值: "+ val);
                return;
            };

            var textInfo = "";
            if (buyrec) {
                if (buyrec.sold == 1) {
                    textInfo += date + " 买入 " + buyrec.cost + " 已卖出";
                } else {
                    this.buyRecordSelected(buyrec);
                    return;
                }
            };

            if (sellrec) {
                textInfo += date + " 卖出: " + sellrec.ptn + "份, 成本: " + sellrec.cost;
            };
            this.showSelectedPointInfo(textInfo);
        }
    }

    buyRecordSelected(buyrec) {
        var selectedCode = this.selectedData ? this.selectedData.code: null;
        if (!selectedCode || selectedCode != this.code) {
            utils.removeAllChild(this.selectionDiv);
            this.selectedData = null;
            selectedCode = null;
        };
        
        if (!selectedCode) {
            this.selectedData = {code: this.code};
            selectedCode = this.code;
            var submitDiv = document.createElement("div");

            submitDiv.appendChild(document.createTextNode("天数>"));
            var daysInput = document.createElement("input");
            daysInput.placeholder = "天数";
            daysInput.value = "31";
            daysInput.size = 2;
            this.selectedData.days = 31;
            daysInput.onchange = function(e) {
                fundSummary.chartWrapper.selectedData.days = parseInt(daysInput.value);
            };
            submitDiv.appendChild(daysInput);
            submitDiv.appendChild(document.createTextNode(", 收益率>"));

            var rateInput = document.createElement("input");
            rateInput.placeholder = "期望收益率";
            rateInput.size = 5;
            rateInput.value = (ftjson[this.code].str * 50).toFixed(3); // *100/2
            this.selectedData.rate = parseFloat(ftjson[this.code].str) / 2;
            rateInput.onchange = function(e) {
                fundSummary.chartWrapper.selectedData.rate = parseFloat(rateInput.value) / 100;
            };
            submitDiv.appendChild(rateInput);
            submitDiv.appendChild(document.createTextNode("%"));

            var btnSubmit = document.createElement("button");
            btnSubmit.textContent = "OK";
            btnSubmit.onclick = function (e) {
                fundSummary.chartWrapper.handleSelectedRecords();
            };
            submitDiv.appendChild(btnSubmit);

            this.selectionDiv.appendChild(submitDiv);
        };

        var selectedDates = this.selectedData.dates;
        var dateExists = false;
        if (!selectedDates) {
            selectedDates = [buyrec.date];
        } else {
            if (selectedDates.indexOf(buyrec.date) != -1) {
                dateExists = true;
            } else {
                selectedDates.push(buyrec.date);
            }
        }
        this.selectedData.dates = selectedDates;

        if (!dateExists) {
            var buyInfo = document.createTextNode(utils.date_by_delta(buyrec.date) + ": " + buyrec.cost + " ");
            this.selectionDiv.insertBefore(buyInfo, this.selectionDiv.lastChild);
        };
    }

    handleSelectedRecords() {
        var code = this.selectedData.code;
        if (!ftjson[code] || !ftjson[code].buy_table) {
            alert("数据错误！");
            return;
        }

        var buytable = ftjson[code].buy_table;
        var selectedDates = this.selectedData.dates;
        var jsonp = ftjson[code].rtgz;
        var gz = jsonp ? jsonp.gsz : ftjson[code].lnv;
        var short_term_rate = this.selectedData.rate;
        var short_term_days = this.selectedData.days;
        var dp = utils.getPuzzledDatePortion(buytable, selectedDates, gz, short_term_rate, short_term_days);
        if (!dp) {
            this.selectionDiv.appendChild(document.createTextNode("无合适买卖！"));
        } else {
            var portion = utils.convertPortionToGram(dp.portion, ftjson[code].ppg).toFixed(4);
            var rate = (parseFloat(dp.rate) * 100).toFixed(2) + "%";
            var dates = dp.dates;
            this.selectionDiv.appendChild(document.createTextNode("可卖出:" + portion + " 成本:" + dp.cost + " 预期收益:" + rate));
            var btnSell = document.createElement("button");
            btnSell.textContent = "卖出";
            btnSell.onclick = function(e) {
                //alert("卖出执行！" + code + ":" + dates);
                request.sellFund(code, utils.getTodayDate(), dates);
            }
            this.selectionDiv.appendChild(btnSell);
        }
    }
}
