'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
        this.ztPool = null;
        this.accountNames = {'normal':'普通账户', 'collat': '担保品账户', 'credit': '融资账户'};
        this.accountsMap = {'normal': ['normal'], 'collat': ['credit', 'collat']};
    }

    sendExtensionMessage(message) {
        chrome.runtime.sendMessage(message);
    }

    handleExtensionMessage(message) {
        if (message.command == 'mngr.stocks') {
            this.initStocks(message.stocks);
        } else if (message.command == 'mngr.getZTPool') {
            if (this.ztPool) {
                this.ztPool.onZTPoolback(message.ztpool);
            };
        } else if (message.command == 'mngr.getkline') {
            if (this.ztPool) {
                this.ztPool.updateKline(message.kline);
            };
        }
    }

    initStocks(stocks) {
        this.log('initStocks');
        if (!this.page) {
            this.page = new ManagerPage();
            document.body.appendChild(this.page.root);
        }

        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };

        var accstocks = [];
        for (var i = 0; i < stocks.length; i++) {
            var tstocks = stocks[i].stocks;
            var account = stocks[i].account;
            for (var j = 0; j < tstocks.length; j++) {
                var ts = tstocks[j];
                ts.acccode = account + '_' + ts.code;
                ts.account = account;
                accstocks.push(ts);
            };
        };
        this.stockList.initUi(accstocks);
        //this.log(JSON.stringify(stocks));
    }

    initUi() {
        if (!this.page) {
            this.page = new ManagerPage();
            document.body.appendChild(this.page.root);
        };

        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };

        this.page.addWatchArea();
        if (!this.ztPool) {
            this.ztPool = new ZtPool(this.sendExtensionMessage);
        };
        this.page.addPickUpArea(this.ztPool);
    }

    addStock(code, account, buystr = null, sellstr = null) {
        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };
        var stock = {code, name:'', account, holdCount: 0, holdCost: 0};
        stock.acccode = account + '_' + code;
        stock.buyStrategy = buystr;
        stock.sellStrategy = sellstr;
        this.stockList.addStock(stock);
    }

    addWatchingStock(code, account, buyStrategy = null, sellStrategy = null) {
        this.addStock(code, account, buyStrategy, sellStrategy);
        this.sendExtensionMessage({command:'mngr.addwatch', code, account, buyStrategy, sellStrategy});
    }
}

class ManagerPage {
    constructor() {
        this.root = document.createElement('div');
    }

    addWatchArea() {
        var watchDiv = document.createElement('div');
        var inputCode = document.createElement('input');
        watchDiv.appendChild(inputCode);
        var watchAccountSelector = document.createElement('select');
        var accounts = ['normal', 'collat'];
        for (var i in emjyManager.accountsMap) {
            var opt = document.createElement('option');
            opt.value = i
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
        this.root.appendChild(watchDiv);
    }

    addPickUpArea(ztPool) {
        ztPool.createZtArea();
        this.root.appendChild(document.createElement('hr'));
        this.root.appendChild(ztPool.root);
    }
}

class StockList {
    constructor(log) {
        this.log = log;
        this.stocks = null;
        this.root = document.createElement('div');
        this.listContainer = document.createElement('div');
        this.root.appendChild(this.listContainer);
        this.root.appendChild(document.createElement('hr'));
        this.strategyContainer = new StrategyChooser();
        this.currentStock = null;
    }

    initUi(stocks) {
        this.log('init StockList');
        this.stocks = stocks;
        if (this.strategyContainer.root.parentElement) {
            this.strategyContainer.root.parentElement.removeChild(this.strategyContainer.root);
        }
        utils.removeAllChild(this.listContainer);
        for (var i = 0; i < stocks.length; i++) {
            this.addStock(stocks[i]);
        };
        
        this.listContainer.lastElementChild.click();
    }

    addStock(stock) {
        var divContainer = document.createElement('div');
        divContainer.stock = stock;
        divContainer.onclick = e => {
            var stk = e.currentTarget.stock;
            if (this.strategyContainer && (!this.currentStock || this.currentStock.code != stk.code)) {
                if (this.strategyContainer) {
                    this.strategyContainer.saveStrategy();
                };
                if (this.strategyContainer.root.parentElement) {
                    this.strategyContainer.root.parentElement.removeChild(this.strategyContainer.root);
                };
                e.currentTarget.appendChild(this.strategyContainer.root);
                this.currentStock = stk;
                this.strategyContainer.initUi(this.currentStock);
            };
        };
        var divTitle = document.createElement('div');
        var titleText = stock.name + '(' + stock.code + ') '+ emjyManager.accountNames[stock.account];
        divTitle.appendChild(document.createTextNode(titleText));
        var anchor = document.createElement('a');
        anchor.textContent = '行情';
        if (stock.market !== undefined) {
            anchor.href = futuStockUrl + stock.code + '-' + stock.market;
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
        };
        divContainer.appendChild(divTitle);
        var divDetails = document.createElement('div');
        divDetails.appendChild(document.createTextNode('最新价：' + stock.latestPrice + ' 成本价：' + stock.holdCost + ' 数量：' + stock.holdCount));
        divContainer.appendChild(divDetails);
        this.listContainer.appendChild(document.createElement('hr'));
        this.listContainer.appendChild(divContainer);
    }
}

class StrategyChooser {
    constructor() {
        this.buyView = null;
        this.sellView = null;
        this.ownerAccount = null;
        this.code = null;
        this.root = document.createElement('div');
        this.radioBars = new RadioAnchorBar('');
        this.radioBars.addRadio('买入策略', function(that) {
            that.initOptions(true, that.buyView);
        }, this);
        this.radioBars.addRadio('卖出策略', function(that) {
            that.initOptions(false, that.sellView);
        }, this);
        this.root.appendChild(this.radioBars.container);
        this.strategySelector = document.createElement('select');
        this.strategySelector.onchange = e => {
            this.onStrategyChanged();
        };
        this.root.appendChild(this.strategySelector);
        this.strategyRoot = document.createElement('div');
        this.root.appendChild(this.strategyRoot);
    }

    initUi(stock) {
        utils.removeAllChild(this.strategyRoot);
        this.code = stock.code;
        this.ownerAccount = stock.account;
        if (stock.buyStrategy) {
            this.buyView = strategyViewManager.viewer(stock.buyStrategy);
            this.buyView.ownerAccount = stock.account;
        } else {
            this.buyView = null;
        };
        if (stock.sellStrategy) {
            this.sellView = strategyViewManager.viewer(stock.sellStrategy);
        } else {
            this.sellView = null;
        };
        this.radioBars.selectDefault();
    }

    initOptions(isBuy, view) {
        if (this.strategyBuy !== undefined) {
            this.saveStrategy();
        };

        this.strategyBuy = isBuy;
        if (isBuy) {
            this.createStrategyOptions(BuyStrategyKeyNames);
        } else {
            this.createStrategyOptions(SellStrategyKeyNames);
        }
        
        if (view && view.strategy) {
            this.strategySelector.value = view.strategy.key;
            this.onStrategyChanged();
        };
    }

    createStrategyOptions(availableStrategies) {
        utils.removeAllChild(this.strategySelector);
        utils.removeAllChild(this.strategyRoot);
        var opt0 = document.createElement('option');
        opt0.textContent = '--请选择--';
        opt0.selected = true;
        opt0.disabled = true;
        this.strategySelector.appendChild(opt0);
        for (var i = 0; i < availableStrategies.length; i++) {
            var opt = document.createElement('option');
            opt.value = availableStrategies[i].key;
            opt.textContent = availableStrategies[i].name;
            this.strategySelector.appendChild(opt);
        };
        var optDelete = document.createElement('option');
        optDelete.value = 'invalid';
        optDelete.textContent = '--删除--';
        this.strategySelector.appendChild(optDelete);
    }

    saveStrategy() {
        var message = {command:'mngr.strategy', code: this.code, account: this.ownerAccount};
        if (this.buyView && this.buyView.isChanged()) {
            message.buyStrategy = this.buyView.strategy;
        };
        if (this.sellView && this.sellView.isChanged()) {
            message.sellStrategy = this.sellView.strategy;
        };

        if (message.buyStrategy || message.sellStrategy) {
            emjyManager.sendExtensionMessage(message);
        };
    }

    removeStrategy(stype) {
        emjyManager.sendExtensionMessage({command:'mngr.strategy.rmv', code: this.code, account: this.ownerAccount, stype});
    }

    onStrategyChanged() {
        if (this.strategyBuy) {
            if (!this.buyView || this.buyView.strategy.key != this.strategySelector.value) {
                if (this.strategySelector.value == 'invalid') {
                    this.buyView = null;
                    this.removeStrategy('buy');
                } else {
                    this.buyView = strategyViewManager.viewer({key: this.strategySelector.value, enabled: true, account: this.ownerAccount});
                    this.buyView.ownerAccount = this.ownerAccount;
                };
                utils.removeAllChild(this.strategyRoot);
            };
        } else if (!this.sellView || this.sellView.strategy.key != this.strategySelector.value) {
            if (this.strategySelector.value == 'invalid') {
                this.sellView = null;
                this.removeStrategy('sell');
            } else {
                this.sellView = strategyViewManager.viewer({key: this.strategySelector.value, enabled: true, account: this.ownerAccount});
            };
            utils.removeAllChild(this.strategyRoot);
        }

        if (this.strategyBuy) {
            if (this.buyView) {
                this.strategyRoot.appendChild(this.buyView.createView());
            };
        } else {
            if (this.sellView) {
                this.strategyRoot.appendChild(this.sellView.createView());
            };
        }
    }
}

window.onunload = function() {
    if (emjyManager.stockList.strategyContainer.stock) {
        emjyManager.stockList.strategyContainer.saveStrategy();
    };
}

window.onload = function() {
    emjyManager.initUi();
}

function onExtensionBackMessage(message) {
    if (message.command.startsWith('mngr.')) {
        emjyManager.handleExtensionMessage(message);
    }
}

chrome.runtime.onMessage.addListener(onExtensionBackMessage);

let emjyManager = new Manager(logInfo);
emjyManager.sendExtensionMessage({command: 'mngr.init'});
