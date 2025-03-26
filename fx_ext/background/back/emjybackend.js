'use strict';


window.emjyBack = {
    fha: null,
    log(...args) {
        logger.log(...args);
    },
    Init() {
        this.running = true;
        this.log('EmjyBack initialized!');
    },
    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
    },
    isTradeTime() {
        var now = new Date();
        if (now > new Date(now.toDateString() + ' 9:30') && now < new Date(now.toDateString() + ' 15:00')) {
            return true;
        }
        return false;
    },
    async tradeClosed() {
        const prm = Object.values(accld.all_accounts).map(acc=>acc.stocks.filter(s=>s.strategies).map(s=>s.strategies.updateKlines())).flat();
        await Promise.all(prm);
        Object.values(klPad.klines).forEach(kl => kl.save());
        this.flushLogs();
        this.running = false;
    },
    flushLogs() {
        logger.log('flush log!');
        if (logger.logs && logger.logs.length > 0) {
            var blob = new Blob(logger.logs, {type: 'application/text'});
            svrd.saveToFile(blob, 'logs/stock.assist' + guang.getTodayDate() + '.log');
            logger.logs = [];
        }
    }
}
