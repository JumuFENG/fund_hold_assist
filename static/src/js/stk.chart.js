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
        this.priceInput =document.createElement('input');
        this.priceInput.placeholder = '成交价格';
        tradePanel.appendChild(this.priceInput);
        this.portionInput = document.createElement('input');
        this.portionInput.placeholder = '份额';
        tradePanel.appendChild(this.portionInput);
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
            var totalPortion = 0;
            for (var i = 0; i < idRadios.length; i++) {
                if (idRadios[i].checked) {
                    ids = idRadios[i].value;
                    totalPortion = idRadios[i].portion;
                    break;
                };
            };

            var portion = parseInt(this.portionInput.value);
            if (Number.isNaN(portion)) {
                portion = null;
            };

            if (!ids || totalPortion < portion) {
                return;
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

class PlanChart extends KmhlChart {
    setCode(code) {
        this.initOptions();
        this.buytable = all_stocks[code].buy_table;
        this.mkhl = all_stocks[code].khl_m_his;
        this.buy_down_rate = all_stocks[code].bgr;
        this.sell_up_rate = all_stocks[code].sgr;
        this.latestPrice = null;
        if (stockRtData[code] && stockRtData[code].rtprice) {
            this.latestPrice = stockRtData[code].rtprice;
        };
        this.code = code;
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
