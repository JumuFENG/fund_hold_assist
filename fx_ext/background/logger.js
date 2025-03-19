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

