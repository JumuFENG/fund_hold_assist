let ztPoolUrl = 'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&cb=cbztPoolback&date=';
let futuStockUrl = 'https://www.futunn.com/stock/';

function getTopicZTPool(date) {
    var url = ztPoolUrl + date;
    var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
    httpRequest.open('GET', url, true);//第二步：打开连接 
    httpRequest.send();//第三步：发送请求 
    /**
     * 获取数据后的处理程序
     */
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            cbztPoolback(httpRequest.responseText);
            //eval(httpRequest.responseText);
        }
    };    
}

function cbztPoolback(text) {
    var ztpool = JSON.parse(text.substring('cbztPoolback('.length, text.length - 2));
    var ztStocks = [];
    for (var i = 0; i < ztpool.data.pool.length; ++i) {
        var stock = ztpool.data.pool[i];
        if (stock.c.startsWith('68') || stock.c.startsWith('30')) {
            continue;
        }
        if (stock.n.includes("ST")) {
            continue;
        }
        if (stock.n.endsWith('退')) {
            continue;
        }
        if (stock.n.startsWith('退市')) {
            continue;
        }
        if (stock.lbc > 1) {
            continue;
        }
        if (stock.zttj.days != stock.zttj.ct) {
            continue;
        }
        var name = stock.n;
        var code = stock.c;
        var url = futuStockUrl + code + (stock.m == '0' ? '-SZ' : '-SH');
        ztStocks.push({name, code, url});
    }

    if (emjyManager) {
        emjyManager.ztPool.refreshZtPool(ztStocks);
    };
}

class ZtPool {
    constructor() {
        this.root = document.createElement('div');
        this.ztListDiv = null;
    }

    createZtArea() {
        var getZtBtn = document.createElement('button');
        getZtBtn.textContent = '获取涨停股池';
        getZtBtn.onclick = function(e) {
            var now = new Date();
            var date = now.getFullYear() + ('' + (now.getMonth() + 1)).padStart(2, '0');
            if (now.getHours() < 10) {
                date += ('' + (now.getDate() - 1)).padStart(2, '0');
            } else {
                date += ('' + now.getDate()).padStart(2, '0');
            }
            getTopicZTPool(date);
        }
        this.root.appendChild(getZtBtn);
    }

    refreshZtPool(stocks) {
        if (!this.ztListDiv) {
            this.ztListDiv = document.createElement('div');
            this.root.appendChild(this.ztListDiv);
        }
        utils.removeAllChild(this.ztListDiv);
        for (var i = 0; i < stocks.length; i++) {
            var ztItem = document.createElement('div');
            ztItem.appendChild(document.createTextNode((i + 1) + ' '));
            ztItem.appendChild(document.createTextNode(stocks[i].code + ' '));
            var anchor = document.createElement('a');
            anchor.textContent = stocks[i].name;
            anchor.href = stocks[i].url;
            anchor.target = '_blank';
            ztItem.appendChild(anchor);
            this.ztListDiv.appendChild(ztItem);
        };
    }
};

