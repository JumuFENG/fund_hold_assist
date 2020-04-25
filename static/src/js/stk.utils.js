let extensionLoaded = false;

class StockUtils extends Utils {
    mergeStockSummaryJson(s, a) {
        for(var c in a) {
            var buy_table = null;
            var sell_table = null;
            if (s[c] && s[c].buy_table) {
                buy_table = s[c].buy_table;
            };
            if (s[c] && s[c].sell_table) {
                sell_table = s[c].sell_table;
            };
            s[c] = a[c];
            if (buy_table) {
                s[c].buy_table = buy_table;
            };
            if (sell_table) {
                s[c].sell_table = sell_table;
            };
        }
    }

    combineid(ids) {
        if (ids instanceof Array) {
            return ids.join('_');
        };
        return '' + ids;
    }

    getIdsPortionMoreThan(buytable, short_term_rate, days = 0) {
        var datestart = this.days_since_2000(this.getTodayDate()) - days;
        var portionInDays = 0;
        var cost = 0;
        var tids = [];
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].date <= datestart && buytable[i].sold == 0) {
                tids.push(buytable[i].id);
                portionInDays += buytable[i].ptn;
                cost += buytable[i].cost;
            }
        };
        return {
            ids: tids.join('_'),
            portion: portionInDays,
            minSellPrice:parseFloat(((1 + short_term_rate) * cost / portionInDays).toFixed(4))
        }
    }

    getShortTermIdsPortionMoreThan(buytable, latest_val, short_term_rate, days = 1) {
        var portionLatest = 0;
        var portionAll = 0;
        var datestart = this.days_since_2000(this.getTodayDate()) - days;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].date > datestart) {
                portionLatest += buytable[i].ptn;
            };
            if (buytable[i].sold == 0) {
                portionAll += buytable[i].ptn;
            };
        };

        var portionAvailable = portionAll - portionLatest;
        var max_price = (parseFloat(latest_val) * (1.0 - parseFloat(short_term_rate)));
        var buyrecs = [];
        var portion = 0;
        for (var i = 0; i < buytable.length; i++) {
            if(buytable[i].sold == 0 && buytable[i].price < max_price) {
                buyrecs.push(buytable[i]);
                portion += buytable[i].ptn;
            }
        };

        for (var i = buyrecs.length - 1; i >= 0; i--) {
            if (portion <= portionAvailable) {
                break;
            }
            portion -= buyrecs[i].ptn;
            buyrecs.pop();
        };

        var aids = '';
        var cost = 0;
        for (var i = 0; i < buyrecs.length; i++) {
            aids += (buyrecs[i].id) + '_';
            cost += buyrecs[i].cost;
        };
        return {
            ids: aids.slice(0, aids.length - 1), 
            portion: portion, 
            minSellPrice: parseFloat(((1 + short_term_rate) * cost / portion).toFixed(4))
        };
    }
}

var utils = new StockUtils();
var all_stocks = {};

class StockTrade {
    fetchStockSummary(code, cb) {
        var querystr = 'act=summary';
        if (code) {
            querystr += '&code=' + code;
        };
        utils.get('stock', querystr, function(rsp){
            var ss = JSON.parse(rsp);
            utils.mergeStockSummaryJson(all_stocks, ss);
            for (var c in ss) {
                rtHelper.pushStockCode(c);
            }
            if (typeof(cb) === 'function') {
                cb(code);
            };
        });
    }

    buyStock(date, code, price, amount, rids, cb) {
        var fd = new FormData();
        fd.append("act", 'buy')
        fd.append("code", code);
        fd.append("date", date);
        fd.append("price", price);
        fd.append("ptn", amount);
        if (rids) {
            fd.append("rid", utils.combineid(rids));
        };
        utils.post('stock', fd, function(){
            if (typeof(cb) === 'function') {
                cb();
            };
        });
    }

    fetchBuyData(code, cb) {
        var querystr = 'act=buy&code=' + code;
        utils.get('stock', querystr, function(rsp){
            all_stocks[code].buy_table = JSON.parse(rsp);
            if (stockHub.detailPage && stockHub.detailPage.buydetail) {
                stockHub.detailPage.buydetail.code = null;
            };
            if (typeof(cb) === 'function') {
                cb(code);
            };
        });
    }

    fixBuyRec(code, id, portion, price, cb) {
        var fd = new FormData();
        fd.append('act', 'fixbuy');
        fd.append('code', code);
        fd.append('id', id);
        fd.append('ptn', portion);
        fd.append('price', price);

        utils.post('stock', fd, function() {
            trade.fetchBuyData(code, cb);
        });
    }

    sellStock(date, code, price, ids, portion, cb) {
        var fd = new FormData();
        fd.append('act', 'sell');
        fd.append('code', code);
        fd.append('date', date);
        fd.append('price', price);
        fd.append('id', utils.combineid(ids));
        if (portion != null) {
            fd.append('ptn', portion);
        };

        utils.post('stock', fd, function() {
            if (typeof(cb) === 'function') {
                cb();
            };
        });
    }

    fetchSellData(code, cb) {
        var querystr = 'act=sell&code=' + code;
        utils.get('stock', querystr, function(rsp){
            all_stocks[code].sell_table = JSON.parse(rsp);
            if (stockHub.detailPage && stockHub.detailPage.selldetail) {
                stockHub.detailPage.selldetail.code = null;
            };
            if (typeof(cb) === 'function') {
                cb(code);
            };
        });
    }

    fetchKhlData(code, cb) {
        var querystr = 'act=khl_m&code=' + code;
        utils.get('stock', querystr, function(rsp) {
            all_stocks[code].khl_m_his = JSON.parse(rsp);
            if (typeof(cb) === 'function') {
                cb(code);
            };
        });
    }

    fixSellRec(code, id, portion, price, cb) {
        var fd = new FormData();
        fd.append('act', 'fixsell');
        fd.append('code', code);
        fd.append('id', id);
        fd.append('ptn', portion);
        fd.append('price', price);

        utils.post('stock', fd, function() {
            trade.fetchSellData(code, cb);
        });
    }

    setRates(code, sellrate, buyrate, short_term_rate) {
        var fd = new FormData();
        fd.append('act', 'setrate');
        fd.append('code', code);
        if (buyrate != null) {
            fd.append('buy', buyrate);
        };
        if (sellrate != null) {
            fd.append('sell', sellrate);
        };
        if (short_term_rate != null) {
            fd.append('str', short_term_rate);
        };

        utils.post('stock', fd);
    }

    setFee(code, fee) {
        if (fee != null) {
            var fd = new FormData();
            fd.append('act', 'setfee');
            fd.append('code', code);
            fd.append('fee', fee);
            utils.post('stock', fd);
        };
    }

    forget(code, cb, that) {
        var fd = new FormData();
        fd.append('act', 'forget');
        fd.append('code', code);
        utils.post('stock', fd, function() {
            if (typeof(cb) === 'function') {
                cb(that);
            } else {
                location.reload();
            }
        });
    }

    interest(code, cb, that) {
        var fd = new FormData();
        fd.append("act", 'interest');
        fd.append("code", code);
        utils.post('stock', fd, function() {
            if (typeof(cb) === 'function') {
                cb(that);
            };
        });
    }
}

var trade = new StockTrade();

var stockRtData = {};
function _sr_cb(rtdata) {
    for (var code in rtdata) {
        var sdata = rtdata[code];
        var scode = sdata.type + sdata.symbol;
        stockRtData[scode] = {
            rtprice: sdata.price,
            percent: sdata.percent,
            time: sdata.time
        };
    }
}

class RealTimeHelper {
    timeFitToFetch() {
        var nowDate=new Date();
        var day_of_week = nowDate.getDay();
        if (day_of_week < 1 || day_of_week > 5) {
            return false;
        };
        var hour_of_day = nowDate.getHours();
        if (hour_of_day < 9 || hour_of_day > 16) {
            return false;
        }
        return true;
    }

    dispatchUrlToGet(url) {
        let urlEvt = new CustomEvent(UrlToGetEvent, {
            detail: {
                url: url
            }
        });
        document.dispatchEvent(urlEvt);
    }

    pushStockCode(code) {
        if (!stockRtData[code]) {
            stockRtData[code] = {};
        };
    }

    get126StocksUrl() {
        var i126codes = '';
        for (var c in stockRtData) {
            if (c.startsWith('SH')) {
                i126codes += c.replace('SH', '0') + ',';
            } else if (c.startsWith('SZ')) {
                i126codes += c.replace('SZ', '1') + ',';
            } else {
                utils.logInfo('index code not start with SH or SZ', c);
            }
        };

        if (i126codes.length > 0) {
            return 'http://api.money.126.net/data/feed/' + i126codes + 'money.api?callback=_sr_cb';
        };
    }

    fetchStockRtDataActually(cb) {
        var url = this.get126StocksUrl();
        if (!url) {
            return;
        };

        if (extensionLoaded) {
            this.dispatchUrlToGet(url);
        } else {
            var enUrl = encodeURIComponent(url);
            utils.get('api/get', 'url=' + enUrl, function(rsp){
                eval(rsp);
                if (typeof(cb) === 'function') {
                    cb();
                };
            });
        }
    }

    fetchStockRtData(cb) {
        if (this.timeFitToFetch()) {
            this.fetchStockRtDataActually(cb);
        };
    }
}

var rtHelper = new RealTimeHelper();
