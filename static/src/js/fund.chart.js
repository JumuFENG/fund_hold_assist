class FundLine {
    constructor(code, name, indexCode = null, indexName = null) {
        this.code = code;
        this.name = name;
        this.indexCode = indexCode;
        this.indexName = indexName;
    }
};

class FundChart {
    constructor(chart_div) {
        // Instantiate and draw our chart, passing in some options.
        this.chart = new google.visualization.LineChart(chart_div);
        this.chartDiv = chart_div;
        this.data = null;
        this.line = null;
        this.ticks = [];
        this.marks = [];
        this.maxValue = null;
        this.minValue = null;
        this.maxIndex = null;
        this.minIndex = null;
        google.visualization.events.addListener(this.chart, 'ready', this.drawVticks);
        google.visualization.events.addListener(this.chart, 'select', function () {
            onChartPointSelected();
        });
    }

    createChartOption() {
        // Set chart options
        this.ticks = [];
        var minTick = Math.round(this.minValue * 100 - 1) / 100;
        var maxTick = Math.round(this.maxValue * 100 + 1) / 100;
        var delta = (maxTick - minTick) / 6;
        for (var i = 0; i < 7; i++) {
            var v = minTick + i * delta;
            this.ticks.push(v);
        };

        var markMax = this.marks[0];
        var markMin = this.marks[0];
        for (var i = 1; i < this.marks.length; i++) {
            if (this.marks[i] < markMin) {
                markMin = this.marks[i];
            };
            if (this.marks[i] > markMax) {
                markMax = this.marks[i];
            };
        };

        for (var i = 0; i < this.ticks.length; i++) {
            if (this.ticks[i] >= markMin && this.ticks[i] <= markMax) {
                this.ticks.splice(i,1);
            };
        };

        for (var i = 0; i < this.marks.length; i++) {
            var added = false;
            for (var j = 0; j < this.ticks.length - 1; j++) {
                if (this.ticks[j] >= this.marks[i]) {
                    this.ticks.splice(j, 0, this.marks[i]);
                    added = true;
                    break;
                }
                if (this.ticks[j] < this.marks[i] && this.ticks[j + 1] > this.marks[i]) {
                    this.ticks.splice(j + 1, 0, this.marks[i]);
                    added = true;
                    break;
                }
            }
            if (!added) {
                this.ticks.push(this.marks[i]);
            }
        }

        for (var i = this.ticks.length - 1; i > 0; i--) {
            if (this.ticks[i] === this.ticks[i-1]) {
                this.ticks.splice(i,1);
            }
        }

        for (var i = this.ticks.length - 1; i > 0; i--) {
            if (this.ticks[i] - this.ticks[i - 1] <= delta * 0.1) {
                if (this.marks.indexOf(this.ticks[i]) === -1) {
                    this.ticks.splice(i,1);
                } else if (this.marks.indexOf(this.ticks[i - 1]) === -1) {
                    this.ticks.splice(i - 1, 1);
                }
            }
        }

        var v0ticks = [];
        for (var i = 0; i < this.ticks.length; i++) {
            v0ticks.push({v: this.ticks[i], f: this.ticks[i].toFixed(this.marks.indexOf(this.ticks[i]) === -1 ? 2 : 4)});
        };

        this.options = {
            title: this.line.name,
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
        if (this.line.indexCode) {
            var v2ticks = [];
            var minTick2 = Math.round(this.minIndex - 1);
            var maxTick2 = Math.round(this.maxIndex + 1);
            var delta2 = (maxTick2 - minTick2) / 6;
            for (var i = 0; i < 7; i++) {
                var v = minTick2 + i * delta2;
                v2ticks.push({v: v, f: v.toFixed()});
            };

            this.options.vAxes["1"].ticks = v2ticks
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
        var aver_price = null;
        var valIdx = all_hist_data[0].indexOf(this.line.code) * 2 - 1;
        var val = all_hist_data[histIdx][valIdx];
        if (val == '') {
            utils.logInfo(this.line.name, strDate, "value not found!");
            if (histIdx - 1 > 0) {
                all_hist_data[histIdx][valIdx] = all_hist_data[histIdx - 1][valIdx];
                all_hist_data[histIdx][valIdx + 1] = '0';
                val = all_hist_data[histIdx][valIdx];
            } else {
                val = 0;
            }
        };
        r.push(val);
        if (val > this.maxValue) {
            this.maxValue = val;
        };
        if (val < this.minValue) {
            this.minValue = val;
        };
        var ptstyle = 'point {visible: false }';
        var pttooltip = strDate + "\n" + val + ": " + all_hist_data[histIdx][valIdx + 1] + "%";
        if (ftjson[this.line.code] !== undefined) {
            var buytable = ftjson[this.line.code].buy_table;
            if (buytable) {
                var buyrec = buytable.find(function(curVal) {
                    return curVal.date == date;
                });
                if (buyrec) {
                    pttooltip += "\n买入:" + buyrec.cost;
                    var ptsize = 3;
                    var ptclr = '#FF4500';
                    var aver_cost = ftjson[this.line.code].holding_aver_cost;
                    if (buyrec.cost > 2000 || (aver_cost > 0 && buyrec.cost > 2 * aver_cost)) { 
                        ptsize = 5
                    };
                    if (buyrec.sold == 1) {
                        ptclr = '#FFD39B';
                    };
                    ptstyle = 'point {size: ' + ptsize + '; fill-color: ' + ptclr + ';}';
                };
            };
            var selltable = ftjson[this.line.code].sell_table;
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
        if (this.line.indexCode) {
            var valIdx = all_hist_data[0].indexOf(this.line.indexCode) * 2 - 1;
            var val = all_hist_data[histIdx][valIdx];
            if (val == '') {
                utils.logInfo(this.line.indexCode, strDate, "value not found!");
                if (histIdx - 1 > 0) {
                    all_hist_data[histIdx][valIdx] = all_hist_data[histIdx - 1][valIdx];
                    all_hist_data[histIdx][valIdx + 1] = '0';
                    val = all_hist_data[histIdx][valIdx];
                } else {
                    val = 0;
                }
            };
            r.push(val);
            if (val > this.maxIndex) {
                this.maxIndex = val;
            };
            if (val < this.minIndex) {
                this.minIndex = val;
            };
        };

        return r;
    }

    createDataTable(days = 0) {
        if (all_hist_data.length < 1) {
            return;
        };

        this.marks = [];
        this.maxValue = 0;
        this.minValue = 0;
        if (ftjson && ftjson[this.line.code] !== undefined) {
            var average = ftjson[this.line.code].avp;
            var lhrate = ftjson[this.line.code].str / 3.0; // short_term_rate/3
            this.maxValue = average * (1 + lhrate);
            this.minValue = average * (1 - lhrate);
            this.marks.push(average);
            this.marks.push(this.maxValue);
            this.marks.push(this.minValue);
        }

        var showLen = 0;
        if (days > 0) {
            showLen = days + 1;
        } else if (days == 0) {
            var buytable = null;
            if (ftjson != null && ftjson[this.line.code] !== undefined) {
                buytable = ftjson[this.line.code].buy_table;
            }

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
        } else if (days == -1) {
            showLen = this.getMaxHistoryLen();
        }
        var maxHistLen = this.getMaxHistoryLen();
        showLen = maxHistLen >= showLen? showLen: maxHistLen;

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        data.addColumn('number', this.line.code);
        data.addColumn({type: 'string', role: 'style'});
        data.addColumn({type: 'string', role: 'tooltip'});
        if (this.line.indexCode) {
            data.addColumn('number', this.line.indexName);
        };

        var rows = [];
        var len = all_hist_data.length;
        if (this.line.indexCode) {
            var valIdx = all_hist_data[0].indexOf(this.line.indexCode) * 2 - 1;
            var val = all_hist_data[len - showLen + 1][valIdx];
            this.maxIndex = val;
            this.minIndex = val;
        };
        for (var i = 1; i < showLen; i++) {
            var r = this.createDataRow(len - showLen + i);
            rows.push(r);
        };

        var addLatestVal = false;
        if (ftjson[this.line.code] !== undefined) {
            var jsonp = ftjson[this.line.code].rtgz;
            if (jsonp && jsonp.gsz) {
                addLatestVal = true;
            };
        };

        if (addLatestVal) {
            var r = [utils.getTodayDate()];
            var funddata = ftjson[this.line.code];
            if (funddata !== undefined && funddata.rtgz && funddata.rtgz.gsz) {
                r.push(parseFloat(funddata.rtgz.gsz));
                r.push('point {visible: false }');
                r.push("最新估值:" + funddata.rtgz.gsz); // tooltip
            }
            if (this.line.indexCode) {
                r.push(null);
            }
            rows.push(r);
        };
    
        data.addRows(rows);
        this.data = data;
    }

    drawVticks() {
        chart.onDrawVticks();
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
        var valIdx = all_hist_data[0].indexOf(this.line.code) * 2 - 1;
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
};



// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(googleChartLoaded);

var chart = null;

function googleChartLoaded() {
    chart = new FundChart(document.getElementById('fund_chart_div'));
    if (!utils.isEmpty(ftjson)) {
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
    chart.line = fundcode == "000217" ?
        new FundLine(fundcode, ftjson[fundcode]['name']):
        new FundLine(fundcode, ftjson[fundcode]['name'], 'sz000001', '上证指数');

    if (all_hist_data.length == 0 || all_hist_data[0].indexOf(fundcode) < 0) {
        getHistoryData(fundcode, 'fund');
        return;
    };

    var days = utils.getHighlightedValue("dayslist");
    chart.drawChart(days);
    document.getElementById("chart_left_arrow").disabled = false;
    document.getElementById("chart_right_arrow").disabled = true;
}

function RedrawHistoryGraphs(ele, t) {
    var days = t.value;
    if (chart)
    {
        chart.drawChart(days);
        document.getElementById("chart_left_arrow").disabled = false;
        document.getElementById("chart_right_arrow").disabled = true;
    }
    utils.toggelHighlight(t);
}

function LeftShiftGraph(leftBtn, rightBtn) {
    if (chart) {
        chart.leftShift();
        leftBtn.disabled = !chart.canShiftLeft();
        rightBtn.disabled = !chart.canShiftRight();
    };
}

function RightShiftGraph(leftBtn, rightBtn) {
    if (chart) {
        chart.rightShift();
        leftBtn.disabled = !chart.canShiftLeft();
        rightBtn.disabled = !chart.canShiftRight();
    };
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
        if (!chart.line || updatingcode != chart.line.code) {
            return;
        };

        var days = utils.getHighlightedValue("dayslist");
        chart.drawChart(days);
        document.getElementById("chart_left_arrow").disabled = false;
        document.getElementById("chart_right_arrow").disabled = true;
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
    selectDiv.selectedData.dates = selectedDates;

    if (!dateExists) {
        var buyInfo = document.createTextNode(utils.date_by_delta(buyrec.date) + ": " + buyrec.cost + " ");
        selectDiv.insertBefore(buyInfo, selectDiv.lastChild);
    };
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
