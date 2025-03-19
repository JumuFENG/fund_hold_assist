class logger {
    static logs = [];
    static log(...args) {
        var l = `[${new Date().toLocaleTimeString('zh',{hour12:false})}] ${args.join(' ')}`;
        if (this.logger) {
            this.logger.info(l);
        } else {
            this.logs.push(l + '\n');
            console.log(l);
        }
    }
    static info(...args) {
        this.log(...args);
    }
    static error(...args) {
        this.log(...args);
    }
    static debug(...args) {
        this.log(...args);
    }
}

class ctxfetch {
    static setPage(page) { }
    static async fetch(url, options) {
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
