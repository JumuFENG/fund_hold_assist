class FundChart {
    constructor(chart_div) {
        // Instantiate and draw our chart, passing in some options.
        this.chart = new google.visualization.LineChart(document.getElementById(chart_div));
        this.data = null;
        this.codes = [];
        this.chartTitle = null;
        google.visualization.events.addListener(this.chart, 'select', function selectHandler() {
            onChartPointSelected();
        });
    }

    createChartOption() {
        // Set chart options
        var colors = ['#B8860B', 'red', 'blue', 'green', 'gray', 'yellow', 'black'];
        var series = {}
        for (var i = 0; i < this.codes.length; i++) {
            if (this.codes.length == 2) {
                series[i] = {color: colors[i], axis: this.codes[i]};
            } else {
                series[i] = {color: colors[i]};
            }
        }

        this.options = {
            title: this.chartTitle,
            width: 800,
            height: 600,
            crosshair: { trigger: 'both', opacity: 0.5},
            pointSize: 3,
            series: series,
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            }
        };

        if (this.codes.length == 2) {
            var yAxisLabels = {};
            for (var i = 0; i < this.codes.length; i++) {
                yAxisLabels[this.codes[i]] = {label: this.codes[i]};
            };
            this.options.axes = {
                y: yAxisLabels
            }
        };
    }

    createDataTable(days = 0) {
        var len = all_hist_data.length;
        var showLen = days > 0 ? days + 1 : len;
        if (days == 0) {
            var buytable = null;
            for (var i = 0; i < this.codes.length; i++) {
                if (ftjson[this.codes[i]] !== undefined) {
                    buytable = ftjson[this.codes[i]]["buy_table"];
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
            }
            else {
                showLen = 11;
            }
        };

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        for (var i = 0; i < this.codes.length; i++) {
            data.addColumn('number', this.codes[i]);
            data.addColumn({type: 'string', role: 'style'})
            data.addColumn({type: 'string', role: 'tooltip'});
        };

        var rows = [];
        for (var i = 1; i < showLen; i++) {
            var date = all_hist_data[len - showLen + i][0];
            var r = [date];
            for (var j = 0; j < this.codes.length; j++) {
                var valIdx = all_hist_data[0].indexOf(this.codes[j]) * 2 - 1;
                var val = all_hist_data[len - showLen + i][valIdx];
                if (val == '') {
                    console.log(this.codes[j], date, "value not found!");
                    val = 0;
                };
                r.push(val);
                var ptstyle = 'point {visible: false }';
                var pttooltip = date + ": " + val + ": " + all_hist_data[len - showLen  + i][valIdx + 1] + "%";
                if (ftjson[this.codes[j]] !== undefined)
                {
                    var buytable = ftjson[this.codes[j]]["buy_table"];
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

                    var selltable = ftjson[this.codes[j]]["sell_table"];
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

        this.chart.draw(this.data, this.options);
    }
};



// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(googleChartLoaded);

var chart = null;

function googleChartLoaded() {
    if (all_hist_data.length > 0) {
        chart = new FundChart('fund_chart_div');
        chart.codes = ["sz000001"];
        chart.chartTitle = '上证指数';
        chart.drawChart();
    };
};

function onChartPointSelected() {
    var selectedItem = chart.chart.getSelection()[0];
    if (selectedItem) {
        var topping = chart.data.getValue(selectedItem.row, selectedItem.column);
        alert(topping);
    }
}

function DrawFundHistory(fundcode) {
    var days = 0;
    var sibling = document.getElementById("dayslist").firstElementChild;
    while (sibling != null) {
        if (sibling.className == "highlight") {
            days = sibling.value;
            break;
        };
        sibling = sibling.nextElementSibling;
    }
    chart.codes = [fundcode];
    chart.chartTitle = ftjson[fundcode]['name'];
    chart.drawChart(days);
}

function RedrawHistoryGraphs(ele, t) {
    var days = t.value;
    // var codes = ["sz000001"]
    // if (ele.parentElement.id) {
    //     codes.push(ele.parentElement.id.split('_').pop());
    // }
    // chart.codes = codes;
    chart.drawChart(days);
    t.className = "highlight";
    var sibling = t.parentElement.firstChild;
    while (sibling != null) {
        if (sibling != t) {
            sibling.className = "";
        };
        sibling = sibling.nextElementSibling;
    }
}
