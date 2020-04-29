var TradeType = {
    Buy:1,
    Sell:2
};

class TradeOption {
    constructor(p) {
        this.tradeDiv = document.createElement('div');
        p.appendChild(this.tradeDiv);
    }

    initialize() {
        this.tradeOptBar = new RadioAnchorBar();
        this.tradeOptBar.addRadio('买入', function(that){
            that.setTradeOption(TradeType.Buy);
        }, this);
        this.tradeOptBar.addRadio('卖出', function(that){
            that.setTradeOption(TradeType.Sell);
        }, this);
        this.tradeDiv.appendChild(this.tradeOptBar.container);

        var tradePanel = document.createElement('div');
        this.tradeDiv.appendChild(tradePanel);
        this.datePicker = document.createElement('input');
        this.datePicker.type = 'date';
        this.datePicker.value = utils.getTodayDate();
        tradePanel.appendChild(this.datePicker);
        this.portionInput = document.createElement('input');
        this.portionInput.placeholder = '份额';
        tradePanel.appendChild(this.portionInput);
        this.priceInput =document.createElement('input');
        this.priceInput.placeholder = '成交价格';
        tradePanel.appendChild(this.priceInput);
        this.submitBtn = document.createElement('button');
        this.submitBtn.textContent = '确定';
        this.submitBtn.onclick = function(e) {
            stockHub.chartWrapper.tradeOption.onSubmitClicked();
        }
        tradePanel.appendChild(this.submitBtn);

        this.tradeOptBar.selectDefault();
    }

    show() {
        this.tradeDiv.style.display = 'block';
    }

    hide() {
        this.tradeDiv.style.display = 'none';
    }

    setTradeOption(tradeTp) {
        this.tradeType = tradeTp;
        this.updateTradePanel();
    }

    updateTradePanel() {
        if (this.tradeType == TradeType.Sell) {
            this.submitBtn.textContent = "卖出";
            if (stockHub.chartWrapper.bindingBuyTable) {
                stockHub.chartWrapper.bindingBuyTable.style.display = 'block';
            };
        } else {
            this.submitBtn.textContent = "确定";
            if (stockHub.chartWrapper.bindingBuyTable) {
                stockHub.chartWrapper.bindingBuyTable.style.display = 'none';
            };
        }
    }

    onSubmitClicked() {
        var code = stockHub.chartWrapper.code;
        var date = this.datePicker.value;
        var price = parseFloat(this.priceInput.value);
        if (Number.isNaN(price)) {
            return;
        };

        var ids = null;
        if (this.tradeType == TradeType.Buy) {
            var portion = parseInt(this.portionInput.value);
            if (Number.isNaN(portion)) {
                return;
            };
            
            trade.buyStock(date, code, price, portion, ids, function(){
                trade.fetchStockSummary(code, function() {
                    trade.fetchBuyData(code, function(c) {
                        stockHub.updateStockSummary(c);
                    });
                });
                stockHub.chartWrapper.tradeOption.portionInput.value = '';
                stockHub.chartWrapper.tradeOption.priceInput.value = '';
            });
        } else {
            var idRadios = document.getElementsByName('to_sell_radio_' + code);
            for (var i = 0; i < idRadios.length; i++) {
                if (idRadios[i].checked) {
                    ids = idRadios[i].value;
                    break;
                };
            };

            if (!ids) {
                return;
            };

            var portion = parseInt(this.portionInput.value);
            if (Number.isNaN(portion)) {
                portion = null;
            };

            trade.sellStock(date, code, price, ids, portion, function(){
                trade.fetchStockSummary(code, function() {
                    trade.fetchSellData(code, function(c) {
                        trade.fetchBuyData(c, function(cc) {
                            stockHub.updateStockSummary(cc);
                        });
                    });
                });
                stockHub.chartWrapper.tradeOption.priceInput.value = '';
            });
        }
    }
}

var googleChartLoaded = false;
// Load the Visualization API and the piechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(function(){
    googleChartLoaded = true;
});

class PlanChart {
    constructor(chartDiv) {
        this.container = chartDiv;
        this.chartOptions = new RadioAnchorBar();
        this.chartLen = -1;
        this.container.appendChild(this.chartOptions.container);
        this.chart_container = document.createElement('div');
        this.container.appendChild(this.chart_container);
        this.chart = new google.visualization.LineChart(this.chart_container);
        var that = this;
        google.visualization.events.addListener(this.chart, 'ready', function() {
            that.drawVticks();
        });
    }

    setCode(code) {
        if (this.chartOptions.radioAchors.length == 0) {
            this.chartOptions.addRadio('5', function(that) {
                that.chartLen = 5;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('10', function(that) {
                that.chartLen = 10;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('20', function(that) {
                that.chartLen = 20;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('30', function(that) {
                that.chartLen = 30;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('全部', function(that) {
                that.chartLen = 0;
                that.drawChart();
            }, this);
        };
        this.buytable = all_stocks[code].buy_table;
        this.mkhl = all_stocks[code].khl_m_his;
        this.latestPrice = null;
        if (stockRtData[code] && stockRtData[code].rtprice) {
            this.latestPrice = stockRtData[code].rtprice;
        };
        this.code = code;
    }

    initTicks(maxValue, minValue) {
        var minTick = Math.round(minValue * 100 - 1) / 100;
        var maxTick = Math.round(maxValue * 100 + 1) / 100;
        var delta = (maxTick - minTick) / 6;

        var ticks = [maxTick];
        for (var i = 1; ; i++) {
            var nextVal = parseFloat((ticks[i - 1] - delta).toFixed(3));
            if (this.latestPrice < ticks[i - 1] && this.latestPrice > nextVal) {
                if (ticks[i - 1] - this.latestPrice < 0.2 * delta) {
                    ticks.splice(i - 1,10, this.latestPrice);
                    ticks.push(nextVal);
                } else if (this.latestPrice - nextVal < 0.2 * delta) {
                    ticks.push(this.latestPrice);
                } else {
                    ticks.push(this.latestPrice);
                    ticks.push(nextVal);
                    i++;
                };
            } else {
                ticks.push(nextVal);
            };

            if (ticks[ticks.length - 1] <= minTick) {
                break;
            };
        };

        this.ticks = ticks;
    }

    drawVticks() {
        if (this.latestPrice != null) {
            var tRects = this.chart_container.getElementsByTagName('rect');
            var tickRects = [];
            for (var i = 0; i < tRects.length; i++) {
                if (tRects[i].getAttribute('height') === '1') {
                    tickRects.push(tRects[i]);
                };
            };
            var priceIndex = this.ticks.indexOf(this.latestPrice);
            tickRects[tickRects.length - priceIndex - 1].setAttribute('fill', '#ff0000');
        };
    }

    createChartOption() {
        this.options = {
            legend: { position: 'top' },
            width: '100%',
            height: '100%',
            vAxes: {
                0: {
                    ticks: this.ticks
                }
            },
            series: {
                0: {
                    pointSize: 0,
                    lineWidth: 1
                },
                1: {
                    pointSize: 0,
                    lineWidth: 1
                },
                2: {
                    pointSize: 2,
                    lineWidth: 0
                },
                3: {
                    pointSize: 1,
                    lineWidth: 0
                },
                4: {
                    pointSize: 2,
                    lineWidth: 0
                }
            }
        };
    }

    get_to_prices_to_buy() {
        var maxIdx = this.mkhl.length - 1;
        var lastLow = parseFloat(this.mkhl[maxIdx][2]);
        if (lastLow > parseFloat(this.mkhl[maxIdx - 1][2])) {
            lastLow = parseFloat(this.mkhl[maxIdx - 1][2]);
        };
        var topBuy = lastLow;

        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        var delta = parseFloat((lastHigh * all_stocks[this.code].bgr).toFixed(3));
        if (this.buytable && this.buytable.length > 0) {
            var minBuyPrice = this.buytable[0].price;
            var topBuy = lastHigh;
            for (var i = 0; i < this.buytable.length; i++) {
                if (minBuyPrice > this.buytable[i].price) {
                    minBuyPrice = this.buytable[i].price;
                }; 
            };
            while (topBuy - delta > minBuyPrice) {
                topBuy = topBuy - delta;
            };
        };
        var nextBuy = topBuy - delta;
        var nnextBuy = nextBuy - delta;
        return [{price:parseFloat(topBuy.toFixed(3)),tooltip:topBuy.toFixed(3) + ' 可买'}, {price:nextBuy, tooltip:nextBuy.toFixed(3) + ' 可买'}, {price:parseFloat(nnextBuy.toFixed(3)), tooltip:nnextBuy.toFixed(3) + ' 可买'}];
    }

    get_to_sell_price() {
        if (!this.buytable || this.buytable.length <= 0) {
            return null;
        };
        var minBuyPrice = this.buytable[0].price;
        var minPtn = this.buytable[0].ptn;
        var sumCost = 0;
        var sumPtn = 0;
        for (var i = 0; i < this.buytable.length; i++) {
            sumCost += this.buytable[i].cost;
            sumPtn += this.buytable[i].ptn;
            if (minBuyPrice > this.buytable[i].price) {
                minBuyPrice = this.buytable[i].price;
                minPtn = this.buytable[i].ptn;
            };
        };
        var averPrice = sumCost / sumPtn;
        var sellPrice = parseFloat((minBuyPrice * (1 + all_stocks[this.code].bgr)).toFixed(3));
        var sellPtn = minPtn;
        if (this.latestPrice > averPrice) {
            sellPrice = parseFloat((this.latestPrice * (1 + all_stocks[this.code].bgr)).toFixed(3));
            sellPtn = sumPtn;
        };
        return {price: sellPrice, tooltip: '卖出点:' + sellPrice + '\n份额:' + minPtn };
    }

    createDataTable() {
        if (!this.mkhl) {
            return;
        };

        this.data = null;

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '时间');
        data.addColumn('number', 'High');
        data.addColumn('number', 'Low');
        data.addColumn('number', '已买');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addColumn('number', '可买');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addColumn('number', '卖点');
        data.addColumn({type: 'string', role: 'tooltip'});

        var rows = [];
        var len = this.chartLen;
        if (len > this.mkhl.length || len == 0) {
            len = this.mkhl.length;
        };
        var maxIdx = this.mkhl.length - 1;
        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        var lastLow = parseFloat(this.mkhl[maxIdx][2]);
        if (lastLow > parseFloat(this.mkhl[maxIdx - 1][2])) {
            lastLow = parseFloat(this.mkhl[maxIdx - 1][2]);
        };
        var maxTick = lastHigh;
        var minTick = lastLow;
        for (var i = this.mkhl.length - len; i < this.mkhl.length; i++) {
            var h = parseFloat(this.mkhl[i][1]);
            var l = parseFloat(this.mkhl[i][2]);
            rows.push([utils.ym_by_delta(this.mkhl[i][0]), h, l, null, null, null, null, null, null]);
            if (maxTick < h) {
                maxTick = h;
            };
            if (minTick > l) {
                minTick = l;
            };
        };

        var delta = lastHigh - lastLow;
        var topBuy = parseFloat((lastLow + 0.2 * delta).toFixed(3));
        var bottomSell = parseFloat((lastHigh - 0.2 * delta).toFixed(3));
        if (this.buytable) {
            for (var i = 0; i < this.buytable.length; i++) {
                var price = this.buytable[i].price;
                rows.push(['', bottomSell, topBuy, price
                    , '买入价:' + price + '\n份额:' + this.buytable[i].ptn,
                    null, null, null, null]);
                if (maxTick < price) {
                    maxTick = price;
                };
                if (minTick > price) {
                    minTick = price;
                };
            };
        };

        var to_buy = this.get_to_prices_to_buy();

        for (var i = 0; i < to_buy.length; i++) {
            rows.push(['', bottomSell, topBuy, null, null, to_buy[i].price, to_buy[i].tooltip, null, null]);
            if (minTick > to_buy[i].price) {
                minTick = to_buy[i].price;
            };
        };

        var to_sell = this.get_to_sell_price();
        if (to_sell != null) {
            rows.push(['', bottomSell, topBuy, null, null, null, null, to_sell.price, to_sell.tooltip]);
            if (to_sell.price != null && maxTick < to_sell.price) {
                maxTick = to_sell.price;
            };
        };

        data.addRows(rows);
        this.data = data;
        this.initTicks(maxTick, minTick);
    }

    drawChart() {
        if (this.chartLen == -1) {
            this.chartOptions.selectDefault();
            return;
        };
        this.createDataTable();
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
    }
}

class ChartWrapper {
    constructor(p) {
        this.container = document.createElement('div');
        p.appendChild(this.container);
        this.bindingBuyTable = null;
    }

    initialize() {
        var planBuyDiv = document.createElement('div');
        this.planChart = new PlanChart(planBuyDiv);
        this.container.appendChild(planBuyDiv);
        this.tradeOption = new TradeOption(this.container);
        this.tradeOption.initialize();
        this.tradeOption.hide();
    }

    setParent(p, btbl) {
        this.container.parentElement.removeChild(this.container);
        p.appendChild(this.container);
        this.tradeOption.show();
        this.bindingBuyTable = btbl;
    }

    hide() {
        this.container.style.display = 'none';
    }

    show() {
        this.container.style.display = 'block';
        if (!this.code) {
            return;
        };

        if (all_stocks[this.code] && all_stocks[this.code].buy_table) {
            this.planChart.setCode(this.code);
            this.planChart.drawChart();
        };
    }
}
