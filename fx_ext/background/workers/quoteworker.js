let quoteTimer = null;
let stocks = null;

let quoteUrl = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot'
// https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=601012&callback=jQuery18304735019505463437_1624277312927&_=1624277415671
let ztPoolUrl = 'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&cb=cbztPoolback&date=';

function doWork() {
    if (stocks) {
        stocks.forEach(function(s) {
            quoteSnapshot(s);
        });
    };
}

function xmlHttpGet(url) {
    var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
    httpRequest.open('GET', url, true);//第二步：打开连接 
    httpRequest.send();//第三步：发送请求 
    /**
     * 获取数据后的处理程序
     */
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            eval(httpRequest.responseText);
        }
    };
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
    }
});

