'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Utils {
    removeAllChild(ele) {
        while(ele.hasChildNodes()) {
            ele.removeChild(ele.lastChild);
        }
    }

}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
    }

    sendExtensionMessage(message) {
        chrome.runtime.sendMessage(message);
    }

    handleExtensionMessage(message) {
        if (message.command == 'mngr.stocks') {
            this.initStocks(JSON.parse(message.stocks));
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
        this.stockList.initUi(stocks);
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
            divContainer.code = stocks[i].code;
            divContainer.owner = this
            divContainer.onclick = function(e) {
                var code = this.code;
                var owner = this.owner;
                if (owner.strategyContainer) {
                    if (owner.strategyContainer.code) {
                        owner.strategyContainer.saveStrategy();
                    }
                    owner.strategyContainer.root.parentElement.removeChild(owner.strategyContainer.root);
                    this.appendChild(owner.strategyContainer.root);
                    owner.strategyContainer.initUi(code);
                }
            }
            var divTitle = document.createElement('div');
            divTitle.appendChild(document.createTextNode(stocks[i].name + '(' + stocks[i].code + ')'));
            divContainer.appendChild(divTitle);
            var divDetails = document.createElement('div');
            divDetails.appendChild(document.createTextNode('最新价：' + stocks[i].latestPrice + '成本价：' + stocks[i].holdCost + '数量：' + stocks[i].holdCount));
            divContainer.appendChild(divDetails);
            this.listContainer.appendChild(divContainer);
        };
        this.root.appendChild(this.listContainer);
        this.strategyContainer.initUi('');
        this.root.appendChild(this.strategyContainer.root);
    }
}

class StrategyChooser {
    constructor() {
        this.root = document.createElement('div');
        this.code = null;
    }

    initUi(code) {
        utils.removeAllChild(this.root);
        this.code = code;
        this.root.appendChild(document.createTextNode('strategy div for: ' + this.code));
    }

    saveStrategy() {

    }
}

window.onunload = function() {
    emjyManager.sendExtensionMessage({command: 'mngr.closed'});
}

function onExtensionBackMessage(message) {
    if (message.command.startsWith('mngr.')) {
        emjyManager.handleExtensionMessage(message);
    }
}

chrome.runtime.onMessage.addListener(onExtensionBackMessage);

let emjyManager = new Manager(logInfo);
let utils = new Utils();
emjyManager.sendExtensionMessage({command: 'mngr.init'});
