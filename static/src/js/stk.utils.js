class Utils {
    logInfo(...args) {
        //console.log(args);
    }

    getTodayDate() {
        var dt = new Date();
        return dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

    getCurrentTime() {
        var dt = new Date();
        return ('' + dt.getHours()).padStart(2, '0') + ':' + ('' + dt.getMinutes()).padStart(2, '0');
    }

    get(path, queries, cb) {
        var httpRequest = new XMLHttpRequest();
        var lnk = '../../' + path;
        if (queries && queries.length > 0) {
            lnk += '?' + queries;
        };
        httpRequest.open('GET', lnk, true);
        httpRequest.send();

        httpRequest.onreadystatechange = function() {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                if (typeof(cb === 'function')) {
                    cb(httpRequest.responseText);
                };
            };
        }
    }

    post(querystr, form, cb) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('POST', '../../' + querystr);
        httpRequest.send(form);

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                if (typeof(cb) === 'function') {
                    cb();
                };
            };
        }
    }

    mergeJsonDict(s, a) {
        for(var c in a) {
            s[c] = a[c];
        }
    }

    combineid(ids) {
        if (ids instanceof Array) {
            return ids.join('_');
        };
        return '' + ids;
    }

    incdec_lbl_classname(val) {
        var lbl_class = "increase";
        if (val < 0) {
            lbl_class = "decrease";
        } else if (val == 0) {
            lbl_class = "keepsame";
        };
        return lbl_class;
    }
}

var utils = new Utils();
var all_stocks = {};

class StockTrade {
    fetchStockSummary(code, cb) {
        var querystr = 'act=summary';
        if (code) {
            querystr += '&code=' + code;
        };
        utils.get('stock', querystr, function(rsp){
            utils.mergeJsonDict(all_stocks, JSON.parse(rsp));
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
            if (typeof(cb) === 'function') {
                cb(code);
            };
        });
    }

    sellStock(date, code, price, ids, cb) {
        var fd = new FormData();
        fd.append('act', 'sell');
        fd.append('code', code);
        fd.append('date', date);
        fd.append('price', price);
        fd.append('id', utils.combineid(ids));

        utils.post('stock', fd, function() {
            if (typeof(cb) === 'function') {
                cb();
            };
        })
    }

    fetchSellData(code, cb) {
        var querystr = 'act=sell&code=' + code;
        utils.get('stock', querystr, function(rsp){
            all_stocks[code].sell_table = JSON.parse(rsp);
            if (typeof(cb) === 'function') {
                cb(code);
            };
        })
    }
}

var trade = new StockTrade();