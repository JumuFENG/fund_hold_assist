window.onload = function () {
    stockHub.initialize();
}

class StockSummay {
    constructor(code) {
        this.code = code;
        this.container = null;
        this.detail = null;
    }

    initialize(hdclick) {
        this.container = document.createElement('div');
        var header = document.createElement('div');
        header.onclick = function(e) {
            if (typeof(hdclick) === 'function') {
                hdclick();
            };
        }
        this.container.appendChild(header);
        this.hdname = document.createTextNode('');
        header.appendChild(this.hdname);
        this.hdearned = document.createElement('label');
        header.appendChild(this.hdearned);

        this.detail = document.createElement('div');
        this.detail.style.display = 'none';
        this.container.appendChild(this.detail);
        this.container.appendChild(document.createElement('hr'));
    }

    toggleDetails() {
        if (this.detail.style.display == "none") {
            this.detail.style.display = 'block';
        } else {
            this.detail.style.display = 'none';
        }
    }

    collapseDetails() {
        if (this.detail.style.display == 'block') {
            this.detail.style.display = 'none';
        };
    }

    update() {
        var stockData = all_stocks[this.code];
        if (stockData) {
            this.hdname.textContent = stockData.name? stockData.name: this.code;
            this.hdearned.textContent = 1;
            this.hdearned.className = 'increase';
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
        this.stockListTable.appendChild(document.createElement('hr'));
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

    toggleStockDetails(code) {
        for(var i in this.stockSummaryList) {
            if (this.stockSummaryList[i].code == code) {
                this.stockSummaryList[i].toggleDetails();
            } else {
                this.stockSummaryList[i].collapseDetails();
            }
        }
    }

    updateStockSummary(code) {
        var stockSummary = this.stockSummaryList.find(function(s){
            return s.code == code;
        });
        if (!stockSummary) {
            stockSummary = new StockSummay(code);
            stockSummary.initialize(function(){
                stockHub.toggleStockDetails(code);
            });
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