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
    // 普通账户 当日成交
    constructor() {
        this.qqhs = 20; // 请求行数
        this.dwc = '';
        this.data = []; // 用于存储所有获取的数据
    }

    getUrl() {
        return feng.jywg + 'Search/GetDealData?validatekey=' + emjyBack.validateKey;
    }

    getFormData() {
        const fd = new FormData();
        fd.append('qqhs', this.qqhs);
        fd.append('dwc', this.dwc);
        return fd;
    }

    // 使用 fetch 替代 xmlHttpPost
    async fetchData() {
        const url = this.getUrl();
        const fd = this.getFormData();
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: fd
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            emjyBack.log(this.constructor.name, 'error url', this.getUrl());
            emjyBack.log(error);
        }
    }

    // 获取所有分页数据
    async getAllData() {
        let hasMoreData = true;
        while (hasMoreData) {
            const deals = await this.fetchData();
            if (deals.Status !== 0 || deals.Message) {
                emjyBack.log(deals);
                break;
            }
            if (deals.Data.length > 0) {
                this.data.push(...deals.Data);
                const dend = deals.Data[deals.Data.length - 1];
                if (dend.Dwc) {
                    this.dwc = dend.Dwc;
                }
            }
            if (!this.dwc || deals.Data.length < this.qqhs) {
                hasMoreData = false;
            }
        }
        return this.data;
    }

    updateDwc() {
        this.dwc = '';
    }
}


class MarginDealsClient extends DealsClient {
    // 信用账户 当日成交
    constructor() {
        super();
        this.dwc = 1;
    }

    getUrl() {
        return feng.jywg + 'MarginSearch/GetDealData?validatekey=' + emjyBack.validateKey;
    }

    updateDwc() {
        this.dwc++;
    }
}


class HistDealsClient extends DealsClient {
    // 普通账户 历史成交
    // 将日期转换为字符串格式
    dateToString(dt, sep = '-') {
        const dstr = new Date(dt - dt.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0];
        if (sep === '-') {
            return dstr;
        }
        return dstr.split('-').join(sep);
    }

    // 设置起始日期
    setStartDate(startDate) {
        this.startDate = new Date(startDate);
        this.endTime = new Date(); // 默认结束时间为当前时间
    }

    // 获取从某一天开始的所有历史成交数据
    async getAllHistoryData() {
        if (!this.startDate) {
            throw new Error('起始日期未设置');
        }

        this.data = []; // 重置数据
        let currentEndTime = new Date(this.endTime);
        let currentStartTime = new Date(currentEndTime);
        currentStartTime.setDate(currentEndTime.getDate() - 90); // 每次查询最多 90 天

        while (currentStartTime >= this.startDate) {
            // 如果当前查询的起始时间早于设置的起始日期，调整起始时间
            if (currentStartTime < this.startDate) {
                currentStartTime = new Date(this.startDate);
            }

            // 设置查询时间范围
            this.startTime = currentStartTime;
            this.endTime = currentEndTime;

            // 获取数据
            const deals = await super.getAllData();
            if (deals.length === 0) {
                break;
            }

            // 更新查询时间范围
            currentEndTime = new Date(currentStartTime);
            currentEndTime.setDate(currentStartTime.getDate() - 1);
            currentStartTime.setDate(currentStartTime.getDate() - 90);
        }

        return this.data;
    }

    // 重写 getFormData 方法，添加时间范围参数
    getFormData() {
        const fd = super.getFormData();
        fd.append('st', this.dateToString(this.startTime));
        fd.append('et', this.dateToString(this.endTime));
        return fd;
    }

    // 重写 getUrl 方法，使用历史成交数据的接口
    getUrl() {
        return feng.jywg + 'Search/GetHisDealData?validatekey=' + emjyBack.validateKey;
    }
}


class MarginHistDealsClient extends HistDealsClient {
    // 信用账户 历史成交
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
        return feng.jywg + 'MarginSearch/queryCreditHisMatchV2?validatekey=' + emjyBack.validateKey;
    }
}

class OrdersClient extends DealsClient {
    getUrl() {
        return feng.jywg + 'Search/GetOrdersData?validatekey=' + emjyBack.validateKey;
    }
}

class MarginOrdersClient extends DealsClient {
    getUrl() {
        return feng.jywg + 'MarginSearch/GetOrdersData?validatekey=' + emjyBack.validateKey;
    }
}

class SxlHistClient extends HistDealsClient {
    // Stock Exchange List
    getUrl() {
        return feng.jywg + 'Search/GetFundsFlow?validatekey=' + emjyBack.validateKey;
    }
}

class MarginSxlHistClient extends HistDealsClient {
    // 交割单查询
    getFormData() {
        const fd = super.getFormData();
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
        return feng.jywg + 'MarginSearch/queryCreditLogAssetV2?validatekey=' + emjyBack.validateKey;
    }
}


class AssetsClient {
    constructor() {
        this.moneyType = 'RMB'; // 默认货币类型
    }

    // 构造 URL
    buildUrl(endpoint) {
        return `${feng.jywg}${endpoint}?validatekey=${emjyBack.validateKey}`;
    }

    // 通用的 fetch 请求方法
    async fetchData(url, formData = new FormData()) {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    // 处理 API 错误
    handleApiError(response) {
        if (response.Status !== 0 || response.Errcode !== 0) {
            throw new Error(`API error: ${JSON.stringify(response)}`);
        }
    }

    // 获取资产
    async getAssets() {
        const url = this.buildUrl('Com/queryAssetAndPositionV1');
        const fd = new FormData();
        fd.append('moneyType', this.moneyType);

        try {
            const response = await this.fetchData(url, fd);
            this.handleApiError(response);
            return this.extractAssets(response);
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }

    // 获取持仓
    async getPositions() {
        const url = this.buildUrl('Com/queryAssetAndPositionV1');
        const fd = new FormData();
        fd.append('moneyType', this.moneyType);

        try {
            const response = await this.fetchData(url, fd);
            this.handleApiError(response);
            return this.extractPositions(response);
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }

    // 同时获取资产和持仓
    async getAssetsAndPositions() {
        const url = this.buildUrl('Com/queryAssetAndPositionV1');
        const fd = new FormData();
        fd.append('moneyType', this.moneyType);

        try {
            const response = await this.fetchData(url, fd);
            this.handleApiError(response);
            return {
                assets: this.extractAssets(response),
                positions: this.extractPositions(response)
            };
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }

    // 提取资产信息
    extractAssets(response) {
        const assetsInfo = {};
        const data = response.Data[0];
        for (const key in data) {
            if (Object.hasOwnProperty.call(data, key) && key !== 'positions') {
                assetsInfo[key] = data[key];
            }
        }
        return assetsInfo;
    }

    // 提取持仓信息
    extractPositions(response) {
        return response.Data[0].positions || [];
    }
}


class MarginAssetsClient extends AssetsClient {
    constructor() {
        super();
    }

    handleApiError(response) {
        if (response.Status != 0 || response.Message) {
            emjyBack.log(response);
        }
    }

    // 获取融资融券资产
    async getAssets() {
        const url = this.buildUrl('MarginSearch/GetRzrqAssets');
        const fd = new FormData();
        fd.append('hblx', this.moneyType);

        try {
            const response = await this.fetchData(url, fd);
            this.handleApiError(response);
            return response.Data;
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }

    // 获取融资融券持仓
    async getPositions() {
        const url = this.buildUrl('MarginSearch/GetStockList');

        try {
            const response = await this.fetchData(url);
            this.handleApiError(response);
            return response.Data;
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }

    // 同时获取融资融券资产和持仓
    async getAssetsAndPositions() {
        try {
            const assets = await this.getAssets();
            const positions = await this.getPositions();
            return {assets, positions};
        } catch (error) {
            emjyBack.log(error);
            throw error;
        }
    }
}


class TradeClient {
    constructor(amoney = 0) {
        this.availableMoney = amoney;
    }

    getUrl() {
        return feng.jywg + 'Trade/SubmitTradeV2?validatekey=' + emjyBack.validateKey;
    }

    getBasicFormData(code, price, count, tradeType) {
        const fd = new FormData();
        const stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('amount', count);
        if (stock.mkt == '4') {
            tradeType = '0' + tradeType;
        }
        fd.append('tradeType', tradeType);
        const mdic = { 0: 'SA', 1: 'HA', 4: 'B' };
        fd.append('market', mdic[stock.mkt]);
        return fd;
    }

    getFormData(code, price, count, tradeType) {
        const fd = this.getBasicFormData(code, price, count, tradeType);
        fd.append('zqmc', emjyBack.stockMarket[code].n);
        return fd;
    }

    getRtPrice(code) {
        const cbprefix = 'jSnapshotBack';
        const url = `https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=${code}&callback=${cbprefix}&_=${Date.now()}`;

        return fetch(url)
            .then(response => response.text()) // 先转换为文本
            .then(text => {
                const jsonText = text.substring(cbprefix.length + 1, text.length - 2); // 去掉 JSONP 包装
                return JSON.parse(jsonText); // 解析 JSON
            })
            .then(resobj => {
                if (!resobj) {
                    throw new Error('getRtPrice Invalid response');
                }

                const { bottomprice: bp, topprice: tp, realtimequote, fivequote } = resobj;
                const cp = realtimequote.currentPrice;
                let s5 = fivequote.sale5;
                let b5 = fivequote.buy5;

                if (fivequote.sale1 == fivequote.buy1) {
                    // 集合竞价
                    s5 = cp * 1.03 - tp > 0 ? tp : cp * 1.03;
                    b5 = cp * 0.97 - bp > 0 ? cp * 0.97 : bp;
                }

                return { bp, tp, cp, s5, b5 };
            })
            .catch(error => {
                console.error('getRtPrice failed:', error);
                return null;
            });
    }

    countUrl() {
        return feng.jywg + 'Trade/GetAllNeedTradeInfo?validatekey=' + emjyBack.validateKey;
    }

    countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        var stock = emjyBack.stockMarket[code];
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        const mdic = {0: 'SA', 1: 'HA', 4: 'B'};
        fd.append('market', mdic[stock.mkt]);
        fd.append('stockName', stock.n);
        fd.append('gddm', '');
        return fd;
    }

    getCount(code, price, tradeType, jylx) {
        return fetch(this.countUrl(), {
            method: 'POST',
            body: this.countFormData(code, price, tradeType, jylx),
        })
            .then(response => response.json())
            .then(robj => {
                if (robj.Status !== 0 || !robj.Data?.Kmml) {
                    throw new Error('Trade getCount error: ' + JSON.stringify(robj));
                }
                return { availableCount: robj.Data.Kmml };
            });
    }

    doTrade(code, price, count, tradeType, jylx) {
        return fetch(this.getUrl(), {
            method: 'POST',
            body: this.getFormData(code, price, count, tradeType, jylx),
        })
            .then(response => response.json())
            .then(robj => {
                if (robj.Status !== 0 || !robj.Data?.length) {
                    throw new Error('Trade failed: ' + JSON.stringify(robj));
                }
                this.availableMoney -= tradeType === 'B' ? price * count : -(price * count);
                return { code, price, count, sid: robj.Data[0].Wtbh, type: tradeType };
            });
    }

    async tradeValidPrice(code, price, count, tradeType, jylx) {
        let finalCount = count;
        if (count < 10) {
            if (count < 1) throw new Error(`Invalid count: ${count}`);
            const cobj = await this.getCount(code, price, tradeType, jylx);
            finalCount = cobj.availableCount;
            if (count > 1) {
                finalCount = 100 * Math.floor(cobj.availableCount / 100 / count);
            }
        }
        return this.doTrade(code, price, finalCount, tradeType, jylx);
    }

    async trade(code, price, count, tradeType, jylx) {
        if (tradeType === 'B' && this.availableMoney < 1000) {
            throw new Error('Insufficient funds');
        }

        if (price === 0) {
            const pobj = await this.getRtPrice(code);
            price =
                tradeType === 'B' ? (pobj.s5 === '-' ? pobj.tp : pobj.s5) :
                tradeType === 'S' ? (pobj.b5 === '-' ? pobj.bp : pobj.b5) :
                price;
        }
        return this.tradeValidPrice(code, price, count, tradeType, jylx);
    }

    sell(code, price, count) {
        return this.trade(code, price, count, 'S', null);
    }

    buy(code, price, count) {
        return this.trade(code, price, count, 'B', null);
    }
}


class CollatTradeClient extends TradeClient {
    constructor(amoney) {
        super(amoney);
        this.buy_jylx = '6';
        this.sell_jylx = '7';
    }

    getUrl() {
        return feng.jywg + 'MarginTrade/SubmitTradeV2?validatekey=' + emjyBack.validateKey;
    }

    getFormData(code, price, count, tradeType, jylx) {
        const fd = super.getBasicFormData(code, price, count, tradeType);
        fd.append('stockName', emjyBack.stockMarket[code].n);
        fd.append('xyjylx', jylx);
        return fd;
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
        const mdic = {0: 'SA', 1: 'HA', 4: 'B'};
        fd.append('market', mdic[stock.mkt]);
        return fd;
    }

    countUrl() {
        return feng.jywg + 'MarginTrade/GetKyzjAndKml?validatekey=' + emjyBack.validateKey;
    }

    async checkRzrqTarget(code) {
        const pobj = await this.getRtPrice(code);
        const url = this.countUrl();
        const fd = this.countFormData(code, pobj.cp, 'B', this.buy_jylx);

        const response = await fetch(url, { method: 'POST', body: fd });
        const robj = await response.json();
        return { Status: robj.Status, Kmml: robj.Data.Kmml, Message: robj.Message, code };
    }

    sell(code, price, count) {
        return this.trade(code, price, count, 'S', this.sell_jylx);
    }

    buy(code, price, count) {
        return this.trade(code, price, count, 'B', this.buy_jylx);
    }
}


class CreditTradeClient extends CollatTradeClient {
    constructor(amoney) {
        super(amoney);
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
    buy(code, price, count) {
        if (count < 100) {
            emjyBack.log('trade error:', 'must set correct buy count for credit buy');
            return Promise.resolve();
        }
        return this.trade(code, price, count, 'B', 'a');
    }

    // stockCode	"510300"
    // stockName	"沪深300ETF"
    // price	"3.909"
    // amount	"3000"
    // tradeType	"S"
    // xyjylx	"A"
    // market	"HA"
    sell(code, price, count) {
        return this.trade(code, price, count, 'S', 'A');
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
        this.tradeClient = new TradeClient(this.availableMoney);
    }

    buyStock(code, price, count) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        return this.tradeClient.buy(code, price, count).then(bd => {
            this.updateAssets();
            return bd;
        });
    }

    sellStock(code, price, count) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        return this.tradeClient.sell(code, price, count).then(sd => {
            this.updateAssets();
            return sd;
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

    buyFundBeforeClose() {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        feng.buyBondRepurchase('204001');
        // feng.buyBondRepurchase('131810');
    }

    sellWalletFund() {
        return this.sellStock(this.wallet.fundcode, 0, 1);
    }

    fillupGuardPrices() {
        this.stocks.forEach(stock => {
            if (emjyBack.klines[stock.code] && stock.strategies) {
                stock.strategies.applyKlines(emjyBack.klines[stock.code].klines);
            }
        });
    }

    loadDeals() {
        var dealclt = new OrdersClient();
        dealclt.getAllData().then((deals) => {
            this.handleDeals(deals);
        });
    }

    handleDeals(deals) {
        emjyBack.uploadTodayDeals(deals);
        var tradedCode = new Set();
        var bdeals = deals.filter(d => d.Mmsm.includes('买入'));
        for (let i = 0; i < bdeals.length; i++) {
            const deali = bdeals[i];
            if (deali.Cjsl > 0) {
                var s = this.getStock(deali.Zqdm);
                if (!s) {
                    this.addWatchStock(deali.Zqdm, {});
                } else if (!s.strategies) {
                    this.addStockStrategy(s, {});
                }
            }
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

        var sdeals = deals.filter(d => d.Mmsm.includes('卖出'));
        for (let i = 0; i < sdeals.length; i++) {
            const deali = sdeals[i];
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

    loadHistDeals(startDate) {
        var dealclt = new HistDealsClient();
        dealclt.setStartDate(startDate);
        return dealclt.getAllHistoryData();
    }

    loadOtherDeals(startDate) {
        var sxlclt = new SxlHistClient();
        sxlclt.setStartDate(startDate);
        return sxlclt.getAllHistoryData();
    }

    createAssetsClient() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no validateKey');
            return;
        }
        if (!this.assetsClient) {
            this.assetsClient = new AssetsClient();
        }
        return this.assetsClient;
    }

    loadAssets() {
        if (!this.assetsClient) {
            this.createAssetsClient();
        }
        if (this.assetsClient) {
            this.assetsClient.getAssetsAndPositions().then(x => {
                this.onAssetsLoaded(x.assets);
                this.onPositionsLoaded(x.positions);
            });
        }
    }

    updateAssets() {
        if (!this.assetsClient) {
            this.createAssetsClient();
        }
        if (this.assetsClient) {
            this.assetsClient.getAssets().then(assets => {
                this.onAssetsLoaded(assets);
            });
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
        if (holdCount - availableCount != 0 && (new Date()).getHours() >= 15) {
            availableCount = holdCount;
        }
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
        this.tradeClient = new CollatTradeClient(this.availableMoney);
    }

    buyFundBeforeClose() {
        feng.repayMarginLoan().then(() => {
            this.buyStock(this.wallet.fundcode, 0, 1);
        });
    }

    loadDeals() {
        var dealclt = new MarginOrdersClient();
        dealclt.getAllData().then((deals) => {
            this.handleDeals(deals);
        });
    }

    loadHistDeals(startDate) {
        var dealclt = new MarginHistDealsClient();
        dealclt.setStartDate(startDate);
        return dealclt.getAllHistoryData();
    }

    loadOtherDeals(startDate) {
        var sxlclt = new MarginSxlHistClient();
        sxlclt.setStartDate(startDate);
        return sxlclt.getAllHistoryData();
    }

    createAssetsClient() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no validateKey');
            return;
        }
        if (!this.assetsClient) {
            this.assetsClient = new MarginAssetsClient();
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
        if (holdCount - availableCount != 0 && (new Date()).getHours() >= 15) {
            availableCount = holdCount;
        }
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
        this.tradeClient = new CreditTradeClient(this.availableMoney);
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
