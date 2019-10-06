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
                    buytable = ftjson[this.lines[i].code]["buy_table"];
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
            var r = [date];
            for (var j = 0; j < this.lines.length; j++) {
                var valIdx = all_hist_data[0].indexOf(this.lines[j].code) * 2 - 1;
                var val = all_hist_data[len - showLen + i][valIdx];
                if (val == '') {
                    console.log(this.lines[j].name, date, "value not found!");
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
                var pttooltip = date + ": " + val + ": " + all_hist_data[len - showLen  + i][valIdx + 1] + "%";
                if (ftjson[this.lines[j].code] !== undefined)
                {
                    var buytable = ftjson[this.lines[j].code]["buy_table"];
                    if (buytable) {
                        var buyrec = buytable.find(function(curVal) {
                            return curVal.date == date;
                        });
                        if (buyrec) {
                            pttooltip += " cost:" + buyrec.cost;
                            var ptsize = 3;
                            var ptclr = '#FF4500';
                            if (buyrec.cost > 500) {
                                ptsize = 5
                            };
                            if (buyrec.sold == 1) {
                                ptclr = '#FFD39B';
                            };
                            ptstyle = 'point {size: ' + ptsize + '; fill-color: ' + ptclr + ';}';
                        };
                    };

                    var selltable = ftjson[this.lines[j].code]["sell_table"];
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
    } else if (document.getElementById('funds_list_container').style.display != 'none') {
        getHistoryData('sz000001', 'index');
    }
};

function onChartPointSelected() {
    var selectedItem = chart.chart.getSelection()[0];
    if (selectedItem) {
        var topping = chart.data.getValue(selectedItem.row, selectedItem.column);
        alert(topping);
    }
}

function DrawFundHistory(fundcode) {
    var fdline = new FundLine(fundcode, '#B8860B', ftjson[fundcode]['name']);
    chart.lines = [fdline];

    if (all_hist_data.length == 0 || all_hist_data[0].indexOf(fundcode) < 0) {
        getHistoryData(fundcode, 'fund');
        return;
    };

    var days = 0;
    var sibling = document.getElementById("dayslist").firstElementChild;
    while (sibling != null) {
        if (sibling.className == "highlight") {
            days = sibling.value;
            break;
        };
        sibling = sibling.nextElementSibling;
    }
    chart.drawChart(days);
}

function RedrawHistoryGraphs(ele, t) {
    var days = t.value;
    if (chart)
    {
        chart.drawChart(days);
    }
    
    t.className = "highlight";
    var sibling = t.parentElement.firstChild;
    while (sibling != null) {
        if (sibling != t) {
            sibling.className = "";
        };
        sibling = sibling.nextElementSibling;
    }
}

function ResetHistoryGraph() {
    if (!chart) {
        return;
    }

    chart.lines = [new FundLine('sz000001', '#87CEFA', '上证指数')]
    var days = 0;
    var sibling = document.getElementById("dayslist").firstElementChild;
    while (sibling != null) {
        if (sibling.className == "highlight") {
            days = sibling.value;
            break;
        };
        sibling = sibling.nextElementSibling;
    }
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
        var basic_his_data = all_hist_data;
        var extend_his_data = hist_data;
        if (all_hist_data.length < hist_data.length) {
            basic_his_data = hist_data;
            extend_his_data = all_hist_data;
        };

        all_hist_data = [];
        var header = basic_his_data[0];
        for (var i = 1; i < extend_his_data[0].length; i++) {
            header.push(extend_his_data[0][i]);
        };
        all_hist_data.push(header);

        for (var i = 1; i < basic_his_data.length; i++) {
            var row = basic_his_data[i];
            var date = row[0];
            var find_same_date = false;
            for (var j = 1; j < extend_his_data.length; j++) {
                var ext_data = extend_his_data[j];
                var fdate = ext_data[0];
                if (fdate < date) {
                    continue;
                } else {
                    if (fdate == date) {
                        for (var k = 1; k < ext_data.length; k++) {
                            row.push(ext_data[k]);
                        };
                        find_same_date = true;
                    }
                    break;
                };
            };
            if (!find_same_date) {
                for (var ii = 0; ii < extend_his_data[1].length - 1; ii++) {
                    row.push('');
                };
            };
            all_hist_data.push(row);
        };
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

        var days = 0;
        var sibling = document.getElementById("dayslist").firstElementChild;
        while (sibling != null) {
            if (sibling.className == "highlight") {
                days = sibling.value;
                break;
            };
            sibling = sibling.nextElementSibling;
        }
        chart.drawChart(days);
    }
}
