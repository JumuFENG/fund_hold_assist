
const cloud = {
    stock_basics: { },
    get server() {
        return emjyBack.fha.server_root
    },
    async getStockBasics (stocks) {
        if (typeof stocks === 'string') {
            await this.updateStockBasics([guang.convertToSecu(stocks)]);
            if (!this.stock_basics[guang.convertToSecu(stocks)]) {
                await this.updateStockBasicsEm([stocks]);
            }
            return this.stock_basics[guang.convertToSecu(stocks)];
        }

        await this.updateStockBasics(stocks.map(s => guang.convertToSecu(s)));
        const failed = stocks.filter(s => !this.stock_basics[guang.convertToSecu(s)]);
        if (failed.length > 0) {
            await this.updateStockBasicsEm(failed);
        }
        return Object.fromEntries(stocks.map(s => [s, this.stock_basics[guang.convertToSecu(s)]]));
    },
    async updateStockBasics (stocks) {
        stocks = stocks.filter(s => !this.stock_basics[s] || this.stock_basics[s].expireTime < Date.now());
        if (stocks.length === 0) {
            return;
        }

        let i = 0;
        const psize = 100;
        let fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        while (i < stocks.length) {
            let group = stocks.slice(i, i + psize);
            let fUrl = this.server + `fwd/clsquote/quote/stocks/basic?app=CailianpressWeb&fields=${fields}&os=web&secu_codes=${group.join(',')}&sv=7.7.5`;
            const bdata = await fetch(fUrl).then(r => r.json()).then(d => d.data);
            for (const s in bdata) {
                this.stock_basics[s] = bdata[s];
                this.stock_basics[s].up_limit = Math.round((bdata[s].up_price - bdata[s].preclose_px)*100/bdata[s].preclose_px)/100;
                this.stock_basics[s].expireTime = await guang.snapshotExpireTime() ;
            }

            i += psize;
        }
    },
    async updateStockBasicsEm(stocks) {
        if (stocks.length == 0) {
            return;
        }
        const scodes = stocks.map(s => s.replaceAll('SH', '1.').replaceAll('SZ', '0.')).join(',');
        const qurl = this.server + `fwd/empush2qt/ulist.np/get?fltt=2&secids=${scodes}&fields=f2,f12,f13,f14`;
        const emdata = await fetch(qurl).then(r => r.json()).then(d=>d?.data?.diff);
        for (const {f2: last_px, f12: code, f13:mkt, f14:secu_name} of emdata) {
            let secu_code = guang.convertToSecu(['SZ','SH'][mkt] + code);
            this.stock_basics[secu_code] = {last_px, secu_code, secu_name};
            this.stock_basics[secu_code].expireTime = await guang.snapshotExpireTime();
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    global.cloud = cloud;
    module.exports = {cloud};
} else if (typeof window !== 'undefined') {
    window.cloud = cloud;
}
