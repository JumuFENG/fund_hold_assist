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

class TestTradeClient extends TradeClient {
    constructor(account) {
        super('');
        this.bindingAccount = account;
    }

    trade(code, price, count, tradeType, jylx, cb) {
        console.log(this.bindingAccount.keyword, 'trade', tradeType, code, price, count, jylx);
        if (price == 0 || count < 100) {
            console.log('please set correct price and count for test trade!');
            return;
        } else {
            var time = this.bindingAccount.tradeTime;
            if (!time) {
                var dt = new Date();
                time = (new Date(dt - dt.getTimezoneOffset()*60*1000)).toISOString().split('.')[0].replace('T', ' ');
            }
            var sid = this.bindingAccount.sid;
            this.bindingAccount.addDeal(code, price, count, tradeType);
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
        this.availableMoney = Infinity;
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
        strategyGroup.applyGuardLevel(false);
        stock.strategies = strategyGroup;
    }

    loadAssets() {
        var loadhour = new Date().getHours();
        var watchingStorageKey = this.keyword + '_watchings';
        var fix_date_price = function(code, records) {
            for (var rec of records) {
                if (rec.date.includes(':')) {
                    var rdate = rec.date.split(' ')[0];
                    var kl = emjyBack.klines[code].getKlineByTime(rdate);
                    if (kl && loadhour >= 15) {
                        if (rec.date < rdate + ' ' + '09:30') {
                            rec.price = kl.o;
                        } else if (rec.date > rdate + ' ' + '14:57') {
                            rec.price = kl.c;
                        }
                        rec.date = rdate;
                    } else if (rec.date > rdate + ' ' + '09:30' && rec.date < rdate + ' ' + '14:57') {
                        rec.date = rdate;
                    }
                }
            }
        }
        emjyBack.getFromLocal(watchingStorageKey, watchings => {
            emjyBack.log('get watching_stocks', JSON.stringify(watchings));
            if (watchings) {
                watchings.forEach(s => {
                    this.addWatchStock(s);
                    var strStorageKey = this.keyword + '_' + s + '_strategies';
                    emjyBack.getFromLocal(strStorageKey, str => {
                        if (str) {
                            this.applyStrategy(s, JSON.parse(str));
                            var stockInfo = this.stocks.find(function(stocki) {return s == stocki.code});
                            fix_date_price(stockInfo.code, stockInfo.strategies.buydetail.records);
                            fix_date_price(stockInfo.code, stockInfo.strategies.buydetail.full_records);
                            stockInfo.holdCount = stockInfo.strategies.buydetail.totalCount();
                            stockInfo.holdCost = (stockInfo.strategies.buydetail.averPrice()).toFixed(2);
                        };
                    });
                });
            };
        });
        emjyBack.getFromLocal(this.key_deals, tdeals => {
            if (tdeals) {
                this.deals = tdeals;
            }
        });
    }

    addDeal(code, price, count, tradeType) {
        var time = this.tradeTime;
        if (!time) {
            time = emjyBack.getTodayDate('-');
        }
        var stk = this.getStock(code);
        if (!stk) {
            return;
        }
        if (tradeType == 'B') {
            stk.holdCount += count;
            this.deals.push({time, sid: this.sid, code, tradeType, price, count});
        } else if (tradeType == 'S') {
            if (stk.holdCount - count >= 0) {
                stk.holdCount -= count;
                this.deals.push({time, sid: this.sid, code, tradeType, price, count});
            } else {
                emjyBack.log(code, 'no enough holdCount to sell! holdCount:', stk.holdCount, ' count:', count);
            }
        }
        this.sid ++;
        this.tradeTime = undefined;
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    buyStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        if (price == 0) {
            this.tradeClient.getRtPrice(code, pobj => {
                var p = pobj.cp;
                this.tradeClient.buy(code, p, count, cb);
            });
            return;
        }
        this.tradeClient.buy(code, price, count, cb);
    }

    sellStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        if (price == 0) {
            this.tradeClient.getRtPrice(code, pobj => {
                var p = pobj.cp;
                this.tradeClient.sell(code, p, count, cb);
            });
            return;
        }
        this.tradeClient.sell(code, price, count, cb);
    }

    removeStock(code) {
        super.removeStock(code);
        this.deals = this.deals.filter( s => s.code !== code);
    }

    save() {
        super.save();
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        emjyBack.saveToLocal(dsobj);
    }
}
