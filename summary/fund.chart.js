var szzs_config = {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options:{
        responsive: true,
        title: {
            display: true,
            text: ''
        },
        tooltip: {
            mode: 'index',
            intersect: true
        },
        hover: {
            mode: 'nearest',
            intersect: true
        },
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Date'
                }
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Value'
                }
            }]
        }
    }
};

var szzs_line;

function DrawSzzsHistory() {
    var ctx = document.getElementById('sz000001_canvas').getContext('2d');
    szzs_config.data.labels = [1, 2, 3, 4, 5, 6, 7, 8];
    var dataset = {
        label: '上证指数',
        backgroundColor: "#339933",
        borderColor: "#339933",
        data: [],
        fill: false,
    }
    dataset.data = [1, 4, 6, 8, 10, 12, 17, 20];
    szzs_config.data.datasets.push(dataset);
    szzs_line = new Chart(ctx, szzs_config);
    //szzs_line.update();
}