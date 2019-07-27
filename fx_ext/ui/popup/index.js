(function() {
    "use strict";

    function logInfo(...args) {
        console.log(args);
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
                document.getElementById('fund_growth').innerText = jsonp["gszzl"] + "%";
            }
        };
    }

    document.getElementById('btn_ok').onclick = function(e) {
        var fundcode = document.getElementById('fund_code_value').value;
        getHttpRequest(fundcode);
    }
})();
