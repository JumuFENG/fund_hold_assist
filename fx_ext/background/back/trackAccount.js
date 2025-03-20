'use strict';

try {
    const {guang}  = require('../guang.js');
    const emjyBack  = require('./emjybackend.js');
    const {TradeClient, NormalAccount}  = require('./accounts.js');
    const {GroupManager}  = require('./strategyGroup.js');
} catch (err) {

}


class TestTradeClient extends TradeClient {
    constructor(account) {
        super('');
        this.bindingAccount = account;
    }

    trade(code, price, count, tradeType, jylx) {
        console.log(this.bindingAccount.keyword, 'trade', tradeType, code, price, count, jylx);
        if (price == 0 || count < 100) {
            console.log('please set correct price and count for test trade!');
            return Promise.resolve(null);
        }
        var time = this.bindingAccount.tradeTime;
        if (!time) {
            time = new Date().toLocaleString('zh', {year:'numeric', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}).replace(/\//g, '-');
        }
        var sid = this.bindingAccount.sid;
        this.bindingAccount.addDeal(code, price, count, tradeType);
        return Promise.resolve({time, code, price, count, sid});
    }
}


class TrackingAccount extends NormalAccount {
    constructor(key='track') {
        super();
        this.keyword = key;
        this.key_deals = this.keyword + '_deals';
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
        stock.strategies = GroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
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
        var enable_track_strategies = function (strategies) {
            if (Object.values(strategies).filter(x=>x.enabled()).length != 0) {
                return;
            }
            const interested_strategies = ['StrategyGrid', 'StrategySellELS', 'StrategySellBE'];
            for (var s in strategies) {
                if (interested_strategies.includes(strategies[s].data.key) && !strategies[s].enabled()) {
                    strategies[s].setEnabled(true);
                }
            }
        }
        emjyBack.getFromLocal(watchingStorageKey).then(watchings => {
            emjyBack.log('get watching_stocks', JSON.stringify(watchings));
            if (watchings) {
                watchings.forEach(s => {
                    this.addWatchStock(s);
                    var strStorageKey = this.keyword + '_' + s + '_strategies';
                    emjyBack.getFromLocal(strStorageKey).then(str => {
                        if (str) {
                            this.applyStrategy(s, JSON.parse(str));
                            var stockInfo = this.stocks.find(function(stocki) {return s == stocki.code});
                            fix_date_price(stockInfo.code, stockInfo.strategies.buydetail.records);
                            fix_date_price(stockInfo.code, stockInfo.strategies.buydetail.full_records);
                            stockInfo.holdCount = stockInfo.strategies.buydetail.totalCount();
                            stockInfo.holdCost = (stockInfo.strategies.buydetail.averPrice()).toFixed(2);
                            if (stockInfo.holdCount > 0 && stockInfo.strategies.buydetail.lastBuyDate() >= guang.getTodayDate('-')) {
                                enable_track_strategies(stockInfo.strategies.strategies);
                            }
                        };
                    });
                });
            };
        });
        emjyBack.getFromLocal(this.key_deals).then(tdeals => {
            if (tdeals) {
                this.deals = tdeals;
            }
        });
    }

    addDeal(code, price, count, tradeType) {
        var time = this.tradeTime;
        if (!time) {
            time = guang.getTodayDate('-');
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

    buyStock(code, price, count) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }

        if (price == 0) {
            return this.tradeClient.getRtPrice(code).then(pobj => {
                var p = pobj.cp;
                return this.tradeClient.buy(code, p, count);
            });
        }
        return this.tradeClient.buy(code, price, count);
    }

    sellStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        if (price == 0) {
            return this.tradeClient.getRtPrice(code).then( pobj => {
                var p = pobj.cp;
                return this.tradeClient.sell(code, p, count);
            });
        }
        return this.tradeClient.sell(code, price, count);
    }

    removeStock(code) {
        super.removeStock(code);
        this.deals = this.deals.filter( s => s.code !== code);
    }

    removeStocksWithNoDeals() {
        let s0 = [];
        this.stocks.forEach(s=>{
            if (s.holdCount==0 && s.strategies.buydetail.full_records.length==0 && s.strategies.buydetail.records.length == 0){
                s0.push(s.code);
            }
        });
        s0.forEach(c=>this.removeStock(c));
    }

    save() {
        super.save();
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        emjyBack.saveToLocal(dsobj);
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {TrackingAccount};
}
