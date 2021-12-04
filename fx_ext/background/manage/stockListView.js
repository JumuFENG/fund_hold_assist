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
        this.divTitle = document.createElement('div');
        var titleText = stock.name + '(' + stock.code + ') '+ emjyManager.accountNames[stock.account];
        this.divTitle.appendChild(document.createTextNode(titleText));
        var anchor = document.createElement('a');
        anchor.textContent = '行情';
        if (stock.market !== undefined) {
            anchor.href = emStockUrl + (stock.market == 'SZ' ? 'sz' : 'sh') + stock.code + emStockUrlTail;
        };
        anchor.target = '_blank';
        this.divTitle.appendChild(anchor);
        
        if (stock.holdCount == 0) {
            this.deleteBtn = document.createElement('button');
            this.deleteBtn.textContent = 'Delete';
            this.deleteBtn.code = stock.code;
            this.deleteBtn.account = stock.account;
            this.deleteBtn.onclick = e => {
                emjyManager.sendExtensionMessage({command:'mngr.rmwatch', code: e.target.code, account: e.target.account});
                location.reload();
            }
            this.divTitle.appendChild(this.deleteBtn);
        };
        this.container.appendChild(this.divTitle);
        var divDetails = document.createElement('div');
        this.detailView = document.createTextNode('最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost + ' 数量：' + this.stock.holdCount);
        divDetails.appendChild(this.detailView);
        this.container.appendChild(divDetails);
        this.showWarningInTitle();
    }

    refresh() {
        this.detailView.textContent = '最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost + ' 数量：' + this.stock.holdCount;
        if (this.deleteBtn && emjyManager.klines[this.stock.code].continuouslyBellow()) {
            this.divTitle.style.borderBottom = '2px solid green';
        }
    }

    showWarningInTitle() {
        var strGrp = this.stock.strategies;
        var needfix = false;
        if (strGrp && strGrp.strategies) {
            var strategies = strGrp.strategies;
            if (this.stock.holdCount == 0) {
                var buystrCount = 0;
                for (const i in strategies) {
                    const str = strategies[i];
                    if (str.enabled && str.key.includes('Sell')) {
                        needfix =  true;
                        break;
                    } else if (str.key.includes('Buy')) {
                        buystrCount ++;
                    }
                }
                if (buystrCount == 0) {
                    needfix = true;
                }
            } else {
                var sellstrCount = 0;
                for (const i in strategies) {
                    const str = strategies[i];
                    if (str.enabled && str.key.includes('Buy')) {
                        needfix =  true;
                        break;
                    } else if (str.key.includes('Sell')) {
                        sellstrCount ++;
                    }
                }
                if (sellstrCount == 0) {
                    needfix = true;
                }
            }
        }

        if (needfix) {
            this.divTitle.style.borderLeft = '5px solid red';
            this.divTitle.style.paddingLeft = '10px';
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
