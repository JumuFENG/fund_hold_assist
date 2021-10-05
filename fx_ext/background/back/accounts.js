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
            var strStorageKey = this.keyword + '_' + s.code + '_strategies';
            chrome.storage.local.get(strStorageKey, item => {
                if (item && item[strStorageKey]) {
                    this.applyStrategy(s.code, JSON.parse(item[strStorageKey]));
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

        var stocks = [];
        for (var i = 0; i < this.stocks.length; i++) {
            stocks.push({
                code: this.stocks[i].code,
                name: this.stocks[i].name,
                market: this.stocks[i].market,
                holdCost: this.stocks[i].holdCost,
                holdCount: this.stocks[i].holdCount,
                availableCount: this.stocks[i].availableCount,
                latestPrice: this.stocks[i].latestPrice,
                strategies: this.stocks[i].strategies ? this.stocks[i].strategies.tostring() : null,
                costDetail: this.stocks[i].costDetail
            });
        };

        return {account: this.keyword, stocks};
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
        if (!this.stocks || !message.kline.data) {
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

    applyStrategy(code, str) {
        if (!str) {
            return;
        };
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        var strategyGroup = strategyGroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
        strategyGroup.setHoldCost(stock.holdCost);
        strategyGroup.setHoldCount(stock.holdCount);
        strategyGroup.applyGuardLevel();
        stock.strategies = strategyGroup;
    }

    removeStrategy(code, stype) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };

        stock.strategies = null;
        chrome.storage.local.remove(this.keyword + '_' + code + '_strategies');
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
        chrome.storage.local.remove(this.keyword + '_' + code + '_strategies');
        this.stocks.splice(ic, 1);
    }

    save() {
        var stock_watching = [];
        this.stocks.forEach(s => {
            if (s.holdCount == 0 && (s.watching || s.strategies)) {
                stock_watching.push(s.code);
            };
            s.saveKlines();
            if (s.strategies) {
                s.strategies.save();
            };
        });
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = stock_watching;
        chrome.storage.local.set(watchingStocks);
    }

    exportConfig() {
        var configs = {};
        var stock_watching = [];
        this.stocks.forEach(s => {
            if (s.holdCount == 0 && (s.watching || s.strategies)) {
                stock_watching.push(s.code);
            };
            if (s.strategies) {
                configs[s.strategies.storeKey] = s.strategies.tostring();
            };
        });
        configs[this.keyword + '_watchings'] = stock_watching;
        return configs;
    }

    importConfig(configs) {
        configs[this.keyword + '_watchings'].forEach(c => {
            this.addWatchStock(c);
        });
        this.stocks.forEach(s => {
            this.applyStrategy(s.code, configs[this.keyword + '_' + s.code + '_strategies']);
        });
    }

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled() && s.buyStrategy.inCritical();
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
        }, 5000);
    }
}
