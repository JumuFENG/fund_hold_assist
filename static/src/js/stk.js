window.onload = function () {
    stockHub.initialize();
}

class StockHub {
    constructor(){
        this.container = null;
        this.topContainer = null;
    }

    initialize() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
        this.topContainer = document.getElementById('top_container');
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
            trade.buyStock(buyNewDate.value, buyNewCode.value, parseFloat(buyNewPrice.value), parseInt(buyNewShare.value));
            buyNewShare.value = '';
            buyNewPrice.value = '';
            buyNewCode.value = '';
        };
        buyNewArea.appendChild(buyNewBtn);
    }
}

var stockHub = new StockHub();