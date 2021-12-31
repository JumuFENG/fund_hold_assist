'use strict';

class TradingData {
    constructor() {
        this.dayPriceAvg = {};
    }

    updateStockRtPrice(snapshot) {
        if (!this.dayPriceAvg[snapshot.code]) {
            this.dayPriceAvg[snapshot.code] = [];
        };
        this.dayPriceAvg[snapshot.code].push([snapshot.realtimequote.currentPrice, snapshot.realtimequote.avg]);
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + ('' + (now.getMonth()+1)).padStart(2, '0') + ('' + now.getDate()).padStart(2, '0');
    }

    save() {
        var fileDate = this.getTodayDate();
        for (var c in this.dayPriceAvg) {
            var blob = new Blob([JSON.stringify(this.dayPriceAvg[c])], {type: 'application/json'});
            var url = URL.createObjectURL(blob);
            var filename = 'StockDailyPrices/' + fileDate + '_' + c + '.json';
            chrome.downloads.download({url, filename, saveAs:false});
        }
    }

    listAllBuySellPrice(stockKl, code, name) {
        var codes = new Set(['000858', '002460', '000401', '002041', '600862', '601600', '601101', '000998', '600546', '600918', '600276', '600031', '000630', '002241', '600010', '600089', '600150', '601016', '601117', '601601', '601800', '600905', '002847']);
        if (!codes.has(code)) {
            return;
        }
        for (var i in stockKl) {
            var afterbuy = false;
            var bcount = 0;
            var ecount = 0;
            var lcount = 0;
            var b = 0;
            var rec = [];
            var earned = 0;
            for (var j = 0; j < stockKl[i].length; j++) {
                if (stockKl[i][j].bss18 == 'b') {
                    afterbuy = true;
                    bcount ++;
                    b = stockKl[i][j].c;
                }
                if (stockKl[i][j].bss18 == 's' && afterbuy) {
                    var e = stockKl[i][j].c - b;
                    rec.push('b:' + b + ' s:' + stockKl[i][j].c + ' e:' + e.toFixed(2));
                    if (e > 0) {
                        ecount ++;
                    } else {
                        lcount ++;
                    }
                    earned += e * 100 / b;
                    afterbuy = false;
                }
            }

            console.log(name, 'kltype' + i, stockKl[i].length, 'b:', bcount, 'e', ecount, 'l', lcount, 'total', earned.toFixed(2));
        }
    }
}

let tradeAnalyzer = new TradingData();

class RetroTradeClient extends TradeClient {
    constructor() {
        super('');
    }

    trade(code, price, count, tradeType, jylx, cb) {
        console.log('test trade', tradeType, code, price, count, jylx);
        if (price == 0 || count < 100) {
            console.log('please set correct price and count for test trade!');
            return;
        } else {
            var time = emjyBack.retroAccount.tradeTime;
            var sid = emjyBack.retroAccount.sid;
            emjyBack.retroAccount.addDeal(code, price, count, tradeType);
            if (typeof(cb) === 'function') {
                cb({time, code, price, count, sid});
            }
        }
    }
}

class TrackingAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'track';
        this.key_deals = 'track_deals';
        this.buyPath = null;
        this.sellPath = null;
        this.sid = 1;
        this.deals = [];
    }

    applyStrategy(code, str) {
        if (!str) {
            return;
        };
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        var strategyGroup = strategyGroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
        strategyGroup.applyGuardLevel();
        stock.strategies = strategyGroup;
    }

    loadAssets() {
        this.loadStrategies();
        chrome.storage.local.get(this.key_deals, item => {
            if (item && item[this.key_deals]) {
                this.deals = item[this.key_deals];
            }
        });
    }

    addDeal(code, price, count, tradeType) {
        var time = this.tradeTime;
        if (!time) {
            time = emjyBack.getTodayDate('-');
        }
        this.deals.push({time, sid: this.sid, code, tradeType, price, count});
        this.sid ++;
        this.tradeTime = undefined;
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient();
    }

    buyStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        this.tradeClient.buy(code, price, count, cb);
    }

    sellStock(code, price, count) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        this.tradeClient.sell(code, price, count);
    }

    save() {
        super.save();
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        chrome.storage.local.set(dsobj);
    }
}

class RetrospectAccount extends TrackingAccount {
    constructor() {
        super();
        this.keyword = 'retro';
        this.key_deals = 'retro_deals';
    }

    createTradeClient() {
        this.tradeClient = new RetroTradeClient();
    }
}

class RetroEngine {
    constructor() {

    }

    initKlines(code, startDate) {
        var stock = emjyBack.retroAccount.stocks.find(s => s.code == code);
        if (stock) {
            stock.loadKlines(() => {
                if (!stock.klines.klines) {
                    emjyBack.fetchStockKline(code, '101', startDate);
                    return;
                }
                var dKline = stock.klines.klines['101'];
                if (!dKline || dKline[0].time > startDate) {
                    stock.klines.klines['101'] = [];
                    emjyBack.fetchStockKline(code, '101', startDate);
                }
            });
        }
    }

    clearRetroDeals() {
        emjyBack.retroAccount.deals = [];
    }

    saveRetroDeals() {
        emjyBack.retroAccount.save();
    }

    initRetro(code, str, startDate, endDate = null) {
        this.code = code;
        this.startDate = startDate;
        this.endDate = endDate;
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        emjyBack.retroAccount.addWatchStock(code, str);
        this.initKlines(code, startDate);
    }

    startRetro() {
        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (!stock || !stock.klines || !stock.klines.klines) {
            console.log('stock not exists')
            return;
        }
        var dKline = stock.klines.klines['101'];

        //'000858'
        var startIdx = dKline.findIndex(k => k.time >= this.startDate);
        if (startIdx < 0) {
            console.log('can not find kl data at', this.startDate);
            return;
        }
        var resKline = dKline.splice(startIdx);
        for (var i = 0; i < resKline.length; i++) {
            dKline.push(resKline[i]);
            emjyBack.retroAccount.tradeTime = resKline[i].time;
            stock.strategies.checkKlines(stock.klines, ['101']);
        }
    }
}