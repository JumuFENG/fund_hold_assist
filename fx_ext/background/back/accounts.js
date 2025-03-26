'use strict';

(function(){
const { logger, ctxfetch, svrd } = xreq('./background/nbase.js');
const { guang } = xreq('./background/guang.js');
const { feng } = xreq('./background/feng.js');
const { klPad } = xreq('./background/kline.js');
const { GroupManager }  = xreq('./background/strategyGroup.js');

class DealsClient {
    // 普通账户 当日成交
    constructor() {
        this.qqhs = 20; // 请求行数
        this.dwc = '';
        this.data = []; // 用于存储所有获取的数据
    }

    getUrl() {
        return feng.jywg + 'Search/GetDealData?validatekey=' + accld.validateKey;
    }

    getFormData() {
        const fd = new FormData();
        fd.append('qqhs', this.qqhs);
        fd.append('dwc', this.dwc);
        return fd;
    }

    async fetchData() {
        const url = this.getUrl();
        const fd = this.getFormData();
        try {
            const response = await ctxfetch.fetch(url, {
                method: 'POST',
                body: fd
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.data;
        } catch (error) {
            logger.info(this.constructor.name, 'error url', this.getUrl());
            logger.info(error);
        }
    }

    // 获取所有分页数据
    async getAllData() {
        let hasMoreData = true;
        this.dwc = '';
        this.data = [];
        while (hasMoreData) {
            const deals = await this.fetchData();
            if (deals.Status !== 0 || deals.Message) {
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
        return feng.jywg + 'MarginSearch/GetDealData?validatekey=' + accld.validateKey;
    }

    updateDwc() {
        this.dwc++;
    }
}


class HistDealsClient extends DealsClient {
    // 普通账户 历史成交
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

        if (currentStartTime < this.startDate) {
            currentStartTime = new Date(this.startDate);
        }

        while (currentStartTime >= this.startDate) {
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
        fd.append('st', guang.dateToString(this.startTime, '-'));
        fd.append('et', guang.dateToString(this.endTime, '-'));
        return fd;
    }

    // 重写 getUrl 方法，使用历史成交数据的接口
    getUrl() {
        return feng.jywg + 'Search/GetHisDealData?validatekey=' + accld.validateKey;
    }
}


class MarginHistDealsClient extends HistDealsClient {
    // 信用账户 历史成交
    getFormData() {
        var fd = super.getFormData();
        if (fd.has('st')) {
            fd.delete('st');
        }
        fd.append('st', guang.dateToString(this.startTime, ''));
        if (fd.has('et')) {
            fd.delete('et');
        }
        fd.append('et', guang.dateToString(this.endTime, ''));
        return fd;
    }

    getUrl() {
        return feng.jywg + 'MarginSearch/queryCreditHisMatchV2?validatekey=' + accld.validateKey;
    }
}

class OrdersClient extends DealsClient {
    getUrl() {
        return feng.jywg + 'Search/GetOrdersData?validatekey=' + accld.validateKey;
    }
}

class MarginOrdersClient extends DealsClient {
    getUrl() {
        return feng.jywg + 'MarginSearch/GetOrdersData?validatekey=' + accld.validateKey;
    }
}

class SxlHistClient extends HistDealsClient {
    // Stock Exchange List
    getUrl() {
        return feng.jywg + 'Search/GetFundsFlow?validatekey=' + accld.validateKey;
    }
}

class MarginSxlHistClient extends HistDealsClient {
    // 交割单查询
    getFormData() {
        const fd = super.getFormData();
        if (fd.has('st')) {
            fd.delete('st');
        }
        fd.append('st', guang.dateToString(this.startTime, ''));
        if (fd.has('et')) {
            fd.delete('et');
        }
        fd.append('et', guang.dateToString(this.endTime, ''));
        return fd;
    }

    getUrl() {
        return feng.jywg + 'MarginSearch/queryCreditLogAssetV2?validatekey=' + accld.validateKey;
    }
}


class AssetsClient {
    constructor() {
        this.moneyType = 'RMB'; // 默认货币类型
    }

    // 构造 URL
    buildUrl(endpoint) {
        return `${feng.jywg}${endpoint}?validatekey=${accld.validateKey}`;
    }

    async fetchData(url, formData = new FormData()) {
        const response = await ctxfetch.fetch(url, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.data;
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
            logger.info(error);
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
            logger.info(error);
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
            logger.info(error);
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
            logger.info(response);
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
            logger.info(error);
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
            logger.info(error);
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
            logger.info(error);
            throw error;
        }
    }
}


class TradeClient {
    constructor(amoney = 0) {
        this.availableMoney = amoney;
    }

    getUrl() {
        return feng.jywg + 'Trade/SubmitTradeV2?validatekey=' + accld.validateKey;
    }

    async getBasicFormData(code, price, count, tradeType) {
        const fd = new FormData();
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('amount', count);
        const mkt = await feng.getStockMktcode(code);
        if (mkt == 'BJ') {
            tradeType = '0' + tradeType;
        }
        fd.append('tradeType', tradeType);
        const mdic = { 'SZ': 'SA', 'SH': 'HA', 'BJ': 'B' };
        fd.append('market', mdic[mkt]);
        return fd;
    }

    async getFormData(code, price, count, tradeType) {
        const fd = await this.getBasicFormData(code, price, count, tradeType);
        fd.append('zqmc', feng.getStockName(code));
        return fd;
    }

    async getRtPrice(code) {
        try {
            const snap = await feng.getStockSnapshot(code);
            let {bottomprice:bp, topprice:tp, latestPrice:cp, buysells: {sale5: s5, buy5: b5}} = snap;
            if (snap.buysells.sale1 == snap.buysells.buy1) {
                // 集合竞价
                s5 = Math.min(cp * 1.03, tp);
                b5 = Math.max(cp * 0.97, bp);
            }
            return { bp, tp, cp, s5, b5 };
        } catch (error) {
            console.error('getRtPrice failed:', error);
        }
    }

    countUrl() {
        return feng.jywg + 'Trade/GetAllNeedTradeInfo?validatekey=' + accld.validateKey;
    }

    async countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        const mkt = await feng.getStockMktcode(code);
        const mdic = {'SZ': 'SA', 'SH': 'HA', 'BJ': 'B'};
        fd.append('market', mdic[mkt]);
        fd.append('stockName', feng.getStockName(code));
        fd.append('gddm', '');
        return fd;
    }

    async getCount(code, price, tradeType, jylx) {
        const fd = await this.countFormData(code, price, tradeType, jylx);
        return ctxfetch.fetch(this.countUrl(), {
            method: 'POST',
            body: fd
        }).then(response => response.data).then(robj => {
            if (robj.Status !== 0 || !robj.Data?.Kmml) {
                logger.err('Trade getCount error: ' + JSON.stringify(robj));
                return { availableCount: 0 };
            }
            return { availableCount: robj.Data.Kmml };
        });
    }

    async doTrade(code, price, count, tradeType, jylx) {
        const body = await this.getFormData(code, price, count, tradeType, jylx);
        return ctxfetch.fetch(this.getUrl(), {
            method: 'POST',
            body,
        }).then(response => response.data).then(robj => {
            if (robj.Status !== 0 || !robj.Data?.length) {
                return { code, type: tradeType, err: robj};
            }
            this.availableMoney -= tradeType === 'B' ? price * count : -(price * count);
            return { code, price, count, sid: robj.Data[0].Wtbh, type: tradeType };
        });
    }

    async tradeValidPrice(code, price, count, tradeType, jylx) {
        let finalCount = count;
        if (count < 10) {
            if (count < 1) {
                return { code, type: tradeType, err: `Invalid count: ${count}`};
            }
            const cobj = await this.getCount(code, price, tradeType, jylx);
            finalCount = cobj.availableCount;
            if (count > 1) {
                finalCount = 100 * Math.floor(cobj.availableCount / 100 / count);
            }
            if (finalCount - 100 < 0) {
                return { code, type: tradeType, err: `Invalid count: ${finalCount} available count: ${cobj.availableCount}`};
            }
        }
        return this.doTrade(code, price, finalCount, tradeType, jylx);
    }

    async trade(code, price, count, tradeType, jylx) {
        if (tradeType === 'B' && this.availableMoney < 1000) {
            return { code, type: tradeType, err: `noney not enough, available Money: ${this.availableMoney}`};
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
        return feng.jywg + 'MarginTrade/SubmitTradeV2?validatekey=' + accld.validateKey;
    }

    async getFormData(code, price, count, tradeType, jylx) {
        const fd = await super.getBasicFormData(code, price, count, tradeType);
        fd.append('stockName', feng.getStockName(code));
        fd.append('xyjylx', jylx);
        return fd;
    }

    async countFormData(code, price, tradeType, jylx) {
        var fd = new FormData();
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', tradeType);
        fd.append('xyjylx', jylx); // 信用交易类型
        fd.append('moneyType', 'RMB');
        const mkt = await feng.getStockMktcode(code);
        fd.append('stockName', feng.getStockName(code));
        const mdic = {'SZ': 'SA', 'SH': 'HA', 'BJ': 'B'};
        fd.append('market', mdic[mkt]);
        return fd;
    }

    countUrl() {
        return feng.jywg + 'MarginTrade/GetKyzjAndKml?validatekey=' + accld.validateKey;
    }

    async checkRzrqTarget(code) {
        const pobj = await this.getRtPrice(code);
        const fd = await this.countFormData(code, pobj.cp, 'B', this.buy_jylx);
        const url = this.countUrl();

        const response = await ctxfetch.fetch(url, { method: 'POST', body: fd });
        const robj = response.data;
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
            logger.info('trade error:', 'must set correct buy count for credit buy');
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
        this.fundcode = '511880'; // 货币基金代码，余钱收盘前买入.
    }

    getStock(code) {
        return this.stocks.find(s => s.code == code);
    }

    get holdAccount() {
        return this.hacc ?? this;
    }

    set holdAccount(v) {
        this.hacc = v;
    }

    async doTrade(code, info) {
        if (info.tradeType == 'B') {
            const bd = await this.buyStock(info.code, info.price, info.count);
            var stk = this.holdAccount.getStock(code);
            if (!stk) {
                this.holdAccount.addWatchStock(code, {});
                stk = this.holdAccount.getStock(code);
            }
            if (stk) {
                if (!stk.strategies) {
                    this.holdAccount.addStockStrategy(stk, {});
                }
                if (bd) {
                    stk.strategies.buydetail.addBuyDetail(bd);
                }
            }
            info.deal = bd;
            return info;
        } else if (info.tradeType == 'S') {
            if (info.count > 0) {
                const sd = await this.sellStock(info.code, info.price, info.count);
                var stk = this.holdAccount.getStock(code);
                if (stk) {
                    if (!stk.strategies) {
                        this.holdAccount.applyStrategy(code, {grptype: 'GroupStandard', strategies: {'0': {key: 'StrategySellELS', enabled: false, cutselltype: 'all', selltype: 'all'}}, transfers: {'0': {transfer: '-1'}}, amount: '5000'});
                    }
                    if (sd) {
                        stk.strategies.buydetail.addSellDetail(sd);
                    }
                }
                info.deal = sd;
                return info;
            }
        }
    }

    createOrderClient() {}

    checkOrderClient() {
        if (!this.orderClient) {
            this.createOrderClient();
        }
    }

    checkOrders() {
        this.checkOrderClient();
        return this.orderClient.getAllData().then(data => {
            for (const d of data) {
                if (!this.orderfeched) {
                    this.orderfeched = [];
                }
                if (!this.orderfeched.find(x=>x.Zqdm == d.Zqdm && x.Wtbh == d.Wtbh && x.Wtzt == d.Wtzt)) {
                    this.orderfeched.push(d);
                }
            }
            return data;
        });
    }

    getDealTime(cjrq, cjsj) {
        var date = cjrq.slice(0, 4) + "-" + cjrq.slice(4, 6) + "-" + cjrq.slice(6, 8);
        if (cjsj.length == 8) {
            cjsj = cjsj.substring(0, 6);
        }
        if (cjsj.length != 6) {
            return date + ' 0:0';
        }
        return date + ' ' + cjsj.slice(0, 2) + ':' + cjsj.slice(2, 4) + ':' + cjsj.slice(4, 6);
    }

// {
//     "Cjrq": "20210629", 成交日期
//     "Cjsj": "143048", 成交时间
//     "Zqdm": "600905", 证券代码
//     "Zqmc": "三峡能源", 证券名称
//     "Mmsm": "证券卖出", 买卖说明
//     "Cjsl": "10000", 成交数量
//     "Cjjg": "6.620", 成交价格
//     "Cjje": "66200.00", 成交金额
//     "Sxf": "16.55", 手续费
//     "Yhs": "66.20", 印花税
//     "Ghf": "1.32", 过户费
//     "Zjye": "66682.05", 资金余额
//     "Gfye": "26700", 股份余额
//     "Market": "HA",
//     "Cjbh": "24376386", 成交编号
//     "Wtbh": "319719", 委托编号
//     "Gddm": "E062854229", 股东代码
//     "Dwc": "",
//     "Xyjylx": "卖出担保品" 信用交易类型
// }
    codeFromMktZqdm(market, zqdm) {
        if (!market && !zqdm) {
            return;
        }
        const mdic = {'HA':'SH', 'SA': 'SZ', 'B': 'BJ'};
        if (market === 'TA') {
            logger.info('退市股买卖不记录!');
            return;
        }
        if (!mdic[market]) {
            throw new Error(`unknown market ${market}`);
        }
        return mdic[market] + zqdm;
    }

    tradeTypeFromMmsm(Mmsm) {
        const ignored = ['担保品划入', '担保品划出', '融券', ]
        if (ignored.includes(Mmsm)) {
            return '';
        }
        const sells = ['证券卖出'];
        if (sells.includes(Mmsm)) {
            return 'S';
        }
        const buys = ['证券买入', '配售申购', '配股缴款', '网上认购'];
        if (buys.includes(Mmsm)) {
            return 'B';
        }
        return;
    }

    loadDeals() {
        this.checkOrderClient();
        this.orderClient.getAllData().then((deals) => {
            const fetchedDeals = this.getDealsToUpload(deals);
            this.uploadDeals(fetchedDeals);
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
        });
    }

    uploadDeals(deals) {
        if (deals.length == 0 || !accld.fha) {
            return;
        }

        accld.testFhaServer().then(txt => {
            if (txt != 'OK') {
                logger.info('testFhaServer, failed.!');
                return;
            }

            var url = accld.fha.server + 'stock';
            var dfd = new FormData();
            dfd.append('act', 'deals');
            dfd.append('acc', this.keyword);
            dfd.append('data', JSON.stringify(deals));
            logger.info('uploadDeals', JSON.stringify(deals));
            fetch(url, {method: 'POST', headers: accld.fha.headers, body: dfd}).then(r=>r.text()).then(p => {
                logger.info('upload deals to server,', p);
            });
        });
    }

    getDealsToUpload(deals) {
        var fetchedDeals = [];
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            if (deali.Wtzt != '已成' && deali.Wtzt != '部撤') {
                logger.info('getDealsToUpload unknown deal:', JSON.stringify(deali));
                continue;
            }
            var tradeType = this.tradeTypeFromMmsm(deali.Mmsm)
            if (!tradeType) {
                logger.info('unknown trade type', deali.Mmsm, JSON.stringify(deali));
                continue;
            }

            var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
            if (!code) {
                continue;
            }

            var time = this.getDealTime(deali.Wtrq, deali.Wtsj);
            const {Cjsl: count, Cjjg: price, Wtbh: sid} = deali;
            fetchedDeals.push({time, sid, code, tradeType, price, count});
        }
        return fetchedDeals.reverse();
    }

    clearCompletedDeals() {
        if (!accld.savedDeals) {
            svrd.getFromLocal('hist_deals').then(sdeals => {
                if (sdeals) {
                    accld.savedDeals = sdeals;
                    this.clearCompletedDeals();
                }
            });
            return;
        }

        let curDeals = accld.savedDeals.filter(d => accld.normalAccount.getStock(d.code.substring(2)) || accld.collateralAccount.getStock(d.code.substring(2)));
        curDeals.sort((a, b) => a.time > b.time);
        accld.savedDeals = curDeals;
        svrd.saveToLocal({'hist_deals': accld.savedDeals});
    }

    loadHistDeals(date) {
        var dealclt = this.createHistDealsClient();
        var startDate = date;
        if (typeof(date) === 'string') {
            startDate = new Date(date.split('-'));
        }
        dealclt.setStartDate(startDate);
        dealclt.getAllHistoryData().then(deals => {
            var fetchedDeals = [];
            for (let i = 0; i < deals.length; i++) {
                const deali = deals[i];
                var tradeType = this.tradeTypeFromMmsm(deali.Mmsm)
                if (!tradeType) {
                    logger.info('unknown trade type', deali.Mmsm, JSON.stringify(deali));
                    continue;
                }

                var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
                if (!code) {
                    continue;
                }

                var time = this.getDealTime(deali.Cjrq, deali.Cjsj);
                const {Cjsl: count, Cjjg: price, Sxf: fee, Yhs: feeYh, Ghf: feeGh, Wtbh: sid} = deali;
                if (count - 0 <= 0) {
                    logger.info('invalid count', deali);
                    continue;
                }
                fetchedDeals.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
            }

            fetchedDeals.reverse();
            var uptosvrDeals = [];
            if (!accld.savedDeals || accld.savedDeals.length == 0) {
                accld.savedDeals = fetchedDeals;
                uptosvrDeals = fetchedDeals;
            } else {
                uptosvrDeals = fetchedDeals.filter(deali => !accld.savedDeals.find(d => d.time == deali.time && d.code == deali.code && d.sid == deali.sid));
                accld.savedDeals.concat(uptosvrDeals);
                accld.savedDeals.sort((a, b) => a.time > b.time);
            }
            svrd.saveToLocal({'hist_deals': accld.savedDeals});
            this.uploadDeals(uptosvrDeals);
            this.clearCompletedDeals();
        });
    }

    mergeCumDeals(deals) {
        // 合并时间相同的融资利息
        var tdeals = {};
        deals.forEach(d => {
            if (Object.keys(tdeals).includes(d.time)) {
                tdeals[d.time].price += parseFloat(d.price);
            } else {
                tdeals[d.time] = d;
                tdeals[d.time].price = parseFloat(d.price);
            }
        });
        return Object.values(tdeals);
    }

    loadOtherDeals(date) {
        var sxlclt = this.createSxlHistClient();
        var startDate = date;
        if (typeof(startDate) === 'string') {
            startDate = new Date(date.split('-'));
        }
        sxlclt.setStartDate(startDate);
        sxlclt.getAllHistoryData().then(deals => {
            var fetchedDeals = [];
            var dealsTobeCum = [];
            var ignoredSm = ['融资买入', '融资借入', '偿还融资负债本金', '担保品卖出', '担保品买入', '担保物转入', '担保物转出', '融券回购', '融券购回', '证券卖出', '证券买入', '股份转出', '股份转入', '配股权证', '配股缴款']
            var otherBuySm = ['红股入账', '配股入帐'];
            var otherSellSm = [];
            var otherSm = ['配售缴款', '新股入帐', '股息红利差异扣税', '偿还融资利息', '偿还融资逾期利息', '红利入账', '银行转证券', '证券转银行', '利息归本'];
            var fsjeSm = ['股息红利差异扣税', '偿还融资利息', '偿还融资逾期利息', '红利入账', '银行转证券', '证券转银行', '利息归本'];
            for (let i = 0; i < deals.length; i++) {
                const deali = deals[i];
                var sm = deali.Ywsm;
                if (ignoredSm.includes(sm)) {
                    continue;
                }
                var tradeType = '';
                if (otherBuySm.includes(sm)) {
                    tradeType = 'B';
                } else if (otherSellSm.includes(sm)) {
                    tradeType = 'S';
                } else if (otherSm.includes(sm)) {
                    logger.info(JSON.stringify(deali));
                    tradeType = sm;
                    if (sm == '股息红利差异扣税') {
                        tradeType = '扣税';
                    }
                    if (sm == '偿还融资利息' || sm == '偿还融资逾期利息') {
                        tradeType = '融资利息';
                    }
                } else {
                    logger.info('unknow deals', sm, JSON.stringify(deali));
                    continue;
                }

                var code = this.codeFromMktZqdm(deali.Market, deali.Zqdm);
                if (!code) {
                    continue;
                }
                var time = this.getDealTime(
                    deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,
                    deali.Fssj === undefined || deali.Fssj == '0' ? deali.Cjsj : deali.Fssj);
                if (sm == '红利入账' && time.endsWith('0:0')) {
                    time = this.getDealTime(deali.Fsrq === undefined || deali.Fsrq == '0' ? deali.Ywrq : deali.Fsrq,'150000');
                }
                const {Sxf: fee, Yhs: feeYh, Ghf: feeGh, Htbh: sid} = deali;
                let count = deali.Cjsl;
                let price = deali.Cjjg;
                if (fsjeSm.includes(sm)) {
                    count = 1;
                    price = deali.Fsje;
                }
                if (sm == '配股入帐' && sid == '') {
                    continue;
                }
                if (tradeType == '融资利息') {
                    dealsTobeCum.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
                } else {
                    fetchedDeals.push({time, sid, code, tradeType, price, count, fee, feeYh, feeGh});
                }
            }
            fetchedDeals.reverse();
            if (dealsTobeCum.length > 0) {
                var ndeals = this.mergeCumDeals(dealsTobeCum);
                ndeals.forEach(d => {
                    fetchedDeals.push(d);
                });
            }
            this.uploadDeals(fetchedDeals);
        });
    }
}

class NormalAccount extends Account {
    constructor() {
        super();
        this.keyword = 'normal';
        this.availableMoney = 0;
    }

    loadWatchings() {
        if (accld.fha.save_on_server) {
            const wurl = accld.fha.server + 'stock?act=watchings&acc=' + this.keyword;
            fetch(wurl, {headers: accld.fha.headers}).then(r => r.json()).then(watchings => {
                for (const s in watchings) {
                    this.addWatchStock(s.slice(-6), watchings[s].strategies);
                }
            });
        } else {
            var watchingStorageKey = this.keyword + '_watchings';
            svrd.getFromLocal(watchingStorageKey).then(watchings => {
                logger.info(this.keyword, 'get watching_stocks', JSON.stringify(watchings));
                if (watchings) {
                    watchings.forEach(s => {
                        this.addWatchStock(s);
                        this.loadStrategies(s);
                    });
                };
            });
        }
    }

    fixWatchings() {
        svrd.getFromLocal(null).then(items => {
            for (var k in items) {
                if (k == 'undefined') {
                    svrd.removeLocal(k);
                    continue;
                }
                if (k.startsWith(this.keyword)) {
                    var keys = k.split('_');
                    if (keys.length == 3 && keys[2] == 'strategies') {
                        this.addWatchStock(keys[1]);
                        this.applyStrategy(keys[1], JSON.parse(items[k]));
                    }
                    logger.info('fix', keys[1]);
                }
            }
        });
    }

    loadStrategies(code) {
        var strStorageKey = this.keyword + '_' + code + '_strategies';
        svrd.getFromLocal(strStorageKey).then(str => {
            if (str) {
                this.applyStrategy(code, JSON.parse(str));
            };
        });
    }

    getServerSavedStrategies(code) {
        if (accld.fha.save_on_server && this === this.holdAccount) {
            feng.getLongStockCode(code).then(fcode => {
                const params = {'act': 'strategy', 'acc': this.keyword, code: fcode};
                const url = accld.fha.server + '/stock?' + new URLSearchParams(params);
                fetch(url, { headers: accld.fha.headers }).then(response => response.json()).then(data => {
                    this.applyStrategy(code, data);
                });
            });
        }
    }

    getAccountStocks() {
        if (!this.stocks || this.stocks.length == 0) {
            return null;
        };

        var stocks = this.stocks.map(({code, name, holdCost, holdCount, availableCount, latestPrice, strategies, }) => ({
            code,
            name,
            holdCost,
            holdCount,
            availableCount,
            latestPrice,
            strategies: strategies?.tostring() ?? null,
        }));
        stocks.sort((a, b) => b.holdCount * b.latestPrice - a.holdCount * a.latestPrice);
        return {account: this.keyword, stocks};
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
        var stock = this.stocks.find(s => s.code == code);
        if (!stock) {
            return;
        };
        var strategyGroup = GroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
        strategyGroup.setHoldCount(stock.holdCount, stock.availableCount, stock.holdCost);
        stock.strategies = strategyGroup;
    }

    removeStrategy(code, stype) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };

        stock.strategies = null;
        svrd.removeLocal(this.keyword + '_' + code + '_strategies');
    }

    disableStrategy(code, skey) {
        var stock = this.stocks.find(s => s.code == code);
        if (!stock || !stock.strategies) {
            return;
        }

        stock.strategies.disableStrategy(skey);
    }

    addStockStrategy(stock, strgrp) {
        if (strgrp) {
            stock.strategies = GroupManager.create(strgrp, this.keyword, stock.code, this.keyword + '_' + stock.code + '_strategies');
        }
    }

    addWatchStock(code, strgrp) {
        klPad.loadKlines(code);
        var stock = this.stocks.find(s => {return s.code == code;});

        if (stock) {
            if (stock.holdCount == 0 || !stock.strategies) {
                this.addStockStrategy(stock, strgrp);
                return;
            }
            for (const s of Object.values(strgrp.strategies)) {
                stock.strategies.addStrategy(s);
            }
            return;
        };

        var name = feng.getStockName(code);
        if (!name) {
            name = code;
        }
        var stock = { code, name, holdCount: 0, availableCount: 0};
        this.addStockStrategy(stock, strgrp);
        this.stocks.push(stock);
    }

    removeStock(code) {
        var stock = this.stocks.find(s => {return s.code == code;});
        if (stock && stock.strategies) {
            stock.strategies.archiveBuyDetail();
        }
        svrd.removeLocal(this.keyword + '_' + code + '_strategies');
        this.stocks = this.stocks.filter(s => s.code !== code);
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = this.stocks.filter(s => s.strategies).map(s => s.code);
        svrd.saveToLocal(watchingStocks);
        if (accld.fha.save_on_server && this === this.holdAccount) {
            feng.getLongStockCode(code).then(fcode => {
                const fd = new FormData();
                fd.append('act', 'forget');
                fd.append('acc', this.keyword);
                fd.append('code', fcode);
                const url = accld.fha.server + '/stock';
                fetch(url, {method: 'POST', headers: accld.fha.headers, body: fd});
            });
        }
    }

    save() {
        this.stocks.forEach(s => {
            if (s.strategies) {
                s.strategies.save();
                if (accld.fha.save_on_server && Object.keys(s.strategies.strategies).length > 0 && this == this.holdAccount) {
                    feng.getLongStockCode(s.code).then(fcode => {
                        const fd = new FormData();
                        fd.append('act', 'strategy');
                        fd.append('acc', this.keyword);
                        fd.append('code', fcode);
                        fd.append('data', s.strategies.tostring());
                        const url = accld.fha.server + '/stock';
                        fetch(url, {method: 'POST', headers: accld.fha.headers, body: fd});
                    });
                }
            };
        });
        var watchingStocks = {};
        watchingStocks[this.keyword + '_watchings'] = this.stocks.filter(s => s.strategies).map(s => s.code);
        svrd.saveToLocal(watchingStocks);
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
        return this.sellStock(this.fundcode, 0, 1);
    }

    fillupGuardPrices() {
        this.stocks.forEach(stock => {
            if (klPad.klines[stock.code] && stock.strategies) {
                stock.strategies.applyKlines(klPad.klines[stock.code].klines);
            }
        });
    }

    createOrderClient() {
        this.orderClient = new OrdersClient();
    }

    createHistDealsClient() {
        return new HistDealsClient();
    }

    createSxlHistClient() {
        return new SxlHistClient();
    }

    createAssetsClient() {
        if (!accld.validateKey) {
            logger.info('no validateKey');
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
            logger.info('onPositionsLoaded positions is null.');
            return;
        }

        for (var i = 0; i < positions.length; i++) {
            if (this.fundcode && positions[i].Zqdm == this.fundcode) {
                continue;
            };
            let stocki = this.parsePosition(positions[i]);
            var stockInfo = this.stocks.find(s=> s.code == stocki.code);
            if (stockInfo) {
                Object.assign(stockInfo, stocki);
            } else {
                this.stocks.push(stocki);
            }
        }
    }
}


class CollateralAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'collat';
    }

    createTradeClient() {
        this.tradeClient = new CollatTradeClient(this.availableMoney);
    }

    buyFundBeforeClose() {
        feng.repayMarginLoan().then(() => {
            this.buyStock(this.fundcode, 0, 1).catch(err => {
                logger.info('buy fund', this.fundcode, 'failed', err.message);
            });;
        })
    }

    createOrderClient() {
        this.orderClient = new MarginOrdersClient();
    }

    createHistDealsClient() {
        return new MarginHistDealsClient();
    }

    createSxlHistClient() {
        return new MarginSxlHistClient();
    }

    createAssetsClient() {
        if (!accld.validateKey) {
            logger.info('no validateKey');
            return;
        }
        if (!this.assetsClient) {
            this.assetsClient = new MarginAssetsClient();
        }
        return this.assetsClient;
    }

    setReleatedAssets(assets) {
        if (accld.creditAccount) {
            accld.creditAccount.setOwnAssets(assets);
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
    }

    createTradeClient() {
        this.tradeClient = new CreditTradeClient(this.availableMoney);
    }

    setReleatedAssets(assets) {
        if (accld.collateralAccount) {
            accld.collateralAccount.setOwnAssets(assets);
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

const accld = {
    enableCredit: false,
    all_accounts: {},
    validateKey: null,
    fha: null,
    initAccounts() {
        this.normalAccount = new NormalAccount();
        this.all_accounts[this.normalAccount.keyword] = this.normalAccount;
        this.normalAccount.loadWatchings();
        if (this.enableCredit) {
            this.collateralAccount = new CollateralAccount();
            this.collateralAccount.loadWatchings();
            this.creditAccount = new CreditAccount();
            this.creditAccount.holdAccount = this.collateralAccount;
            this.all_accounts[this.collateralAccount.keyword] = this.collateralAccount;
            this.all_accounts[this.creditAccount.keyword] = this.creditAccount;
        }
    },
    testFhaServer() {
        var url = this.fha.server + 'stock?act=test';
        return fetch(url, {headers: accld.fha.headers}).then(r=>r.text());
    },
    updateHistDeals() {
        svrd.getFromLocal('hist_deals').then(hdl => {
            var startDate = null;
            if (hdl) {
                this.savedDeals = hdl;
                if (this.savedDeals && this.savedDeals.length > 0) {
                    startDate = new Date(this.savedDeals[this.savedDeals.length - 1].time);
                    startDate.setDate(startDate.getDate() + 1);
                } else {
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 10);
                }
            }
            this.doUpdateHistDeals(startDate);
            this.loadOtherDeals(startDate);
        });
    },
    doUpdateHistDeals(date) {
        this.normalAccount.loadHistDeals(date);
        this.collateralAccount.loadHistDeals(date);
    },
    loadOtherDeals(date) {
        this.normalAccount.loadOtherDeals(date);
        this.collateralAccount.loadOtherDeals(date);
    },
    trySellStock(code, price, count, account, cb) {
        if (!this.all_accounts[account]) {
            logger.info('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].sellStock(code, price, count).then(sd => {
            var stk = this.all_accounts[account].holdAccount.getStock(code);
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[account].holdAccount.applyStrategy(code, {grptype: 'GroupStandard', strategies: {'0': {key: 'StrategySellELS', enabled: false, cutselltype: 'all', selltype: 'all'}}, transfers: {'0': {transfer: '-1'}}, amount: '5000'});
                }
                if (sd) {
                    stk.strategies.buydetail.addSellDetail(sd);
                }
            }
            return sd;
        });
    },
    tryBuyStock(code, price, count, account) {
        if (!this.all_accounts[account]) {
            logger.info('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].buyStock(code, price, count).then(bd => {
            var stk = this.all_accounts[account].holdAccount.getStock(code);
            var strgrp = {};
            if (!stk) {
                this.all_accounts[account].holdAccount.addWatchStock(code, strgrp);
                stk = this.all_accounts[account].holdAccount.getStock(code);
            }
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[account].holdAccount.addStockStrategy(stk, strgrp);
                }
                stk.strategies.buydetail.addBuyDetail(bd);
            }
            return bd;
        });
    },
    buyWithAccount(code, price, count, account, strategies) {
        if (strategies) {
            this.all_accounts[account].holdAccount.addWatchStock(code, strategies);
        }
        if (!count) {
            var stk = this.all_accounts[account].holdAccount.getStock(code);
            if (stk) {
                count = stk.strategies.getBuyCount(price);
            }
            if (count * price - this.all_accounts[account].availableMoney > 0) {
                count = guang.calcBuyCount(this.all_accounts[account].availableMoney, price);
            }
        }
        return this.tryBuyStock(code, price, count, account);
    },
    checkRzrq(code) {
        if (!this.creditAccount) {
            return Promise.resolve();
        }
        if (!this.creditAccount.tradeClient) {
            this.creditAccount.createTradeClient();
        }
        return this.creditAccount.tradeClient.checkRzrqTarget(code);
    },
    testTradeApi(code) {
        if (!code) {
            code = '601398';
        }
        feng.getStockSnapshot(code).then(snap => {
            this.tryBuyStock(code, snap.bottomprice, guang.calcBuyCount(1000, snap.bottomprice), 'normal').then(bd => {
                if (bd) {
                    console.log('tade test with deal', bd);
                }
            }).catch(err => {
                console.log('test trade failed', err)
            });
        });
    },
    removeStock(account, code) {
        this.all_accounts[account].removeStock(code);
    },
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        accld, TradeClient, NormalAccount
    };
} else if (typeof window !== 'undefined') {
    window.accld = accld;
    window.TradeClient = TradeClient;
    window.NormalAccount = NormalAccount;
}
})();
