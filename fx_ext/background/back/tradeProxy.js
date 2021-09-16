'use strict';

class TradeProxy {
    constructor() {
        this.tabid = null;
        this.url = null;
        this.triggered = false;
        this.task = null;
        this.tabOpened = false;
        this.active = true;
        this.retry = 0;
    }

    triggerTask() {
        if (this.triggered) {
            return;
        };
        this.openTab(this.url, this.active);
        this.tabOpened = true;
        this.triggered = true;
    }

    openTab(url, active) {
        chrome.tabs.create({url, active}, tab => {
            this.tabid = tab.id;
            var loadInterval = setInterval(() => {
                chrome.tabs.get(this.tabid, t => {
                    if (t.status == 'complete' && t.url == this.url) {
                        clearInterval(loadInterval);
                        if (this.task) {
                            this.sendTaskMessage();
                        };
                    };
                });
            }, 200);
        });
    }

    sendTaskMessage() {
        var tabInterval = setInterval(() => {
            chrome.tabs.sendMessage(this.tabid, this.task, r => {
                if (r.command == this.task.command && r.status == 'success') {
                    console.log(this.tabid, r);
                    if (r.result == 'error' && r.reason == 'maxCountInvalid') {
                        if (this.retry < 10) {
                            this.retry++;
                            return;
                        };
                        console.log('retry ', this.retry);
                    };
                    clearInterval(tabInterval);
                    if (r.result == 'success') {
                        emjyBack.onContentMessageReceived(r, this.tabid);
                        this.closeTab();
                    };
                };
            });
        }, 200);
    }

    pageLoaded() {
        console.log('pageLoaded');
    }

    closeTab() {
        if (this.tabid && this.tabOpened) {
            chrome.tabs.remove(this.tabid);
            this.tabOpened = false;
        };
    }
}