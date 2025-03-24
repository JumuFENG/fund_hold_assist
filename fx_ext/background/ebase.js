window.logger = {
    logs: [],
    log(...args) {
        var l = `[${new Date().toLocaleTimeString('zh',{hour12:false})}] ${args.join(' ')}`;
        if (this.logger) {
            this.logger.info(l);
        } else {
            this.logs.push(l + '\n');
            console.log(l);
        }
    },
    info(...args) {
        this.log(...args);
    },
    error(...args) {
        this.log(...args);
    },
    debug(...args) {
        this.log(...args);
    }
}

window.ctxfetch = {
    setPage(page) { },
    async fetch(url, options) {
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


window.xreq = function(m) {
    return window;
}
