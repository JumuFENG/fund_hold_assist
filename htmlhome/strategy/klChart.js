'use strict';

class KlChartSimple {
    // 简单K线图
    constructor(cont, title, link) {
        this.container = cont;
        this.option = {
            legend: {
                left: 'right'
            },
            animation: false,
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'},            },
            title: {text: title, left: 'center', textStyle: {color: 'rgb(133, 146, 232)'}, link},
            xAxis: [
                {type: 'category', axisLabel: {show: true}}
            ],
            yAxis: [
                {scale: true},
            ]
        };
    }

    drawKlines(data) {
        if (this.chart === undefined) {
            this.chart = echarts.init(this.container);
        }
        this.option.dataset = {source: data};
        this.option.series = [
            {
                type: 'k', xAxisIndex: 0, yAxisIndex: 0, 
                encode: {x: 'time', y: ['o','c','l','h']},
            }
        ];
        this.option.tooltip.formatter = function (params) {
            var param = params[0];
            return [
                '' + param.value.time,
                '开盘 ' + param.value.o,
                '收盘 ' + param.value.c,
                '最低 ' + param.value.l,
                '最高 ' + param.value.h,
                '成交量(手)<br/>' + param.value.v
            ].join('<br/>');
        };

        var datalength = this.option.dataset.source.length;
        if (datalength > 150) {
            this.option.dataZoom = {
                show: true,
                xAxisIndex: [0, 1],
                start: 0,
                end: 15000 / datalength,
            };
        }
        this.chart.setOption(this.option);
    }
}

class KlChart {
    // K线图
    constructor(cont, title, link) {
        this.container = cont;
        this.option = {
            legend: {
                left: 'right'
            },
            animation: false,
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'},            },
            title: {text: title, left: 'center', textStyle: {color: 'rgb(133, 146, 232)'}, link},
            grid: [{left: '10%', right: '8%', height: '60%'}, {left: '10%', right: '8%', top: '75%', height: '15%'}],
            xAxis: [
                {type: 'category', axisLabel: {show: true}},
                {type: 'category', gridIndex: 1, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }}
            ],
            axisPointer: {link: {xAxisIndex: 'all'}},
            yAxis: [
                {scale: true},
                {scale: true, gridIndex: 1, axisTick: { show: false }, axisLabel: { show: false }}
            ]
        };
    }

    calculateMA(dcount, data) {
        var result = [];
        for (var i = 0; i < data.length; ++i) {
            if (i < dcount) {
                var sum = 0;
                for (var j = 0; j <= i; ++j) {
                    sum -= data[j].c;
                }
                result.push([data[i].time, -(sum / (i + 1)).toFixed(3)]);
                continue;
            }
            var sum = 0;
            for (var j = 0; j < dcount; ++j) {
                sum -= data[i - j].c;
            }
            result.push([data[i].time, -(sum / dcount).toFixed(3)]);
        }
        return result;
    }

    drawKlines(data) {
        if (this.chart === undefined) {
            this.chart = echarts.init(this.container);
        }
        data[0].vup = 1;
        for (var i = 1; i < data.length; ++i) {
            data[i].vup = (data[i].c - data[i-1].c) >= 0 ? 1 : -1;
        }
        this.option.dataset = {source: data};
        this.option.series = [
            {
                type: 'k', xAxisIndex: 0, yAxisIndex: 0,
                encode: {x: 'time', y: ['o','c','l','h']},
            },
            {type: 'bar', xAxisIndex: 1, yAxisIndex: 1, encode: {x: 'time', y: 'v'}},
            {
                name: 'MA5',
                type: 'line', xAxisIndex: 0, yAxisIndex: 0,
                data: this.calculateMA(5, data),
                symbolSize: 1,
                lineStyle: {opacity: 0.9, width: 1}
            },
            {
                name: 'MA18',
                type: 'line', xAxisIndex: 0, yAxisIndex: 0,
                data: this.calculateMA(18, data),
                symbolSize: 1,
                lineStyle: {opacity: 0.9, width: 1}
            },
            {
                name: 'MA60',
                type: 'line', xAxisIndex: 0, yAxisIndex: 0,
                data: this.calculateMA(60, data),
                symbolSize: 1,
                lineStyle: {opacity: 0.9, width: 1}
            },
        ];
        this.option.visualMap = {show: false, seriesIndex: 1, dimension: 'vup', pieces: [{value: -1, color: 'green'}, {value: 1, color: 'red'}]};
        this.option.tooltip.formatter = function (params) {
            var tips = [];
            for (var i = 0; i < params.length; ++i) {
                var param = params[i];
                if (param.seriesIndex == 1) {
                    continue;
                }
                if (param.seriesIndex == 0) {
                    var ftips = [
                        '' + param.value.time,
                        '开盘 ' + param.value.o,
                        '收盘 ' + param.value.c,
                        '最低 ' + param.value.l,
                        '最高 ' + param.value.h,
                        '成交量(手)<br/>' + param.value.v
                    ];
                    if (tips.length >= 0) {
                        tips.forEach(t => ftips.push(t));
                    }
                    tips = ftips;
                } else {
                    tips.push(param.seriesName + ' ' + param.value[1]);
                }
            }
            return tips.join('<br/>');
        };

        var datalength = this.option.dataset.source.length;
        if (datalength > 150) {
            this.option.dataZoom = {
                show: true,
                xAxisIndex: [0, 1],
                start: 0,
                end: 15000 / datalength,
            };
        }
        this.chart.setOption(this.option);
    }
}

class ZtHeightConutChart {
    // 涨停家数&连板高度
    constructor(cont) {
        this.container = cont;
        this.option = {
            legend: {
                left: 'right'
            },
            tooltip: {},
            title: {text: '涨停家数&连板高度', left: 'center', textStyle: {color: 'rgb(247, 137, 148)'}},
            xAxis: {type: 'category', axisLabel: {show: true}},
            yAxis: [{type: 'value'}, {type: 'value'}]
        };
    }

    setdata(ztstats) {
        this.option.dataset = {source: ztstats};
    }

    draw(showSt) {
        if (this.chart === undefined) {
            this.chart = echarts.init(this.container);
        }

        // this.option.xAxis.data ; 默认第一列
        this.option.legend.data = ['涨停家数', '连板高度'];
        this.option.series = [
            // [日期，涨停家数，最大连板数，涨停家数(不含ST)， 最大连板数(非ST)]
            {type: 'line', name: '涨停家数', yAxisIndex: 0, encode: {y: (showSt ? 1 : 3)}},
            {type: 'bar', name: '连板高度', yAxisIndex: 1, encode: {y: (showSt ? 2 : 4)}}
        ];
        var datalength = this.option.dataset.source.length;
        if (datalength > 150) {
            this.option.dataZoom = {
                show: true,
                start: (datalength - 150) * 100 / datalength,
                end: 100
            };
        }
        this.chart.setOption(this.option);
    }
}
