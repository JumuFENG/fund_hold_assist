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
        this.tradeOptBar.addRadio('买入', function(){
            stockHub.chartWrapper.tradeOption.setTradeOption(TradeType.Buy);
        });
        this.tradeOptBar.addRadio('卖出', function(){
            stockHub.chartWrapper.tradeOption.setTradeOption(TradeType.Sell);
        });
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
            this.portionInput.style.display = "none";
            this.submitBtn.textContent = "卖出";
            if (stockHub.chartWrapper.bindingRollinTable) {
                stockHub.chartWrapper.bindingRollinTable.style.display = 'none';
            };
            if (stockHub.chartWrapper.bindingBuyTable) {
                stockHub.chartWrapper.bindingBuyTable.style.display = 'block';
            };
        } else {
            this.portionInput.style.display = "inline";
            this.submitBtn.textContent = "确定";
            if (stockHub.chartWrapper.bindingRollinTable) {
                stockHub.chartWrapper.bindingRollinTable.style.display = 'block';
            };
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
            var idRadios = document.getElementsByName('to_rollin_check_' + code);
            var checkedId = [];
            for (var i = 0; i < idRadios.length; i++) {
                if (idRadios[i].checked) {
                    checkedId.push(idRadios[i].value);
                };
            };

            if (checkedId.length > 0) {
                ids = checkedId.join('_');
            };
            if (Number.isNaN(portion)) {
                return;
            };
            
            trade.buyStock(date, code, price, portion, ids, function(){
                trade.fetchStockSummary(code, function() {
                    trade.fetchBuyData(code, function(c) {
                        if (ids != null) {
                            trade.fetchSellData(c, function(cc) {
                                stockHub.updateStockSummary(cc);
                            })
                        } else {
                            stockHub.updateStockSummary(c);
                        }
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

            trade.sellStock(date, code, price, ids, function(){
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
        this.chart = new google.visualization.ScatterChart(this.container);
        google.visualization.events.addListener(this.chart, 'ready', this.drawVticks);
    }

    setCode(code) {
        this.buytable = all_stocks[code].buy_table;
        this.code = code;
    }

    initD0Price() {
        this.latestPrice = null;
        if (stockRtData[this.code] && stockRtData[this.code].rtprice) {
            this.latestPrice = stockRtData[this.code].rtprice;
        };

        this.buy0price = this.latestPrice;
        this.buy0Cost = null;
        if (this.buytable && this.buytable.length > 0) {
            for (var i = 0; i < this.buytable.length; i++) {
                if (this.buytable[i].sold == 0) {
                    this.buy0price = this.buytable[i].price;
                    this.buy0Cost = this.buytable[i].cost;
                    break;
                }
            };
        } else if (all_stocks[this.code].sell_table && all_stocks[this.code].sell_table.length > 0) {
            this.buy0price = all_stocks[this.code].sell_table[all_stocks[this.code].sell_table.length - 1].price;
        };

        if (this.buy0Cost == null && this.buy0price != null) {
            this.buy0Cost = 100 * this.buy0price;
        };
    }

    initTicks() {
        this.initD0Price();
        this.ticks = [];
        this.availableBuyRec = [];
        if (this.buy0price == null || this.buy0Cost == null) {
            return;
        };

        var gridBuyRate = all_stocks[this.code].bgr;
        var gridSellRate = all_stocks[this.code].sgr;
        var ticks = [this.buy0price];
        for (var i = 0; i < 5; i++) {
            ticks.push(parseFloat((ticks[i] * (1 - gridBuyRate)).toFixed(3)));
        };

        if (this.latestPrice != null) {
            var max_price = this.latestPrice * (1 - gridSellRate);
            for (var i = 0; i < this.buytable.length; i++) {
                if (this.buytable[i].price <= max_price) {
                    this.availableBuyRec.push(this.buytable[i]);
                };
            };
        };

        var minPrice = this.buytable.length > 0 ? this.buytable[0].price : this.buy0price;
        if (this.availableBuyRec.length == 0) {
            for (var i = 0; i < this.buytable.length; i++) {
                if (this.buytable[i].price < minPrice) {
                    minPrice = this.buytable[i].price;
                };
            };
            for (var i = 0; i < this.buytable.length; i++) {
                if (this.buytable[i].price == minPrice) {
                    this.availableBuyRec.push(this.buytable[i]);
                };
            };
        };
        this.maxPrice = minPrice * (1 + gridSellRate);
        if (this.latestPrice != null) {
            this.maxPrice = this.latestPrice > this.maxPrice ? this.latestPrice : this.maxPrice;
        };

        for (var i = 0; i < 5; i++) {
            var sTick = parseFloat((ticks[0] * (1 + gridSellRate)).toFixed(3));
            ticks.splice(0, 0, sTick);
            if (sTick > this.maxPrice) {
                break;
            };
        };

        if (this.latestPrice != null) {
            ticks.push(this.latestPrice);
            ticks.sort(function(l,g) {
                return l - g;
            });
        };

        this.ticks = ticks;
    }

    createChartOption() {
        this.options = {
            legend: { position: 'top' },
            width: '100%',
            height: '100%',
            vAxes: {
                0: {
                    ticks: this.ticks
                },
                1: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0,
                    pointSize: 2
                }
            }
        };
    }

    drawVticks() {
        stockHub.chartWrapper.planChart.onDrawVticks();
    }

    onDrawVticks() {
        if (this.latestPrice != null) {
            var tRects = this.container.getElementsByTagName('rect');
            var tickRects = [];
            for (var i = 0; i < tRects.length; i++) {
                if (tRects[i].getAttribute('height') === '1') {
                    tickRects.push(tRects[i]);
                }
            };
            var priceIndex = this.ticks.indexOf(this.latestPrice);
            tickRects[tickRects.length - this.ticks.length + priceIndex].setAttribute('fill', '#ff0000');
        };
    }

    createDataTable() {
        if (!this.buytable) {
            return;
        };
        this.initTicks();
        this.data = null;
        if (this.buy0price == null || this.buy0Cost == null) {
            return;
        };

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('number', '份额');
        data.addColumn('number', '网格法');
        data.addColumn({type: 'string', role: 'style'});

        var rows = [];
        for (var i = 0; i < this.buytable.length; i++) {
            rows.push([this.buytable[i].ptn, this.buytable[i].price, '']);
        };

        if (this.buy0Cost) {
            for (var i = 0; i < this.ticks.length; i++) {
                if (this.ticks[i] >= this.buy0price) {
                    continue;
                };
                rows.push([100 * parseInt(this.buy0Cost/(100 * this.ticks[i])), this.ticks[i], 'point {fill-color: #FFD39B;}']);
            };
        };

        var portion = 0;
        for (var i = 0; i < this.availableBuyRec.length; i++) {
            portion += this.availableBuyRec[i].ptn;
        };
        rows.push([portion, this.maxPrice, 'point {fill-color: #FF4500}']);

        data.addRows(rows);
        this.data = data;
    }

    drawChart() {
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
        this.bindingRollinTable = null;
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

    setParent(p, rtbl, btbl) {
        this.container.parentElement.removeChild(this.container);
        p.appendChild(this.container);
        this.tradeOption.show();
        this.bindingRollinTable = rtbl;
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
