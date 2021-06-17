(function () {
    'use strict';
    
    let ExtensionLoadedEvent = "ExtensionLoaded";
    let UrlToGetEvent = "UrlToGet";
    let RealtimeInfoFetchedEvent = "RealtimeInfoReturned"

    function logInfo(...args) {
        //console.log(args.join(' '));
    }

    function isFirefox() {
        return navigator.userAgent.includes('Firefox');
    }
    
    function isMacOS() {
        return navigator.platform.toLowerCase().startsWith('mac');
    }

    function onMessage(message) {
        if (message.command === "response") {
            let infoFetchedEvt = new CustomEvent(RealtimeInfoFetchedEvent, {
                detail: message.response
            });
            document.dispatchEvent(infoFetchedEvt);
        } else {
            logInfo("command not recognized.");
        }
    }

    chrome.runtime.onMessage.addListener(onMessage);

    document.addEventListener(UrlToGetEvent, e => {
        logInfo(e.detail.url);
        chrome.runtime.sendMessage({url: e.detail.url, command: 'REST.Get'});
    })

    document.dispatchEvent(new CustomEvent(ExtensionLoadedEvent, {
        detail: "1"
    }));
}());
