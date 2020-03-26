window.onload = function () {
    stockHub.initialize();
}

class StockSummay {
    constructor(code) {
        this.code = code;
        this.container = null;
        this.header = null;
        this.detail = null;
    }

    initialize() {
        this.container = document.createElement('div');
        this.header = document.createElement('div');
        this.detail = document.createElement('div');
        this.container.appendChild(this.header);
        this.container.appendChild(this.detail);
    }

    update() {
        var stockData = all_stocks[this.code];
        if (stockData) {
            this.header.textContent = stockData.name;
            this.detail.textContent = this.code + ' ' + stockData.ptn + ' ' + stockData.avp;
        };
    }
}

class StockHub {
    constructor() {
        this.container = null;
        this.topContainer = null;
        this.stockSummaryList = [];
    }

    initialize() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
        this.topContainer = document.getElementById('top_container');
        this.stockListTable = document.createElement('table');
        this.container.appendChild(this.stockListTable);
        trade.fetchStockSummary(null, function(c){
            stockHub.reloadAllStocks();
        });
        this.createBuyNewArea();
    }

    createBuyNewArea() {
        var buyNewArea = document.createElement('div');
        this.container.appendChild(buyNewArea);
        buyNewArea.appendChild(document.createTextNode('新买入'));
        buyNewArea.appendChild(document.createElement('br'));

        var buyNewDate = document.createElement('input');
        buyNewDate.type = 'date';
        buyNewDate.value = utils.getTodayDate();
        buyNewArea.appendChild(buyNewDate);

        var buyNewCode = document.createElement('input');
        buyNewCode.placeholder = '股票代码';
        buyNewArea.appendChild(buyNewCode);

        var buyNewShare = document.createElement('input');
        buyNewShare.placeholder = '买入份额';
        buyNewArea.appendChild(buyNewShare);

        var buyNewPrice = document.createElement('input');
        buyNewPrice.placeholder = '成交价';
        buyNewArea.appendChild(buyNewPrice);

        var buyNewBtn = document.createElement('button');
        buyNewBtn.textContent = '确定';
        buyNewBtn.onclick = function(){
            trade.buyStock(buyNewDate.value, buyNewCode.value, parseFloat(buyNewPrice.value), parseInt(buyNewShare.value), null, function(){
                trade.fetchStockSummary(null, function(c){
                    if (c) {
                        stockHub.updateStockSummary(c);
                    } else {
                        stockHub.reloadAllStocks();
                    }
                });
            });
            buyNewShare.value = '';
            buyNewPrice.value = '';
            buyNewCode.value = '';
        };
        buyNewArea.appendChild(buyNewBtn);
    }

    updateStockSummary(code) {
        var stockSummary = this.stockSummaryList.find(function(s){
            return s.code == code;
        });
        if (!stockSummary) {
            stockSummary = new StockSummay(code);
            stockSummary.initialize();
            var cell = document.createElement('td');
            cell.appendChild(stockSummary.container);
            var row = document.createElement('tr');
            row.appendChild(cell);
            this.stockListTable.appendChild(row);
            this.stockSummaryList.push(stockSummary);
        };
        stockSummary.update();
    }

    reloadAllStocks() {
        for(var c in all_stocks) {
            this.updateStockSummary(c);
        }
    }
}

var stockHub = new StockHub();