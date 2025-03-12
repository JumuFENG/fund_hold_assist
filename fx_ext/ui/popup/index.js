(function() {
    "use strict";
    var stockInfo = {};

    window.onload = function() {
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
        var stsel = document.querySelector('#stock_buy_strategy');
        stsel.options.add(new Option('买卖策略', ''));
        const strategyoptions = {'StrategyBuyDTBoard': '跌停开板买入', 'StrategyBuyZTBoard': '打板买入', 'StrategySellELS': '涨停开板卖出'};
        for (var k in strategyoptions) {
            stsel.options.add(new Option(strategyoptions[k], k));
        }
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

    function getStockInfo(code) {
        var url = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?callback=jSnapshotBack&id=' + code;
        fetch(url).then(r=>r.text()).then(rsp => {
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

    function generate_strategy_json(key, sinfo) {
        const strobjs = {
            "StrategySellELS": {"key": "StrategySellELS", "enabled": true, "cutselltype": "all", "selltype":"all"},
            "StrategyBuyZTBoard": { "key": "StrategyBuyZTBoard", "enabled": true },
            "StrategyBuyDTBoard": { "key":"StrategyBuyDTBoard", "enabled": true},
        }
        return Object.assign(strobjs[key], sinfo);
    }

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
        const sinfo = {};
        const skey = document.querySelector('#stock_buy_strategy').value;
        if (skey == 'StrategySellELS') {
            sinfo.guardPrice = (price * 0.95).toFixed(2)
        }
        let tradestr = generate_strategy_json(skey, sinfo);

        var account = document.querySelector('#stock_buy_acc_select').value;
        var strategies = {};
        if (urkey) {
            strategies.uramount = {key: urkey};
        }
        if (tradestr) {
            strategies.strinfo = tradestr;
            chrome.runtime.sendMessage({command: 'popup.addwatch', code, amount, account, strategies});
        } else {
            chrome.runtime.sendMessage({command: 'popup.buystock', code, price, amount, account, strategies}, brsp => {
                let result = brsp?.sid? '委托成功, 委托编号：' + brsp.sid : '委托失败!';
                document.querySelector('#stock_err_info').textContent = result;
            });
        }
    }
})();
