'use strict';

let emjyBack = null;

class AccountInfo {
    constructor() {
        this.buyPath = null;
        this.salePath = null;
        this.assetsPath = null;
    }

    initAccount(buyPath, salePath, assetsPath) {
        this.buyPath = buyPath;
        this.salePath = salePath;
        this.assetsPath = assetsPath;
    }
}

function onMainWorkerMessage(e) {
    emjyBack.onMainWorkerMessageReceived(e.data);
}

class EmjyBack {
    constructor() {
        this.log = null;
        this.normalAccount = null;
        this.collateralAccount = null;
        this.creditAccount = null;
    }

    Init(logger) {
        this.log = logger;
        this.mainWorker = new Worker('workers/mainworker.js');
        this.mainWorker.onmessage = onMainWorkerMessage;
        emjyBack = this;
        this.log('EmjyBack initialized!');
    }

    onContentLoaded(path, search) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('init accounts');
            this.normalAccount = new AccountInfo();
            this.normalAccount.initAccount('/Trade/Buy', '/Trade/Sale', '/Search/Position');
            this.collateralAccount = new AccountInfo();
            this.collateralAccount.initAccount('/MarginTrade/Buy', '/MarginTrade/Sale', '/MarginSearch/MyAssets');
            this.creditAccount = new AccountInfo();
            this.creditAccount.initAccount('/MarginTrade/MarginBuy', '/MarginTrade/FinanceSale', '/MarginSearch/MyAssets');
            this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.normalAccount.assetsPath});
            this.postWorkerTask({command: 'emjy.getAssets', assetsPath: this.creditAccount.assetsPath});
        }
        this.log('onContentLoaded');
    }

    sendMsgToContent(data) {
        //console.log('sendMsgToContent', data);
        chrome.tabs.query({active:true, currentWindow:true}, function (tabs) {
            var url = new URL(tabs[0].url);
            if (url.host == 'jywg.18.cn' && url.pathname != '/Login') {
                chrome.tabs.sendMessage(tabs[0].id, data);
                //console.log('do sendMsgToContent', data);
                emjyBack.mainWorker.postMessage({command: 'emjy.sent'});
            }
        });
    }

    onContentMessageReceived(message) {
        if (!this.normalAccount && !this.creditAccount) {
            this.log('background not initialized');
            return;
        }

        this.log('onContentMessageReceived');
        if (message.command == 'emjy.getValidateKey') {
            this.log('getValidateKey =', message.key);
        } else if (message.command == 'emjy.getAssets') {
            this.log('update assets', JSON.stringify(message));
            if (message.assetsPath == this.normalAccount.assetsPath) {
                this.normalAccount.pureAssets = parseFloat(message.pureAssets);
                this.normalAccount.availableMoney = parseFloat(message.availableMoney);
                this.normalAccount.stocks = this.parseStockInfoList(message.stocks);
            } else {
                // this.collateralAccount.pureAssets = message.totalAssets - message.pureAssets;
                this.creditAccount.pureAssets = 0.0;
                this.creditAccount.availableMoney = parseFloat(message.availableCreditMoney);
                this.collateralAccount.pureAssets = parseFloat(message.pureAssets);
                this.collateralAccount.availableMoney = parseFloat(message.availableMoney);
                this.collateralAccount.stocks = this.parseStockInfoList(message.stocks);
            }
            this.log(JSON.stringify(this.normalAccount));
            this.log(JSON.stringify(this.collateralAccount));
            this.log(JSON.stringify(this.creditAccount));
            if (this.currentTask && this.currentTask.command == message.command) {
                this.currentTask.state = 'done';
                this.log('pop task');
                this.postWorkerTask(this.currentTask);
                this.currentTask = null;
            }
        }
    }

    postWorkerTask(task) {
        this.log('postMessage to worker');
        this.mainWorker.postMessage(task);
    }

    onMainWorkerMessageReceived(message) {
        // this.log('mainworker', message.task, message.assetsPath);
        this.currentTask = message;
        this.sendMsgToContent(message);
    }

    parseStockInfoList(stocks) {
        var stockList = [];
        for (var i = 0; i < stocks.length; i++) {
            var stockInfo = {};
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.market = stocks[i].market;
            if (stockInfo.holdCount > 0 && stockInfo.availableCount > 0) {
                stockList.push(stockInfo);
            }
        };
        return stockList;
    }
}