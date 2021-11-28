'use strict';
let BondRepurchasePath = '/BondRepurchase/SecuritiesLendingRepurchase';

class Wallet {
    constructor() {
        this.fundcode = '511880';
        this.name = '';
        this.state = 'none';
        this.holdCount = 0;
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

    fixWatchings() {
        chrome.storage.local.get(null, items => {
            for (var k in items) {
                if (k == 'undefined') {
                    chrome.storage.local.remove(k);
                    continue;
                }
                if (k.startsWith(this.keyword)) {
                    var keys = k.split('_');
                    if (keys.length == 3 && keys[2] == 'strategies') {
                        this.addWatchStock(keys[1]);
                        this.applyStrategy(keys[1], JSON.parse(items[k]));
                    }
                }
            }
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
            if (stocks[i].market !== undefined) {
                stockInfo.market = stocks[i].market;
                emjyBack.stockMarket[stocks[i].code] = stocks[i].market;
            }
            stockInfo.latestPrice = stocks[i].latestPrice;
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
        // emjyBack.log('updateStockRtPrice', JSON.stringify(snapshot));
        if (this.wallet && snapshot.code == this.wallet.fundcode) {
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

        if (count < 100) {
            emjyBack.log('Buy', code, name, 'price:', price, 'count: 1/', finalCount);
            emjyBack.scheduleNewTabCommand(new TradeCommander(this.buyPath, code, name, finalCount, price));
            return;
        };

        var moneyNeed = finalCount * price;
        if (this.availableMoney < moneyNeed) {
            finalCount = 100 * Math.floor(this.availableMoney / (100 * price));
        }

        moneyNeed = finalCount * price;

        if (this.availableMoney < moneyNeed) {
            emjyBack.log('No availableMoney match');
            return;
        }
        emjyBack.scheduleNewTabCommand(new TradeCommander(this.buyPath, code, name, finalCount, price));
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
                emjyBack.log('error: availableCount is 0', stockInfo.code, stockInfo.name);
                return;
            };

            emjyBack.scheduleNewTabCommand(new TradeCommander(this.sellPath, code, stockInfo.name, finalCount, price));
            stockInfo.availableCount -= finalCount;
            this.availableMoney += finalCount * price;
        } else if (code == this.wallet.fundcode) {
            emjyBack.scheduleNewTabCommand(new TradeCommander(this.sellPath, code, '', finalCount, price));
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
        strategyGroup.setHoldCount(stock.holdCount, stock.availableCount);
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
        var name = '';
        var market = '';
        if (emjyBack.stockMarket[code]) {
            name = emjyBack.stockMarket[code].name;
            market = emjyBack.getStockMarketHS(code);
        } else {
            emjyBack.postQuoteWorkerMessage({command:'quote.query.stock', code});
        }
        this.stocks.push(new StockInfo({ code, name, holdCount: 0, availableCount: 0, market}));
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
            if (s.strategies) {
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
            if (s.strategies) {
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
            if (configs[this.keyword + '_' + s.code + '_strategies'] !== undefined) {
                this.applyStrategy(s.code, JSON.parse(configs[this.keyword + '_' + s.code + '_strategies']));
            };
        });
    }

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled() && s.buyStrategy.inCritical();
        });

        if (!anyCritial) {
            emjyBack.scheduleNewTabCommand(new TradeCommander(this.buyPath, this.wallet.fundcode, '', 1, 0));
        };
    }

    checkAvailableMoney(price) {
        var count = 100 * Math.ceil(400 / price);
        var moneyNeed = count * price;
        if (moneyNeed > this.availableMoney && this.wallet.holdCount > 0) {
            emjyBack.scheduleNewTabCommand(new TradeCommander(this.sellPath, this.wallet.fundcode, '', 1, 0));
        };
    }

    fillupGuardPrices() {
        this.stocks.forEach(stock => {
            if (stock.klines && stock.strategies) {
                stock.strategies.applyKlines(stock.klines.klines);
            }
        });
    }
}

class NormalAccount extends AccountInfo {
    constructor() {
        super();
    }

    buyFundBeforeClose() {
        emjyBack.scheduleNewTabCommand(new BondRepurchaseCommander('204001'), true);
        setTimeout(() => {
            emjyBack.scheduleNewTabCommand(new BondRepurchaseCommander('131810', true));
        }, 8000);
    }
}
