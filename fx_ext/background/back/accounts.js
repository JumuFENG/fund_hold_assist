'use strict';
let BondRepurchasePath = '/BondRepurchase/SecuritiesLendingRepurchase';

class Wallet {
    constructor() {
        this.fundcode = '511880';
        this.name = '';
        this.state = 'none';
        this.holdCount = 0;
        this.log = emjyBack.log;
    }

    updateFundPrice(snapshot, account) {
        this.log('updateFundPrice');
        if (snapshot.code != this.fundcode) {
            return;
        };

        this.latestPrice = snapshot.realtimequote.currentPrice;
        this.buy1Prices = snapshot.fivequote.buy1;
        this.sell1Prices = snapshot.fivequote.sale1;
        if (this.state == 'fetchBuy') {
            this.state = 'none';
            emjyBack.tryBuyStock(this.fundcode, this.name, this.sell1Prices, 1, account);
        } else if (this.state == 'fetchSell') {
            this.state = 'none';
            emjyBack.trySellStock(this.fundcode, this.buy1Prices, 1, account);
        }
    }
}

class AccountInfo {
    constructor() {
        this.keyword = null;
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
        this.stocks = [];
        this.wallet = null;
        this.log = emjyBack.log;
    }

    initAccount(key, buyPath, sellPath, assetsPath) {
        this.keyword = key;
        this.buyPath = buyPath;
        this.sellPath = sellPath;
        this.assetsPath = assetsPath;
        this.wallet = new Wallet();
    }

    loadWatchings() {
        var watchingStorageKey = this.keyword + '_watchings';
        chrome.storage.local.get(watchingStorageKey, item => {
            emjyBack.log('get watching_stocks', JSON.stringify(item));
            if (item && item[watchingStorageKey]) {
                item[watchingStorageKey].forEach(s => {
                    this.addWatchStock(s);
                });
            };
        });
    }

    loadStrategies() {
        this.stocks.forEach(s => {
            s.loadKlines();
            var buyStorageKey = this.keyword + '_' + s.code + '_buyStrategy';
            chrome.storage.local.get(buyStorageKey, item => {
                if (item && item[buyStorageKey]) {
                    emjyBack.applyStoredBuyStrategy(this.keyword, s.code, item[buyStorageKey]);
                };
            });
            var sellStorageKey = this.keyword + '_' + s.code + '_sellStrategy';
            chrome.storage.local.get(sellStorageKey, item => {
                if (item && item[sellStorageKey]) {
                    emjyBack.applyStoredSellStrategy(this.keyword, s.code, item[sellStorageKey]);
                };
            });
        });
    }

    parseStockInfoList(stocks) {
        for (var i = 0; i < stocks.length; i++) {
            if (this.wallet && stocks[i].code == this.wallet.fundcode) {
                this.wallet.name = stocks[i].name;
                this.wallet.holdCount = stocks[i].holdCount;
                continue;
            };
            var stockInfo = this.stocks.find(function(s) {return s.code == stocks[i].code});
            if (!stockInfo) {
                stockInfo = new StockInfo(stocks[i]);
                this.stocks.push(stockInfo);
            };
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.holdCost = stocks[i].holdCost;
            stockInfo.market = stocks[i].market;
            emjyBack.stockMarket[stocks[i].code] = stocks[i].market;
        };
    }

    getAccountStocks() {
        if (!this.stocks || this.stocks.length == 0) {
            return null;
        };

        return {account: this.keyword, stocks: JSON.stringify(this.stocks)};
    }

    queryStockMarketInfo() {
        this.stocks.forEach(s => {
            emjyBack.postQuoteWorkerMessage({command:'quote.query.stock', code: s.code});
        });
    }

    updateStockMarketInfo(sdata) {
        if (!this.stocks || this.stocks.length == 0) {
            return;
        };
        var stock = this.stocks.find(s => { return s.code == sdata.code});
        if (stock) {
            if (!stock.name) {
                stock.name = sdata.name;
            }
            stock.market = sdata.market;
        };
    }

    updateStockRtPrice(snapshot) {
        // this.log('updateStockRtPrice', JSON.stringify(snapshot));
        if (this.wallet && snapshot.code == this.wallet.fundcode) {
            this.wallet.updateFundPrice(snapshot, this.keyword);
            return;
        };

        if (!this.stocks) {
            return;
        };

        var stock = this.stocks.find(function(s) { return s.code == snapshot.code});
        if (stock) {
            stock.updateRtPrice(snapshot);
        }
    }

    updateStockRtKline(message) {
        if (!this.stocks) {
            return;
        };

        var stock = this.stocks.find((s) => { return s.code == message.kline.data.code});
        if (stock) {
            stock.updateRtKline(message);
        };
    }

    buyStock(code, name, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = {code, name};

        if (count < 100) {
            this.log('Buy', code, name, 'price:', price, 'count: 1/', finalCount);
            emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
            return;
        };

        var moneyNeed = finalCount * price;
        if (this.availableMoney < moneyNeed) {
            finalCount = 100 * Math.floor(this.availableMoney / (100 * price));
        }

        moneyNeed = finalCount * price;

        if (this.availableMoney < moneyNeed) {
            this.log('No availableMoney match');
            return;
        }
        emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
        this.availableMoney -= moneyNeed;
    }

    sellStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = this.stocks.find(function(s) { return s.code == code; });
        if (stockInfo) {
            if (finalCount > stockInfo.availableCount) {
                finalCount = stockInfo.availableCount;
            }
            if (finalCount == 0) {
                this.log('error: availableCount is 0');
                return;
            };

            emjyBack.sendTradeMessage(this.sellPath, {code: stockInfo.code, name: stockInfo.name}, price, finalCount);
            stockInfo.availableCount -= finalCount;
            this.availableMoney += finalCount * price;
        } else if (code == this.wallet.fundcode) {
            emjyBack.sendTradeMessage(this.sellPath, {code}, price, finalCount);
            this.availableMoney += this.wallet.holdCount * price;
            this.wallet.holdCount = 0;
        }
    }

    applyStrategy(code, bstr, sstr) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        if (bstr) {
            stock.buyStrategy = bstr;
        };
        if (sstr) {
            if (sstr.key == 'StrategySellEL' && stock.holdCost) {
                sstr.setHoldCost(stock.holdCost);
            };
            if (sstr.key == 'StrategySellMA' || sstr.key == 'StrategySellMAR') {
                sstr.setHoldCount(stock.holdCount);
            };
            stock.sellStrategy = sstr;
        };
    }

    removeStrategy(code, stype) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        var storageKey = this.keyword + '_' + code;
        if (stype == 'buy') {
            stock.buyStrategy = null;
            storageKey += '_buyStrategy';
        } else {
            stock.sellStrategy = null;
            storageKey += '_sellStrategy';
        };
        chrome.storage.local.remove(storageKey);
    }

    addWatchStock(code) {
        var stock = this.stocks.find(s => {return s.code == code;});
        if (stock) {
            return;
        };
        this.stocks.push(new StockInfo({ code, name: '', holdCount: 0, availableCount: 0, market: '', watching: true}));
        emjyBack.postQuoteWorkerMessage({command:'quote.query.stock', code});
    }

    removeStock(code) {
        var ic = this.stocks.findIndex(s => {return s.code == code;});
        if (ic == -1) {
            return;
        };
        this.stocks[ic].deleteKlines();
        chrome.storage.local.remove([this.keyword + '_' + code + '_buyStrategy', this.keyword + '_' + code + '_sellStrategy']);
        this.stocks.splice(ic, 1);
    }

    save() {
        var stock_watching = [];
        this.stocks.forEach(s => {
            if (s.watching || (s.holdCount == 0 && (s.buyStrategy || s.sellStrategy))) {
                stock_watching.push(s.code);
            };
            s.saveKlines();
            if (s.buyStrategy) {
                strategyManager.flushStrategy(s.buyStrategy);
            };
            if (s.sellStrategy) {
                strategyManager.flushStrategy(s.sellStrategy);
            };
        });
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = stock_watching;
        chrome.storage.local.set(watchingStocks);
    }

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled && s.buyStrategy.inCritical
        });

        if (!anyCritial) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchBuy';
        };
    }

    checkAvailableMoney(price) {
        var count = 100 * Math.ceil(400 / price);
        var moneyNeed = count * price;
        if (moneyNeed > this.availableMoney && this.wallet.holdCount > 0) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchSell';
        };
    }
}

class NormalAccount extends AccountInfo {
    constructor() {
        super();
    }

    buyFundBeforeClose() {
        emjyBack.scheduleTaskInNewTab({command: 'emjy.trade.bonds', code: '204001', path: BondRepurchasePath}, true);
        setTimeout(() => {
            emjyBack.scheduleTaskInNewTab({command: 'emjy.trade.bonds', code: '131810', path: BondRepurchasePath}, false);
        }, 2000);
    }
}
