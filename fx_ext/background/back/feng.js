'use strict';
(function(){
const { guang } = xreq('./background/guang.js');

const feng = {
    quotewg: 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot',
    emklapi: 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56',
    emshszac: 'https://emhsmarketwg.eastmoneysec.com/api/SHSZQuery/GetCodeAutoComplete2?count=10&callback=sData&id=',
    gtimg: 'http://qt.gtimg.cn/q=',
    get sinahqapi() {
        return (guang.server ? `${guang.server}/fwd/sinahq/` : 'https://hq.sinajs.cn/') + `rn=${Date.now()}&list=`;
    },
    stkcache: new Map(),
    quoteCache: new Map(),
    loadSaved(cached) {
        for (const code in cached) {
            this.stkcache.set(code, cached[code]);
        }
    },
    dumpCached(intrested) {
        let holdcached = {};
        for (const [k, { name, code, mktcode, secid }] of this.stkcache.entries()) {
            if (intrested.includes(k)) {
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
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
        const s = await feng.getEmStcokInfo(code);
        this.stkcache.set(code, Object.assign(cached || {}, s));
        return s[k];
    },

    /**
    * 从cache中获取属性值，不存在则返回默认值
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'name'
    * @param {string} v 属性默认值
    * @returns {string} 获取的属性值
    */
    cachedStockGenSimple(code, k, v='') {
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
        return v;
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
        return this.cachedStockGenSimple(code, 'name');
    },

    /**
    * 获取缓存中股票价格相关的信息,主要用于涨停/跌停价查询.
    * @param {string} code 股票代码, 如: 002261
    * @param {string} k 属性名称, 如: 'zt'
    * @returns {string} 属性值
    */
    cachedStockPrcs(code, k) {
        const cached = this.stkcache.get(code);
        if (cached && cached[k]) {
            return cached[k];
        }
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

    resetCachedQuotes(codes) {
        codes.forEach(async (code) => {
            const qcode = guang.convertToQtCode(code);
            this.quoteCache.delete(qcode);
        });
    },
    async fetchStocksQuotes(codes, cacheTime=60000) {
        if (!codes || codes.length == 0) {
            return;
        }
        if (typeof codes == 'string') {
            codes = [codes];
        }
        for (let i = 0; i < codes.length; i++) {
            if (codes[i].length == 6) {
                codes[i] = await feng.getLongStockCode(codes[i]);
            }
        }
        if (codes.length < 800) {
            return this.fetchStocksQuotesBatch(codes, cacheTime);
        }
        for (let i = 0; i < codes.length; i += 800) {
            const batch = codes.slice(i, i + 800);
            this.fetchStocksQuotesBatch(batch, cacheTime);
        }
    },

    async fetchStocksQuotesBatch(codes, cacheTime=60000) {
        const slist = codes.map(code => guang.convertToQtCode(code)).filter(code =>code.length == 8).join(',');
        fetch(feng.sinahqapi + slist, {headers: { Referer: 'https://finance.sina.com.cn/'}}).then(r => r.text()).then(txt => {
            txt = txt.trim();
            if (txt.includes('Forbidden')) {
                throw new Error('sina quotes Forbidden!');
            }
            txt.split(';').forEach(async(q) => {
                const [hv, hq] = q.split('=');
                if (!hq) {
                    return;
                }
                const code = hv.split('_').slice(-1)[0];
                const vals = hq.split(',').map(v => v.trim());
                this.quoteCache.set(code, {
                    code: code.slice(2), name: vals[0], openPrice: vals[1], lastClose: vals[2],
                    latestPrice: vals[3], high: vals[4], low: vals[5],
                    buysells: {
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
                    },
                    expireTime: guang.snapshotExpireTime(cacheTime)
                });
            });
        }).catch(e => {
            console.error('Error fetching quotes from sina:', e);
            this.fetchStocksQuotesTencent(codes, cacheTime);
        });
    },
    async fetchStocksQuotesTencent(codes, cacheTime=60000) {
        for (let i = 0; i < codes.length; i += 60) {
            const batch = codes.slice(i, i + 60);
            const slist = batch.map(code => guang.convertToQtCode(code)).filter(c => c.length == 8).join(',');
            fetch(feng.gtimg + slist).then(r => r.text()).then(async(q) => {
                const qdata = q.split(';');
                for (let i = 0; i < qdata.length; i++) {
                    const q = qdata[i].split('~');
                    if (q.length < 2) {
                        continue;
                    }
                    let code = q[2];
                    const qcode = q[0].split('=')[0].split('_')[1];
                    this.quoteCache.set(qcode, {
                        code, name: q[1], latestPrice: q[3], zdf: q[32], openPrice: q[5], high: q[33], low: q[34],
                        lastClose: q[4], buysells: {
                            buy1: q[9], buy1_count: q[10],
                            buy2: q[11], buy2_count: q[12],
                            buy3: q[13], buy3_count: q[14],
                            buy4: q[15], buy4_count: q[16],
                            buy5: q[17], buy5_count: q[18],
                            sale1: q[19], sale1_count: q[20],
                            sale2: q[21], sale2_count: q[22],
                            sale3: q[23], sale3_count: q[24],
                            sale4: q[25], sale4_count: q[26],
                            sale5: q[27], sale5_count: q[28],
                        },
                        expireTime: guang.snapshotExpireTime(cacheTime)
                    });
                }
            }).catch(e => {
                console.error('Error fetching quotes from tencent:', e);
            });
        }
    },
    /**
    * 获取股票实时盘口数据, 包括最新价，开盘价，昨收价，涨停价，跌停价以及五档买卖情况，要获取涨停价跌停价不需要用本接口，可以直接计算。
    * @param {string} code 股票代码, 如: 002261
    * @returns {Promise<Object>} 返回 {name, latestPrice, openPrice, lastClose, topprice, bottomprice, buysells}
    */
    async getStockSnapshot(code) {
        const qcode = guang.convertToQtCode(code);
        const cached = this.quoteCache.get(qcode);
        if (cached && cached.expireTime > Date.now()) {
            return cached;
        }

        code = qcode.slice(-6);
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
            const expireTime = guang.snapshotExpireTime(1000);

            const cached = this.stkcache.get(code);
            if (!cached || !cached.lclose || !cached.lclose != lastClose) {
                this.stkcache.set(code, Object.assign(cached || {}, {name, zt:topprice, dt:bottomprice, lclose: lastClose}));
            }

            return expireTime > 0 ? { data, expireTime } : data;
        });
    },
    /**
    * 获取股票K线数据, 常用日K，1分， 15分
    * @param {string} code 股票代码, 如: 002261
    * @param {number} klt K线类型，101: 日k 102: 周k 103: 月k 104: 季k 105: 半年k 106:年k 60: 小时 120: 2小时, 其他分钟数 1, 5, 15,30
    * @param {string} date 用于大于日K的请求，设置开始日期如： 20201111
    * @returns {Promise<any>} 返回数据的 Promise
    */
    async getStockKline(code, klt, date) {
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
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {feng};
} else if (typeof window !== 'undefined') {
    window.feng = feng;
}
})();
