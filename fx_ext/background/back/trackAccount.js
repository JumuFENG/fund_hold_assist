'use strict';
(function(){

const { logger, svrd } = xreq('./background/nbase.js');
const { guang } = xreq('./background/guang.js');
const { feng } = xreq('./background/feng.js');
const { klPad } = xreq('./background/kline.js');
const { TradeClient, NormalAccount, accinfo }  = xreq('./background/accounts.js');
const { GroupManager } = xreq('./background/strategyGroup.js');


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
        return this.bindingAccount.addDeal(code, price, count, tradeType);
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
                    var kl = klPad.klines[code].getKlineByTime(rdate);
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
        svrd.getFromLocal(watchingStorageKey).then(watchings => {
            logger.info('get watching_stocks', JSON.stringify(watchings));
            if (watchings) {
                watchings.forEach(s => {
                    this.addWatchStock(s);
                    var strStorageKey = this.keyword + '_' + s + '_strategies';
                    svrd.getFromLocal(strStorageKey).then(str => {
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
        svrd.getFromLocal(this.key_deals).then(tdeals => {
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
            return Promise.resolve();
        }

        if (tradeType == 'S') {
            if (stk.holdCount - count < 0) {
                return Promise.resolve();
            }
            stk.holdCount -= count;
        } else {
            stk.holdCount += count;
        }
        const deal = {time, sid: this.sid, code, tradeType, price, count};
        this.deals.push(deal);
        this.sid ++;
        this.tradeTime = undefined;
        return Promise.resolve(deal);
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    loadDeals() {
        const daystr = guang.getTodayDate('-');
        const daydeals = this.deals.filter(d => d.time == daystr);
        Promise.all(daydeals.map(async (x) => {const xd = Object.assign({}, x); xd.code = await feng.getLongStockCode(x.code); return xd;})).then(deals => {
            this.uploadDeals(deals);
        });
    }

    loadHistDeals() {
        Promise.all(this.deals.map(async (x) => {const xd = Object.assign({}, x); xd.code = await feng.getLongStockCode(x.code); return xd;})).then(deals => {
            this.uploadDeals(deals);
            this.clearCompletedDeals();
        });
    }

    clearCompletedDeals() {
        this.deals = this.deals.filter(x=>this.getStock(x.code)?.holdCount > 0);
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        svrd.saveToLocal(dsobj);
    }

    alignDealsToRecords() {
        // 调用之前需确保record里面没有不需要的记录.
        this.stocks.forEach(s => {
            s.strategies.buydetail.full_records.forEach(r=>{
                if (!this.deals.find(x => x.code == s.code && r.date.startsWith(x.time) && x.sid == r.sid)) {
                    this.deals.push({code: s.code, time: r.date, price: r.price, count: r.count, tradeType: r.type, sid: r.sid});
                }
            });
        });
    }

    loadOtherDeals() {}

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
        svrd.saveToLocal(dsobj);
    }
}

const trackacc = {
    initTrackAccounts() {
        this.track_accounts = [];
        if (accinfo.fha.save_on_server) {
            var url = accinfo.fha.server + 'userbind?onlystock=1';
            fetch(url, {headers: accinfo.fha.headers}).then(r => r.json()).then(accs => {
                for (const acc of accs) {
                    if (acc.realcash) {
                        logger.info('skip realcash acc in track account');
                        continue;
                    }
                    this.track_accounts.push(new TrackingAccount(acc.name));
                }
                for (const account of this.track_accounts) {
                    accinfo.all_accounts[account.keyword] = account;
                    account.loadWatchings();
                }
            })
        } else {
            svrd.getFromLocal('track_accounts').then(accs => {
                if (!accs || Object.keys(accs).length === 0) {
                    accs = ['track'];
                }
                for (let ac in accs) {
                    this.track_accounts.push(new TrackingAccount(ac));
                }
                for (const account of this.track_accounts) {
                    accinfo.all_accounts[account.keyword] = account;
                    account.loadAssets();
                }
            });
        }
        accinfo.track_accounts = this.track_accounts;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {trackacc};
} else if (typeof window !== 'undefined') {
    window.trackacc = trackacc;
}
})();
