const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;


const logger = createLogger({
    level: 'info', // 日志级别
    format: combine(
        label({ label: 'emtrade' }),
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new transports.Console(), // 输出到控制台
        new transports.File({ filename: 'emtrade.err.log', level: 'error' }), // 输出到文件
        new transports.File({ filename: 'emtrade.log' }) // 输出到文件
    ],
    exceptionHandlers: [
        new transports.File({ filename: 'emtrade.excepts.log' })
    ]
});


const svrd = {
    saveToFile(blob, filename, conflictAction = 'overwrite') {
    },
    getFromLocal(key) {
        return Promise.resolve();
    },
    saveToLocal(data) {
    },
    removeLocal(key) {
    }
}


class ctxfetch {
    constructor() {
        if (ctxfetch.inst) {
            return ctxfetch.inst;
        }
        ctxfetch.inst = this;
    }

    static page = null;
    static setPage(page) {
        this.page = page;
    }

    static async fetch(url, options) {
        // 检查 URL 的主机是否与页面主机相同
        if (this.page && new URL(url).host === new URL(this.page.url()).host) {
            // 在浏览器上下文中执行 fetch
            return this.page.evaluate(async (param) => {
                const response = await fetch(param.url, param.options);
                try {
                    const data = await response.json(); // 尝试解析 JSON
                    return {
                        status: response.status,
                        ok: response.ok,
                        headers: Object.fromEntries(response.headers.entries()),
                        data
                    };
                } catch (error) {
                    // 如果 JSON 解析失败，返回文本
                    const text = await response.text();
                    return {
                        status: response.status,
                        ok: response.ok,
                        headers: Object.fromEntries(response.headers.entries()),
                        text
                    };
                }
            }, { url, options });
        } else {
            // 在 Node.js 环境中执行 fetch
            const response = await fetch(url, options);
            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });

            try {
                const data = await response.json(); // 尝试解析 JSON
                return {
                    status: response.status,
                    ok: response.ok,
                    headers,
                    data
                };
            } catch (error) {
                const text = await response.text(); // 如果失败，返回文本
                return {
                    status: response.status,
                    ok: response.ok,
                    headers,
                    text
                };
            }
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {logger, ctxfetch, svrd};
}
