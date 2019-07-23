(function () {
    'use strict';

    function logInfo(...args) {
        //console.log(args);
    }
    
    function getActiveTab() {
        return browser.tabs.query({active: true, currentWindow: true});
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
                var json = httpRequest.responseText;//获取到json字符串，还需解析
                getActiveTab().then((tabs) => {
                    browser.tabs.sendMessage(tabs[0].id, {
                        command: "rtgz",
                        jsonp: json}
                    );
                })
            }
        };
    }

    function notify(message) {
        logInfo("background receive message: " + message.code);
        getHttpRequest(message.code);
    }

    browser.runtime.onMessage.addListener(notify);
}());
