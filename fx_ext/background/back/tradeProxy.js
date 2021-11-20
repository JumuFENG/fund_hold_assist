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
                            if (this.task.command.startsWith('emjy.trade')) {
                                this.sendCheckError();
                            }
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
                    if (r.result == 'error' && r.reason == 'maxCountInvalid') {
                        emjyBack.log('retry ', this.retry, JSON.stringify(r));
                        if (this.retry < 10) {
                            this.retry++;
                            return;
                        };
                    };
                    clearInterval(tabInterval);
                    if (r.result == 'success') {
                        emjyBack.onContentMessageReceived(r, this.tabid);
                        if (r.what === undefined || r.what.includes('委托编号')) {
                            this.closeTab();
                        } else {
                            emjyBack.log(this.tabid, JSON.stringify(r));
                        }
                    };
                };
            });
        }, 500);
    }

    sendCheckError() {
        this.checkInterval = setInterval(() => {
            chrome.tabs.sendMessage(this.tabid, {command:'emjy.checkContentError'});
        }, 500);
    }

    pageLoaded() {
        emjyBack.log('pageLoaded', this.url);
    }

    closeTab() {
        if (this.tabid && this.tabOpened) {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
            }
            chrome.tabs.remove(this.tabid);
            this.tabOpened = false;
        };
    }
}