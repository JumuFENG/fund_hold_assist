'use strict';

class TradeProxy {
    constructor() {
        this.tabid = null;
        this.url = null;
        this.triggered = false;
        this.task = null;
        this.tabOpened = false;
        this.active = true;
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
            if (this.task) {
                this.sendTaskMessage();
            };
        });
    }

    sendTaskMessage() {
        var tabInterval = setInterval(() => {
            chrome.tabs.sendMessage(this.tabid, this.task, r => {
                if (r.command == this.task.command && r.status == 'success') {
                    console.log(this.tabid, r);
                    clearInterval(tabInterval);
                    if (r.result == 'success') {
                        emjyBack.onContentMessageReceived(r, this.tabid);
                        this.closeTab();
                    };
                };
            });
        }, 300);
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