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
        var anchor = emjyManager.stockAnchor(stock.code, '行情');
        this.divTitle.appendChild(anchor);
        
        if (stock.holdCount == 0) {
            this.deleteBtn = document.createElement('button');
            this.deleteBtn.textContent = 'Delete';
            this.deleteBtn.code = stock.code;
            this.deleteBtn.account = stock.account;
            this.deleteBtn.onclick = e => {
                emjyManager.sendExtensionMessage({command:'mngr.rmwatch', code: e.target.code, account: e.target.account});
                emjyManager.stockList.deleteStock(e.target.account, e.target.code);
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
        var detailText = '最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost + ' 数量：' + this.stock.holdCount;
        if (this.stock.holdCount == 0) {
            detailText += ' 总收益:' + emjyManager.getTotalEarned(this.stock.code).toFixed(2);
        }
        this.detailView.textContent = detailText;
        if (this.deleteBtn && emjyManager.klines[this.stock.code] && emjyManager.klines[this.stock.code].continuouslyBellowMaDays() >= 5) {
            this.divTitle.style.borderBottom = '2px solid green';
            console.log('remove', this.stock.code);
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
                    } else if (str.enabled && str.key.includes('Buy')) {
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
                    if (str.enabled && (str.key.includes('Buy') || (str.kltype !== undefined && str.kltype - 30 < 0))) {
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
        } else {
            needfix = true;
        }

        if (needfix) {
            this.divTitle.style.borderLeft = '5px solid red';
            this.divTitle.style.paddingLeft = '10px';
        }

        if (emjyManager.klines[this.stock.code]) {
            this.refresh();
        }
    }
}

class StockListPanelPage extends RadioAnchorPage {
    constructor() {
        super('自选管理');
        this.stocks = [];
        this.initStockList();
        this.addWatchArea();
        this.strategyGroupView = new StrategyGroupView();
        this.currentCode = null;
    }

    initUi(stocks) {
        emjyManager.log('init StockList');
        if (this.strategyGroupView.root.parentElement) {
            this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(this.listContainer);
        for (var i = 0; i < stocks.length; i++) {
            stocks[i].strategies = JSON.parse(stocks[i].strategies);
            if (stocks[i].holdCount == 0 && stocks[i].strategies) {
                var strategyObj = stocks[i].strategies.strategies;
                if (Object.keys(strategyObj).length == 1) {
                    var key = Object.keys(strategyObj)[0];
                    if (strategyObj[key].period == 'l') {
                        continue;
                    }
                }
            }
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
            emjyManager.log(stock.acccode, 'already exists');
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

    deleteStock(account, code) {
        var idx = this.stocks.findIndex(s => s.stock.acccode == account + '_' + code);
        if (idx == -1) {
            return;
        }
        if (this.strategyGroupView.root.parentElement == this.stocks[idx].container) {
            this.stocks[idx].container.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(this.stocks[idx].container);
        this.stocks.splice(idx, 1);
    }

    initStockList() {
        var updateBtn = document.createElement('button');
        updateBtn.textContent = '更新数据';
        updateBtn.onclick = e => {
            emjyManager.updateShownStocksDailyKline();
        }
        this.container.appendChild(updateBtn);
        
        this.listContainer = document.createElement('div');
        this.container.appendChild(this.listContainer);
        this.container.appendChild(document.createElement('hr'));
    }

    addWatchArea() {
        var watchDiv = document.createElement('div');
        var inputCode = document.createElement('input');
        watchDiv.appendChild(inputCode);
        var watchAccountSelector = document.createElement('select');
        var accounts = ['normal', 'collat'];
        for (var i in emjyManager.accountsMap) {
            var opt = document.createElement('option');
            opt.value = i;
            opt.textContent = emjyManager.accountNames[i];
            watchAccountSelector.appendChild(opt);
        };
        watchDiv.appendChild(watchAccountSelector);
        var btnOk = document.createElement('button');
        btnOk.textContent = '新增观察股票';
        btnOk.parentPage = this;
        btnOk.onclick = (e) => {
            if (inputCode.value.length != 6) {
                alert('Wrong stock code');
                return;
            };
            emjyManager.addWatchingStock(inputCode.value, watchAccountSelector.value);
            inputCode.value = '';
        };
        watchDiv.appendChild(btnOk);
        this.container.appendChild(watchDiv);
    }
}
