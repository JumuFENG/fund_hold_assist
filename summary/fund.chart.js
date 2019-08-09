function general_config(title) {
    var config = {};
    config.type = 'line';
    config.data = {labels:[], datasets:[]};
    var option = {};
    option.responsive = true;
    option.title = {display:true, text: title};
    option.tooltip = {mode:'index', intersect: true};
    option.hover = {mode: 'nearest', intersect: true};
    option.scales = {
            xAxes: [{
                display: false,
                scaleLabel: {
                    display: true,
                    labelString: 'Date'
                }
            }],
            yAxes: [{
                display: false,
                scaleLabel: {
                    display: true,
                    labelString: 'Value'
                }
            }]}
    option.elements = {line:{tension:0}};
    config.options = option;

    return config;
}

function drawSingleSzzsHistory(ctx, line_config, labels, dataset) {
    line_config.data.labels = labels;
    line_config.data.datasets.push(dataset);
    var szzs_line = new Chart(ctx, line_config);
}

function DrawSzzsHistory(days = 30) {
    var labels = [];
    var dataset = {
        label: '',
        backgroundColor: 'blue',
        borderColor: 'darkgrey',
        data: [],
        fill: false,
    }
    var dataArr = all_hist_data;
    var len = dataArr.length;
    var showLen = days > 0 ? days : len;
    for (var i = 1; i < showLen; i++) {
        labels.push(dataArr[len - showLen + i][0]);
        dataset.data.push(dataArr[len - showLen + i][1]);
    };
    var ctx = document.getElementById('sz000001_canvas').getContext('2d');
    var szzs_config = general_config("上证指数");
    drawSingleSzzsHistory(ctx, szzs_config, labels, dataset);
}

function DrawFundHistory(fundcode, days = 30) {
    var labels = [];
    var dataset = {
        label: '',
        backgroundColor: 'purple',
        borderColor: 'darkgrey',
        data: [],
        fill: false,
    }
    var dataArr = all_hist_data;
    var len = dataArr.length;
    var fundValIdx = dataArr[0].indexOf(fundcode) * 2 - 1;
    var showLen = days > 0 ? days : len;
    for (var i = 1; i < showLen; i++) {
        labels.push(dataArr[len - showLen + i][0]);
        dataset.data.push(dataArr[len - showLen + i][fundValIdx]);
    };

    var fund_config = general_config(ftjson[fundcode]["name"]);
    var ctx_short = document.getElementById('fund_canvas').getContext('2d');
    drawSingleSzzsHistory(ctx_short, fund_config, labels, dataset);
}

function RedrawHistoryGraphs(ele, t) {
    var days = parseInt(t.innerText);
    DrawSzzsHistory(days);
    if (ele.parentElement.id) {
        DrawFundHistory(ele.parentElement.id.split('_').pop(), days);
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
