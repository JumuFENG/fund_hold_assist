'use strict';

let emjyBack = null;

class AccountInfo {
    constructor() {
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
    }

    initAccount(buyPath, sellPath, assetsPath) {
        this.buyPath = buyPath;
        this.sellPath = sellPath;
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
        this.currentTask = null;
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

    // DON'T use this API directly, or it may break the task queue.
    sendMsgToContent(data) {
        //emjyBack.log('sendMsgToContent', data);
        chrome.tabs.query({active:true, currentWindow:true}, function (tabs) {
            var doSendMsgToContent = function (tabid, data) {
                chrome.tabs.sendMessage(tabid, data);
                emjyBack.currentTask = data;
                emjyBack.postWorkerTask({command: 'emjy.sent'});
                emjyBack.log('do sendMsgToContent', data);
            };

            var sendNavigateToContent = function(tabid, url) {
                chrome.tabs.sendMessage(tabid, {command: 'emjy.navigate', url: url.href});
                emjyBack.log('do sendNavigateToContent', url.href);
            };

            var url = new URL(tabs[0].url);
            if (url.host == 'jywg.18.cn') {
                if (url.pathname == '/Login') {
                    return;
                }
                if (data.command == 'emjy.getAssets') {
                    if (url.pathname == data.assetsPath) {
                        doSendMsgToContent(tabs[0].id, data);
                    } else {
                        url.pathname = data.assetsPath;
                        url.search = '';
                        sendNavigateToContent(tabs[0].id, url);
                    }
                    return;
                }
                if (data.command == 'emjy.trade') {
                    if (url.pathname == data.tradePath && url.search.includes('code=')) {
                        doSendMsgToContent(tabs[0].id, data);
                    } else {
                        url.pathname = data.tradePath;
                        url.search = '?code=' + data.stock.code;
                        sendNavigateToContent(tabs[0].id, url);
                    }
                    return;
                }
                // chrome.tabs.sendMessage(tabs[0].id, data);
                // emjyBack.log('do sendMsgToContent', data);
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
                this.popCurrentTask();
            }
        } else if (message.command == 'emjy.trade') {
            if (message.result == 'success') {
                this.popCurrentTask();
            } else if (message.result == 'error') {
                if (message.reason == 'pageNotLoaded') {
                    this.revokeCurrentTask();
                } else {
                    this.popCurrentTask();
                }
            }
        }
    }

    postWorkerTask(task) {
        this.log('postMessage to worker');
        this.mainWorker.postMessage(task);
    }

    revokeCurrentTask() {
        this.log('revoke task');
        this.postWorkerTask({command: 'emjy.revoke'});
        this.currentTask = null;
    }

    popCurrentTask() {
        this.currentTask.state = 'done';
        this.log('pop task');
        this.postWorkerTask(this.currentTask);
        this.currentTask = null;
    }

    onMainWorkerMessageReceived(message) {
        // this.log('mainworker', message.task, message.assetsPath);
        if (!this.currentTask) {
            this.sendMsgToContent(message);
        }
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

    trySellStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }
        for (var i = 0; i < this.normalAccount.stocks.length; i++) {
            if (this.normalAccount.stocks[i].code == code) {
                if (finalCount > this.normalAccount.stocks[i].availableCount) {
                    finalCount = this.normalAccount.stocks[i].availableCount;
                }
                this.sendTradeMessage(this.normalAccount.sellPath, this.normalAccount.stocks[i], price, finalCount);
                return;
            }
        };
        for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
            if (this.collateralAccount.stocks[i].code == code) {
                if (finalCount > this.collateralAccount.stocks[i].availableCount) {
                    finalCount = this.collateralAccount.stocks[i].availableCount;
                }
                this.sendTradeMessage(this.collateralAccount.sellPath, this.collateralAccount.stocks[i], price, finalCount);
                return;
            }
        };
    }

    tryBuyStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = null;
        for (var i = 0; i < this.normalAccount.stocks.length; i++) {
            if (this.normalAccount.stocks[i].code == code) {
                stockInfo = this.normalAccount.stocks[i];
                break;
            }
        };
        if (!stockInfo) {
            for (var i = 0; i < this.collateralAccount.stocks.length; i++) {
                if (this.collateralAccount.stocks[i].code == code) {
                    stockInfo = this.collateralAccount.stocks[i];
                    break;
                }
            };
        }

        if (!stockInfo) {
            stockInfo = {code: code};
        }

        var moneyNeed = finalCount * price;
        var moneyMax = Math.max(this.normalAccount.availableMoney, this.collateralAccount.availableMoney, this.creditAccount.availableMoney);
        if (moneyMax < moneyNeed) {
            finalCount = 100 * Math.floor(moneyMax / (100 * price));
        }

        moneyNeed = finalCount * price;
        var buyAccount = this.normalAccount;
        if (this.normalAccount.availableMoney < moneyNeed) {
            buyAccount = this.collateralAccount;
            if (this.collateralAccount.availableMoney < moneyNeed) {
                buyAccount = this.creditAccount;
            }
        }

        if (buyAccount.availableMoney < moneyNeed) {
            this.log('No availableMoney match');
            return;
        }
        this.sendTradeMessage(buyAccount.buyPath, stockInfo, price, finalCount);
    }

    sendTradeMessage(tradePath, stock, price, count) {
        this.postWorkerTask({command: 'emjy.trade', tradePath: tradePath, stock: stock, price: price, count: count});
    }
}