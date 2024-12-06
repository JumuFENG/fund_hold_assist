(function() {
    "use strict";
    var stockInfo = {};

    function logInfo(...args) {
        console.log(args);
    }

    window.onload = function() {
        document.querySelector("#fund_code_name").textContent = chrome.i18n.getMessage("popup_fund_code");
        document.querySelector("#fund_name_name").textContent = chrome.i18n.getMessage("fund_name_name");
        document.querySelector("#fund_value_name").textContent = chrome.i18n.getMessage("fund_value_name");
        document.querySelector("#fund_esti_name").textContent = chrome.i18n.getMessage("fund_esti_name");
        document.querySelector("#fund_growth_name").textContent = chrome.i18n.getMessage("fund_growth_name");
        document.querySelector('#btn_open_start_page').textContent = chrome.i18n.getMessage("btn_open_start_page");
        document.querySelector('#btn_open_dashbard').textContent = chrome.i18n.getMessage("btn_open_dashbard");
        chrome.runtime.sendMessage({command: 'popup.costdogs'}, cdogs => {
            var csel = document.querySelector('#stock_buy_cost');
            var blankopt = new Option('成本方案', '');
            csel.options.add(blankopt);
            for (var k in cdogs) {
                csel.options.add(new Option(k, k));
            }
        });
    }

    document.querySelector('#btn_open_start_page').onclick = e => {
        // var startPageUrl = 'https://jywg.18.cn/MarginTrade/Buy';
        // var accountCrAssets = 'https://jywg.18.cn/MarginSearch/MyAssets';
        // window.open(startPageUrl, '_blank');
        chrome.tabs.create({url:'/background/manage.html'});
        window.close();
    };

    document.querySelector('#btn_open_dashbard').onclick = e => {
        chrome.tabs.create({url:'http://47.100.77.253/home/stkanalyzer/dailydata.html'});
        window.close();
    };

    function toggleRenderBlock(w) {
        if (w == 'rstock') {
            document.querySelector('#stock_op_block').style.display = 'block';
            document.querySelector('#fund_op_block').style.display = 'none';
        } else if (w == 'rfund') {
            document.querySelector('#stock_op_block').style.display = 'none';
            document.querySelector('#fund_op_block').style.display = 'block';
        }
    }

    document.querySelector('#rstock').onclick = () => {
        toggleRenderBlock(document.querySelector('input[name="popradius"]:checked').value)
    };

    document.querySelector('#rfund').onclick = () => {
        toggleRenderBlock(document.querySelector('input[name="popradius"]:checked').value)
    }

    function getHttpResponse(url, cb) {
        var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
        httpRequest.open('GET', url, true);//第二步：打开连接 
        httpRequest.send();//第三步：发送请求 
        /**
         * 获取数据后的处理程序
         */
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                logInfo("httpRequest get response OK.");
                if (typeof(cb) == "function") {
                    cb(httpRequest.responseText);
                }
            }
        };
    }

    function getFundInfo (code) {
        var url = 'http://fundgz.1234567.com.cn/js/' + code + '.js?rt=' +  (new Date()).getTime();
        getHttpResponse(url, rsp => {
            var json = rsp.substr("jsonpgz(".length);
            var jsonp = JSON.parse(json.substr(0, json.length - 2));
            document.getElementById('fund_name').innerText = jsonp["name"];
            document.getElementById('fund_value').innerText = jsonp["dwjz"];
            document.getElementById('fund_value_gsz').innerText = jsonp["gsz"];
            var tdfundgrowth = document.getElementById('fund_growth');
            tdfundgrowth.innerText = jsonp["gszzl"] + "%";
            if (parseFloat(jsonp["gszzl"]) < 0) {
                tdfundgrowth.className = "growth_decrease";
            } else {
                tdfundgrowth.className = "growth_increase";
            }
        });
    }

    function getStockInfo(code) {
        var url = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?callback=jSnapshotBack&id=' + code;
        getHttpResponse(url, rsp => {
            var snapshot = JSON.parse(rsp.match(/jSnapshotBack\((.+?)\);/)[1]);
            if (snapshot.code !== code) {
                document.querySelector('#stock_err_info').textContent = 'Error when get stock info!';
                return;
            }
            stockInfo = {code: snapshot.code, name: snapshot.name, topprice: snapshot.topprice,
                bottomprice: snapshot.bottomprice, yesClosePrice: snapshot.fivequote.yesClosePrice,
                currentPrice: snapshot.realtimequote.currentPrice, zd: snapshot.realtimequote.zd,
                zdf: snapshot.realtimequote.zdf
            }
            document.querySelector('#stock_name').textContent = stockInfo.name;
            document.querySelector('#stock_price_chg').innerHTML =
            `涨停价: <span style="color: red;">${stockInfo.topprice}</span>
            最新价: <span style="color: ${stockInfo.zd > 0 ? 'red' : 'green'};">${stockInfo.currentPrice}</span>
            涨跌幅: <span style="color: ${stockInfo.zd > 0 ? 'red' : 'green'};">${stockInfo.zdf}</span>`;
            let s3 = snapshot.fivequote.sale3;
            if (snapshot.fivequote.sale1 == snapshot.fivequote.buy1) {
                s3 = (stockInfo.currentPrice * 1.03).toFixed(2);
                if (s3 - stockInfo.topprice > 0) {
                    s3 = stockInfo.topprice;
                }
            }
            if (s3 == '-') {
                s3 = stockInfo.topprice;
            }
            document.querySelector('#stock_buy_price_value').value = s3;
        });
    }

    document.querySelector('#btn_ok').onclick = function(e) {
        var fundcode = document.querySelector('#fund_code_value').value;
        getFundInfo(fundcode);
    }

    document.querySelector('#fund_code_value').onkeydown = function(e) {
        if (e.keyCode == 13) {
            getFundInfo(e.target.value);
        };
    };

    document.querySelector('#stock_code_value').onkeydown = function(e) {
        if (e.keyCode == 13) {
            getStockInfo(e.target.value);
        };
    };

    document.querySelector('#stock_code_value').onblur = function(e) {
        if (e.target.value.length == 6) {
            getStockInfo(e.target.value);
        };
    };

    document.querySelector('#btn_stock_ok').onclick = e => {
        document.querySelector('#stock_err_info').textContent = '';
        var code = document.querySelector('#stock_code_value').value;
        if (!code) {
            document.querySelector('#stock_err_info').textContent = 'code is empty';
            return;
        }
        var amount = document.querySelector('#stock_buy_amt_value').value;
        var urkey = document.querySelector('#stock_buy_cost').value;
        if (!amount && !urkey) {
            document.querySelector('#stock_err_info').textContent = 'amount and cost are empty';
            return;
        }
        let price = document.querySelector('#stock_buy_price_value').value;
        var account = document.querySelector('#stock_buy_acc_select').value;
        var strategies = {};
        if (urkey) {
            strategies.uramount = {key: urkey};
        }
        chrome.runtime.sendMessage({command: 'popup.buystock', code, price, amount, account, strategies});
    }
})();
