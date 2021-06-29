'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
        this.accountNames = {'normal':'普通账户', 'collat': '担保品', 'credit': '融资账户', 'watch':'关注中'};
    }

    sendExtensionMessage(message) {
        chrome.runtime.sendMessage(message);
    }

    handleExtensionMessage(message) {
        if (message.command == 'mngr.stocks') {
            this.initStocks(message.stocks);
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
            var tstocks = JSON.parse(stocks[i].stocks);
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
    }

    addStock(code) {
        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };
        var stock = {code: code, name:'', account: 'watch', holdCount: 0, holdCost: 0};
        stock.acccode = stock.account + '_' + code;
        this.stockList.addStock(stock);
    }

    addWatchingStock(code) {
        this.addStock(code);
        this.sendExtensionMessage({command:'mngr.addwatch', code});
    }
}

class ManagerPage {
    constructor() {
        this.root = document.createElement('div');
    }

    addWatchArea() {
        var watchDiv = document.createElement('div');
        this.inputCode = document.createElement('input');
        watchDiv.appendChild(this.inputCode);
        var btnOk = document.createElement('button');
        btnOk.textContent = '新增观察股票';
        btnOk.parentPage = this;
        btnOk.onclick = function(e) {
            emjyManager.addWatchingStock(e.target.parentPage.inputCode.value);
        }
        watchDiv.appendChild(btnOk);
        this.root.appendChild(watchDiv);
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
        this.selectedCode = null;
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
        if (stock.buyStrategy) {
            divContainer.stock.buyStrategy = strategyManager.initStrategy(stock.acccode + '_buyStrategy', stock.buyStrategy, this.log);
        };
        if (stock.sellStrategy) {
            divContainer.stock.sellStrategy = strategyManager.initStrategy(stock.acccode + '_sellStrategy', stock.sellStrategy, this.log);
        };
        divContainer.owner = this;
        divContainer.onclick = function(e) {
            var code = this.stock.acccode;
            var owner = this.owner;
            if (owner.strategyContainer && code != owner.selectedCode) {
                if (owner.strategyContainer.stock) {
                    owner.strategyContainer.saveStrategy();
                }
                if (owner.strategyContainer.root.parentElement) {
                    owner.strategyContainer.root.parentElement.removeChild(owner.strategyContainer.root);
                }
                this.appendChild(owner.strategyContainer.root);
                owner.selectedCode = code;
                owner.strategyContainer.initUi(this.stock);
            }
        }
        var divTitle = document.createElement('div');
        var titleText = stock.name + '(' + stock.code + ') '+ emjyManager.accountNames[stock.account];
        if (stock.account != 'watch') {
            titleText += '持有'
        };
        divTitle.appendChild(document.createTextNode(titleText));
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
        this.stock = null;
        this.root = document.createElement('div');
        this.radioBars = new RadioAnchorBar('');
        this.radioBars.addRadio('买入策略', function(that) {
            that.initOptions(true, that.stock.buyStrategy);
        }, this);
        this.radioBars.addRadio('卖出策略', function(that) {
            that.initOptions(false, that.stock.sellStrategy);
        }, this);
        this.root.appendChild(this.radioBars.container);
        this.strategySelector = document.createElement('select');
        this.strategySelector.onchange = function() {
            emjyManager.stockList.strategyContainer.onStrategyChanged();
        }
        this.root.appendChild(this.strategySelector);
        this.strategyRoot = document.createElement('div');
        this.root.appendChild(this.strategyRoot);
    }

    initUi(stock) {
        utils.removeAllChild(this.strategyRoot);
        this.stock = stock;
        this.radioBars.selectDefault();
    }

    initOptions(isBuy, strategy) {
        if (this.strategyBuy !== undefined) {
            this.saveStrategy();
        };

        this.strategyBuy = isBuy;
        if (isBuy) {
            this.createStrategyOptions(strategyManager.buystrategies);
        } else {
            this.createStrategyOptions(strategyManager.sellstrategies);
        }
        
        if (strategy) {
            this.strategySelector.value = strategy.key;
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
    }

    saveStrategy() {
        var message = {command:'mngr.strategy', code: this.stock.code, account: this.stock.account};
        if (this.stock.buyStrategy && this.stock.buyStrategy.isChanged()) {
            message.buyStrategy = this.stock.buyStrategy.tostring();
        };
        if (this.stock.sellStrategy && this.stock.sellStrategy.isChanged()) {
            message.sellStrategy = this.stock.sellStrategy.tostring();
        };

        if (message.buyStrategy || message.sellStrategy) {
            emjyManager.sendExtensionMessage(message);
        };
    }

    onStrategyChanged() {
        if (this.strategyBuy) {
            if (!this.stock.buyStrategy || this.stock.buyStrategy.key != this.strategySelector.value) {
                this.stock.buyStrategy = strategyManager.createStrategy(this.strategySelector.value, emjyManager.log);
                this.stock.buyStrategy.account = this.stock.account;
                this.stock.buyStrategy.storeKey = this.stock.acccode + '_buyStrategy';
                utils.removeAllChild(this.strategyRoot);
            };
        } else if (!this.stock.sellStrategy || this.stock.sellStrategy.key != this.strategySelector.value) {
            this.stock.sellStrategy = strategyManager.createStrategy(this.strategySelector.value, emjyManager.log);
            this.stock.sellStrategy.account = this.stock.account;
            this.stock.sellStrategy.storeKey = this.stock.acccode + '_sellStrategy';
            utils.removeAllChild(this.strategyRoot);
        }

        if (this.strategyBuy) {
            this.strategyRoot.appendChild(this.stock.buyStrategy.createView());
        } else {
            this.strategyRoot.appendChild(this.stock.sellStrategy.createView());
        }
    }
}

window.onunload = function() {
    emjyManager.stockList.strategyContainer.saveStrategy();
    emjyManager.sendExtensionMessage({command: 'mngr.closed'});
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
