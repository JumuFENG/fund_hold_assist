(function() {
    "use strict";

    function logInfo(...args) {
        console.log(args);
    }

    window.onload = function() {
        document.getElementById("fund_code_name").textContent = chrome.i18n.getMessage("popup_fund_code");
        document.getElementById("fund_name_name").textContent = chrome.i18n.getMessage("fund_name_name");
        document.getElementById("fund_value_name").textContent = chrome.i18n.getMessage("fund_value_name");
        document.getElementById("fund_esti_name").textContent = chrome.i18n.getMessage("fund_esti_name");
        document.getElementById("fund_growth_name").textContent = chrome.i18n.getMessage("fund_growth_name");
    }

    function getHttpRequest (code) {
        var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
        httpRequest.open('GET', 'http://fundgz.1234567.com.cn/js/' + code + '.js?rt=' +  (new Date()).getTime(), true);//第二步：打开连接 
        httpRequest.send();//第三步：发送请求 
        /**
         * 获取数据后的处理程序
         */
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                logInfo("httpRequest get response OK.");
                var json = httpRequest.responseText.substr("jsonpgz(".length);
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
            }
        };
    }

    document.getElementById('btn_ok').onclick = function(e) {
        var fundcode = document.getElementById('fund_code_value').value;
        getHttpRequest(fundcode);
    }

    document.getElementById('fund_code_value').onkeydown = function(e) {
        if (e.keyCode == 13) {
            getHttpRequest(e.target.value);
        };
    };
})();
