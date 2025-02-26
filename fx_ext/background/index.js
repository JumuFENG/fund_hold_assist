(function () {
    'use strict';

    let emjyBack = null;

    function logInfo(...args) {
        console.log(`[${new Date().toLocaleTimeString('zh',{hour12:false})}] ${args.join(' ')}`);
    }

    function sendMessage(data) {
        chrome.tabs.query({active:true, currentWindow:true}, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, data);
        });
    }

    function notify(message, sender, response) {
        logInfo("background receive message: " + message.command);
        if (message.command == 'REST.Get') {
            fetch(message.url).then(r=>r.text()).then(text => sendMessage({command: "response", response: text}));
        } else if (message.command == 'emjy.contentLoaded') {
            emjyBack.onContentLoaded(message, sender.tab.id);
            logInfo('emjy.Loaded', message.url);
        } else if (message.command.startsWith('emjy.') && emjyBack) {
            emjyBack.onContentMessageReceived(message, sender.tab.id);
        } else if (message.command.startsWith('mngr.')) {
            if (sender.tab) {
                emjyBack.onManagerMessageReceived(message, sender.tab.id);
            } else {
                emjyBack.onManagerMessageReceived(message, null);
            }
        } else if (message.command.startsWith('popup.')) {
            emjyBack.onPopupMessageReceived(message, sender, response);
        }
    }

    chrome.runtime.onMessage.addListener(notify);
    emjyBack = new EmjyBack();
    emjyBack.startup();
}());
