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

    getFormData() {
        var fd = new FormData();
        fd.append('qqhs', this.qqhs);
        fd.append('dwc', this.dwc);
        return fd;
    }

    GetNext() {
        var fd = this.getFormData();
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
        if (deals.Data.length > 0) {
            var dend = deals.Data[deals.Data.length - 1];
            if (dend.Dwc) {
                this.dwc = dend.Dwc;
            }
        }
        if (!this.data || this.data.length == 0) {
            this.data = deals.Data;
        } else {
            this.data.push.apply(this.data, deals.Data);
        }
        if (this.dwc && deals.Data.length == this.qqhs) {
            this.GetNext();
        } else if (typeof(this.dealsCallback) == 'function') {
            this.dealsCallback(this.data);
            if (typeof(this.onNextPeriod) == 'function' && this.data.length > 0) {
                this.data = [];
                this.onNextPeriod();
            }
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

class HistDealsClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    dateToString(dt, sep = '-') {
        return dt.getFullYear() + sep + ('' + (dt.getMonth() + 1)).padStart(2, '0') + sep + ('' + dt.getDate()).padStart(2, '0');
    }

    setStartDate(startDate) {
        this.startDate = startDate;
        this.endTime = new Date();
        this.setStartTime();
    }

    onNextPeriod() {
        this.endTime = new Date(this.startTime);
        this.endTime.setDate(this.startTime.getDate() - 1);
        this.setStartTime();
        if (this.startDate && this.endTime < this.startDate) {
            if (typeof(this.dealsCallback) == 'function') {
                this.dealsCallback(null);
            }
            return;
        }
        this.GetNext();
    }

    setStartTime() {
        if (!this.startDate || this.endTime - this.startDate > 90 * 86400000) {
            this.startTime = new Date(this.endTime);
            this.startTime.setDate(this.endTime.getDate() - 90);
        } else {
            this.startTime = this.startDate;
        }
    }

    getFormData() {
        var fd = super.getFormData();
        fd.append('st', this.dateToString(this.startTime));
        fd.append('et', this.dateToString(this.endTime));
        return fd;
    }

    getUrl() {
        return 'https://jywg.18.cn/Search/GetHisDealData?validatekey=' + this.validateKey;
    }
}

class MarginHistDealsClient extends HistDealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return 'https://jywg.18.cn/MarginSearch/GetHisDealData?validatekey=' + this.validateKey;
    }
}

class OrdersClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return 'https://jywg.18.cn/Search/GetOrdersData?validatekey=' + this.validateKey;
    }
}

class MarginOrdersClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return 'https://jywg.18.cn/MarginSearch/GetOrdersData?validatekey=' + this.validateKey;
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

class TradeClient {
    constructor(validateKey) {
        this.validateKey = validateKey;
    }

    getUrl() {
        return 'https://jywg.18.cn/Trade/SubmitTradeV2?validatekey=' + this.validateKey;
    }

    getBasicFormData(code, price, count, tradeType) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('amount', count);
        fd.append('tradeType', tradeType);
        var market = stock.mkt == '0' ? 'SA' : 'HA';
        fd.append('market', market);
        return fd;
    }

    getFormData(code, price, count, tradeType) {
        var fd = this.getBasicFormData(code, price, count, tradeType);
        fd.append('zqmc', emjyBack.stockMarket[code].name);
        return fd;
    }

    getRtPrice(code, cb) {
        var cbprefix = 'jSnapshotBack';
        var url = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=' + code + '&callback=' + cbprefix + '&_=' + Date.now();
        var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
        httpRequest.open('GET', url, true);//第二步：打开连接
        httpRequest.send();//第三步：发送请求
        /**
         * 获取数据后的处理程序
         */
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                if (typeof(cb) === 'function') {
                    console.log(httpRequest.responseText);
                    var resobj = JSON.parse(httpRequest.responseText.substring(cbprefix.length + 1, httpRequest.responseText.length - 2));
                    var bp = resobj.bottomprice;
                    var tp = resobj.topprice;
                    var cp = resobj.realtimequote.currentPrice;
                    var s5 = resobj.fivequote.sale5;
                    var b5 = resobj.fivequote.buy5;
                    cb({bp, tp, cp, s5, b5});
                } else {
                    eval(httpRequest.responseText);
                }
            }
        };
    }

    countUrl() {
        return 'https://jywg.18.cn/Trade/GetAllNeedTradeInfo?validatekey=' + this.validateKey;
    }

    countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        var market = stock.mkt == '0' ? 'SA' : 'HA';
        fd.append('market', market);
        fd.append('stockName', stock.name);
        fd.append('gddm', '');
        return fd;
    }

    getCount(code, price, tradeType, jylx, cb) {
        var url = this.countUrl();
        var fd = this.countFormData(code, price, tradeType, jylx);
        xmlHttpPost(url, fd, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log(code, tradeType, 'trade getCount error');
                emjyBack.log(response);
                return;
            }
            if (robj.Data && robj.Data.Kmml > 0) {
                if (typeof(cb) === 'function') {
                    cb({availableCount: robj.Data.Kmml});
                    return;
                }
            } else {
                emjyBack.log(code, tradeType, 'trade error:', 'getCount unresolved response:');
            }
            emjyBack.log(response);
        });
    }

    doTrade(code, price, count, tradeType, jylx, cb) {
        emjyBack.log('doTrade', tradeType, code, price, count, jylx);
        xmlHttpPost(this.getUrl(), this.getFormData(code, price, count, tradeType, jylx), response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log(code, tradeType, response);
                return;
            }
            if (robj.Data && robj.Data.length > 0) {
                emjyBack.log(code, tradeType, 'Trade success! wtbh', robj.Data[0].Wtbh);
                if (typeof(cb) === 'function') {
                    cb({code, price, count, sid: robj.Data[0].Wtbh});
                }
            }
            console.log(code, tradeType, robj);
        });
    }

    tradeValidPrice(code, price, count, tradeType, jylx, cb) {
        if (count < 100) {
            if (count < 1 || count > 10) {
                emjyBack.log(code, tradeType, 'unknwn count', count);
                return;
            }
            this.getCount(code, price, tradeType, jylx, cobj => {
                var finalCount = cobj.availableCount;
                if (count > 1) {
                    finalCount = 100 * ((cobj.availableCount / 100) / count).toFixed();
                }
                this.doTrade(code, price, finalCount, tradeType, jylx, cb);
            });
        } else {
            this.doTrade(code, price, count, tradeType, jylx, cb);
        }
    }

    trade(code, price, count, tradeType, jylx, cb) {
        emjyBack.log('trade', tradeType, code, price, count, jylx);
        if (price == 0) {
            this.getRtPrice(code, pobj => {
                var p = pobj.cp;
                if (tradeType == 'B') {
                    p = pobj.s5 == '-' ? pobj.tp : pobj.s5;
                } else if (tradeType == 'S') {
                    p = pobj.b5 == '-' ? pobj.bp : pobj.b5;
                }
                this.tradeValidPrice(code, p, count, tradeType, jylx, cb);
            });
        } else {
            this.tradeValidPrice(code, price, count, tradeType, jylx, cb);
        }
    }

    // stockCode	"002084"
    // price	"5.67"
    // amount	"900"
    // tradeType	"S"
    // zqmc	"海鸥住工"
    // gddm	""
    // market	"SA"
    sell(code, price, count) {
        this.trade(code, price, count, 'S', null);
    }

    // stockCode	"605033"
    // price	"15.71"
    // amount	"100"
    // tradeType	"B"
    // zqmc	"美邦股份"
    // market	"HA"
    buy(code, price, count, cb) {
        this.trade(code, price, count, 'B', null, cb);
    }
}

class CollatTradeClient extends TradeClient {
    constructor(validateKey) {
        super(validateKey);
    }

    getUrl() {
        return 'https://jywg.18.cn/MarginTrade/SubmitTradeV2?validatekey=' + this.validateKey;
    }

    getFormData(code, price, count, tradeType, jylx) {
        var fd = super.getBasicFormData(code, price, count, tradeType);
        fd.append('stockName', emjyBack.stockMarket[code].name);
        fd.append('xyjylx', jylx); // 信用交易类型
        return fd;
    }

    countUrl() {
        return 'https://jywg.18.cn/MarginTrade/GetKyzjAndKml?validatekey=' + this.validateKey;
    }

    countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        fd.append('xyjylx', jylx); // 信用交易类型
        fd.append('moneyType', 'RMB');
        fd.append('stockName', stock.name);
        var market = stock.mkt == '0' ? 'SA' : 'HA';
        fd.append('market', market);
        return fd;
    }

    // stockCode   "601456"
    // stockName   "国联证券"
    // price   "13.87"
    // amount  "100"
    // tradeType   "S"
    // xyjylx  "7"
    // market  "HA"
    sell(code, price, count) {
        this.trade(code, price, count, 'S', '7');
    }

    // stockCode	"000531"
    // stockName	"穗恒运Ａ"
    // price	"10.20"
    // amount	"100"
    // tradeType	"B"
    // xyjylx	"6"
    // market	"SA"
    buy(code, price, count, cb) {
        this.trade(code, price, count, 'B', '6', cb);
    }
}

class CreditTradeClient extends CollatTradeClient {
    constructor(validateKey) {
        super(validateKey);
    }

    // stockCode	"601016"
    // stockName	"节能风电"
    // price	"5.91"
    // amount	"1000"
    // tradeType	"B"
    // xyjylx	"a"
    // market	"HA"
    buy(code, price, count, cb) {
        if (count < 100) {
            emjyBack.log('trade error:', 'must set correct buy count for credit buy');
            return;
        }
        this.trade(code, price, count, 'B', 'a', cb);
    }

    sell(code, price, count) {
        console.log('trade error:', 'NOT IMPLEMENTED!');
        // this.trade(code, price, count, 'B', '6');
    }
}

class TestTradeClient extends TradeClient {
    constructor() {
        super('');
    }

    trade(code, price, count, tradeType, jylx, cb) {
        console.log('test trade', tradeType, code, price, count, jylx);
        if (price == 0 || count < 100) {
            console.log('please set correct price and count for test trade!');
            return;
        } else {
            emjyBack.trackAccount.addDeal(code, price, count, tradeType);
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
        this.tradeClient = null;
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
            var strStorageKey = this.keyword + '_' + s.code + '_strategies';
            chrome.storage.local.get(strStorageKey, item => {
                if (item && item[strStorageKey]) {
                    this.applyStrategy(s.code, JSON.parse(item[strStorageKey]));
                };
            });
        });
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

    updateStockRtKline(code, updatedKlt) {
        if (!this.stocks) {
            return;
        };

        var stock = this.stocks.find((s) => { return s.code == code});
        if (stock) {
            stock.updateRtKline(updatedKlt);
        };
    }

    createTradeClient() {
        this.tradeClient = new TradeClient(emjyBack.validateKey);
    }

    buyStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        if (count < 100) {
            this.tradeClient.buy(code, price, count, cb);
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
        this.tradeClient.buy(code, price, finalCount, cb);
        this.availableMoney -= moneyNeed;
    }

    sellStock(code, price, count) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

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

            this.tradeClient.sell(code, price, finalCount);
            stockInfo.availableCount -= finalCount;
            this.availableMoney += finalCount * price;
        } else if (code == this.wallet.fundcode) {
            this.tradeClient.sell(code, price, finalCount);
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

    addWatchStock(code, str) {
        emjyBack.loadKlines(code);
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
        var stock = new StockInfo({ code, name, holdCount: 0, availableCount: 0, market});

        if (str) {
            var strategyGroup = strategyGroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
            strategyGroup.applyGuardLevel();
            stock.strategies = strategyGroup;
        }
        this.stocks.push(stock);
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

    buyBondRepurchase() {
        if (!this.bondRepurchaseList || this.bondRepurchaseList.length == 0) {
            return;
        }
        var code = this.bondRepurchaseList.shift();
        this.tradeClient.getRtPrice(code, pobj => {
            var p = pobj.cp;
            p = pobj.s5 == '-' ? pobj.tp : pobj.s5;
            this.brClient.buy(code, p);
        });
    }

    buyFundBeforeClose() {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        this.bondRepurchaseList = ['204001', '131810'];
        this.brClient = new BondRepurchaseClient(emjyBack.validateKey, () => {
            this.buyBondRepurchase();
        });
        this.buyBondRepurchase();
    }

    checkAvailableMoney(price) {
        var count = 100 * Math.ceil(400 / price);
        var moneyNeed = count * price;
        if (moneyNeed > this.availableMoney && this.wallet.holdCount > 0) {
            this.sellStock(this.wallet.fundcode, 0, 1);
        };
    }

    fillupGuardPrices() {
        this.stocks.forEach(stock => {
            if (emjyBack[stock.code].klines && stock.strategies) {
                stock.strategies.applyKlines(emjyBack[stock.code].klines.klines);
            }
        });
    }

    loadDeals() {
        var dealclt = new OrdersClient(emjyBack.validateKey, (deals) => {
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
                        s.strategies.updateBuyDetail(deali.Wtbh, deali.Cjjg, deali.Cjsl);
                    }
                });
            }
        }
    }

    loadHistDeals(startDate, cb) {
        var dealclt = new HistDealsClient(emjyBack.validateKey, (deals) => {
            if (!this.fecthedDeals || this.fecthedDeals.length == 0) {
                this.fecthedDeals = deals;
            } else {
                this.fecthedDeals.push.apply(this.fecthedDeals, deals);
            }
            if (typeof(cb) == 'function' && (!deals || deals.length == 0) && this.fecthedDeals && this.fecthedDeals.length > 0) {
                cb(this.fecthedDeals);
                this.fecthedDeals = [];
            }
        });
        dealclt.setStartDate(startDate);
        dealclt.GetNext();
    }

    loadAssets() {
        if (!emjyBack.validateKey) {
            console.log('no validateKey');
            return;
        }
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
        if (!positions) {
            emjyBack.log('onPositionsLoaded positions is null.');
            return;
        }

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

    createTradeClient() {
        this.tradeClient = new CreditTradeClient(emjyBack.validateKey);
    }

    onAssetsLoaded(assets) {
        this.pureAssets = 0;
        this.availableMoney = parseFloat(assets.Bzjkys);
    }

    buyFundBeforeClose() {

    }

    loadDeals() {

    }

    loadHistDeals() {

    }

    loadAssets() {

    }
}

class CollateralAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'collat';
        this.buyPath = '/MarginTrade/Buy';
        this.sellPath = '/MarginTrade/Sale';
    }

    createTradeClient() {
        this.tradeClient = new CollatTradeClient(emjyBack.validateKey);
    }

    buyFundBeforeClose() {
        var rpclt = new RepaymentClient(emjyBack.validateKey, () => {
            this.buyStock(this.wallet.fundcode, 0, 1);
        });
        rpclt.go();
    }

    loadDeals() {
        var dealclt = new MarginOrdersClient(emjyBack.validateKey, (deals) => {
            this.handleDeals(deals);
        });
        dealclt.GetNext();
    }

    loadHistDeals(startDate, cb) {
        var dealclt = new MarginHistDealsClient(emjyBack.validateKey, (deals) => {
            if (!this.fecthedDeals || this.fecthedDeals.length == 0) {
                this.fecthedDeals = deals;
            } else {
                this.fecthedDeals.push.apply(this.fecthedDeals, deals);
            }
            if (typeof(cb) == 'function' && (!deals || deals.length == 0) && this.fecthedDeals && this.fecthedDeals.length > 0) {
                cb(this.fecthedDeals);
                this.fecthedDeals = [];
            }
        });
        dealclt.setStartDate(startDate);
        dealclt.GetNext();
    }

    loadAssets(cb) {
        if (!emjyBack.validateKey) {
            console.log('no validateKey');
            return;
        }
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
