'use strict';
(function(){
const { guang } = xreq('./background/guang.js');

class feng {
    constructor() {
        throw new Error('Cannot instantiate StaticClass');
    }

    static jywg = 'https://jywg.eastmoneysec.com/'; //'https://jywg.18.cn/';
    static quotewg = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot';
    static emklapi = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56';
    static emshszac = 'https://emhsmarketwg.eastmoneysec.com/api/SHSZQuery/GetCodeAutoComplete2?count=10&callback=sData&id='


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
                if (!lclose) {
                    lclose = emjyBack.klines[code].getKline('101').slice(-1)[0].c;
                }
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
                if (!lclose) {
                    lclose = emjyBack.klines[code].getKline('101').slice(-1)[0].c;
                }
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

    /**
    * 获取股票K线数据, 常用日K，1分， 15分
    * @param {string} code 股票代码, 如: 002261
    * @param {number} klt K线类型，101: 日k 102: 周k 103: 月k 104: 季k 105: 半年k 106:年k 60: 小时 120: 2小时, 其他分钟数 1, 5, 15,30
    * @param {string} date 用于大于日K的请求，设置开始日期如： 20201111
    * @returns {Promise<any>} 返回数据的 Promise
    */
    static async getStockKline(code, klt, date) {
        if (!klt) {
            klt = '101';
        }
        let secid = await feng.getStockSecId(code);
        let beg = 0;
        if (klt == '101') {
            beg = date;
            if (!beg) {
                beg = new Date();
                beg = new Date(beg.setDate(beg.getDate() - 30));
                beg = beg.toLocaleString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, '')
            } else if (date.includes('-')) {
                beg = date.replaceAll('-', '');
            }
        }
        let url = feng.emklapi + '&klt=' + klt + '&secid=' + secid + '&beg=' + beg + '&end=20500000';
        let cacheTime = klt - 15 < 0 || klt % 30 == 0 ? klt * 60000 : 24*60*60000;
        return guang.fetchData(url, {}, cacheTime, klrsp => {
            let code = klrsp.data.code;
            if (!emjyBack.klines[code]) {
                emjyBack.klines[code] = new KLine(code);
            }
            let updatedKlt = emjyBack.klines[code].updateRtKline({kltype: klt, kline: klrsp});
            let kl0 = emjyBack.klines[code].getLatestKline(klt);
            const getExpireTime = function(kltime, kltype) {
                const currentDate = new Date();
                const [year, month, day] = [currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()]
                const createTime = (h, m, s = 0, dd = 0) => new Date(year, month, day + dd, h, m, s);

                const amStart = createTime(9, 30);   // 上午开盘时间
                const amEnd = createTime(11, 30);    // 上午收盘时间
                const pmStart = createTime(13, 0);   // 下午开盘时间
                const pmEnd = createTime(15, 0);     // 下午收盘时间

                let klDate = new Date(kltime);
                if (kltype - 15 > 0 && kltype % 30 !== 0) {
                    klDate = new Date(kltime + ' 15:00');
                }

                if (klDate < currentDate) {
                    return amStart > currentDate ? amStart : createTime(9, 30, 0, 1); // 下一天的上午开盘时间
                }

                if (kltype - 15 > 0 && kltype % 30 !== 0) {
                    if (currentDate < createTime(14, 50)) {
                        return createTime(14, 50); // 尾盘更新
                    }
                    return currentDate < pmEnd ? pmEnd : createTime(9, 30, 0, 1); // 下午收盘时间或第二天开盘时间
                }

                if (currentDate < amStart) {
                    return amStart; // 上午开盘时间
                }

                const kLineInterval = kltype;
                const nextDate = new Date(Math.ceil(klDate.getTime() / (kLineInterval * 60000)) * kLineInterval * 60000);

                if (currentDate >= amStart && currentDate < amEnd) {
                    return nextDate < amEnd ? nextDate : amEnd;
                }
                if (currentDate >= pmStart && currentDate < pmEnd) {
                    return nextDate < pmEnd ? nextDate : pmEnd;
                }
                if (currentDate >= amEnd && currentDate < pmStart) {
                    return pmStart;
                }
                if (currentDate >= pmEnd) {
                    return createTime(9, 30, 0, 1); // 下一天的上午开盘时间
                }
            };

            let data = Object.fromEntries(updatedKlt.map(x => [x, emjyBack.klines[code].klines[x]]));
            return {data, expireTime: getExpireTime(kl0.time, klt)};
        });
    }

    static async buyNewStocks() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no valid validateKey', emjyBack.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetCanBuyNewStockListV3?validatekey=${emjyBack.validateKey}`;
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
                    emjyBack.log('buyNewStocks', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${emjyBack.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        emjyBack.log('buyNewStocks success', robjPost.Message);
                    } else {
                        emjyBack.log('buyNewStocks error', robjPost);
                    }
                } else {
                    emjyBack.log('buyNewStocks no new stocks to buy!');
                }
            } else {
                emjyBack.log(JSON.stringify(robj));
            }
        } catch (error) {
            console.error('Error in buyNewStocks:', error);
        }
    }

    static async buyNewBonds() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no valid validateKey', emjyBack.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetConvertibleBondListV2?validatekey=${emjyBack.validateKey}`;
        try {
            const response = await fetch(url, { method: 'POST' });
            const robj = await response.json();

            if (robj.Status !== 0) {
                emjyBack.log('unknown error', robj);
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
                    emjyBack.log('buyNewBonds', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${emjyBack.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        emjyBack.log('buyNewBonds success', robjPost.Message);
                    } else {
                        emjyBack.log('buyNewBonds error', robjPost);
                    }
                } else {
                    emjyBack.log('buyNewBonds no new bonds to buy!');
                }
            } else {
                emjyBack.log('no new bonds', JSON.stringify(robj));
            }
        } catch (error) {
            console.error('Error in buyNewBonds:', error);
        }
    }


    static async buyBondRepurchase(code) {
        if (!emjyBack.validateKey) {
            emjyBack.log('No valid validateKey');
            return;
        }

        try {
            // 获取最新价格
            const priceData = await feng.getStockSnapshot(code);
            let price = priceData.latestPrice;
            price = priceData.buysells.buy5 === '-' ? priceData.bottomprice : priceData.buysells.buy5;

            // 获取可操作数量
            const amountUrl = `${feng.jywg}Com/GetCanOperateAmount?validatekey=${emjyBack.validateKey}`;
            const amountFd = new FormData();
            amountFd.append('stockCode', code);
            amountFd.append('price', price);
            amountFd.append('tradeType', '0S');

            const amountResponse = await fetch(amountUrl, { method: 'POST', body: amountFd });
            const amountData = await amountResponse.json();

            if (amountData.Status !== 0 || !amountData.Data || amountData.Data.length === 0 || amountData.Data[0].Kczsl <= 0) {
                emjyBack.log('No enough funds to repurchase', JSON.stringify(amountData));
                return;
            }

            const count = amountData.Data[0].Kczsl;

            // 进行国债逆回购交易
            const repurchaseUrl = `${feng.jywg}BondRepurchase/SecuritiesLendingRepurchaseTrade?validatekey=${emjyBack.validateKey}`;
            const repurchaseFd = new FormData();
            repurchaseFd.append('zqdm', code);
            repurchaseFd.append('rqjg', price);
            repurchaseFd.append('rqsl', count);

            emjyBack.log('Executing bond repurchase:', code, price, count);
            const repurchaseResponse = await fetch(repurchaseUrl, { method: 'POST', body: repurchaseFd });
            const repurchaseData = await repurchaseResponse.json();

            if (repurchaseData.Status === 0 && repurchaseData.Data && repurchaseData.Data.length > 0) {
                emjyBack.log('Repurchase successful!', JSON.stringify(repurchaseData));
            } else {
                emjyBack.log('Repurchase failed:', JSON.stringify(repurchaseData));
            }
        } catch (error) {
            emjyBack.log('Error in bond repurchase process:', error);
        }
    }

    static async repayMarginLoan() {
        const validateKey = emjyBack.validateKey;
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
                emjyBack.log('Failed to fetch assets:', assetsData);
                return;
            }

            // 计算待还款金额
            const total = -(-assetsData.Data.Rzfzhj - assetsData.Data.Rqxf);
            if (total <= 0 || assetsData.Data.Zjkys - 1 < 0) {
                emjyBack.log('待还款金额:', total, '可用金额:', assetsData.Data.Zjkys);
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
                emjyBack.log('Invalid repayment amount:', payAmount);
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
                emjyBack.log('Repayment success!', repaymentData.Data?.[0]?.Sjhkje ?? 'Unknown amount');
            } else {
                emjyBack.log('Repayment failed:', repaymentData);
            }
        } catch (error) {
            emjyBack.log('Repayment process failed:', error);
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {feng};
} else if (typeof window !== 'undefined') {
    window.feng = feng;
}
})();
