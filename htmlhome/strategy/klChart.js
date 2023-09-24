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
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'}},
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
                        '涨跌幅 ' + param.value.pc + '%',
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
        } else {
            this.option.dataZoom = {
                show: true,
                start: 0,
                end: 100
            };
        }
        this.chart.setOption(this.option);
    }
}

class ZtHeightCountChart {
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
        } else {
            this.option.dataZoom = {
                show: true,
                start: 0,
                end: 100
            };
        }
        this.chart.setOption(this.option);
    }
}

class KlChartWithRanks {
    constructor(cont, title, link) {
        this.rk_arr = [5, 10, 20, 30, 60, 120, 250];
        this.maxTicks = 120;
        this.container = cont;
        this.chartToobar = document.createElement('div');
        this.chartContainer = document.createElement('div');
        this.chartContainer.style.height = '100%';
        this.container.appendChild(this.chartToobar);
        this.container.appendChild(this.chartContainer);
        var autoReply = document.createElement('button');
        autoReply.textContent = '回放';
        this.chartToobar.appendChild(autoReply);
        autoReply.onclick = e => {
            if (this.replayInterval !== undefined) {
                return;
            }
            this.replayedId = undefined;
            this.replayInterval = setInterval(() => {
                var option = this.option;
                if (this.replayedId === undefined) {
                    this.replayedId = 0;
                    option.dataset.source = [];
                }
                if (this.replayedId == this.originData.length) {
                    clearInterval(this.replayInterval);
                    this.replayInterval = undefined;
                    return;
                }
                ++this.replayedId;
                var tick0 = 0;
                if (this.replayedId > this.maxTicks) {
                    tick0 = this.replayedId - this.maxTicks;
                }
                option.dataset.source = this.originData.slice(tick0, this.replayedId);
                if (option.dataset.source.length < this.maxTicks) {
                    for (var i = option.dataset.source.length; i < this.maxTicks; i++) {
                        option.dataset.source.push({time: i});
                    }
                }
                this.chart.setOption(option);
            }, 580);
        }
        this.option = {
            legend: {
                left: 'right'
            },
            animation: false,
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'}},
            title: {text: title, left: 'center', textStyle: {color: 'rgb(133, 146, 232)'}, link},
            grid: [{left: '10%', right: '8%', height: '40%'}, {left: '10%', right: '8%', top: '58%', height: '35%'}],
            xAxis: [
                {type: 'category', axisLabel: {show: true}},
                {type: 'category', gridIndex: 1, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }}
            ],
            axisPointer: {link: {xAxisIndex: 'all'}},
            yAxis: [
                {scale: true},
                {scale: true, gridIndex: 1, axisTick: { show: false }, axisLabel: { show: false }, inverse: true}
            ]
        };
    }

    rankInKl(n) {
        for (const d of this.originData) {
            if (d['rk'+n] !== undefined) {
                return true;
            }
        }
        return false;
    }

    draw(kldata) {
        this.originData = kldata;
        var rks = [];
        for (const n of this.rk_arr) {
            if (this.rankInKl(n)) {
                rks.push(n);
            }
        }
        for (var kl of this.originData) {
            for (const n of rks) {
                if (kl['rk'+n] === undefined) {
                    kl['rk'+n] = '';
                }
            }
        }
        this.option.dataset = {source: kldata};
        this.option.series = [
            {
                type: 'k', xAxisIndex: 0, yAxisIndex: 0,
                encode: {x: 'time', y: ['o','c','l','h']},
            },
        ];

        for (const n of rks) {
            this.option.series.push({
                name: 'rank' + n,
                type: 'line', xAxisIndex: 1, yAxisIndex: 1,
                encode: {x: 'time', y: 'rk'+n},
                symbolSize: 1,
                lineStyle: {opacity: 0.9, width: 1}
            });
        }
        if (this.chart === undefined) {
            this.chart = echarts.init(this.chartContainer);
        }
        this.chart.setOption(this.option);
    }
}

class StockRanks {
    constructor(cont) {
        this.container = cont;
        this.rk_arr = [5, 10, 20, 30, 60, 120, 250];
        this.option = {
            legend: {
                left: 'right'
            },
            animation: false,
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'}},
            grid: [{left: '5%', right: '3%', top: 20, height: '90%'}],
            xAxis: [{type: 'category', axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }}],
            axisPointer: {link: {xAxisIndex: 'all'}},
            yAxis: [{scale: true, axisTick: { show: false }, axisLabel: { show: false }, inverse: true}]
        };
    }

    getRankTimeRk(ranks, key) {
        var data = [];
        for (var i = 0; i < ranks.length; ++i) {
            if (ranks[i][key]) {
                data.push([ranks[i].time, ranks[i][key]]);
            } else {
                data.push([ranks[i].time, '']);
            }
        }
        return data;
    }

    draw(rankdata, title, link) {
        this.option.series = [];
        this.option.title = {text: title, left: 'center', textStyle: {color: 'rgb(133, 146, 232)'}, link};

        for (var k = 0; k < this.rk_arr.length; ++k) {
            var n = this.rk_arr[k];
            var seriel = {
                name: 'rank' + n,
                type: 'line',
                data: this.getRankTimeRk(rankdata, 'rk'+n),
                symbolSize: 1,
                lineStyle: {opacity: 0.9, width: 1}
            };
            this.option.series.push(seriel);
        }
        if (this.chart === undefined) {
            this.chart = echarts.init(this.container);
        }
        this.chart.setOption(this.option);
    }
}

class RanksChart {
    constructor(cont) {
        this.container = cont;
        this.rk_arr = [5, 10, 20, 30, 60, 120, 250];
        this.chartToobar = document.createElement('div');
        this.chartContainer = document.createElement('div');
        this.chartContainer.style.height = '100%';
        this.container.appendChild(this.chartToobar);
        this.container.appendChild(this.chartContainer);
    }

    draw(rankdata) {
        if (!this.charts || this.charts.length < Object.keys(rankdata).length) {
            if (!this.charts) {
                this.charts = [];
            }
            for (var i = this.charts.length; i < Object.keys(rankdata).length; i ++) {
                var chartDiv = document.createElement('div');
                chartDiv.style.width = '100%';
                chartDiv.style.height = this.chartContainer.height / Object.keys(rankdata).length;
                this.chartContainer.appendChild(chartDiv);
                this.charts.push(new StockRanks(chartDiv));
            }
            for (var i = this.charts.length - 1; i >= Object.keys(rankdata).length; i--) {
                this.chartContainer.removeChild(this.charts[i].container);
                this.charts.pop();
            }
            for (var ch of this.charts) {
                ch.container.style.height = this.chartContainer.clientHeight / Object.keys(rankdata).length;
            }
        }
        var i = 0;
        for (var code in rankdata) {
            var slink = emjyBack.stockAnchor(code);
            this.charts[i].draw(rankdata[code], slink.textContent, slink);
            i ++;
        }
    }
}

class RanksChartBk {
    constructor(cont) {
        this.container = cont;
        this.rk_arr = [5, 10, 20, 30, 60, 120, 250];
        this.chartToobar = document.createElement('div');
        this.chartContainer = document.createElement('div');
        this.chartContainer.style.height = '100%';
        this.container.appendChild(this.chartToobar);
        this.container.appendChild(this.chartContainer);
        this.option = {
            legend: {
                show: false
            },
            animation: false,
            tooltip: {trigger: 'axis', borderColor: '#ccc', axisPointer: {type: 'cross'}},
            axisPointer: {link: {xAxisIndex: 'all'}}
        };
    }

    getRankTimeRk(ranks, key) {
        var data = [];
        for (var i = 0; i < ranks.length; ++i) {
            if (ranks[i][key]) {
                data.push([ranks[i].time, ranks[i][key]]);
            } else {
                data.push([ranks[i].time, '']);
            }
        }
        return data;
    }

    draw(rankdata) {
        this.option.series = [];
        this.option.grid = [];
        this.option.xAxis = [];
        this.option.yAxis = [];

        for (var k = 0; k < this.rk_arr.length; ++k) {
            this.option.grid.push({left: '5%', right: '3%', top: (k * 90 / this.rk_arr.length) + '%', height: 90 / this.rk_arr.length + '%'});
            this.option.xAxis.push({type: 'category', gridIndex: k, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }});
            this.option.yAxis.push({scale: true, gridIndex: k, axisTick: { show: false }, axisLabel: { show: false }, inverse: true});
            var n = this.rk_arr[k];
            for (var code in rankdata) {
                var seriel = {
                    name: code + '_' + n,
                    type: 'line', xAxisIndex: k, yAxisIndex: k,
                    data: this.getRankTimeRk(rankdata[code], 'rk'+n),
                    symbolSize: 1,
                    lineStyle: {opacity: 0.9, width: 1}
                };
                this.option.series.push(seriel);
            }
        }
        if (this.chart === undefined) {
            this.chart = echarts.init(this.chartContainer);
        }
        this.chart.setOption(this.option);
    }
}
