'use strict';

class guang {
    static cache = new Map();

    /**
    * 生成缓存的唯一键：URL + 查询参数
    * @param {string} url 请求的 URL
    * @param {Object} params 请求的查询参数
    * @returns {string} 缓存的唯一键
    */
    static buildParams(url, params) {
        return Object.keys(params).length > 0 ? `${url}?${new URLSearchParams(params)}` : url;
    }

    /**
    * 发送 GET 请求并进行缓存
    * @param {string} url 请求地址
    * @param {Object} params 请求的查询参数
    * @param {number} cacheTime 缓存时间（毫秒）
    * @param {Function} dataFilter 数据过滤函数，用来解析和过滤数据
    * @returns {Promise<any>} 返回数据的 Promise
    */
    static async fetchData(url, params = {}, cacheTime = 5000, dataFilter = null) {
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
            throw error;
        });

        this.cache.set(cacheKey, { data: requestPromise, expireTime: Date.now() + cacheTime }); // 缓存 Promise
        return requestPromise;
    }

    /**
    * 根据代码获取股票的涨跌停幅度
    * @param {string} code 代码
    * @param {string} name 名称，用于判断是否ST
    * @returns {int} 返回涨停/跌停幅度
    */
    static getStockZdf(code, name='') {
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
    }

    /**
    * 根据昨天收盘价及涨跌幅限制计算今日涨停价
    * @param {number} lclose 昨日收盘价
    * @param {number} zdf 涨停幅度 5/10/20/30
    * @returns {number} 返回涨停价
    */
    static calcZtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.floor(lclose * 130) / 100;
        }
        return Math.round(lclose * 100 + lclose * zdf + 0.00000001) / 100;
    }

    /**
    * 根据昨天收盘价及涨跌幅限制计算今日跌停价
    * @param {number} lclose 昨日收盘价
    * @param {number} zdf 跌停幅度 5/10/20/30
    * @returns {number} 返回跌停价
    */
    static calcDtPrice(lclose, zdf) {
        if (zdf == 30) {
            return Math.ceil(lclose * 70) / 100;
        }
        return Math.round(lclose * 100 - lclose * zdf + 0.00000001) / 100;
    }

    /**
    * 今日日期的字符串形式
    * @param {string} sep 间隔符号
    * @returns {string}
    */
    static getTodayDate(sep = '') {
        return new Date().toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, sep);
    }

    /**
    * 日期转字符串形式
    * @param {Date} dt 日期
    * @param {string} sep 间隔符号
    * @returns {string}
    */
    static dateToString(dt, sep = '') {
        return dt.toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, sep);
    }

    /**
    * 计算股数, 1手为100股
    * @param {number} amount 金额
    * @param {number} price 股价
    * @returns {number} 股数(整百股)
    */
    static calcBuyCount(amount, price) {
        var ct = (amount / 100) / price;
        if (amount - price * Math.floor(ct) * 100 - (price * Math.ceil(ct) * 100 - amount) > 0) {
            return 100 * Math.ceil(ct);
        }
        return ct > 1 ? 100 * Math.floor(ct) : 100;
    }

    static async getSystemDate() {
        return this.fetchData('http://www.sse.com.cn/js/common/systemDate_global.js', {}, 10*60*60000, r => {
            let matchsd = r.match(/var systemDate_global\s*=\s*"([^"]+)"/);
            let matchtd = r.match(/var whetherTradeDate_global\s*=\s*(\w+)/);
            let matchlast = r.match(/var lastTradeDate_global\s*=\s*"([^"]+)"/);

            let systemDate = matchsd ? matchsd[1] : null;
            let isTradeDay = matchtd ? matchtd[1] === 'true' : false;
            let lastTradeDate = matchlast ? matchlast[1] : null;
            return {data: {systemDate, isTradeDay, lastTradeDate}, expireTime: new Date(new Date(this.getTodayDate('-').split('-')).getTime() + 30*60*60000)};
        });
    }

    static async isTodayTradingDay() {
        var now = new Date();
        if (now.getDay() == 6 || now.getDay() == 0) {
            return false;
        }

        const date = this.getTodayDate('-');
        return this.getSystemDate().then(d=> {
            return date == d.systemDate && d.isTradeDay;
        });
    }

    static async getLastTradeDate() {
        return this.getSystemDate().then(d=> {
            if (d.isTradeDay && new Date().getHours() >= 15) {
                return d.systemDate;
            }
            return d.lastTradeDate;
        });
    }

    static convertToSecu(code) {
        if (code.length === 6 && !isNaN(code)) {
            const prefixes = {'60': 'sh', '68': 'sh', '30': 'sz', '00': 'sz', '90': 'sh', '20': 'sz'};
            const postfixes = {'83': '.BJ', '43': '.BJ', '87': '.BJ', '92': '.BJ'}
            let beg = code.substring(0, 2);
            if (prefixes[beg]) {
                return prefixes[beg] + code;
            } else if (postfixes[beg]) {
                return code + postfixes[beg];
            }
            console.log('cant convert code', code);
            return code;
        }
        return code.startsWith('BJ') ? code.substring(2) + '.BJ' : code.toLowerCase();
    }

    /**
    * 计算实时数据过期时间, 非交易日或收盘后定第二天9:15，交易时间按传入参数计算
    * @param {number} delay 盘中更新延迟时间 默认5分钟.
    */
    static async snapshotExpireTime(delay=300*1000) {
        const tradeDay = await this.isTodayTradingDay();
        const setTimeTo = (date, h, m) => {
            date.setHours(h);
            date.setMinutes(m);
            date.setSeconds(0);
            date.setMilliseconds(0);
            return date;
        };

        const now = new Date();
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
}
