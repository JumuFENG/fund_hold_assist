(function () {
    'use strict';

    function logInfo(...args) {
        alert(args);
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
            document.getElementById("btn_ok").onclick();
        } else {
            logInfo("command not recognized.");
        }
    }

    browser.runtime.onMessage.addListener(onMessage);

    function notifyExtension(e) {
        var target = e.target;
        while (target.tagName != "OPTION" && target.parentNode) {
            target = target.parentNode;
        }
        if (target.tagName != "OPTION")
            return;

        logInfo("send code:" + target.value + " to background.");
        browser.runtime.sendMessage({"code": target.value});
    }

    window.addEventListener("click", notifyExtension);
}());
