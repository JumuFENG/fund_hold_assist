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

class DealsClient {
    constructor(validateKey, cb) {
        this.validateKey = validateKey;
        this.qqhs = 20; // 请求行数
        this.dwc = '';
        this.dealsCallback = cb;
    }

    getUrl() {
        return 'https://jywg.18.cn/Search/GetDealData?validatekey=' + this.validateKey;
    }

    GetNext() {
        var fd = new FormData();
        fd.append('qqhs', this.qqhs);
        fd.append('dwc', this.dwc);
        this.updateDwc();
        xmlHttpPost(this.getUrl(), fd, response => {
            this.onResponse(response);
        });
    }

    updateDwc() {
        this.dwc = '';
    }

    onResponse(response) {
        var deals = JSON.parse(response);
        if (deals.Status != 0 || deals.Message) {
            emjyBack.log(response);
        }
        var dend = deals.Data[deals.Data.length - 1];
        if (dend.Dwc) {
            this.dwc = dend.Dwc;
        }
        if (this.dwc && deals.Data.length == this.qqhs) {
            this.GetNext();
        }
        if (typeof(this.dealsCallback) == 'function') {
            this.dealsCallback(deals.Data);
        }
    }
}

class MarginDealsClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
        this.dwc = 1;
    }

    getUrl() {
        return 'https://jywg.18.cn/MarginSearch/GetDealData?validatekey=' + this.validateKey;
    }

    updateDwc() {
        this.dwc++;
    }
}

class AssetsClient {
    constructor(validateKey, cb, pcb) {
        this.validateKey = validateKey;
        this.moneyType = 'RMB';
        this.assetsCallback = cb;
        this.positionCallback = pcb;
    }

    GetAssets() {
        var url = 'https://jywg.18.cn/Com/queryAssetAndPositionV1?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('moneyType', this.moneyType);
        xmlHttpPost(url, fd, response => {
            this.onResponse(response);
        });
    }

    onResponse(response) {
        var assets = JSON.parse(response);
        if (assets.Status != 0 || assets.Errcode != 0) {
            emjyBack.log(response);
        }
        var assetsInfo = {};
        var data = assets.Data[0];
        for (const key in data) {
            if (Object.hasOwnProperty.call(data, key)) {
                if (key != 'positions') {
                    assetsInfo[key] = data[key];
                }
            }
        }
        if (typeof(this.assetsCallback) == 'function') {
            this.assetsCallback(assetsInfo);
        }
        if (typeof(this.positionCallback) == 'function') {
            this.positionCallback(data.positions);
        }
    }
}

class MarginAssetsClient extends AssetsClient {
    constructor(validateKey, cb, pcb) {
        super(validateKey, cb, pcb);
    }

    GetAssets() {
        var url = 'https://jywg.18.cn/MarginSearch/GetRzrqAssets?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('hblx', this.moneyType);
        xmlHttpPost(url, fd, response => {
            this.onAssetsResponse(response);
        });

        var slUrl = 'https://jywg.18.cn/MarginSearch/GetStockList?validatekey=' + this.validateKey;
        xmlHttpPost(slUrl, new FormData(), response => {
            this.onStockListResponse(response);
        });
    }

    onAssetsResponse(response) {
        var assets = JSON.parse(response);
        if (assets.Status != 0 || assets.Message) {
            emjyBack.log(response);
        }
        if (typeof(this.assetsCallback) == 'function') {
            this.assetsCallback(assets.Data);
        }
    }

    onStockListResponse(response) {
        var assets = JSON.parse(response);
        if (assets.Status != 0 || assets.Message) {
            emjyBack.log(response);
        }
        if (typeof(this.positionCallback) == 'function') {
            this.positionCallback(assets.Data);
        }
    }
}

class Account {
    constructor() {
        this.keyword = null;
        this.stocks = [];
        this.wallet = null;
        this.buyPath = null;
        this.sellPath = null;
    }
}

class NormalAccount extends Account {
    constructor() {
        super();
        this.keyword = 'normal';
        this.buyPath = '/Trade/Buy';
        this.sellPath = '/Trade/Sale';
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
        emjyBack.scheduleNewTabCommand(new BondRepurchaseCommander('204001'), true);
        setTimeout(() => {
            emjyBack.scheduleNewTabCommand(new BondRepurchaseCommander('131810', true));
        }, 8000);
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

    loadDeals() {
        var dealclt = new DealsClient(emjyBack.validateKey, (deals) => {
            this.handleDeals(deals);
        });
        dealclt.GetNext();
    }

    handleDeals(deals) {
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (deali.Mmsm.includes('卖出')) {
                // Not implemented!
                // console.log(deali.Mmsm, deali.Zqdm);
            } else if (deali.Mmsm.includes('买入')) {
                this.stocks.forEach(s => {
                    if (s.code == deali.Zqdm) {
                        s.strategies.clearTodayBuyDetail();
                        s.strategies.updateBuyDetail(s.strategies.getTodayDate(), deali.Cjjg, deali.Cjsl);
                    }
                });
            }
        }
    }

    loadAssets() {
        var astClient = new AssetsClient(emjyBack.validateKey, assets => {
            this.onAssetsLoaded(assets);
        }, positions => {
            this.onPositionsLoaded(positions);
        });
        astClient.GetAssets();
    }

    onAssetsLoaded(assets) {
        this.pureAssets = parseFloat(assets.Zzc);
        this.availableMoney = parseFloat(assets.Kyzj);
    }

    parsePosition(position) {
        var code = position.Zqdm;
        var name = position.Zqmc;
        var holdCount = parseInt(position.Zqsl);
        var availableCount = parseInt(position.Kysl);
        var holdCost = position.Cbjg;
        var latestPrice = position.Zxjg;
        return {code, name, holdCount, holdCost, availableCount, latestPrice};
    }

    onPositionsLoaded(positions) {
        for (var i = 0; i < positions.length; i++) {
            if (this.wallet && positions[i].Zqdm == this.wallet.fundcode) {
                this.wallet.name = positions[i].Zqmc;
                this.wallet.holdCount = positions[i].Zqsl;
                continue;
            };
            var stocki = this.parsePosition(positions[i]);
            var stockInfo = this.stocks.find(function(s) {return s.code == stocki.code});
            if (stockInfo) {
                stockInfo.code = stocki.code;
                stockInfo.name = stocki.name;
                stockInfo.holdCount = stocki.holdCount;
                stockInfo.availableCount = stocki.availableCount;
                stockInfo.holdCost = stocki.holdCost;
                stockInfo.latestPrice = stocki.latestPrice;
            } else {
                var market = '';
                if (emjyBack.stockMarket[stocki.code]) {
                    market = emjyBack.getStockMarketHS(stocki.code);
                } else {
                    emjyBack.postQuoteWorkerMessage({command:'quote.query.stock', code: stocki.code});
                }
                stocki.market = market;
                this.stocks.push(new StockInfo(stocki));
            }
        }
        this.loadStrategies();
    }
}

class CreditAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'credit';
        this.buyPath = '/MarginTrade/MarginBuy';
        this.sellPath = '/MarginTrade/FinanceSale';
    }

    onAssetsLoaded(assets) {
        this.pureAssets = 0;
        this.availableMoney = parseFloat(assets.Bzjkys);
    }
}

class CollateralAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'collat';
        this.buyPath = '/MarginTrade/Buy';
        this.sellPath = '/MarginTrade/Sale';
    }

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled() && s.buyStrategy.inCritical();
        });

        if (!anyCritial) {
            emjyBack.scheduleNewTabCommand(new TradeCommander(this.buyPath, this.wallet.fundcode, '', 1, 0));
        };
    }

    loadDeals() {
        var dealclt = new MarginDealsClient(emjyBack.validateKey, (deals) => {
            this.handleDeals(deals);
        });
        dealclt.GetNext();
    }

    loadAssets(cb) {
        this.assetsCallback = cb;
        var astClient = new MarginAssetsClient(emjyBack.validateKey, assets => {
            this.onAssetsLoaded(assets);
        }, positions => {
            this.onPositionsLoaded(positions);
        });
        astClient.GetAssets();
    }

    onAssetsLoaded(assets) {
        this.pureAssets = assets.Zzc - assets.Zfz;
        this.availableMoney = parseFloat(assets.Zjkys);
        if (typeof(this.assetsCallback) == 'function') {
            this.assetsCallback(assets);
        }
    }

    parsePosition(position) {
        var code = position.Zqdm;
        var name = position.Zqmc;
        var holdCount = parseInt(position.Zqsl);
        var availableCount = parseInt(position.Gfky);
        var holdCost = position.Cbjg;
        var latestPrice = position.Zxjg;
        return {code, name, holdCount, holdCost, availableCount, latestPrice};
    }
}

