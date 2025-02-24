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
        return Object.keys(params) > 0 ? `${url}?${new URLSearchParams(params)}` : url;
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
}
