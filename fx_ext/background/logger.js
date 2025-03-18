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
}

// export default new Logger();

