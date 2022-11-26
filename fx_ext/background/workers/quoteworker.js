let SHSZQueryUrl = 'https://hsmarketwg.eastmoney.com/api/SHSZQuery?count=10&callback=sData&id=';
let quoteUrl = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot';
// https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=601012&callback=jQuery18304735019505463437_1624277312927&_=1624277415671
let ztPoolUrl = 'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&date=';

let hisKlineUrl = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&klt=101&fqt=1&fields1=f1,f3&fields2=f51,f52,f53,f54,f55,f56';

let hisKlineRt = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56&beg=0&end=20500000'

let bkQueryUrl = 'http://push2.eastmoney.com/api/qt/clist/get?ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fields=f12,f13,f14'

// fields 
// f1 : code  f2 : market f3 : name f4 : decimal f5 : dktotal  f6 : preKPrice f7 : prePrice f8 : qtMiscType 
// f51: date/time,f52:开盘,f53:收盘,f54:最高, f55:最低, f56: 成交量, f57: 成交额 ,f58: 振幅(%),f59:涨跌幅(%),f60:涨跌额,f61:换手率(%)
// secid: 1 = sh, 0 = sz
// klt: k line type 101: 日k 102: 周k 103: 月k 104: 季k 105: 半年k 106:年k 60: 小时, 1, 5, 15,30,60,120,
// fqt: 复权 1: 前复权 2: 后复权 0: 不复权

function postLog(log) {
    postMessage({command: 'quote.log', log});
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
            }
        }
    };
}

function queryStockInfo(code) {
    var url = SHSZQueryUrl + code;
    xmlHttpGet(url, (response) => {
        var sData = response.match(/var sData = "(.+?);";/)[1];
        if (!sData.includes(',')) {
            postMessage({command:'quote.query.stock', sdata: {code, market:code.startsWith('60') ||code.startsWith('68') ? 'SH' : 'SZ'}});
        } else {
            var items = sData.split(',');
            var name = items[4];
            var market = (items[5] == 1 ? 'SH' : 'SZ');
            var sdata = {name, code, market};
            postMessage({command: 'quote.query.stock', sdata});
        }
    });
}

function getHQSecIdByCode(code){  // 300059 //1.300059
    let i = code.substring(0, 1);
    let k = code.substring(0, 2);
    let j = code.substring(0, 3);
    if (i == "5" || i == "6" || i == "9"){
        //上证股票
        return "1"
    } else if(k.toLowerCase()=="bk"){
        return "90"
    }
    if (code == "000300"){
        //上证股票
        return "1"
    }
    if (j == "009" || j == "126" || j == "110"){
        //上证股票
        return "1"
    }
    return "0"
}

function codeToSecid(code, market) {
    if (market !== undefined) {
        return (market == 'SH' ? '1.' : '0.') + code;
    };
    return getHQSecIdByCode(code) + code;
}

function quoteSnapshot(code) {
    var url = quoteUrl + '?id=' + code + '&callback=jSnapshotBack&_=' + Date.now();
    xmlHttpGet(url, response => {
        var snapshot = JSON.parse(response.match(/jSnapshotBack\((.+?)\);/)[1]);
        postMessage({command: 'quote.snapshot', snapshot});
    });
}

function getTopicZTPool(date) {
    var url = ztPoolUrl + date;
    xmlHttpGet(url, response => {
        postMessage({command: 'quote.get.ZTPool', ztpool: JSON.parse(response)});
    });
}

function getKlineDailySince(code, date, len, market) {
    // postLog('get ' + code + ' ' + date + ' len = ' + len);
    var secid = codeToSecid(code, market);
    var end = '20500000';
    if (len > 0) {
        var sdate = new Date(date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8));
        sdate.setDate(sdate.getDate() + len)
        end = sdate.getFullYear() + ('' + (sdate.getMonth() + 1)).padStart(2, '0') + ('' + sdate.getDate()).padStart(2, '0');
    };
    var url = hisKlineUrl + '&secid=' + secid + '&beg=' + date + '&end=' + end + '&_=' + Date.now();
    xmlHttpGet(url, response => {
        postMessage({command: 'quote.get.kline', kltype:'101', kline: JSON.parse(response)});
    });
}

var kltBack = {'1':'klineMinBack', '5':'kline5MinBack', '15':'kline15MinBack', '30':'klineHalfHrBack', '60':'klineHourlyBack', '120':'kline2HrBack', '101':'klineDailyBack', '102':'klineWeeklyBack', '103':'klineMonthlyBack', '104':'klineQuarterlyBack','105':'klineHalfYrBack','106':'klineYearBack'};

function getKlineRt(code, klt, market) {
    var secid = codeToSecid(code, market);
    var url = hisKlineRt + '&klt=' + klt  + '&secid=' + secid;
    xmlHttpGet(url, response => {
        postMessage({command: 'quote.kline.rt', kltype: klt, kline: JSON.parse(response)});
    });
}

function getKlineDaily(code, market, date) {
    var secid = codeToSecid(code, market);
    var beg = date;
    if (!beg) {
        var edate = new Date();
        var sdate = new Date(edate.setDate(edate.getDate() - 30));
        beg = sdate.getFullYear() + ('' + (sdate.getMonth() + 1)).padStart(2, '0') + ('' + sdate.getDate()).padStart(2, '0');
    } else if (date.includes('-')) {
        beg = date.split('-').join('');
    }
    var url = hisKlineUrl + '&secid=' + secid + '&beg=' + beg + '&end=20500000&_=' + Date.now();
    xmlHttpGet(url, response => {
        postMessage({command: 'quote.kline.rt', kltype:'101', kline: JSON.parse(response)});
    });
}

function bkQuery(bk, pn, pz) {
    var url = bkQueryUrl + '&pn=' + pn + '&pz=' + pz + '&fs=' + bk + '&_=' + Date.now();
    // fs={k:v} + {k:v}
    // b->板块  
    // m->市场(0 = sz, 1 = sh)  t->类型 f->风险/风格 s->
    // m(0),t(6) 深主板 m(0),t(80) 创业板   m(0),t(7)深B股  m(0),t(8)深新股
    // m(1),t(2) 上主板 m(1),t(23) 上科创板) m(1),t(3)上B股  m(1),t(8)上新股
    // f(4) 风险警示 f(3) 两网及退市
    // m(0),t(81),s(2048) 北交所
    xmlHttpGet(url, response => {
        var bkdata = JSON.parse(response);
        console.log(bkdata);
        postMessage({command: 'quote.get.bkcode', total: bkdata.data.total, data: bkdata.data.diff});
    });
}

addEventListener('message', function(e) {
    if (e.data.command == 'quote.query.stock') {
        queryStockInfo(e.data.code);
    } else if (e.data.command == 'quote.fetch.code') {
        quoteSnapshot(e.data.code);
    } else if (e.data.command == 'quote.get.ZTPool') {
        getTopicZTPool(e.data.date);
    } else if (e.data.command == 'quote.get.kline') {
        getKlineDailySince(e.data.code, e.data.date, e.data.len, e.data.market);
    } else if (e.data.command == 'quote.kline.rt') {
        if (e.data.kltype == '101') {
            getKlineDaily(e.data.code, e.data.market, e.data.sdate);
        } else {
            getKlineRt(e.data.code, e.data.kltype, e.data.market);
        };
    } else if (e.data.command == 'quote.get.bkcode') {
        bkQuery(e.data.bk, e.data.pn, e.data.pz);
    } else {
        postLog('unknown command ' + e.data.command);
    }
});

