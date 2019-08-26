(function () {
    'use strict';
    
    let ExtensionLoadedEvent = "ExtensionLoaded";
    let CodeToFetchEvent = "FundCodeToFetch";
    let RealtimeInfoFetchedEvent = "FundGzReturned"

    function logInfo(...args) {
        //console.log(args);
    }

    function isFirefox() {
        return navigator.userAgent.includes('Firefox');
    }
    
    function isMacOS() {
        return navigator.platform.toLowerCase().startsWith('mac');
    }

    function onMessage(message) {
        if (message.command === "rtgz") {
            let infoFetchedEvt = new CustomEvent(RealtimeInfoFetchedEvent, {
                detail: message.jsonp
            });
            document.dispatchEvent(infoFetchedEvt);
        } else {
            logInfo("command not recognized.");
        }
    }

    chrome.runtime.onMessage.addListener(onMessage);

    document.addEventListener(CodeToFetchEvent, e => {
        logInfo(e.detail.code);
        chrome.runtime.sendMessage({"code": e.detail.code});
    })

    document.dispatchEvent(new CustomEvent(ExtensionLoadedEvent, {
        detail: "1"
    }));
}());
