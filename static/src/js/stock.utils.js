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
            } 
        }
    }
}

var utils = new Utils();

class StockTrade {
    buyStock(date, code, price, amount, rids, cb) {
        var fd = new FormData();
        fd.append("act", 'buy')
        fd.append("code", code);
        fd.append("date", date);
        fd.append("price", price);
        fd.append("ptn", amount);
        // if (rids) {
        //     fd.append("ptn", rids);
        // };
        utils.post('stock', fd, function(){
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }
}

var trade = new StockTrade();