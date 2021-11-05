(function () {
    'use strict';

    let emjyBack = null;

    function logInfo(...args) {
        var dt = new Date();
        console.log('[' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds()  + '] ' +  args.join(' '));
    }
    
    function sendMessage(data) {
        chrome.tabs.query({active:true, currentWindow:true}, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, data);
        });
    }

    function getHttpRequest (url) {
        var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
        httpRequest.open('GET', url, true);//第二步：打开连接 
        httpRequest.send();//第三步：发送请求 
        /**
         * 获取数据后的处理程序
         */
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                logInfo("httpRequest get response OK.");
                var json = httpRequest.responseText;//获取到json字符串，还需解析
                sendMessage({command: "response", response: json});
            }
        };
    }

    function notify(message, sender) {
        logInfo("background receive message: " + JSON.stringify(message));
        if (message.command == 'REST.Get') {
            getHttpRequest(message.url);
        } else if (message.command == 'emjy.contentLoaded') {
            if (!emjyBack) {
                emjyBack = new EmjyBack();
                emjyBack.Init();
            }
            emjyBack.onContentLoaded(message, sender.tab.id);
            logInfo('emjy.Loaded', message.url);
        } else if (message.command.startsWith('emjy.') && emjyBack) {
            emjyBack.onContentMessageReceived(message, sender.tab.id);
        } else if (message.command.startsWith('mngr.')) {
            if (!emjyBack) {
                emjyBack = new EmjyBack();
                emjyBack.Init();
            };
            if (sender.tab) {
                emjyBack.onManagerMessageReceived(message, sender.tab.id);
            } else {
                emjyBack.onManagerMessageReceived(message, null);
            }
        }
    }

    chrome.runtime.onMessage.addListener(notify);
}());
