'use strict';

class StockView {
    constructor(stock, click) {
        this.container = document.createElement('div');
        this.stock = stock;
        this.onStockClicked = click;
        this.container.acccode = stock.acccode;
        this.container.onclick = e => {
            this.onStockClicked(e.currentTarget, this.stock);
        };
        var divTitle = document.createElement('div');
        var titleText = stock.name + '(' + stock.code + ') '+ emjyManager.accountNames[stock.account];
        divTitle.appendChild(document.createTextNode(titleText));
        var anchor = document.createElement('a');
        anchor.textContent = '行情';
        if (stock.market !== undefined) {
            anchor.href = emStockUrl + (stock.market == 'SZ' ? 'sz' : 'sh') + stock.code + emStockUrlTail;
        };
        anchor.target = '_blank';
        divTitle.appendChild(anchor);
        
        if (stock.holdCount == 0) {
            var deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.code = stock.code;
            deleteBtn.account = stock.account;
            deleteBtn.onclick = e => {
                emjyManager.sendExtensionMessage({command:'mngr.rmwatch', code: e.target.code, account: e.target.account});
                location.reload();
            }
            divTitle.appendChild(deleteBtn);
            this.deleteBtn = deleteBtn;
        };
        this.container.appendChild(divTitle);
        var divDetails = document.createElement('div');
        this.detailView = document.createTextNode('最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost + ' 数量：' + this.stock.holdCount);
        divDetails.appendChild(this.detailView);
        this.container.appendChild(divDetails);
    }

    refresh() {
        this.detailView.textContent = '最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost + ' 数量：' + this.stock.holdCount;
        if (this.deleteBtn && emjyManager.klines[this.stock.code].continuouslyBellow()) {
            this.deleteBtn.style.color = 'green';
        }
    }
}

class StockList {
    constructor(log) {
        this.log = log;
        this.stocks = [];
        this.root = document.createElement('div');
        this.listContainer = document.createElement('div');
        this.root.appendChild(this.listContainer);
        this.root.appendChild(document.createElement('hr'));
        this.strategyGroupView = new StrategyGroupView();
        this.currentCode = null;
    }

    initUi(stocks) {
        this.log('init StockList');
        if (this.strategyGroupView.root.parentElement) {
            this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(this.listContainer);
        for (var i = 0; i < stocks.length; i++) {
            stocks[i].strategies = JSON.parse(stocks[i].strategies);
            this.addStock(stocks[i]);
        };
        
        this.listContainer.lastElementChild.click();
    }

    onStrategyGroupChanged(code, strGrp) {
        if (!strGrp) {
            return;
        };

        for (var i = 0; i < this.stocks.length; i++) {
            if (this.stocks[i].stock.acccode == code) {
                this.stocks[i].stock.strategies = strGrp;
                break;
            };
        };
    }

    stockExist(code, account) {
        return this.accStockExists(account + '_' + code);
    }

    accStockExists(code) {
        return this.stocks.find( s => {
            return s.stock.acccode == code;
        });
    }

    updateStockPrice(code) {
        for (var i = 0; i < this.stocks.length; i++) {
            if (this.stocks[i].stock.code == code) {
                this.stocks[i].stock.latestPrice = emjyManager.klines[code].getLatestKline('101').c;
                this.stocks[i].refresh();
            }
        }
    }

    addStock(stock) {
        if (this.accStockExists(stock.acccode)) {
            this.log(stock.acccode, 'already exists');
            return;
        };
        
        var divContainer = new StockView(stock, (target, stk) => {
            if (this.strategyGroupView && (!this.currentCode || this.currentCode != stk.acccode)) {
                if (this.strategyGroupView) {
                    this.strategyGroupView.saveStrategy();
                    this.onStrategyGroupChanged(this.currentCode, this.strategyGroupView.strGrp);
                };
                if (this.strategyGroupView.root.parentElement) {
                    this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
                };
                target.appendChild(this.strategyGroupView.root);
                this.currentCode = stk.acccode;
                this.strategyGroupView.latestPrice = stk.latestPrice;
                this.strategyGroupView.initUi(stk.account, stk.code, stk.strategies);
            };
        });
        this.listContainer.appendChild(document.createElement('hr'));
        this.listContainer.appendChild(divContainer.container);
        this.stocks.push(divContainer);
    }
}
