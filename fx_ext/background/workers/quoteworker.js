let quoteTimer = null;
let stocks = null;

let quoteUrl = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot'
// https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=601012&callback=jQuery18304735019505463437_1624277312927&_=1624277415671
let ztPoolUrl = 'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&cb=cbztPoolback&date=';

let hisKlineUrl = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&klt=101&fqt=1&fields1=f1%2Cf3&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55';

let hisKlineHourly = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&klt=60&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55&beg=0&end=20500000'

// fields 
// f1 : code  f2 : market f3 : name f4 : decimal f5 : dktotal  f6 : preKPrice f7 : prePrice f8 : qtMiscType 
// f51: date/time,f52:开盘,f53:收盘,f54:最高, f55:最低, f56: 成交量, f57: 成交额 ,f58: 振幅(%),f59:涨跌幅(%),f60:涨跌额,f61:换手率(%)
// secid: 1 = sh, 0 = sz
// klt: k line type 101: 日k 102: 周k 103: 月k 104: 年k 60: 小时
// fqt: 复权 1: 前复权 2: 后复权 0: 不复权

function postLog(log) {
    postMessage({command: 'quote.log', log});
}

function doWork() {
    if (stocks) {
        stocks.forEach(function(s) {
            quoteSnapshot(s);
        });
    };
}

function xmlHttpGet(url, cb) {
    var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
    httpRequest.open('GET', url, true);//第二步：打开连接 
    httpRequest.send();//第三步：发送请求 
    /**
     * 获取数据后的处理程序
     */
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            if (typeof(cb) === 'function') {
                cb(httpRequest.responseText);
            } else {
                eval(httpRequest.responseText);
            }
        }
    };
}

function codeToSecid (code) {
    return ((code.startsWith('00') || code.startsWith('30')) ? '0.' : '1.') + code;
}

function quoteSnapshot(code) {
    var url = quoteUrl + '?id=' + code + '&callback=jSnapshotBack&_=' + Date.now();
    xmlHttpGet(url);
}

function jSnapshotBack(snapshot) {
    postMessage({command: 'quote.snapshot', snapshot});
}

function getTopicZTPool(date) {
    var url = ztPoolUrl + date;
    xmlHttpGet(url);
}

function cbztPoolback(ztpool) {
    postMessage({command: 'quote.get.ZTPool', ztpool});
}

function getKlineDailySince(code, date, len) {
    // postLog('get ' + code + ' ' + date + ' len = ' + len);
    var secid = codeToSecid(code);
    var end = '20500000';
    if (len > 0) {
        var sdate = new Date(date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8));
        sdate.setDate(sdate.getDate() + len)
        end = sdate.getFullYear() + ('' + (sdate.getMonth() + 1)).padStart(2, '0') + ('' + sdate.getDate()).padStart(2, '0');
    };
    var url = hisKlineUrl + '&cb=klineback&secid=' + secid + '&beg=' + date + '&end=' + end + '&_=' + Date.now();
    xmlHttpGet(url);
}

function klineback(kline) {
    postMessage({command: 'quote.get.kline', kline});
}

function getKlineHourly(code) {
    var secid = codeToSecid(code);
    var url = hisKlineHourly + '&cb=klineHourlyBack&secid=' + secid;
    xmlHttpGet(url);
}

function klineHourlyBack (kline) {
    postMessage({command: 'quote.get.kline.hourly', kline});
}

addEventListener('message', function(e) {
    if (e.data.command == 'quote.refresh') {
        if (quoteTimer) {
            clearInterval(quoteTimer);
        }
        if (e.data.time == 0) {
            setTimeout(doWork, 5000);
        } else if (e.data.time > 0) {
            quoteTimer = setInterval(doWork, e.data.time);
        }
    } else if (e.data.command == 'quote.update.code') {
        stocks = e.data.stocks;
    } else if (e.data.command == 'quote.fetch.code') {
        quoteSnapshot(e.data.code);
    } else if (e.data.command == 'quote.get.ZTPool') {
        getTopicZTPool(e.data.date);
    } else if (e.data.command == 'quote.get.kline') {
        getKlineDailySince(e.data.code, e.data.date, e.data.len);
    } else if (e.data.command == 'quote.get.kline.hourly') {
        getKlineHourly(e.data.code);
    } else {
        postLog('unknown command ' + e.data.command);
    }
});

