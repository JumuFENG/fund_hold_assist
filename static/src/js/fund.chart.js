class FundLine {
    constructor(code, lineclr, name) {
        this.code = code;
        this.color = lineclr;
        this.name = name;
    }
};

class FundChart {
    constructor(chart_div) {
        // Instantiate and draw our chart, passing in some options.
        this.chart = new google.visualization.LineChart(document.getElementById(chart_div));
        this.data = null;
        this.lines = [];
        google.visualization.events.addListener(this.chart, 'select', function selectHandler() {
            onChartPointSelected();
        });
    }

    createChartOption() {
        // Set chart options
        var series = {}
        var lineNames = [];
        for (var i = 0; i < this.lines.length; i++) {
            lineNames.push(this.lines[i].name);
            if (this.lines.length == 2) {
                series[i] = {color: this.lines[i].color, axis: this.lines[i].code};
            } else {
                series[i] = {color: this.lines[i].color};
            }
        }

        this.options = {
            title: lineNames.join(' vs. '),
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            pointSize: 3,
            series: series,
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            }
        };

        if (this.lines.length == 2) {
            var yAxisLabels = {};
            for (var i = 0; i < this.lines.length; i++) {
                yAxisLabels[this.lines[i].code] = {label: this.lines[i].name};
            };
            this.options.axes = {
                y: yAxisLabels
            }
        };
    }

    createDataTable(days = 0) {
        if (all_hist_data.length < 1) {
            return;
        };

        var showLen = 0;
        if (days > 0) {
            showLen = days + 1;
        } else if (days == -1) {
            var valIdx = [];
            for (var j = 0; j < this.lines.length; j++) {
                valIdx.push(all_hist_data[0].indexOf(this.lines[j].code) * 2 - 1);
            };

            for (var i = 1; i < all_hist_data.length; i++) {
                for (var k = 0; k < valIdx.length; k++) {
                    if (all_hist_data[i][valIdx[k]] != '') {
                        showLen = all_hist_data.length - i + 1;
                        break;
                    }; 
                };
                if (showLen != 0) {
                    break;
                };
            };
        } else if (days == 0) {
            var buytable = null;
            for (var i = 0; ftjson != null && i < this.lines.length; i++) {
                if (ftjson[this.lines[i].code] !== undefined) {
                    buytable = ftjson[this.lines[i].code].buy_table;
                    break;
                }
            };

            if (buytable) {
                var fundDateIdx = 0;
                var firstnotsell = buytable.find(function(curVal) {
                    return curVal.sold == 0;
                });
                var notselldate = firstnotsell.date;
                var startDateArr = all_hist_data.find(function(curVal) {
                    return curVal[fundDateIdx] == notselldate;
                });
                showLen = all_hist_data.length - all_hist_data.indexOf(startDateArr) + 2;
            } else {
                showLen = 11;
            }
        } else {
            showLen = all_hist_data.length;
        }

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        for (var i = 0; i < this.lines.length; i++) {
            data.addColumn('number', this.lines[i].code);
            data.addColumn({type: 'string', role: 'style'})
            data.addColumn({type: 'string', role: 'tooltip'});
        };

        var rows = [];
        var len = all_hist_data.length;
        for (var i = 1; i < showLen; i++) {
            var date = all_hist_data[len - showLen + i][0];
            var strDate = utils.date_by_delta(date)
            var r = [strDate];
            for (var j = 0; j < this.lines.length; j++) {
                var valIdx = all_hist_data[0].indexOf(this.lines[j].code) * 2 - 1;
                var val = all_hist_data[len - showLen + i][valIdx];
                if (val == '') {
                    utils.logInfo(this.lines[j].name, strDate, "value not found!");
                    if (len - showLen + i - 1 > 0) {
                        all_hist_data[len - showLen + i][valIdx] = all_hist_data[len - showLen + i - 1][valIdx];
                        all_hist_data[len - showLen + i][valIdx + 1] = '0';
                        val = all_hist_data[len - showLen + i][valIdx];
                    } else {
                        val = 0;
                    }
                };
                r.push(val);
                var ptstyle = 'point {visible: false }';
                var pttooltip = strDate + ": " + val + ": " + all_hist_data[len - showLen  + i][valIdx + 1] + "%";
                if (ftjson[this.lines[j].code] !== undefined)
                {
                    var buytable = ftjson[this.lines[j].code].buy_table;
                    if (buytable) {
                        var buyrec = buytable.find(function(curVal) {
                            return curVal.date == date;
                        });
                        if (buyrec) {
                            pttooltip += " cost:" + buyrec.cost;
                            var ptsize = 3;
                            var ptclr = '#FF4500';
                            var aver_cost = ftjson[this.lines[j].code].holding_aver_cost;
                            if (buyrec.cost > 2000 || (aver_cost > 0 && buyrec.cost > 2 * aver_cost)) { 
                                ptsize = 5
                            };
                            if (buyrec.sold == 1) {
                                ptclr = '#FFD39B';
                            };
                            ptstyle = 'point {size: ' + ptsize + '; fill-color: ' + ptclr + ';}';
                        };
                    };

                    var selltable = ftjson[this.lines[j].code].sell_table;
                    if (selltable) {
                        var sellrec = selltable.find(function(curVal) {
                            return curVal.date == date;
                        });
                        if (sellrec) {
                            pttooltip += " sell:" + sellrec.cost;
                            ptstyle = 'point {size: 4; fill-color: #8B6914;}';
                        };
                    };
                }
                r.push(ptstyle);
                r.push(pttooltip);
            };
            rows.push(r);
        };

        var addLatestVal = false;
        for (var i = 0; i < this.lines.length; i++) {
            if (ftjson[this.lines[i].code] === undefined) {
                continue;
            };
            var jsonp = ftjson[this.lines[i].code].rtgz;
            if (jsonp && jsonp.gsz) {
                addLatestVal = true;
                break;
            };
        };

        if (addLatestVal) {
            var r = [utils.getTodayDate()];
            for (var i = 0; i < this.lines.length; i++) {
                var funddata = ftjson[this.lines[i].code];
                if (funddata !== undefined && funddata.rtgz && funddata.rtgz.gsz) {
                    r.push(parseFloat(funddata.rtgz.gsz));
                    r.push('point {visible: false }');
                    r.push("最新估值:" + funddata.rtgz.gsz); // tooltip
                } else {
                    r.push(null);
                    r.push(null);
                    r.push(null);
                }
            };
            rows.push(r);
        };
    
        data.addRows(rows);
        this.data = data;
    }

    drawChart(days = 0) {
        this.createDataTable(days);
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
    }
};



// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(googleChartLoaded);

var chart = null;

function googleChartLoaded() {
    chart = new FundChart('fund_chart_div');
    var szline = new FundLine('sz000001', '#87CEFA', '上证指数');
    chart.lines = [szline];
    if (all_hist_data.length > 0) {
        chart.drawChart();
    } else if (!utils.isEmpty(ftjson)) {
        getHistoryData('sz000001', 'index');
    }
};

function onChartPointSelected() {
    var selectedItem = chart.chart.getSelection()[0];
    if (selectedItem) {
        var date = chart.data.getValue(selectedItem.row, 0);
        var val = chart.data.getValue(selectedItem.row, 1);
        var code = chart.data.getColumnLabel(selectedItem.column);
        document.getElementById("chart_interaction").style.display = "block";
        if (!ftjson[code] || (!ftjson[code].buy_table && !ftjson[code].sell_table)) {
            ShowSelectedPointInfo(date +" 净值: "+ val);
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
            ShowSelectedPointInfo(date +" 净值: "+ val);
            return;
        };

        var textInfo = "";
        if (buyrec) {
            if (buyrec.sold == 1) {
                textInfo += date + " 买入 " + buyrec.cost + " 已卖出";
            } else {
                BuyRecordSelected(buyrec, code);
                return;
            }
        };

        if (sellrec) {
            textInfo += date + " 卖出: " + sellrec.ptn + "份, 成本: " + sellrec.cost;
        };
        ShowSelectedPointInfo(textInfo);
    }
}

function resetChartInteractionPanel() {
    document.getElementById("chart_interaction").style.display = "none";
}

function DrawFundHistory(fundcode) {
    resetChartInteractionPanel();
    var fdline = new FundLine(fundcode, '#B8860B', ftjson[fundcode]['name']);
    chart.lines = [fdline];

    if (all_hist_data.length == 0 || all_hist_data[0].indexOf(fundcode) < 0) {
        getHistoryData(fundcode, 'fund');
        return;
    };

    var days = utils.getHighlightedValue("dayslist");
    chart.drawChart(days);
}

function RedrawHistoryGraphs(ele, t) {
    var days = t.value;
    if (chart)
    {
        chart.drawChart(days);
    }
    utils.toggelHighlight(t);
}

function ResetHistoryGraph() {
    if (!chart) {
        return;
    }

    chart.lines = [new FundLine('sz000001', '#87CEFA', '上证指数')]
    var days = utils.getHighlightedValue("dayslist");
    chart.drawChart(days);
}

function getHistoryData(code, type) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundhist?code=' + code + '&type=' + type, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            updateHistData(JSON.parse(httpRequest.responseText));
        }
    }
}

function updateHistData(hist_data) {
    var updatingcode = hist_data[0][1];
    if (all_hist_data.length < 1) {
        all_hist_data = hist_data;
    } else {
        all_hist_data = utils.mergeHistData(all_hist_data, hist_data);
    }

    if (chart)
    {
        var chartRedraw = false;
        for (var i = 0; i < chart.lines.length; i++) {
            if (updatingcode = chart.lines[i].code) {
                chartRedraw = true;
            }
        };

        if (!chartRedraw) {
            return;
        };

        var days = utils.getHighlightedValue("dayslist");
        chart.drawChart(days);
    }
}

function ShowSelectedPointInfo(textInfo) {
    var selectDiv = document.getElementById("chart_selected_data");
    selectDiv.textContent = textInfo;
    selectDiv.selectedData = null;
}

function BuyRecordSelected(buyrec, code) {
    var selectDiv = document.getElementById("chart_selected_data");
    var selectedCode = selectDiv.selectedData ? selectDiv.selectedData.code: null;
    if (!selectedCode || selectedCode != code) {
        while(selectDiv.hasChildNodes()) {
            selectDiv.removeChild(selectDiv.lastChild);
        }
        selectDiv.selectedData = null;
        selectedCode = null;
    };
    
    if (!selectedCode) {
        selectDiv.selectedData = {code: code};
        selectedCode = code;
        var submitDiv = document.createElement("div");

        submitDiv.appendChild(document.createTextNode("天数>"));
        var daysInput = document.createElement("input");
        daysInput.placeholder = "天数";
        daysInput.value = "31";
        daysInput.size = 2;
        selectDiv.selectedData.days = 31;
        daysInput.onchange = function(e) {
            selectDiv.selectedData.days = parseInt(daysInput.value);
        };
        submitDiv.appendChild(daysInput);
        submitDiv.appendChild(document.createTextNode(", 收益率>"));

        var rateInput = document.createElement("input");
        rateInput.placeholder = "期望收益率";
        rateInput.size = 5;
        rateInput.value = (ftjson[code].str * 50).toFixed(3); // *100/2
        selectDiv.selectedData.rate = parseFloat(ftjson[code].str) / 2;
        rateInput.onchange = function(e) {
            selectDiv.selectedData.rate = parseFloat(rateInput.value) / 100;
        };
        submitDiv.appendChild(rateInput);
        submitDiv.appendChild(document.createTextNode("%"));

        var btnSubmit = document.createElement("button");
        btnSubmit.textContent = "OK";
        btnSubmit.onclick = function (e) {
            HandleSelectedRecords(selectDiv);
        };
        submitDiv.appendChild(btnSubmit);

        selectDiv.appendChild(submitDiv);
    };

    var selectedDates = selectDiv.selectedData.dates;
    if (!selectedDates) {
        selectedDates = [buyrec.date];
    } else {
        selectedDates.push(buyrec.date);
    }
    selectDiv.selectedData.dates = selectedDates;

    var buyInfo = document.createTextNode(utils.date_by_delta(buyrec.date) + ": " + buyrec.cost + " ");
    selectDiv.insertBefore(buyInfo, selectDiv.lastChild);
}

function HandleSelectedRecords(selectDiv) {
    var code = selectDiv.selectedData.code;
    if (!ftjson[code] || !ftjson[code].buy_table) {
        alert("数据错误！");
        return;
    }

    var buytable = ftjson[code].buy_table;
    var selectedDates = selectDiv.selectedData.dates;
    var jsonp = ftjson[code].rtgz;
    var gz = jsonp ? jsonp.gsz : ftjson[code].lnv;
    var short_term_rate = selectDiv.selectedData.rate;
    var short_term_days = selectDiv.selectedData.days;
    var dp = utils.getPuzzledDatePortion(buytable, selectedDates, gz, short_term_rate, short_term_days);
    if (!dp) {
        selectDiv.appendChild(document.createTextNode("无合适买卖！"));
    } else {
        var portion = utils.convertPortionToGram(dp.portion, ftjson[code].ppg).toFixed(4);
        var rate = (parseFloat(dp.rate) * 100).toFixed(2) + "%";
        var dates = dp.dates;
        selectDiv.appendChild(document.createTextNode("可卖出:" + portion + " 成本:" + dp.cost + " 预期收益:" + rate));
        var btnSell = document.createElement("button");
        btnSell.textContent = "卖出";
        btnSell.onclick = function(e) {
            //alert("卖出执行！" + code + ":" + dates);
            sellFund(code, utils.getTodayDate(), dates);
        }
        selectDiv.appendChild(btnSell);
    }
}
