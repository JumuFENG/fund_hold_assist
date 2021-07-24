'use strict';

class DailyDataAnalyzer {
    constructor() {
        this.chartsDiv = null;
    }

    initUi() {
        var iptDiv = document.createElement('div');
        var iptFile = document.createElement('input');
        iptFile.type = 'file';
        iptFile.owner = this;
        iptFile.addEventListener('change', e => {
            e.target.files[0].text().then(text => {
                e.target.owner.onDailyTradingData(JSON.parse(text));
            });
        });
        iptDiv.appendChild(document.createTextNode('Please select the daily trading data.'));
        iptDiv.appendChild(iptFile);
        document.body.appendChild(iptDiv);
        this.chartsDiv = document.createElement('div');
        document.body.appendChild(this.chartsDiv);
    }

    onDailyTradingData(dailyData) {
        this.paoffset = [];
        for (var i = 0; i < dailyData.length; i++) {
            this.paoffset.push(100 * (dailyData[i][0] - dailyData[i][1]) / dailyData[i][1]);
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new SingleLineChart(chartDiv);
            gchart.drawLine(this.paoffset);
            //this.paoffset.forEach(o => offsetstring += o.toFixed(2));
            //document.body.appendChild(document.createTextNode(this.paoffset.join(' ')));
        } else {
            console.log('google Chart Not Loaded!');
        };
    }
};

class SingleLineChart {
    constructor(chart_div) {
        this.chart = new google.visualization.LineChart(chart_div);
    }

    createOption() {
        this.options = {
            title: '',
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

    drawLine(points) {
        var data = new google.visualization.DataTable();
        data.addColumn('number', 'order');
        data.addColumn('number', 'offset');
        var rows = [];
        for (var i = 0; i < points.length; i++) {
            rows.push([i, points[i]]);
        };
        data.addRows(rows);
        this.createOption();
        this.chart.draw(data, this.options);
    }
};

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
