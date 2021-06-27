let quoteTimer = null;
let stocks = null;

let quoteUrl = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot'
// https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=601012&callback=jQuery18304735019505463437_1624277312927&_=1624277415671

function doWork() {
    if (stocks) {
        stocks.forEach(function(s) {
            quoteSnapshot(s);
        });
    };
}

function quoteSnapshot(code) {
    var url = quoteUrl + '?id=' + code + '&callback=jSnapshotBack&_=' + Date.now();
    var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
    httpRequest.open('GET', url, true);//第二步：打开连接 
    httpRequest.send();//第三步：发送请求 
    /**
     * 获取数据后的处理程序
     */
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            eval(httpRequest.responseText)
        }
    };    
}

function jSnapshotBack(snapshot) {
    postMessage({command: 'quote.snapshot', snapshot: snapshot});
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
    }
});

