(function () {
    'use strict';

    function logInfo(...args) {
        //console.log(args);
    }

    function isFirefox() {
        return navigator.userAgent.includes('Firefox');
    }
    
    function isMacOS() {
        return navigator.platform.toLowerCase().startsWith('mac');
    }

    function jsonpgz(fundgz) {
        logInfo(fundgz);
        document.getElementById("guzhi_lgz").value = fundgz.gsz;
        document.getElementById("btn_ok").onclick();
    }

    function onMessage(message) {
        if (message.command === "rtgz") {
            eval(message.jsonp);
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

        logInfo("send code to background.");
        browser.runtime.sendMessage({"code": target.value});
    }

    window.addEventListener("click", notifyExtension);
}());
