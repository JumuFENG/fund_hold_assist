'use strict';

class DailyDataAnalyzer {
    constructor() {
        this.chartsDiv = null;
    }

    initUi() {
        var iptDiv = document.createElement('div');
        var iptFile = document.createElement('input');
        iptFile.type = 'file';
        iptFile.addEventListener('change', e => {
            e.target.files[0].text().then(text => {
                this.onDailyTradingData(e.target.files[0].name, JSON.parse(text));
            });
        });
        iptDiv.appendChild(document.createTextNode('Please select the daily trading data.'));
        iptDiv.appendChild(iptFile);
        document.body.appendChild(iptDiv);
        this.chartsDiv = document.createElement('div');
        document.body.appendChild(this.chartsDiv);
    }

    onDailyTradingData(name, dailyData) {
        // this.drawOffsetSingleLine(name.substr(0, 15), dailyData);
        // this.drawOffsetPriceLine(name.substr(0, 15), dailyData);
        this.drawPriceWithTrend(name.substr(0, 15), dailyData);
    }

    drawOffsetSingleLine(name, dailyData) {
        var paoffset = [];
        for (var i = 0; i < dailyData.length; i++) {
            paoffset.push(100 * (dailyData[i][0] - dailyData[i][1]) / dailyData[i][1]);
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new SingleLineChart(chartDiv);
            gchart.drawLines(name, paoffset);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }

    drawOffsetPriceLine(name, dailyData) {
        var paoffset = [];
        for (var i = 0; i < dailyData.length; i++) {
            paoffset.push([100 * (dailyData[i][0] - dailyData[i][1]) / dailyData[i][1], parseFloat(dailyData[i][0])]);
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new TwoLineChart(chartDiv);
            gchart.drawLines(name, paoffset);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }

    drawPriceWithTrend(name, dailyData) {
        var points = [];
        for (var i = 0; i < dailyData.length; i++) {
            points.push(parseFloat(dailyData[i][0]));
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new PriceTrendChart(chartDiv);
            gchart.drawLines(name, points);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }
};

class LineChart {
    constructor(chart_div) {
        this.chart = new google.visualization.LineChart(chart_div);
    }

    createOption(name) {
        this.options = null;
    }

    createDataTable(points) {
        this.data = null;
    }

    drawLines(name, points) {
        this.createOption(name);
        this.createDataTable(points);
        if (this.data && this.options) {
            this.chart.draw(this.data, this.options);
        };
    }
}

class SingleLineChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0
                }
            }
        };
    }

    createDataTable(points) {
        this.data = new google.visualization.DataTable();
        this.data.addColumn('string', 'order');
        this.data.addColumn('number', 'offset');
        var rows = [];
        for (var i = 0; i < points.length; i++) {
            rows.push(['' + i, points[i]]);
        };
        this.data.addRows(rows);
    }
};

class TwoLineChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                },
                1: {}
            },
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    targetAxisIndex: 1
                }
            }
        };
    }

    createDataTable(ptpair) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'order');
        data.addColumn('number', 'offset');
        data.addColumn('number', 'price');

        var rows = [];
        for (var i = 0; i < ptpair.length; i++) {
            rows.push(['' + i, ptpair[i][0], ptpair[i][1]]);
        };
        data.addRows(rows);
        this.createOption(name);
        this.chart.draw(data, this.options);
    }
}

class PriceTrendChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    targetAxisIndex: 0
                },
                2: {
                    targetAxisIndex: 0
                }
            }
        };
    }

    nextPeeks(peeks) {
        if (peeks.length <= 2) {
            return peeks;
        };

        var pks = [peeks[0]];
        var increasing = peeks[0][0] < peeks[1][0];
        var lastIdx = 0;
        for (var i = 1; i < peeks.length - 1; i += 2) {
            if (i + 2 > peeks.length - 1) {
                lastIdx = i;
                break;
            };
            if (increasing) {
                if (peeks[i][0] <= peeks[i + 2][0]) {
                    continue;
                } else {
                    pks.push(peeks[i]);
                    increasing = false;
                    i--;
                };
            } else {
                if (peeks[i][0] >= peeks[i + 2][0]) {
                    continue;
                } else {
                    pks.push(peeks[i]);
                    increasing = true;
                    i--;
                };
            };
        };
        
        if (lastIdx > 0) {
            for (var i = lastIdx; i < peeks.length; i++) {
                pks.push(peeks[i]);
            };
        };
        
        console.log(pks);
        return pks;
    }

    getPeeks(points) {
        if (points.length <= 2) {
            return points;
        };
        var peeks = [points[0]];
        var increasing = points[0][0] < points[1][0];
        if (points[0][0] == points[1][0]) {
            for (var i = 1; i < points.length; i++) {
                if (points[i][0] == points[i - 1][0]) {
                    continue;
                };
                increasing = points[i - 1][0] < points[i][0];
                break;
            };
        };

        for (var i = 1; i < points.length - 1; i++) {
            if (points[i][0] == peeks[peeks.length - 1][0]) {
                continue;
            };

            if (increasing) {
                if (points[i][0] <= points[i + 1][0]) {
                    continue;
                } else {
                    increasing = false;
                    peeks.push(points[i]);
                }
            } else {
                if (points[i][0] >= points[i + 1][0]) {
                    continue;
                } else {
                    peeks.push(points[i]);
                    increasing = true;
                }
            };
        };
        peeks.push(points[points.length - 1]);
        console.log(peeks);
        return peeks;
    }

    createDataTable(ptpair) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'order');
        data.addColumn('number', 'price');
        data.addColumn('number', 'p1');
        data.addColumn('number', 'p2');

        var rows = [];
        var points = [];
        for (var i = 0; i < ptpair.length; i++) {
            rows.push(['' + i, ptpair[i]]);
            points.push([ptpair[i], i]);
        };
        var peeks = this.getPeeks(points);
        var pks = this.nextPeeks(peeks);

        while (pks.length > 30) {
            peeks = pks;
            pks = this.nextPeeks(peeks);
        };

        var rlen = rows[0].length;
        for (var i = 0; i < peeks.length; i++) {
            rows[peeks[i][1]].push(peeks[i][0]);
        };
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].length == rlen) {
                rows[i].push(null);
            };
        };

        rlen++;
        for (var i = 0; i < pks.length; i++) {
            rows[pks[i][1]].push(pks[i][0]);
        };
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].length == rlen) {
                rows[i].push(null);
            };
        };
        data.addRows(rows);
        this.createOption(name);
        this.chart.draw(data, this.options);
    }
}

window.onload = e => {
    dailyDa.initUi();
};

let dailyDa = new DailyDataAnalyzer();

var googleChartLoaded = false;
// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(function(){
    googleChartLoaded = true;
});
