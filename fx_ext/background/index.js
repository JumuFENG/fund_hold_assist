(function () {
    'use strict';

    function notify(message, sender, response) {
        if (message.command == 'emjy.contentLoaded') {
            emjyBack.onContentLoaded(message, sender.tab.id, response);
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
        } else {
            console.log('Unknown command', message);
        }
    }

    chrome.runtime.onMessage.addListener(notify);
    emjyBack = new EmjyBack();
    emjyBack.createMainTab();
    emjyBack.Init();
    alarmHub.setupAlarms();
    istrManager.initExtStrs();
}());
