'use strict';
(function(){
const { guang } = xreq('./background/guang.js');

class feng {
    constructor() {
        throw new Error('Cannot instantiate StaticClass');
    }

    static jywg = 'https://jywg.eastmoneysec.com/'; //'https://jywg.18.cn/';
    static quotewg = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot';
    static emshszac = 'https://emhsmarketwg.eastmoneysec.com/api/SHSZQuery/GetCodeAutoComplete2?count=10&callback=sData&id='
    static validateKey = null;


    static stkcache = new Map();
    static loadSaved(cached) {
        for (const code in cached) {
            this.stkcache.set(code, cached[code]);
        }
    }

    static dumpCached(intrested) {
        let holdcached = {};
        for (const [k, { name, code, mktcode, secid }] of this.stkcache.entries()) {
            if (intrested.includes(k)) {
                holdcached[k] = { name, code, mktcode, secid };
            }
        }
        return holdcached;
    }

    static async getEmStcokInfo(code) {
        let url = feng.emshszac + code;
        return guang.fetchData(url, {}, 24*60*60000, emsinf => {
            try {
                const match = emsinf.match(/var sData = "(.+?);";/);
                if (!match) throw new Error('Invalid response format, code: ' + code, ' response: ' + emsinf);

                const sData = match[1].split(',');
                const mm = { '1': 'SH', '2': 'SZ', '4': 'BJ' };
                const [, , , , name, market, , , sec] = sData;
                return {name, code, mktcode: mm[market], secid: `${sec}.${code}`};
            } catch (e) {
                return feng.searchSecurity(code, {classify: 'AStock'}).then(data => data[0]);
            }
        });
    }

    /**
    * 从cache中获取属性值，不存在则从stockinfo获取
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'secid‘
    * @returns {string} 获取的属性值
    */
    static async cachedStockGen(code, k) {
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
        const s = await feng.getEmStcokInfo(code);
        this.stkcache.set(code, Object.assign(cached || {}, s));
        return s[k];
    }

    /**
    * 从cache中获取属性值，不存在则返回默认值
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'name'
    * @param {string} v 属性默认值
    * @returns {string} 获取的属性值
    */
    static cachedStockGenSimple(code, k, v='') {
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
        return v;
    }

    /**
    * 获取东方财富股票secid 如 002261 -> 2.002261
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} secid
    */
    static async getStockSecId(code) {
        return this.cachedStockGen(code, 'secid');
    }

    /**
    * 获取东方财富指数secid 如 000001 -> 2.002261
    * @param {string} code 代码, 如: 002261/001/399/4002
    * @param {string} params 查询条件
    * markettype:
    * mktnum:
    * jys:
    * classify: AStock 股票 | Fund 基金 | Index 指数 | NEEQ 三板...
    * securitytype:
    * @returns {Array} 查询到的对象
    */
    static async searchSecurity(code, params={}) {
        let q = {markettype: '', mktnum: '', jys:'', classify: 'AStock', securitytype:''};
        Object.assign(q, params);
        let sUrl = `https://searchadapter.eastmoney.com/api/suggest/get?type=14&markettype=${q.markettype}&mktnum=${q.mktnum}&jys=${q.jys}&classify=${q.classify}&securitytype=${q.securitytype}&status=&count=5&input=${code}`;
        return fetch(sUrl).then(r=>r.json()).then(qct=> {
            qct = qct.QuotationCodeTable;
            if (qct.Status != 0 || qct.TotalCount < 1) {
                throw new Error('Error get quotes ' + JSON.stringify(qct));
            }
            return qct.Data.map(d=>{
                return {code: d.Code, name: d.Name, secid: d.QuoteID, jsy: d.JYS, mType: d.MarketType, mNum: d.MktNum}
            });
        });
    }

    /**
    * 获取东方财富指数secid 如 000001 -> 1.000001 399001 -> 0.399001
    * @param {string} code 指数代码, 如: 000001
    * @returns {string} secid
    */
    static async getIndexSecId(code) {
        return feng.searchSecurity(code, {classify: 'Index'}).then(data => data[0].secid);
    }

    /**
    * 获取股票的交易所信息 如 002261 -> SZ
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} 市场代码 SH|SZ|BJ
    */
    static async getStockMktcode(code) {
        let mkt = this.cachedStockGenSimple(code, 'mktcode');
        if (mkt) {
            return mkt;
        }
        if (code.startsWith('60') || code.startsWith('68')) {
            return 'SH';
        }
        if (code.startsWith('00') || code.startsWith('30')) {
            return 'SZ';
        }
        if (code.startsWith('92')) {
            return 'BJ';
        }
        return this.cachedStockGen(code, 'mktcode');
    }

    /**
    * 获取股票的完整代码 如 002261 -> SZ002261
    * @param {string} code 股票代码, 如: 002261
    * @returns {string}
    */
    static async getLongStockCode(code) {
        if (code.startsWith('S') || code.startsWith('BJ') || code == '') {
            return code;
        }

        return feng.getStockMktcode(code).then(mkt => {
            return mkt + code;
        });
    }

    /**
    * 获取缓存中股票的名称, 没有则返回空字符串.
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} 股票名称
    */
    static getStockName(code) {
        return this.cachedStockGenSimple(code, 'name');
    }

    /**
    * 获取缓存中股票价格相关的信息,主要用于涨停/跌停价查询.
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'zt'
    * @returns {string} 属性值
    */
    static cachedStockPrcs(code, k) {
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
    }

    /**
    * 获取股票涨停价.
    * @param {string} code 股票代码, 如: 002261
    * @param {number} lclose 昨日收盘价
    * @returns {number} 涨停价
    */
    static getStockZt(code, lclose=null) {
        let zt = this.cachedStockPrcs(code, 'zt');
        if (!zt) {
            const name = this.getStockName(code);
            try {
                zt = guang.calcZtPrice(lclose, guang.getStockZdf(code, name));
            } catch (e) {
                throw new Error('calcZtPrice in getStockZt!');
            }
        }
        return zt;
    }

    /**
    * 获取股票跌停价.
    * @param {string} code 股票代码, 如: 002261
    * @param {number} lclose 昨日收盘价
    * @returns {number} 跌停价
    */
    static getStockDt(code, lclose=null) {
        let dt = this.cachedStockPrcs(code, 'dt');
        if (!dt) {
            const name = this.getStockName(code);
            try {
                dt = guang.calcDtPrice(lclose, guang.getStockZdf(code, name));
            } catch (e) {
                throw new Error('calcDtPrice in getStockDt!');
            }
        }
        return dt;
    }

    /**
    * 获取股票实时盘口数据, 包括最新价，开盘价，昨收价，涨停价，跌停价以及五档买卖情况，要获取涨停价跌停价不需要用本接口，可以直接计算。
    * @param {string} code 股票代码, 如: 002261
    * @returns {Promise<Object>} 返回 {name, latestPrice, openPrice, lastClose, topprice, bottomprice, buysells}
    */
    static async getStockSnapshot(code) {
        const setTimeTo0915 = (date) => {
            date.setHours(9);
            date.setMinutes(15);
            date.setSeconds(0);
            date.setMilliseconds(0);
            return date;
        };

        const snapExpireTime = (date) => {
            const now = new Date();

            if (date !== now.toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replaceAll('/', '') || now.getHours() >= 15) {
                const tomorrow = new Date(now);
                tomorrow.setDate(now.getDate() + 1);
                return setTimeTo0915(tomorrow).getTime();
            }

            if (now.getHours() < 9 || (now.getHours() === 9 && now.getMinutes() < 15)) {
                return setTimeTo0915(new Date(now)).getTime();
            }

            return 0;
        }

        if (code.length != 6) {
            throw new Error('Please check your stock code, code length for snapshort is 6!');
        }

        let url = feng.quotewg + '?id=' + code + '&callback=?';
        return guang.fetchData(url, {}, 1000, snapshot => {
            const {
                name, code, topprice, bottomprice,
                realtimequote: { currentPrice: latestPrice, date, zdf },
                fivequote: { openPrice, yesClosePrice: lastClose, ...fivequote },
            } = snapshot;

            const buysells = Object.fromEntries(
                Object.entries(fivequote).filter(([key]) => key.startsWith('buy') || key.startsWith('sale'))
            );

            const data = { code, name, latestPrice, zdf, openPrice, lastClose, topprice, bottomprice, buysells };
            if (data.zdf.includes('%')) {
                data.zdf = data.zdf.replace('%','');
            }
            const expireTime = snapExpireTime(date);

            const cached = this.stkcache.get(code);
            if (!cached || !cached.lclose || !cached.lclose != lastClose) {
                this.stkcache.set(code, Object.assign(cached || {}, {name, zt:topprice, dt:bottomprice, lclose: lastClose}));
            }

            return expireTime > 0 ? { data, expireTime } : data;
        });
    }

    static async buyNewStocks() {
        if (!this.validateKey) {
            logger.info('no valid validateKey', this.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetCanBuyNewStockListV3?validatekey=${this.validateKey}`;
        try {
            const response = await fetch(url, { method: 'POST' });
            const robj = await response.json();

            if (robj.NewStockList && robj.NewStockList.length > 0) {
                const data = robj.NewStockList
                    .filter(stk => stk.Fxj - 100 > 0 && stk.Ksgsx > 0)
                    .map(stk => ({
                        StockCode: stk.Sgdm,
                        StockName: stk.Zqmc,
                        Price: stk.Fxj,
                        Amount: parseInt(stk.Ksgsx),
                        TradeType: "B",
                        Market: stk.Market
                    }));

                if (data.length > 0) {
                    const jdata = JSON.stringify(data);
                    logger.info('buyNewStocks', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${this.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        logger.info('buyNewStocks success', robjPost.Message);
                    } else {
                        logger.info('buyNewStocks error', robjPost);
                    }
                } else {
                    logger.info('buyNewStocks no new stocks to buy!');
                }
            } else {
                logger.info(JSON.stringify(robj));
            }
        } catch (error) {
            console.error('Error in buyNewStocks:', error);
        }
    }

    static async buyNewBonds() {
        if (!this.validateKey) {
            logger.info('no valid validateKey', this.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetConvertibleBondListV2?validatekey=${this.validateKey}`;
        try {
            const response = await fetch(url, { method: 'POST' });
            const robj = await response.json();

            if (robj.Status !== 0) {
                logger.info('unknown error', robj);
                return;
            }

            if (robj.Data && robj.Data.length > 0) {
                const data = robj.Data
                    .filter(bondi => bondi.ExIsToday)
                    .map(bondi => ({
                        StockCode: bondi.SUBCODE,
                        StockName: bondi.SUBNAME,
                        Price: bondi.PARVALUE,
                        Amount: bondi.LIMITBUYVOL,
                        TradeType: "B",
                        Market: bondi.Market
                    }));

                if (data.length > 0) {
                    const jdata = JSON.stringify(data);
                    logger.info('buyNewBonds', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${this.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        logger.info('buyNewBonds success', robjPost.Message);
                    } else {
                        logger.info('buyNewBonds error', robjPost);
                    }
                } else {
                    logger.info('buyNewBonds no new bonds to buy!');
                }
            } else {
                logger.info('no new bonds', JSON.stringify(robj));
            }
        } catch (error) {
            console.error('Error in buyNewBonds:', error);
        }
    }


    static async buyBondRepurchase(code) {
        if (!this.validateKey) {
            logger.info('No valid validateKey');
            return;
        }

        try {
            // 获取最新价格
            const priceData = await feng.getStockSnapshot(code);
            let price = priceData.latestPrice;
            price = priceData.buysells.buy5 === '-' ? priceData.bottomprice : priceData.buysells.buy5;

            // 获取可操作数量
            const amountUrl = `${feng.jywg}Com/GetCanOperateAmount?validatekey=${this.validateKey}`;
            const amountFd = new FormData();
            amountFd.append('stockCode', code);
            amountFd.append('price', price);
            amountFd.append('tradeType', '0S');

            const amountResponse = await fetch(amountUrl, { method: 'POST', body: amountFd });
            const amountData = await amountResponse.json();

            if (amountData.Status !== 0 || !amountData.Data || amountData.Data.length === 0 || amountData.Data[0].Kczsl <= 0) {
                logger.info('No enough funds to repurchase', JSON.stringify(amountData));
                return;
            }

            const count = amountData.Data[0].Kczsl;

            // 进行国债逆回购交易
            const repurchaseUrl = `${feng.jywg}BondRepurchase/SecuritiesLendingRepurchaseTrade?validatekey=${this.validateKey}`;
            const repurchaseFd = new FormData();
            repurchaseFd.append('zqdm', code);
            repurchaseFd.append('rqjg', price);
            repurchaseFd.append('rqsl', count);

            logger.info('Executing bond repurchase:', code, price, count);
            const repurchaseResponse = await fetch(repurchaseUrl, { method: 'POST', body: repurchaseFd });
            const repurchaseData = await repurchaseResponse.json();

            if (repurchaseData.Status === 0 && repurchaseData.Data && repurchaseData.Data.length > 0) {
                logger.info('Repurchase successful!', JSON.stringify(repurchaseData));
            } else {
                logger.info('Repurchase failed:', JSON.stringify(repurchaseData));
            }
        } catch (error) {
            logger.info('Error in bond repurchase process:', error);
        }
    }

    static async repayMarginLoan() {
        const validateKey = this.validateKey;
        if (!validateKey) {
            return;
        }

        const assetsUrl = `${feng.jywg}MarginSearch/GetRzrqAssets?validatekey=${validateKey}`;
        const fd = new FormData();
        fd.append('hblx', 'RMB');

        try {
            // 获取融资融券资产信息
            const assetsResponse = await fetch(assetsUrl, { method: 'POST', body: fd });
            const assetsData = await assetsResponse.json();

            if (assetsData.Status !== 0 || !assetsData.Data) {
                logger.info('Failed to fetch assets:', assetsData);
                return;
            }

            // 计算待还款金额
            const total = -(-assetsData.Data.Rzfzhj - assetsData.Data.Rqxf);
            if (total <= 0 || assetsData.Data.Zjkys - 1 < 0) {
                logger.info('待还款金额:', total, '可用金额:', assetsData.Data.Zjkys);
                return;
            }

            let payAmount = total;
            if (total > assetsData.Data.Zjkys - 0.1) {
                const dateval = new Date().getDate();
                if (dateval > 25 || dateval < 5) {
                    payAmount = assetsData.Data.Zjkys - assetsData.Data.Rzxf - assetsData.Data.Rqxf - assetsData.Data.Rzxf;
                } else {
                    payAmount = (assetsData.Data.Zjkys - 0.11).toFixed(2);
                }
            }

            payAmount = parseFloat(payAmount);
            if (payAmount <= 0) {
                logger.info('Invalid repayment amount:', payAmount);
                return;
            }

            // 提交还款请求
            const repaymentUrl = `${feng.jywg}MarginTrade/submitZjhk?validatekey=${validateKey}`;
            const repaymentFd = new FormData();
            repaymentFd.append('hbdm', 'RMB');
            repaymentFd.append('hkje', payAmount);
            repaymentFd.append('bzxx', ''); // 备注信息

            const repaymentResponse = await fetch(repaymentUrl, { method: 'POST', body: repaymentFd });
            const repaymentData = await repaymentResponse.json();

            if (repaymentData.Status === 0) {
                logger.info('Repayment success!', repaymentData.Data?.[0]?.Sjhkje ?? 'Unknown amount');
            } else {
                logger.info('Repayment failed:', repaymentData);
            }
        } catch (error) {
            logger.info('Repayment process failed:', error);
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {feng};
} else if (typeof window !== 'undefined') {
    window.feng = feng;
}
})();
