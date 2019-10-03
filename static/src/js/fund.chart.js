class FundChart {
    constructor(chart_div) {
        // Instantiate and draw our chart, passing in some options.
        this.chart = new google.visualization.LineChart(document.getElementById(chart_div));
        this.data = null;
        this.codes = [];
        this.chatTitle = 'Fund History.';
        google.visualization.events.addListener(this.chart, 'select', function selectHandler() {
            this.onChartPointSelected();
        });
    }

    createChartOption() {
        // Set chart options
        this.options = {
            title:this.chatTitle,
            width:800,
            height:600,
            pointSize: 5,
            series: {},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            }
        };
        var series = {}
        var pshapes = ['circle', 'triangle'];
        for (var i = 0; i < this.codes.length; i++) {
            series[i] = {pointShape : pshapes[i]};
        };
        this.options.series = series;
    }

    createDataTable(days = 0) {
        var len = all_hist_data.length;
        var showLen = days > 0 ? days + 1 : len;
        if (days == 0) {
            showLen = 18;
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
                r.push(val);
                var szstyle = null;
                r.push(szstyle);
                var sztooltip = date + ": " + val + ": " + all_hist_data[len - showLen  + i][valIdx + 1] + "%";
                r.push(sztooltip);
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

    onChartPointSelected() {
        var selectedItem = this.chart.getSelection()[0];
        if (selectedItem) {
            var topping = this.data.getValue(selectedItem.row, selectedItem.column);
            alert(topping);
        }
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
        chart.drawChart();
    };
};

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
