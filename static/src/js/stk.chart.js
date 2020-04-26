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
        var chartArea = document.createElement('div');
        this.container.appendChild(chartArea);
        this.chart = new google.visualization.LineChart(chartArea);
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

    createChartOption() {
        this.options = {
            legend: { position: 'top' },
            width: '100%',
            height: '100%',
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
                    pointSize: 0,
                    lineWidth: 0.5
                },
                3: {
                    pointSize: 2,
                    lineWidth: 0
                },
                4: {
                    pointSize: 1,
                    lineWidth: 0
                },
                5: {
                    pointSize: 2,
                    lineWidth: 0
                }
            }
        };
    }

    get_to_prices_to_buy() {
        var maxIdx = this.mkhl.length - 1;
        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        var topBuy = parseFloat((lastHigh * (1 - all_stocks[this.code].bgr * 5)).toFixed(3));
        if (this.buytable && this.buytable.length > 0) {
            var minBuyPrice = this.buytable[0].price;
            for (var i = 0; i < this.buytable.length; i++) {
                if (minBuyPrice > this.buytable[i].price) {
                    minBuyPrice = this.buytable[i].price;
                }; 
            };
            while (topBuy * (1 - all_stocks[this.code].bgr) > minBuyPrice) {
                topBuy = topBuy * (1 - all_stocks[this.code].bgr);
            };
        };
        var nextBuy = parseFloat((topBuy * (1 - all_stocks[this.code].bgr)).toFixed(3));
        return [{price:parseFloat(topBuy.toFixed(3)),tooltip:topBuy.toFixed(3) + ' 可买'}, {price:nextBuy, tooltip:nextBuy.toFixed(3) + ' 可买'}];
    }

    get_to_sell_price() {
        if (!this.buytable || this.buytable.length <= 0) {
            return {price:null, tooltip:null};
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
        if (this.latestPrice > averPrice) {
            return {price: this.latestPrice, tooltip: '卖出点:' + this.latestPrice + '\n份额:' + sumPtn };
        };
        var sellPrice = parseFloat((minBuyPrice * (1 + all_stocks[this.code].bgr)).toFixed(3));
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
        data.addColumn('number', '新值');
        data.addColumn({type: 'string', role: 'tooltip'});
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
        for (var i = this.mkhl.length - len; i < this.mkhl.length; i++) {
            rows.push([utils.ym_by_delta(this.mkhl[i][0]), parseFloat(this.mkhl[i][1]), parseFloat(this.mkhl[i][2]), this.latestPrice, '最新值:' + this.latestPrice, null, null, null, null, null, null]);
        };

        var maxIdx = this.mkhl.length - 1;
        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        console.log('lastHigh', lastHigh);
        var topBuy = parseFloat((lastHigh * (1 - all_stocks[this.code].bgr * 5)).toFixed(3));
        console.log('topBuy', topBuy);
        var lastLow = parseFloat(this.mkhl[maxIdx][2]);
        if (lastLow > parseFloat(this.mkhl[maxIdx - 1][2])) {
            lastLow = parseFloat(this.mkhl[maxIdx - 1][2]);
        };
        console.log('lastLow', lastLow);
        var bottomSell = parseFloat((lastLow * (1 + all_stocks[this.code].sgr)).toFixed(3))
        console.log('bottomSell', bottomSell);
        var lastDate = utils.ym_by_delta(this.mkhl[this.mkhl.length - 1][0]);
        if (this.buytable) {
            for (var i = 0; i < this.buytable.length; i++) {
                rows.push([lastDate, bottomSell, topBuy, this.latestPrice, '最新值:' + this.latestPrice, 
                    this.buytable[i].price, '买入价:' + this.buytable[i].price + '\n份额:' + this.buytable[i].ptn,
                    null, null, null, null]);
            };
        };

        var to_buy = this.get_to_prices_to_buy();

        for (var i = 0; i < to_buy.length; i++) {
            rows.push([lastDate, bottomSell, topBuy, this.latestPrice, '最新值:' + this.latestPrice, null, null, to_buy[i].price, to_buy[i].tooltip, null, null]);
        };

        var to_sell = this.get_to_sell_price();
        rows.push([lastDate, bottomSell, topBuy, null, null, null, null, null, null, to_sell.price, to_sell.tooltip]);

        data.addRows(rows);
        this.data = data;
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
