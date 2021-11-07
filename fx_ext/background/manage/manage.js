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

    addStock(code, account, strGrp = null) {
        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };
        var stock = {code, name:'', account, holdCount: 0, holdCost: 0};
        stock.acccode = account + '_' + code;
        stock.strategies = strGrp;
        this.stockList.addStock(stock);
    }

    addWatchingStock(code, account, strGrp = null) {
        if (!this.stockList.stockExist(code, account)) {
            this.addStock(code, account, strGrp);
            this.sendExtensionMessage({command:'mngr.addwatch', code, account, strategies: strGrp});
        }
    }
}

class ManagerPage {
    constructor() {
        this.root = document.createElement('div');
        var btnExport = document.createElement('button');
        btnExport.textContent = '导出';
        btnExport.onclick = e => {
            emjyManager.sendExtensionMessage({command:'mngr.export'});
        };
        this.root.appendChild(btnExport);
        var importDiv = document.createElement('div');
        var fileIpt = document.createElement('input');
        fileIpt.type = 'file';
        fileIpt.multiple = false;
        fileIpt.onchange = e => {
            e.target.files[0].text().then(text => {
                emjyManager.sendExtensionMessage({command:'mngr.import', config: JSON.parse(text)});
            });
        };
        importDiv.appendChild(document.createTextNode('导入'));
        importDiv.appendChild(fileIpt);
        this.root.appendChild(importDiv);
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
            if (this.stocks[i].acccode == code) {
                this.stocks[i].strategies = strGrp;
                break;
            };
        };
    }

    stockExist(code, account) {
        return this.accStockExists(account + '_' + code);
    }

    accStockExists(code) {
        return this.stocks.find( s => {
            return s.acccode == code;
        });
    }

    addStock(stock) {
        if (!this.accStockExists(stock.acccode)) {
            this.stocks.push(stock);
        };
        
        var divContainer = document.createElement('div');
        divContainer.acccode = stock.acccode;
        divContainer.onclick = e => {
            if (this.strategyGroupView && (!this.currentCode || this.currentCode != e.currentTarget.acccode)) {
                if (this.strategyGroupView) {
                    this.strategyGroupView.saveStrategy();
                    this.onStrategyGroupChanged(this.currentCode, this.strategyGroupView.strGrp);
                };
                if (this.strategyGroupView.root.parentElement) {
                    this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
                };
                e.currentTarget.appendChild(this.strategyGroupView.root);
                this.currentCode = e.currentTarget.acccode;
                var stk = this.accStockExists(this.currentCode);
                this.strategyGroupView.latestPrice = stk.latestPrice;
                this.strategyGroupView.initUi(stk.account, stk.code, stk.strategies);
            };
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
        };
        divContainer.appendChild(divTitle);
        var divDetails = document.createElement('div');
        divDetails.appendChild(document.createTextNode('最新价：' + stock.latestPrice + ' 成本价：' + stock.holdCost + ' 数量：' + stock.holdCount));
        divContainer.appendChild(divDetails);
        this.listContainer.appendChild(document.createElement('hr'));
        this.listContainer.appendChild(divContainer);
    }
}

window.addEventListener('beforeunload', e => {
    if (emjyManager.stockList.strategyGroupView) {
        emjyManager.stockList.strategyGroupView.saveStrategy();
    };
});

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
