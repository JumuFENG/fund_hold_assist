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
}
