'use strict';
(function(){
const { guang } = xreq('./background/guang.js');

const feng = {
    quotewg: 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot',
    emklapi: 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56',
    etrendapi: 'http://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56&ut=fa5fd1943c7b386f172d6893dbfba10b&iscr=1&iscca=0',
    emshszac: 'https://emhsmarketwg.eastmoneysec.com/api/SHSZQuery/GetCodeAutoComplete2?count=10&callback=sData&id=',
    get gtimg() {
        return guang.server ? `${guang.server}/fwd/gtimg/q=` : 'http://qt.gtimg.cn/q=';
    },
    get sinahqapi() {
        return (guang.server ? `${guang.server}/fwd/sinahq/` : 'https://hq.sinajs.cn/') + `rn=${Date.now()}&list=`;
    },
    get zdfbapi() {
        return (guang.server ? `${guang.server}/fwd/empush2ex/` : 'https://push2ex.eastmoney.com/') + `getTopicZDFenBu?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&_=${Date.now()}`;
    },
    stock_basics: {},
    loadSaved(cached) {
        for (const code in cached) {
            const qcode = guang.convertToQtCode(code);
            this.stock_basics[qcode] = {...cached[code]};
        }
    },
    dumpCached(interested) {
        const holdcached = {};
        for (const k of interested) {
            const qcode = guang.convertToQtCode(k);
            if (this.stock_basics[qcode]) {
                const { name, code, mktcode, secid } = this.stock_basics[qcode];
                holdcached[k] = { name, code, mktcode, secid };
            }
        }
        return holdcached;
    },
    async getEmStcokInfo(code) {
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
    },

    /**
    * 从cache中获取属性值，不存在则从stockinfo获取
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'secid‘
    * @returns {string} 获取的属性值
    */
    async cachedStockGen(code, k) {
        const qcode = guang.convertToQtCode(code);
        const cached = this.stock_basics[qcode];
        if (cached && cached[k]) {
            return cached[k];
        }
        const s = await feng.getEmStcokInfo(code);
        this.stock_basics[qcode] = Object.assign(cached || {}, s);
        return s[k];
    },

    /**
    * 从cache中获取属性值，不存在则返回默认值
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'name'
    * @param {string} v 属性默认值
    * @returns {string} 获取的属性值
    */
    cachedStockGenSimple(code, k, v) {
        const qcode = guang.convertToQtCode(code);
        const cached = this.stock_basics[qcode];
        return (cached && cached[k]) ? cached[k] : v;
    },

    /**
    * 获取东方财富股票secid 如 002261 -> 2.002261
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} secid
    */
    async getStockSecId(code) {
        return this.cachedStockGen(code, 'secid');
    },

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
    async searchSecurity(code, params={}) {
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
        }).catch(e=>{
            if (guang.logger) {
                guang.logger.error('searchSecurity', e);
            } else {
                console.error('searchSecurity', e)
            }
        });
    },

    /**
    * 获取东方财富指数secid 如 000001 -> 1.000001 399001 -> 0.399001
    * @param {string} code 指数代码, 如: 000001
    * @returns {string} secid
    */
    async getIndexSecId(code) {
        return feng.searchSecurity(code, {classify: 'Index'}).then(data => data[0].secid);
    },

    /**
    * 获取股票的交易所信息 如 002261 -> SZ
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} 市场代码 SH|SZ|BJ
    */
    async getStockMktcode(code) {
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
    },

    /**
    * 获取股票的完整代码 如 002261 -> SZ002261
    * @param {string} code 股票代码, 如: 002261
    * @returns {string}
    */
    async getLongStockCode(code) {
        if (code.startsWith('S') || code.startsWith('BJ') || code == '') {
            return code;
        }

        return feng.getStockMktcode(code).then(mkt => {
            return mkt + code;
        });
    },

    /**
    * 获取缓存中股票的名称, 没有则返回空字符串.
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} 股票名称
    */
    getStockName(code) {
        return this.cachedStockGenSimple(code, 'name') ?? feng.stock_basics[guang.convertToQtCode(code)]?.secu_name;;
    },

    /**
    * 获取缓存中股票价格相关的信息,主要用于涨停/跌停价查询.
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'zt'
    * @returns {string} 属性值
    */
    cachedStockPrcs(code, k) {
        const qcode = guang.convertToQtCode(code);
        const cached = this.stock_basics[qcode];
        return cached ? cached[k] : undefined;
    },

    /**
    * 获取股票涨停价.
    * @param {string} code 股票代码, 如: 002261
    * @param {number} lclose 昨日收盘价
    * @returns {number} 涨停价
    */
    getStockZt(code, lclose=null) {
        let zt = this.cachedStockPrcs(code, 'zt');
        if (!zt) {
            const name = this.getStockName(code);
            try {
                zt = guang.calcZtPrice(lclose, guang.getStockZdf(code, name));
            } catch (e) {
                throw new Error('calcZtPrice in getStockZt!' + code);
            }
        }
        return zt;
    },

    /**
    * 获取股票跌停价.
    * @param {string} code 股票代码, 如: 002261
    * @param {number} lclose 昨日收盘价
    * @returns {number} 跌停价
    */
    getStockDt(code, lclose=null) {
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
    },

    /**
     * 通过验证码识别服务器的captcha api识别验证码
     * @param {string} captchaServer 验证码识别服务器网址
     * @param {string} base64Image 验证码图片的base64
     * @returns {Promise<string>} 识别的验证码
     */
    async recognizeCaptcha(captchaServer, base64Image) {
        if (!base64Image) {
            return;
        }

        const url = `${captchaServer}/api/captcha`;
        const formData = new FormData();
        formData.append('img', base64Image);

        try {
            const response = await fetch(url, {method: 'POST', body: formData});
            const text = await response.text();
            const replaceMap = {
                'g': '9', 'Q': '0', 'i': '1', 'D': '0', 'C': '0', 'u': '0',
                'U': '0', 'z': '7', 'Z': '7', 'c': '0', 'o': '0', 'q': '9'
            };
            return text.replace(/[gQiuDUZczqo]/g, m => replaceMap[m]);
        } catch (error) {
            throw new Error('Error recognizeCaptcha: ' + error.message);
        }
    },

    async fetchStocksQuotes(codes, cacheTime=60000) {
        if (!codes || codes.length == 0) {
            return;
        }
        if (typeof codes == 'string') {
            codes = [codes];
        }
        if (codes.length == 1) {
            return this.getStockSnapshot(codes[0]);
        }
        codes = codes.map(c => guang.convertToQtCode(c));
        if (codes.length <= 60) {
            return this.fetchStocksQuotesTencent(codes, cacheTime);
        }
        if (codes.length <= 800) {
            return this.fetchStocksQuotesBatch(codes, cacheTime);
        }
        for (let i = 0; i < codes.length; i += 800) {
            const batch = codes.slice(i, i + 800);
            this.fetchStocksQuotesBatch(batch, cacheTime);
        }
    },

    _apply_sina_quote_cache(qcode, vals, cacheTime) {
        const [name, openPrice, lastClose, latestPrice, high, low] = vals.slice(0, 6);
        const buysells = {
            buy1: vals[11], buy1_count: (vals[10]/100).toFixed(2),
            buy2: vals[13], buy2_count: (vals[12]/100).toFixed(2),
            buy3: vals[15], buy3_count: (vals[14]/100).toFixed(2),
            buy4: vals[17], buy4_count: (vals[16]/100).toFixed(2),
            buy5: vals[19], buy5_count: (vals[18]/100).toFixed(2),
            sale1: vals[21], sale1_count: (vals[20]/100).toFixed(2),
            sale2: vals[23], sale2_count: (vals[22]/100).toFixed(2),
            sale3: vals[25], sale3_count: (vals[24]/100).toFixed(2),
            sale4: vals[27], sale4_count: (vals[26]/100).toFixed(2),
            sale5: vals[29], sale5_count: (vals[28]/100).toFixed(2)
        };
        const change_px = latestPrice - lastClose;
        const change = change_px / lastClose;
        const zdf = change * 100;
        const preclose_px = lastClose;
        const expireTime = guang.snapshotExpireTime(cacheTime);
        const code = qcode.slice(-6);
        const up_price = guang.calcZtPrice(lastClose, guang.getStockZdf(code, name));
        const down_price = guang.calcDtPrice(lastClose, guang.getStockZdf(code, name));
        const sdata = {
            code, name, openPrice, lastClose, latestPrice, high, low, buysells, zdf,
            secu_name: name,
            secu_code: guang.convertToSecu(code),
            last_px: latestPrice, up_price, down_price, topprice: up_price, bottomprice: down_price,
            preclose_px, change_px, change, expireTime,
        };
        if (!this.stock_basics[qcode]) {
            this.stock_basics[qcode] = sdata;
        } else {
            Object.assign(this.stock_basics[qcode], sdata);
        }
    },
    async fetchStocksQuotesBatch(codes, cacheTime=60000) {
        const slist = codes.map(code => guang.convertToQtCode(code)).filter(code =>code.length == 8).join(',');
        try {
            const rsp = await fetch(feng.sinahqapi + slist, {headers: { Referer: 'https://finance.sina.com.cn/'}});
            let txt = guang.decodeString(await rsp.arrayBuffer(), rsp.headers.get('content-type'));
            txt = txt.trim();
            if (txt.includes('Forbidden')) {
                throw new Error('sina quotes Forbidden!');
            }
            txt.split(';').forEach(async(q) => {
                q = q.replaceAll('"', '');
                const [hv, hq] = q.split('=');
                if (!hq) {
                    return;
                }
                const code = hv.split('_').slice(-1)[0];
                const vals = hq.split(',').map(v => v.trim());
                this._apply_sina_quote_cache(code, vals, cacheTime);
            });
        } catch (e) {
            if (guang.logger) {
                guang.logger.error('Error fetching quotes from sina:', e);
            } else {
                console.error('Error fetching quotes from sina:', e);
            }
            await this.fetchStocksQuotesTencent(codes, cacheTime);
        }
    },

    _apply_tencent_quote_cache(qcode, vals, cacheTime) {
        let code = vals[2];
        const sdata = {
            code, name: vals[1], latestPrice: vals[3], zdf: vals[32], openPrice: vals[5], high: vals[33], low: vals[34],
            lastClose: vals[4], buysells: {
                buy1: vals[9], buy1_count: vals[10],
                buy2: vals[11], buy2_count: vals[12],
                buy3: vals[13], buy3_count: vals[14],
                buy4: vals[15], buy4_count: vals[16],
                buy5: vals[17], buy5_count: vals[18],
                sale1: vals[19], sale1_count: vals[20],
                sale2: vals[21], sale2_count: vals[22],
                sale3: vals[23], sale3_count: vals[24],
                sale4: vals[25], sale4_count: vals[26],
                sale5: vals[27], sale5_count: vals[28],
            },
            secu_name: vals[1],
            secu_code: guang.convertToSecu(code),
            last_px: vals[3],
            preclose_px: vals[4],
            change_px: vals[31],
            change: vals[32]/100,
            up_price: vals[47],
            down_price: vals[48],
            expireTime: guang.snapshotExpireTime(cacheTime)
        };
        if (!this.stock_basics[qcode]) {
            this.stock_basics[qcode] = sdata;
        } else {
            Object.assign(this.stock_basics[qcode], sdata);
        }
    },
    async fetchStocksQuotesTencent(codes, cacheTime=60000) {
        for (let i = 0; i < codes.length; i += 60) {
            const batch = codes.slice(i, i + 60);
            const slist = batch.map(code => guang.convertToQtCode(code)).filter(c => c.length == 8).join(',');
            try {
                const rsp = await fetch(feng.gtimg + slist)
                const q = guang.decodeString(await rsp.arrayBuffer(), rsp.headers.get('content-type'));
                const qdata = q.split(';');
                for (let i = 0; i < qdata.length; i++) {
                    const q = qdata[i].split('~');
                    if (q.length < 2) {
                        continue;
                    }
                    const qcode = q[0].split('=')[0].split('_')[1];
                    this._apply_tencent_quote_cache(qcode, q, cacheTime);
                }
            } catch (e) {
                if (guang.logger) {
                    guang.logger.error('Error fetching quotes from tencent:', e);
                } else {
                    console.error('Error fetching quotes from tencent:', e);
                }
            }
        }
    },
    /**
    * 获取股票实时盘口数据, 包括最新价，开盘价，昨收价，涨停价，跌停价以及五档买卖情况，要获取涨停价跌停价不需要用本接口，可以直接计算。
    * @param {string} code 股票代码, 如: 002261
    * @returns {Promise<Object>} 返回 {name, latestPrice, openPrice, lastClose, topprice, bottomprice, buysells}
    */
    async getStockSnapshot(code) {
        const qcode = guang.convertToQtCode(code);
        const cached = this.stock_basics[qcode];
        if (cached && cached.expireTime > Date.now()) {
            return cached;
        }

        code = qcode.slice(-6);
        const url = feng.quotewg + '?id=' + code + '&callback=?';
        const snapshot = await fetch(url).then(r => r.json())
        const { name, topprice, bottomprice,
            realtimequote: { currentPrice: latestPrice, date, zdf },
            fivequote: { openPrice, yesClosePrice: lastClose, ...fivequote },
        } = snapshot;

        const buysells = Object.fromEntries(
            Object.entries(fivequote).filter(([key]) => key.startsWith('buy') || key.startsWith('sale'))
        );

        const change = zdf.replace('%', '') / 100;
        this.stock_basics[qcode] = {
            code, name, latestPrice, zdf, openPrice, lastClose, topprice, bottomprice, buysells,
            change,
            secu_name: name,
            secu_code: guang.convertToSecu(code),
            last_px: latestPrice,
            preclose_px: lastClose,
            change_px: latestPrice - lastClose,
            up_price: topprice,
            down_price: bottomprice,
            expireTime: guang.snapshotExpireTime(1000)
        };
        return this.stock_basics[qcode];
    },
    /**
    * 获取股票K线数据, 常用日K，1分，15分
    * @param {string} code 股票代码, 如: 002261
    * @param {number} klt K线类型，101: 日k 102: 周k 103: 月k 104: 季k 105: 半年k 106:年k 60: 小时 120: 2小时, 其他分钟数 1, 5, 15,30
    * @param {string} date 用于大于日K的请求，设置开始日期如： 20201111
    * @returns {Promise<any>} 返回数据的 Promise
    */
    async getStockKline(code, klt, date) {
        if (!klt) {
            klt = '101';
        }
        // if (klt == 1) {
        //     return feng.getStockMinutesKline(code, 1, 60000);
        // }
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
        let url = this.emklapi + '&klt=' + klt + '&secid=' + secid + '&beg=' + beg + '&end=20500000';
        let cacheTime = klt - 15 < 0 || klt % 30 == 0 ? klt * 60000 : 24*60*60000;
        return guang.fetchData(url, {}, cacheTime, klrsp => {
            const code = klrsp.data.code;
            const kdata = klrsp.data.klines.map(kl => {
                const [time,o,c,h,l,v,prc,pc] = kl.split(',');
                return {time, o, c, h, l, v, prc, pc};
            });
            kdata.forEach((kl, i) => {
                if (i === 0) {
                    kl.prc = kl.prc || 0;
                    kl.pc = kl.pc || 0;
                } else {
                    if (!kl.prc) {
                        kl.prc = (kl.c - kdata[i - 1].c).toFixed(3);
                        kl.pc = (kl.prc * 100 / kdata[i - 1].c).toFixed(2);
                    }
                }
            });

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

            let kl0 = kdata.slice(-1)[0];
            if (!kl0) {
                return null;
            }
            let data = {code, kltype: klt, kdata};
            return {data, expireTime: getExpireTime(kl0.time, klt)};
        });
    },

    /**
     * 获取股票1分钟K线数据, 默认cache 24小时，盘前盘后使用
     * @param {string} code - The stock code.
     * @param {number} [days=2] - 天数, 最多可以获取5天.
     */
    async getStockMinutesKline(code, days=2, cacheTime=24*60*60000) {
        const secid = await this.getStockSecId(code);
        const url = this.etrendapi + `&secid=${secid}&ndays=${days}`;
        return guang.fetchData(url, {}, cacheTime, rsp => {
            const kdata = rsp.data.trends.map(kl => {
                const [time,o,c,h,l,v] = kl.split(',');
                return {time, o, c, h, l, v};
            });
            for (let i = 1; i < kdata.length; i++) {
                if (!kdata[i].o || kdata[i].o == 0) {
                    kdata[i].o = kdata[i - 1].c;
                }
            }
            return {data: {code, kltype:'1', kdata: kdata.filter(k => !k.time.endsWith('09:30'))}};
        });
    },
    async getStockBasics (stocks) {
        if (typeof stocks === 'string') {
            const qcode = guang.convertToQtCode(stocks);
            await this.updateStockBasicsTencent([qcode]);
            if (!this.stock_basics[qcode]) {
                await this.updateStockBasicsEm([qcode]);
            }
            return this.stock_basics[qcode];
        }

        if (stocks.length === 0) {
            return {};
        }
        const qcodes = stocks.map(s => guang.convertToQtCode(s));
        await this.updateStockBasicsTencent(qcodes);
        const failed = qcodes.filter(s => !this.stock_basics[s]);
        if (failed.length > 0) {
            await this.updateStockBasicsEm(failed);
        }
        return Object.fromEntries(stocks.map(s => [s, this.stock_basics[guang.convertToQtCode(s)]]));
    },
    get clsworks() {
        if (this._clsworks === undefined) {
            if (!guang.server) {
                this._clsworks = false;
                this.checkClsWorks();
                return false;
            }
            return false;
        }
        return this._clsworks;
    },
    async checkClsWorks() {
        return fetch(guang.server + 'fwd/clsquote/quote/stock/closest_trading_day').then(r => r.json()).then(d => {
            this._clsworks = Boolean(d && d.data);
            return this._clsworks;
        });
    },
    async updateStockBasics (stocks) {
        stocks = stocks.filter(s => !this.stock_basics[guang.convertToQtCode(s)] || this.stock_basics[guang.convertToQtCode(s)].expireTime < Date.now());
        if (stocks.length === 0) {
            return;
        }

        const psize = 100;
        let fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        for (let i = 0; i < stocks.length; i += psize) {
            const group = stocks.slice(i, i + psize).map(s => guang.convertToSecu(s));
            const fUrl = guang.server + `fwd/clsquote/quote/stocks/basic?app=CailianpressWeb&fields=${fields}&os=web&secu_codes=${group.join(',')}&sv=8.4.6`;
            const bdata = await fetch(fUrl).then(r => r.json()).then(d => d.data);
            for (const s in bdata) {
                const qcode = guang.convertToQtCode(s);
                this.stock_basics[qcode] = bdata[s];
                this.stock_basics[qcode].expireTime = guang.snapshotExpireTime() ;
            }
        }
    },
    async updateStockBasicsTencent(stocks) {
        stocks = stocks.filter(s => !this.stock_basics[guang.convertToQtCode(s)] || this.stock_basics[guang.convertToQtCode(s)].expireTime < Date.now());
        if (stocks.length === 0) {
            return;
        }

        await this.fetchStocksQuotesTencent(stocks);
    },
    async updateStockBasicsEm(stocks) {
        stocks = stocks.filter(s => !this.stock_basics[guang.convertToQtCode(s)] || this.stock_basics[guang.convertToQtCode(s)].expireTime < Date.now());
        if (stocks.length === 0) {
            return;
        }
        const secs = [];
        for (const s of stocks) {
            let sec = s.replaceAll('SH', '1.').replaceAll('sh', '1.').replaceAll('sz', '0.').replaceAll('SZ', '0.');
            if (sec.endsWith('.BJ') || sec.startsWith('BJ')) {
                sec = '0.' + sec.substring(0, 6);
            }
            secs.push(sec);
        }
        const scodes = secs.join(',');
        const qurl = guang.server + `fwd/empush2qt/ulist.np/get?fltt=2&secids=${scodes}&fields=f2,f3,f4,f12,f13,f14,f18`;
        const emdata = await fetch(qurl).then(r => r.json()).then(d=>d?.data?.diff);
        if (!emdata) {
            return;
        }
        for (const {f2: last_px, f3: change, f4: change_px, f12: code, f13:mkt, f14:secu_name, f18: preclose_px} of emdata) {
            let qcode = guang.convertToQtCode(['SZ','SH'][mkt] + code);
            this.stock_basics[qcode] = {last_px, change: change/100, change_px, secu_code: qcode, secu_name, preclose_px};
            const zdf = guang.getStockZdf(code, secu_name);
            this.stock_basics[qcode].up_price = guang.calcZtPrice(preclose_px, zdf);
            this.stock_basics[qcode].down_price = guang.calcDtPrice(preclose_px, zdf);
            this.stock_basics[qcode].expireTime = guang.snapshotExpireTime();
        }
    },
    async getIndiceRtInfo(indices) {
        if (!guang.server) {
            throw new Error('getIndiceRtInfo: guang.server is not set!');
        }
        let emo = null;
        if (this.clsworks) {
            const iparam = `app=CailianpressWeb&fields=secu_name,secu_code,trade_status,change,change_px,last_px&os=web&secu_codes=${indices}&sv=8.4.6`;
            var fUrl = guang.server + `fwd/clsquote/quote/stocks/basic?${iparam}`;
            emo = await fetch(fUrl).then(r => r.json());
            emo = emo?.data;
        }
        if (!emo) {
            await this.updateStockBasicsEm(indices);
            emo = Object.fromEntries(indices.map(s => [s, this.stock_basics[guang.convertToQtCode(s)]]));
        }
        return emo;
    },
    async getZdFenbu() {
        let emo = null;
        const emparam = 'app=CailianpressWeb&os=web&sv=8.4.6';
        var fUrl = guang.server + 'fwd/clsquote/v2/quote/a/stock/emotion?' + emparam;
        if (!this.clsworks) {
            fUrl = 'https://x-quote.cls.cn/v2/quote/a/stock/emotion?' + emparam;
            fUrl = guang.dserver + 'api/get?url=' + btoa(fUrl) + '&host=x-quote.cls.cn&referer=https://www.cls.cn/';
        }
        emo = await fetch(fUrl).then(r => r.json());
        emo = emo?.data;
        if (!emo) {
            // https://quote.eastmoney.com/ztb/
            let zdfbarr = await fetch(this.zdfbapi).then(r => r.json()).then(d => d?.data?.fenbu);
            let zdfb = {};
            zdfbarr.forEach(o => Object.assign(zdfb, o));
            emo = {};
            emo.up_down_dis = {
                up_num: zdfb[11], up_10: zdfb[9] + zdfb[10], up_8: zdfb[7]+zdfb[8], up_6: zdfb[5] + zdfb[6],
                up_4: zdfb[3] + zdfb[4], up_2: zdfb[1] + zdfb[2], flat_num: zdfb[0], down_2: zdfb['-1'] + zdfb['-2'],
                down_4: zdfb['-3'] + zdfb['-4'], down_6: zdfb['-5'] + zdfb['-6'], down_8: zdfb['-7']+zdfb['-8'],
                down_10: zdfb['-9'] + zdfb['-10'], down_num: zdfb['-11']
            };
            emo.up_down_dis.rise_num = emo.up_down_dis.up_num + emo.up_down_dis.up_10 + emo.up_down_dis.up_8 + emo.up_down_dis.up_6 +
                emo.up_down_dis.up_4 + emo.up_down_dis.up_2;
            emo.up_down_dis.fall_num = emo.up_down_dis.down_num + emo.up_down_dis.down_10 + emo.up_down_dis.down_8 + emo.up_down_dis.down_6 +
                emo.up_down_dis.down_4 + emo.up_down_dis.down_2;
            emo.up_down_dis.suspend_num = '-';
            emo.shsz_balance = 0; // 总成交额
            emo.shsz_balance_change_px = 0; // 较上日
            emo.up_ratio_num = zdfb[11]; // 涨停个股
            emo.up_open_num = 0; // 开板数
            emo.up_ratio = 0; // 封板率
        }
        return emo;
    },
    async getClsPlatesRanking() {
        const pways = ['change', 'limit_up_num', 'main_fund_diff'];
        const pparam = 'app=CailianpressWeb&os=web&page=1&rever=1&sv=8.4.6&type=concept&way=';
        var plates = {};
        for (let w of pways) {
            let url = '';
            if (this.clsworks) {
                url = guang.server + 'fwd/clsquote/web_quote/plate/plate_list?' + pparam + w;
            } else {
                const ourl = 'https://x-quote.cls.cn/web_quote/plate/plate_list?' + pparam + w;
                url = guang.dserver + 'api/get?url=' + btoa(ourl) + '&host=x-quote.cls.cn&referer=https://www.cls.cn/';
            }

            const pl = await (await fetch(url)).json();
            if (pl?.data?.plate_data) {
                for (const secu of pl.data.plate_data) {
                    plates[secu.secu_code] = secu;
                }
            }
        }
        return plates;
    },
    async getStockTlineCls(code) {
        const secu_code = guang.convertToSecu(code);
        const tparams = `app=CailianpressWeb&fields=date,minute,last_px,business_balance,business_amount,open_px,preclose_px,av_px&os=web&secu_code=${secu_code}&sv=8.4.6`
        var fUrl = guang.server + `fwd/clsquote/quote/stock/tline?${tparams}`;
        if (!this.clsworks) {
            fUrl = 'https://x-quote.cls.cn/quote/stock/tline?' + tparams;
            fUrl = guang.dserver + 'api/get?url=' + btoa(fUrl) + '&host=x-quote.cls.cn&referer=https://www.cls.cn/';
        }
        return fetch(fUrl).then(r => r.json()).then(d => d?.data);
    },
    async getStockTlinesCls(codes) {
        if (typeof codes == 'string') {
            return this.getStockTlineCls(codes);
        }
        if (codes.length == 0) {
            return {};
        }
        codes = codes.map(c => guang.convertToSecu(c));
        const psize = 100;
        const tlines = {};
        for (let i = 0; i < codes.length; i += psize) {
            let group = codes.slice(i, i + psize);
            const tparams = `app=CailianpressWeb&os=web&secu_codes=${group.join(',')}&sv=8.4.6`;
            var fUrl = guang.server + `fwd/clsquote/quote/index/tlines?${tparams}`;
            if (!this.clsworks) {
                fUrl = 'https://x-quote.cls.cn/quote/index/tlines?' + tparams;
                fUrl = guang.dserver + 'api/get?url=' + btoa(fUrl) + '&host=x-quote.cls.cn&referer=https://www.cls.cn/';
            }
            Object.assign(tlines, (await fetch(fUrl).then(r => r.json())).data);
        }
        return tlines;
    },
    async getStockChanges(stocks, options = {}) {
        // 60日新高,火箭发射, 大笔买入, 大笔卖出, 有大买盘, 有大卖盘, 封涨停板, 打开涨停板
        const { types = '8213,8201,8193,8194,64,128,4,16'} = options;
        this.pageSize = this.pageSize ?? 1000;
        this.currentPage = 0;
        this.fetchedStocks = [];
        if (!this.processedChangeKeys) {
            this.processedChangeKeys = new Set();
        }
        if (!this.fullChanges) {
            this.fullChanges = [];
        }

        await this.fetchNextPage(types);
        if (this.fetchedStocks.length < this.pageSize) {
            if (this.fetchedStocks.length > 0 || this.fullChanges.length > 0) {
                self.pageSize = Math.max(64, this.fetchedStocks.length)
            }
        }

        if (stocks && stocks.length > 0) {
            stocks = stocks.map(s => guang.convertToQtCode(s).slice(-6));
            return this.fetchedStocks.filter(f => stocks.includes(f[0]));
        }
        return this.fetchedStocks;
    },

    async fetchNextPage(types) {
        try {
            const url = `http://push2ex.eastmoney.com/getAllStockChanges?type=${types}&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex=${this.currentPage}&pagesize=${this.pageSize}&dpt=wzchanges`;
            const response = await fetch(url, {
                headers: {
                    Host: 'push2ex.eastmoney.com',
                    Referer: 'http://quote.eastmoney.com/changes/',
                },
            });
            const { data } = await response.json();
            if (!data?.allstock) return;

            if (this.mergeFetched(data.allstock) > 0 && data.allstock.length >= this.pageSize) {
                this.currentPage++;
                await this.fetchNextPage(types);
            }
        } catch (error) {
            if (guang.logger) {
                guang.logger.error('Fetch failed:', error);
            } else {
                console.error('Fetch failed:', error);
            }
        }
    },

    VALID_PREFIXES: ['00', '60', '30', '68', '83', '87', '43', '92', '90'],
    mergeFetched(changes) {
        const date = guang.getTodayDate('-');
        let changesCount = 0;
        for (const chg of changes) {
            const code = chg['c'] || '';
            if (!this.VALID_PREFIXES.includes(code.slice(0, 2))) continue;

            const tm = String(chg['tm'] || '').padStart(6, '0');
            const timeStr = `${tm.slice(0, 2)}:${tm.slice(2, 4)}:${tm.slice(4, 6)}`;
            const key = `${code},${timeStr},${chg['t']}`;

            if (!this.processedChangeKeys.has(key)) {
                this.fetchedStocks.push([code, timeStr, chg['t'], chg['i']]);
                this.fullChanges.push([code, `${date} ${timeStr}`, chg['t'], chg['i']]);
                this.processedChangeKeys.add(key);
                changesCount++;
            }
        }
        return changesCount;
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {feng};
} else if (typeof window !== 'undefined') {
    window.feng = feng;
}
})();
