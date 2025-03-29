const path = require('path');
const { createLogger, transports, format } = require('winston');
const { combine, label, timestamp, printf } = format;

// 统一日志目录（相对于当前文件所在位置）
const LOG_DIR = path.join(__dirname, '../logs');

// 确保日志目录存在（同步检查，适合初始化阶段）
const fs = require('fs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger = createLogger({
    level: 'info',
    format: combine(
        label({ label: 'emtrade' }),
        timestamp(),
        printf(({ level, message, label, timestamp, ...rest }) => {
            const args = rest[Symbol.for('splat')] || [];
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            const strArgs = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            return `[${timestamp}] [${label}] ${level}: ${message} ${strArgs}`;
        })
    ),
    transports: [
        new transports.Console(),
        // 所有日志文件统一存放到 logs/ 目录
        new transports.File({ 
            filename: path.join(LOG_DIR, 'emtrade.err.log'),
            level: 'error' 
        }),
        new transports.File({ 
            filename: path.join(LOG_DIR, 'emtrade.log') 
        })
    ],
    exceptionHandlers: [
        new transports.File({ 
            filename: path.join(LOG_DIR, 'emtrade.excepts.log') 
        })
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

            try {
                const data = await response.json(); // 尝试解析 JSON
                return {
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries()),
                    data
                };
            } catch (error) {
                const text = await response.text(); // 如果失败，返回文本
                return {
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries()),
                    text
                };
            }
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {logger, ctxfetch, svrd};
}
