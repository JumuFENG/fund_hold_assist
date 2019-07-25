(function () {
    'use strict';
    
    let CustomEventName = "SelectedFundCode";

    function logInfo(...args) {
        //alert(args);
        console.log(args);
    }

    function isFirefox() {
        return navigator.userAgent.includes('Firefox');
    }
    
    function isMacOS() {
        return navigator.platform.toLowerCase().startsWith('mac');
    }


    function onMessage(message) {
        if (message.command === "rtgz") {
            document.getElementById("btn_ok").value = message.jsonp;
            document.getElementById("btn_ok").click();
        } else {
            logInfo("command not recognized.");
        }
    }

    chrome.runtime.onMessage.addListener(onMessage);

    // document.getElementById("fundlist").onchange = function (e) {
    //     chrome.runtime.sendMessage({"code": e.target.value});
    // }

    document.addEventListener(CustomEventName, e => {
        logInfo(e.detail.code);
        chrome.runtime.sendMessage({"code": e.detail.code});
    })
}());
