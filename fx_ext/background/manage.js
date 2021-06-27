'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
        this.accountNames = {'normal':'普通账户', 'collat': '担保品', 'credit': '融资账户'};
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
            this.page.initUi();
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
            tstocks.forEach(function(ts) {
                ts.acccode = account + '_' + ts.code;
                ts.account = account;
                accstocks.push(ts);
            });
        };
        this.stockList.initUi(accstocks);
        //this.log(JSON.stringify(stocks));
    }
}

class ManagerPage {
    constructor() {
        this.root = document.createElement('div');
    }

    initUi() {
    }
}

class StockList {
    constructor(log) {
        this.log = log;
        this.stocks = null;
        this.root = document.createElement('div');
        this.listContainer = document.createElement('div');
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
            var divContainer = document.createElement('div');
            divContainer.stock = stocks[i];
            if (stocks[i].buyStrategy) {
                divContainer.stock.buyStrategy = strategyManager.initStrategy(stocks[i].acccode + '_buyStrategy', stocks[i].buyStrategy, this.log);
            };
            if (stocks[i].sellStrategy) {
                divContainer.stock.sellStrategy = strategyManager.initStrategy(stocks[i].acccode + '_sellStrategy', stocks[i].sellStrategy, this.log);
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
            divTitle.appendChild(document.createTextNode(stocks[i].name + '(' + stocks[i].code + ') '+ emjyManager.accountNames[stocks[i].account] + '持有'));
            divContainer.appendChild(divTitle);
            var divDetails = document.createElement('div');
            divDetails.appendChild(document.createTextNode('最新价：' + stocks[i].latestPrice + ' 成本价：' + stocks[i].holdCost + ' 数量：' + stocks[i].holdCount));
            divContainer.appendChild(divDetails);
            this.listContainer.appendChild(document.createElement('hr'));
            this.listContainer.appendChild(divContainer);
        };
        
        this.root.appendChild(this.listContainer);
        this.listContainer.lastElementChild.click();
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
        var message = {command:'mngr.strategy', code: this.stock.code};
        if (this.stock.buyStrategy && this.stock.buyStrategy.isChanged()) {
            message.buyStrategy = this.stock.buyStrategy.tostring();
            strategyManager.flushStrategy(this.stock.buyStrategy);
        };
        if (this.stock.sellStrategy && this.stock.sellStrategy.isChanged()) {
            message.sellStrategy = this.stock.sellStrategy.tostring();
            strategyManager.flushStrategy(this.stock.sellStrategy);
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

function onExtensionBackMessage(message) {
    if (message.command.startsWith('mngr.')) {
        emjyManager.handleExtensionMessage(message);
    }
}

chrome.runtime.onMessage.addListener(onExtensionBackMessage);

let emjyManager = new Manager(logInfo);
emjyManager.sendExtensionMessage({command: 'mngr.init'});
