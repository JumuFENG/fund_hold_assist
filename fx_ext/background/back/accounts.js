'use strict';
let BondRepurchasePath = '/BondRepurchase/SecuritiesLendingRepurchase';
let jywgroot = 'https://jywg.eastmoneysec.com/'; //'https://jywg.18.cn/';
class Wallet {
    constructor() {
        this.fundcode = '511880';
        this.name = '';
        this.state = 'none';
        this.holdCount = 0;
    }
}

class DealsClient {
    // 普通账户 当日成交
    constructor(validateKey, cb) {
        this.validateKey = validateKey;
        this.qqhs = 20; // 请求行数
        this.dwc = '';
        this.dealsCallback = cb;
    }

    getUrl() {
        return jywgroot + 'Search/GetDealData?validatekey=' + this.validateKey;
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
        xmlHttpPost(this.getUrl(), fd, null, response => {
            this.onResponse(response);
        });
    }

    updateDwc() {
        this.dwc = '';
    }

    onResponse(response) {
        try {
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
                    this.dwc = "";
                    this.onNextPeriod();
                }
            }
        } catch (e) {
            emjyBack.log(response);
            emjyBack.log(e);
        }
    }
}

class MarginDealsClient extends DealsClient {
    // 信用账户 当日成交
    constructor(validateKey, cb) {
        super(validateKey, cb);
        this.dwc = 1;
    }

    getUrl() {
        return jywgroot + 'MarginSearch/GetDealData?validatekey=' + this.validateKey;
    }

    updateDwc() {
        this.dwc++;
    }
}

class HistDealsClient extends DealsClient {
    // 普通账户 历史成交
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    dateToString(dt, sep = '-') {
        var dstr = new Date(dt - dt.getTimezoneOffset()*60*1000).toISOString().split('T')[0];
        if (sep === '-') {
            return dstr;
        }
        return dstr.split('-').join(sep);
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
        return jywgroot + 'Search/GetHisDealData?validatekey=' + this.validateKey;
    }
}

class MarginHistDealsClient extends HistDealsClient {
    // 信用账户 历史成交
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getFormData() {
        var fd = super.getFormData();
        if (fd.has('st')) {
            fd.delete('st');
        }
        fd.append('st', this.dateToString(this.startTime, ''));
        if (fd.has('et')) {
            fd.delete('et');
        }
        fd.append('et', this.dateToString(this.endTime, ''));
        return fd;
    }

    getUrl() {
        return jywgroot + 'MarginSearch/queryCreditHisMatchV2?validatekey=' + this.validateKey;
    }
}

class OrdersClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return jywgroot + 'Search/GetOrdersData?validatekey=' + this.validateKey;
    }
}

class MarginOrdersClient extends DealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return jywgroot + 'MarginSearch/GetOrdersData?validatekey=' + this.validateKey;
    }
}

class SxlHistClient extends HistDealsClient {
    // Stock Exchange List
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return jywgroot + 'Search/GetFundsFlow?validatekey=' + this.validateKey;
    }
}

class MarginSxlHistClient extends HistDealsClient {
    constructor(validateKey, cb) {
        super(validateKey, cb);
    }

    getUrl() {
        return jywgroot + 'MarginSearch/GetWaterBill?validatekey=' + this.validateKey;
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
        // update assets and positions
        this.queryAssetAndPosition(this.assetsCallback, this.positionCallback);
    }

    UpdateAssets() {
        // update assets
        this.queryAssetAndPosition(this.assetsCallback);
    }

    UpdatePosition() {
        // update positions
        this.queryAssetAndPosition(null, this.positionCallback);
    }

    queryAssetAndPosition(acb, pcb) {
        var url = jywgroot + 'Com/queryAssetAndPositionV1?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('moneyType', this.moneyType);
        xmlHttpPost(url, fd, null, response => {
            this.onResponse(response, acb, pcb);
        });
    }

    onResponse(response, acb, pcb) {
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
        if (typeof(acb) == 'function') {
            acb(assetsInfo);
        }
        if (typeof(pcb) == 'function') {
            pcb(data.positions);
        }
    }
}

class MarginAssetsClient extends AssetsClient {
    constructor(validateKey, cb, pcb) {
        super(validateKey, cb, pcb);
    }

    GetAssets() {
        // update assets and positions
        this.UpdateAssets();
        this.UpdatePosition();
    }

    UpdateAssets() {
        // update assets
        var url = jywgroot + 'MarginSearch/GetRzrqAssets?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('hblx', this.moneyType);
        xmlHttpPost(url, fd, null, response => {
            this.onAssetsResponse(response);
        });
    }

    UpdatePosition() {
        // update positions
        var slUrl = jywgroot + 'MarginSearch/GetStockList?validatekey=' + this.validateKey;
        xmlHttpPost(slUrl, new FormData(), null, response => {
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
    constructor(validateKey, amoney=0) {
        this.validateKey = validateKey;
        this.availableMoney = amoney;
    }

    getUrl() {
        return jywgroot + 'Trade/SubmitTradeV2?validatekey=' + this.validateKey;
    }

    getBasicFormData(code, price, count, tradeType) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('amount', count);
        if (stock.mkt == '4') {
            tradeType = '0' + tradeType;
        }
        fd.append('tradeType', tradeType);
        var market = stock.mkt == '0' ? 'SA' : (stock.mkt == '4' ? 'B' : 'HA');
        fd.append('market', market);
        return fd;
    }

    getFormData(code, price, count, tradeType) {
        var fd = this.getBasicFormData(code, price, count, tradeType);
        fd.append('zqmc', emjyBack.stockMarket[code].n);
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
                    var resobj = JSON.parse(httpRequest.responseText.substring(cbprefix.length + 1, httpRequest.responseText.length - 2));
                    if (resobj) {
                        var bp = resobj.bottomprice;
                        var tp = resobj.topprice;
                        var cp = resobj.realtimequote.currentPrice;
                        var s5 = resobj.fivequote.sale5;
                        var b5 = resobj.fivequote.buy5;
                        cb({bp, tp, cp, s5, b5});
                    } else {
                        cb();
                    }
                } else {
                    emjyBack.log('getRtPrice no callback cb set!', httpRequest.responseText);
                }
            }
        };
    }

    countUrl() {
        return jywgroot + 'Trade/GetAllNeedTradeInfo?validatekey=' + this.validateKey;
    }

    countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        var market = stock.mkt == '0' ? 'SA' : 'HA';
        fd.append('market', market);
        fd.append('stockName', stock.n);
        fd.append('gddm', '');
        return fd;
    }

    getCount(code, price, tradeType, jylx, cb) {
        var url = this.countUrl();
        var fd = this.countFormData(code, price, tradeType, jylx);
        xmlHttpPost(url, fd, null, response => {
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
        if (tradeType == 'B' && this.availableMoney - price * count < 0) {
            emjyBack.log('doTrade no enough money', code, price * count, this.availableMoney, price, count);
            return;
        }
        emjyBack.log('doTrade', tradeType, code, price, count, jylx);
        xmlHttpPost(this.getUrl(), this.getFormData(code, price, count, tradeType, jylx), null, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log(code, tradeType, response);
                return;
            }
            if (robj.Data && robj.Data.length > 0) {
                emjyBack.log(code, tradeType, 'Trade success! wtbh', robj.Data[0].Wtbh);
                this.availableMoney -= tradeType == 'B' ? price * count : -(price * count);
                if (typeof(cb) === 'function') {
                    cb({code, price, count, sid: robj.Data[0].Wtbh, type: tradeType});
                }
            }
            emjyBack.log(code, tradeType, JSON.stringify(robj));
        });
    }

    tradeValidPrice(code, price, count, tradeType, jylx, cb) {
        if (count < 10) {
            if (count < 1) {
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
        if (tradeType == 'B' && this.availableMoney < 1000) {
            emjyBack.log('trade no enough money.', tradeType, code, price, count, jylx);
            return;
        }
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
    sell(code, price, count, cb) {
        this.trade(code, price, count, 'S', null, cb);
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
    constructor(validateKey, amoney) {
        super(validateKey, amoney);
        this.buy_jylx = '6';
        this.sell_jylx = '7';
    }

    getUrl() {
        return jywgroot + 'MarginTrade/SubmitTradeV2?validatekey=' + this.validateKey;
    }

    getFormData(code, price, count, tradeType, jylx) {
        var fd = super.getBasicFormData(code, price, count, tradeType);
        fd.append('stockName', emjyBack.stockMarket[code].n);
        fd.append('xyjylx', jylx); // 信用交易类型
        return fd;
    }

    countUrl() {
        return jywgroot + 'MarginTrade/GetKyzjAndKml?validatekey=' + this.validateKey;
    }

    countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        fd.append('xyjylx', jylx); // 信用交易类型
        fd.append('moneyType', 'RMB');
        fd.append('stockName', stock.n);
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
    sell(code, price, count, cb) {
        this.trade(code, price, count, 'S', this.sell_jylx, cb);
    }

    // stockCode	"000531"
    // stockName	"穗恒运Ａ"
    // price	"10.20"
    // amount	"100"
    // tradeType	"B"
    // xyjylx	"6"
    // market	"SA"
    buy(code, price, count, cb) {
        this.trade(code, price, count, 'B', this.buy_jylx, cb);
    }

    checkRzrqTarget(code, cb) {
        this.getRtPrice(code, pobj => {
            var p = pobj.cp;
            var url = this.countUrl();
            var fd = this.countFormData(code, p, 'B', this.buy_jylx);
            xmlHttpPost(url, fd, null, response => {
                var robj = JSON.parse(response);
                if (typeof(cb) === 'function') {
                    cb({Status: robj.Status, Kmml: robj.Data.Kmml, Message: robj.Message, code});
                }
            });
        });
    }
}

class CreditTradeClient extends CollatTradeClient {
    constructor(validateKey, amoney) {
        super(validateKey, amoney);
        this.buy_jylx = 'a';
        this.sell_jylx = 'A';
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

    // stockCode	"510300"
    // stockName	"沪深300ETF"
    // price	"3.909"
    // amount	"3000"
    // tradeType	"S"
    // xyjylx	"A"
    // market	"HA"
    sell(code, price, count, cb) {
        this.trade(code, price, count, 'S', 'A', cb);
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
        this.assetsClient = null;
    }

    getStock(code) {
        return this.stocks.find(s => s.code == code);
    }
}

class NormalAccount extends Account {
    constructor() {
        super();
        this.keyword = 'normal';
        this.buyPath = '/Trade/Buy';
        this.sellPath = '/Trade/Sale';
        this.wallet = new Wallet();
        this.availableMoney = 0;
    }

    loadWatchings() {
        var watchingStorageKey = this.keyword + '_watchings';
        emjyBack.getFromLocal(watchingStorageKey, watchings => {
            emjyBack.log('get watching_stocks', JSON.stringify(watchings));
            if (watchings) {
                watchings.forEach(s => {
                    this.addWatchStock(s);
                });
            };
        });
    }

    fixWatchings() {
        emjyBack.getFromLocal(null, items => {
            for (var k in items) {
                if (k == 'undefined') {
                    emjyBack.removeLocal(k);
                    continue;
                }
                if (k.startsWith(this.keyword)) {
                    var keys = k.split('_');
                    if (keys.length == 3 && keys[2] == 'strategies') {
                        this.addWatchStock(keys[1]);
                        this.applyStrategy(keys[1], JSON.parse(items[k]));
                    }
                    emjyBack.log('fix', keys[1]);
                }
            }
        });
    }

    loadStrategies() {
        this.stocks.forEach(s => {
            var strStorageKey = this.keyword + '_' + s.code + '_strategies';
            emjyBack.getFromLocal(strStorageKey, str => {
                if (str) {
                    this.applyStrategy(s.code, JSON.parse(str));
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
                strategies: this.stocks[i].strategies ? this.stocks[i].strategies.tostring() : null
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
        this.tradeClient = new TradeClient(emjyBack.validateKey, this.availableMoney);
    }

    buyStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        this.tradeClient.buy(code, price, count, bd => {
            if (typeof(cb) === 'function') {
                cb(bd);
            }
            if (bd) {
                this.updateAssets();
            }
        });
    }

    sellStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        this.tradeClient.sell(code, price, count, sd => {
            if (typeof(cb) === 'function') {
                cb(sd);
            }
            if (sd) {
                this.updateAssets();
            }
        });
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
        strategyGroup.setHoldCount(stock.holdCount, stock.availableCount, stock.holdCost);
        strategyGroup.applyGuardLevel();
        stock.strategies = strategyGroup;
        emjyBack.sendWebsocketMessage({action:'addwatch', account: this.keyword, code, strategy: str});
    }

    removeStrategy(code, stype) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };

        stock.strategies = null;
        emjyBack.removeLocal(this.keyword + '_' + code + '_strategies');
    }

    addStockStrategy(stock, strgrp) {
        if (strgrp) {
            var strategyGroup = strategyGroupManager.create(strgrp, this.keyword, stock.code, this.keyword + '_' + stock.code + '_strategies');
            strategyGroup.applyGuardLevel();
            stock.strategies = strategyGroup;
        }
    }

    addWatchStock(code, strgrp) {
        emjyBack.loadKlines(code);
        var stock = this.stocks.find(s => {return s.code == code;});

        if (stock) {
            if (stock.holdCount > 0) {
                emjyBack.log(code, this.keyword, 'already exists and holdCount = ', stock.holdCount);
            } else {
                this.addStockStrategy(stock, strgrp);
            }
            return;
        };

        var name = '';
        var market = '';
        if (emjyBack.stockMarket[code]) {
            name = emjyBack.stockMarket[code].n;
            market = emjyBack.getStockMarketHS(code);
        } else {
            emjyBack.postQuoteWorkerMessage({command:'quote.query.stock', code});
        }

        var stock = new StockInfo({ code, name, holdCount: 0, availableCount: 0, market});
        this.addStockStrategy(stock, strgrp);
        this.stocks.push(stock);
    }

    removeStock(code) {
        var stock = this.stocks.find(s => {return s.code == code;});
        if (stock && stock.strategies) {
            stock.strategies.archiveBuyDetail();
        }
        emjyBack.removeLocal(this.keyword + '_' + code + '_strategies');
        this.stocks = this.stocks.filter(s => s.code !== code);
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = this.stocks.filter(s => s.strategies).map(s => s.code);
        emjyBack.saveToLocal(watchingStocks);
    }

    save() {
        this.stocks.forEach(s => {
            if (s.strategies) {
                s.strategies.save();
            };
        });
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = this.stocks.filter(s => s.strategies).map(s => s.code);
        emjyBack.saveToLocal(watchingStocks);
    }

    exportConfig() {
        var configs = {};
        this.stocks.forEach(s => {
            if (s.strategies) {
                configs[s.strategies.storeKey] = s.strategies.tostring();
            };
        });
        configs[this.keyword + '_watchings'] = this.stocks.filter(s => s.strategies).map(s => s.code);
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
            p = pobj.b5 == '-' ? pobj.bp : pobj.b5;
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

    sellWalletFund() {
        this.sellStock(this.wallet.fundcode, 0, 1);
    }

    fillupGuardPrices() {
        this.stocks.forEach(stock => {
            if (emjyBack.klines[stock.code] && stock.strategies) {
                stock.strategies.applyKlines(emjyBack.klines[stock.code].klines);
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
        emjyBack.uploadTodayDeals(deals);
        var tradedCode = new Set();
        var bdeals = deals.filter(d => d.Mmsm.includes('买入'));
        for (let i = 0; i < bdeals.length; i++) {
            const deali = bdeals[i];
            this.stocks.forEach(s => {
                if (s.code == deali.Zqdm && deali.Cjsl > 0) {
                    tradedCode.add(deali.Zqdm);
                    if (!s.strategies) {
                        console.log('can not find strategy for stock', s.code, deali);
                        return;
                    }
                    s.strategies.updateBuyDetail(deali.Wtbh, deali.Cjjg, deali.Cjsl);
                }
            });
        }

        var sdeails = deals.filter(d => d.Mmsm.includes('卖出'));
        for (let i = 0; i < sdeails.length; i++) {
            const deali = sdeails[i];
            this.stocks.forEach(s => {
                if (s.code == deali.Zqdm && deali.Cjsl > 0) {
                    tradedCode.add(deali.Zqdm);
                    if (!s.strategies) {
                        console.log('can not find strategy for stock', s.code, deali);
                        return;
                    }
                    s.strategies.updateSellDetail(deali.Wtbh, deali.Cjjg, deali.Cjsl);
                }
            });
        }

        tradedCode.forEach(c => {
            this.stocks.forEach(s => {
                if (s.code == c) {
                    if (s.strategies) {
                        s.strategies.archiveBuyDetail();
                        s.strategies.save();
                    }
                }
            });
        });
    }

    loadHistDeals(startDate, cb) {
        var dealclt = new HistDealsClient(emjyBack.validateKey, (deals) => {
            if (!this.fecthedDeals || this.fecthedDeals.length == 0) {
                this.fecthedDeals = deals;
            } else {
                this.fecthedDeals.push.apply(this.fecthedDeals, deals);
            }
            if (typeof(cb) === 'function' && (!deals || deals.length == 0) && this.fecthedDeals && this.fecthedDeals.length > 0) {
                cb(this.fecthedDeals);
                this.fecthedDeals = [];
            }
        });
        dealclt.setStartDate(startDate);
        dealclt.GetNext();
    }

    loadOtherDeals(startDate, cb) {
        var sxlclt = new SxlHistClient(emjyBack.validateKey, deals => {
            if (!this.otherDeals || this.otherDeals.length == 0) {
                this.otherDeals = deals;
            } else {
                this.otherDeals.push.apply(this.otherDeals, deals);
            }
            if (typeof(cb) === 'function' && (!deals || deals.length == 0) && this.otherDeals && this.otherDeals.length > 0) {
                cb(this.otherDeals);
                this.otherDeals = [];
            }
        });
        sxlclt.setStartDate(startDate);
        sxlclt.GetNext();
    }

    createAssetsClient() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no validateKey');
            return;
        }
        if (!this.assetsClient) {
            this.assetsClient = new AssetsClient(emjyBack.validateKey, assets => {
                this.onAssetsLoaded(assets);
            }, positions => {
                this.onPositionsLoaded(positions);
            });
        }
        return this.assetsClient;
    }

    loadAssets() {
        if (!this.assetsClient) {
            this.createAssetsClient();
        }
        if (this.assetsClient) {
            this.assetsClient.GetAssets();
        }
    }

    updateAssets() {
        if (!this.assetsClient) {
            this.createAssetsClient();
        }
        if (this.assetsClient) {
            this.assetsClient.UpdateAssets();
        }
    }

    setReleatedAssets(assets) {}

    setOwnAssets(assets) {
        this.pureAssets = parseFloat(assets.Zzc);
        this.availableMoney = parseFloat(assets.Kyzj);
        this.setTcAvailableMoney();
    }

    setTcAvailableMoney() {
        if (!this.tradeClient) {
            this.createTradeClient();
        } else {
            this.tradeClient.availableMoney = this.availableMoney;
        }
    }

    onAssetsLoaded(assets) {
        this.setOwnAssets(assets);
        this.setReleatedAssets(assets);
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


class CollateralAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'collat';
        this.buyPath = '/MarginTrade/Buy';
        this.sellPath = '/MarginTrade/Sale';
    }

    createTradeClient() {
        this.tradeClient = new CollatTradeClient(emjyBack.validateKey, this.availableMoney);
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
            if (typeof(cb) === 'function' && (!deals || deals.length == 0) && this.fecthedDeals && this.fecthedDeals.length > 0) {
                cb(this.fecthedDeals);
                this.fecthedDeals = [];
            }
        });
        dealclt.setStartDate(startDate);
        dealclt.GetNext();
    }

    loadOtherDeals(startDate, cb) {
        var sxlclt = new MarginSxlHistClient(emjyBack.validateKey, deals => {
            if (!this.otherDeals || this.otherDeals.length == 0) {
                this.otherDeals = deals;
            } else {
                this.otherDeals.push.apply(this.otherDeals, deals);
            }
            if (typeof(cb) === 'function' && (!deals  || deals.length == 0) && this.otherDeals && this.otherDeals.length > 0) {
                cb(this.otherDeals);
                this.otherDeals = [];
            }
        });
        sxlclt.setStartDate(startDate);
        sxlclt.GetNext();
    }

    createAssetsClient() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no validateKey');
            return;
        }
        if (!this.assetsClient) {
            this.assetsClient = new MarginAssetsClient(emjyBack.validateKey, assets => {
                this.onAssetsLoaded(assets);
            }, positions => {
                this.onPositionsLoaded(positions);
            });
        }
        return this.assetsClient;
    }

    setReleatedAssets(assets) {
        if (emjyBack.creditAccount) {
            emjyBack.creditAccount.setOwnAssets(assets);
        }
    }

    setOwnAssets(assets) {
        this.pureAssets = assets.Zzc - assets.Zfz;
        this.availableMoney = parseFloat(assets.Zjkys);
        this.setTcAvailableMoney();
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

class CreditAccount extends CollateralAccount {
    constructor() {
        super();
        this.keyword = 'credit';
        this.buyPath = '/MarginTrade/MarginBuy';
        this.sellPath = '/MarginTrade/FinanceSale';
    }

    createTradeClient() {
        this.tradeClient = new CreditTradeClient(emjyBack.validateKey, this.availableMoney);
    }

    setReleatedAssets(assets) {
        if (emjyBack.collateralAccount) {
            emjyBack.collateralAccount.setOwnAssets(assets);
        }
    }

    setOwnAssets(assets) {
        this.pureAssets = 0;
        this.availableMoney = parseFloat(assets.Bzjkys);
        this.setTcAvailableMoney()
    }

    buyFundBeforeClose() { }
    loadDeals() { }
    loadOtherDeals() {}
    loadHistDeals() { }
    loadAssets() {}
    parsePosition() { }
}
