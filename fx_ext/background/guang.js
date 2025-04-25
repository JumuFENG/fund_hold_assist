'use strict';
(function(){
const guang = {
    cache: new Map(),
    server: null, // for reverse proxy;
    dserver: null, // for data service;
    logger: null,
    get tradedayurl() {
        return (this.server ? this.server + 'fwd/ssejs/' : 'http://www.sse.com.cn/js/') + 'common/systemDate_global.js';
    },

    /**
    * 生成缓存的唯一键：URL + 查询参数
    * @param {string} url 请求的 URL
    * @param {Object} params 请求的查询参数
    * @returns {string} 缓存的唯一键
    */
    buildParams(url, params) {
        return Object.keys(params).length > 0 ? `${url}?${new URLSearchParams(params)}` : url;
    },

    /**
    * 发送 GET 请求并进行缓存
    * @param {string} url 请求地址
    * @param {Object} params 请求的查询参数
    * @param {number} cacheTime 缓存时间（毫秒）
    * @param {Function} dataFilter 数据过滤函数，用来解析和过滤数据
    * @returns {Promise<any>} 返回数据的 Promise
    */
    async fetchData(url, params = {}, cacheTime = 5000, dataFilter = null) {
        const cacheKey = this.buildParams(url, params);
        const cacheEntry = this.cache.get(cacheKey);

        // 如果缓存存在，并且数据仍然有效，则直接返回
        if (cacheEntry && Date.now() < cacheEntry.expireTime) {
            return cacheEntry.data;
        }

        const requestPromise =
        fetch(this.buildParams(url, params))
        .then(r => r.headers.get('content-type')?.includes('application/json')
            ? r.json()
            : r.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch {
                    return text;
                }
            })
        )
        .then(data => {
            if (dataFilter) {
                // 使用 dataFilter 解析和验证数据
                const filteredResult = dataFilter(data);
                if (!filteredResult) {
                    return null; // 如果数据无效，则不缓存
                }
                let filteredData = filteredResult.data ?? filteredResult;
                let expireTime = filteredResult.expireTime ?? Date.now() + cacheTime;
                this.cache.set(cacheKey, { data: filteredData, expireTime});
                return filteredData;
            }

            this.cache.set(cacheKey, { data: Promise.resolve(data), expireTime: Date.now() + cacheTime });
            return data;
        }).catch(error => {
            this.cache.delete(cacheKey); // 失败时删除缓存
            if (this.logger) {
                this.logger.error(`Error fetching data from ${url}`, error);
                this.logger.error(`${error.stack}`);
            } else {
                console.error(`Error fetching data from ${url}: ${error}`);
            }
        });

        this.cache.set(cacheKey, { data: requestPromise, expireTime: Date.now() + cacheTime }); // 缓存 Promise
        return requestPromise;
    },

    /**
    * 根据代码获取股票的涨跌停幅度
    * @param {string} code 代码
    * @param {string} name 名称，用于判断是否ST
    * @returns {int} 返回涨停/跌停幅度
    */
    getStockZdf(code, name='') {
        if (isNaN(code)) {
            code = code.replace(/[a-zA-Z\.]+/, '');
        }
        if (code.startsWith('68') || code.startsWith('30')) {
            return 20;
        }
        if (code.startsWith('60') || code.startsWith('00')) {
            if (name?.includes('S')) {
                return 5;
            }
            return 10;
        }
        return 30;
    },

    /**
    * 根据昨天收盘价及涨跌幅限制计算今日涨停价
    * @param {number} lclose 昨日收盘价
    * @param {number} zdf 涨停幅度 5/10/20/30
    * @returns {number} 返回涨停价
    */
    calcZtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.floor(lclose * 130) / 100;
        }
        return Math.round(lclose * 100 + lclose * zdf + 0.00000001) / 100;
    },

    /**
    * 根据昨天收盘价及涨跌幅限制计算今日跌停价
    * @param {number} lclose 昨日收盘价
    * @param {number} zdf 跌停幅度 5/10/20/30
    * @returns {number} 返回跌停价
    */
    calcDtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.ceil(lclose * 70) / 100;
        }
        return Math.round(lclose * 100 - lclose * zdf + 0.00000001) / 100;
    },

    /**
    * 今日日期的字符串形式
    * @param {string} sep 间隔符号
    * @returns {string}
    */
    getTodayDate(sep = '') {
        return new Date().toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, sep);
    },

    /**
    * 日期转字符串形式
    * @param {Date} dt 日期
    * @param {string} sep 间隔符号
    * @returns {string}
    */
    dateToString(dt, sep = '') {
        return dt.toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, sep);
    },

    /**
    * 计算股数, 1手为100股
    * @param {number} amount 金额
    * @param {number} price 股价
    * @returns {number} 股数(整百股)
    */
    calcBuyCount(amount, price) {
        var ct = (amount / 100) / price;
        if (amount - price * Math.floor(ct) * 100 - (price * Math.ceil(ct) * 100 - amount) > 0) {
            return 100 * Math.ceil(ct);
        }
        return ct > 1 ? 100 * Math.floor(ct) : 100;
    },

    /**
     * decode ArrayBuffer to string according to content type with charset
     * @param {ArrayBuffer} buf data buffer
     * @param {string} contentType content type, e.g. 'application/javascript; charset=GB18030', 'text/html; charset=GBK'
     * @returns {string} decoded data
     */
    decodeString(buf, contentType) {
        let charset = 'utf-8';
        if (contentType) {
            const match = contentType.match(/charset\s*=\s*([\w-]+)/i);
            if (match) charset = match[1].toLowerCase();
        }

        const charsetMap = { gb2312: 'gb18030', gbk: 'gb18030' };
        charset = charsetMap[charset] || charset;

        let decoder;
        try {
            decoder = new TextDecoder(charset);
        } catch (e) {
            decoder = new TextDecoder('utf-8');
        }

        return decoder.decode(buf);
    },

    async getSystemDate() {
        return this.fetchData(guang.tradedayurl, {}, 10*60*60000, r => {
            let matchsd = r.match(/var systemDate_global\s*=\s*"([^"]+)"/);
            let matchtd = r.match(/var whetherTradeDate_global\s*=\s*(\w+)/);
            let matchlast = r.match(/var lastTradeDate_global\s*=\s*"([^"]+)"/);

            let systemDate = matchsd ? matchsd[1] : null;
            let isTradeDay = matchtd ? matchtd[1] === 'true' : false;
            let lastTradeDate = matchlast ? matchlast[1] : null;
            return {data: {systemDate, isTradeDay, lastTradeDate}, expireTime: new Date(new Date(this.getTodayDate('-').split('-')).getTime() + 30*60*60000)};
        });
    },

    async isTodayTradingDay() {
        var now = new Date();
        if (now.getDay() == 6 || now.getDay() == 0) {
            return false;
        }

        const date = this.getTodayDate('-');
        return this.getSystemDate().then(d=> {
            return date == d.systemDate && d.isTradeDay;
        });
    },

    async getLastTradeDate() {
        return this.getSystemDate().then(d=> {
            if (d.isTradeDay && new Date().getHours() >= 15) {
                return d.systemDate;
            }
            return d.lastTradeDate;
        });
    },

    /**
     * 转换为cls股票代码格式
     * @param {string} code stock code
     * @returns {string} converted cls secu_code
     */
    convertToSecu(code) {
        if (code.length === 6 && !isNaN(code)) {
            const prefixes = {'60': 'sh', '68': 'sh', '30': 'sz', '00': 'sz', '90': 'sh', '20': 'sz'};
            const postfixes = {'83': '.BJ', '43': '.BJ', '87': '.BJ', '92': '.BJ'}
            let beg = code.substring(0, 2);
            if (prefixes[beg]) {
                return prefixes[beg] + code;
            } else if (postfixes[beg]) {
                return code + postfixes[beg];
            }
            return this.convertToSecu(this.convertToQtCode(code));
        }
        if (code.endsWith('.BJ')) {
            return code;
        }
        code = code.toLowerCase();
        if (code.startsWith('bj') || code.startsWith('sz89')) {
            return code.substring(2) + '.BJ';
        }
        return code;
    },

    /**
     * 转换为新浪/腾讯行情代码格式
     * @param {string} code stock code
     * @returns {string} converted code
     */
    convertToQtCode(code) {
        if (typeof code !== 'string' || !code) return code;

        if (code.length === 6 && !isNaN(code)) {
            if (["43", "83", "87", "92", "89"].some(p => code.startsWith(p))) {
                return 'bj' + code;
            }
            if (["5", "6", "7", "9", "110", "113", "118", "132", "204"].some(p => code.startsWith(p))) {
                return 'sh' + code;
            }
            return 'sz' + code;
        }
        if (code.endsWith('.BJ')) {
            return 'bj' + code.substring(0, 6);
        }
        code = code.toLowerCase();
        if (code.startsWith('sz89')) {
            // 89 开头的代码是北交所指数
            return 'bj' + code.substring(2);
        }
        return code;
    },
    getLongStockCode(code) {
        if (code.startsWith('SH') || code.startsWith('SZ') || code.startsWith('BJ')) {
            return code;
        }
        return this.convertToQtCode(code).toUpperCase();
    },

    /**
    * 计算实时数据过期时间, 非交易日或收盘后定第二天9:15，交易时间按传入参数计算
    * @param {number} delay 盘中更新延迟时间 默认5分钟.
    */
    snapshotExpireTime(delay=300*1000) {
        const setTimeTo = (date, h, m) => {
            date.setHours(h);
            date.setMinutes(m);
            date.setSeconds(0);
            date.setMilliseconds(0);
            return date;
        };

        const now = new Date();
        let tradeDay = true;
        if (now.getDay() == 6 || now.getDay() == 0) {
            tradeDay = false;
        } else {
            const sysDay = this.cache.get(guang.tradedayurl)?.data;
            if (sysDay) {
                const date = this.getTodayDate('-');
                tradeDay = date == sysDay.systemDate && sysDay.isTradeDay;
            } else {
                this.getSystemDate();
            }
        }

        if (!tradeDay || now.getHours() >= 15) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            return setTimeTo(tomorrow, 9, 15).getTime();
        }

        if (now.getHours() < 9 || (now.getHours() === 9 && now.getMinutes() < 15)) {
            return setTimeTo(new Date(now), 9, 15).getTime();
        }

        if ((now.getHours() > 11 && now.getHours() < 13) || (now.getHours() === 11 && now.getMinutes() >= 30)) {
            return setTimeTo(new Date(now), 13, 0).getTime();
        }

        return now.getTime() + delay;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    global.guang = guang;
    module.exports = {guang};
} else if (typeof window !== 'undefined') {
    window.guang = guang;
}
})();
