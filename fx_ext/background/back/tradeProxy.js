'use strict';
let EmjyUrlRoot = 'https://jywg.18.cn';
let NewStockPurchaseUrl = 'https://jywg.18.cn/Trade/NewBatBuy';
let NewBondsPurchaseUrl = 'https://jywg.18.cn/Trade/XzsgBatPurchase';
let BondRepurchaseUrl = 'https://jywg.18.cn/BondRepurchase/SecuritiesLendingRepurchase';

class CommanderBase {
    constructor() {
        this.tabid = null;
        this.url = null;
        this.triggered = false;
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
            var loadInterval = setInterval(() => {
                chrome.tabs.get(this.tabid, t => {
                    if (t.status == 'complete' && t.url == this.url) {
                        clearInterval(loadInterval);
                        this.sendTaskMessage();
                    };
                });
            }, 200);
        });
    }

    sendTaskMessage() {
        if (this.command) {
            emjyBack.log('sendTaskMessage', this.command, 'to tab', this.tabid);
            chrome.tabs.sendMessage(this.tabid, {command: this.command}, r => {
                this.onReactResponsed(r);
            });
        }
    }

    onReactResponsed(r) {
        emjyBack.log('onReactResponsed: ', JSON.stringify(r), 'tab', this.tabid);
    }

    sendStepMessage(step) {
        setTimeout(()=>{
            emjyBack.log('sendStepMessage', step, 'tab', this.tabid);
            chrome.tabs.sendMessage(this.tabid, {command: 'emjy.step', step}, r => {
                this.onReactResponsed(r);
            });
        }, 100);
    }

    pageLoaded() {
        emjyBack.log('pageLoaded', this.url, 'tab', this.tabid);
    }

    closeTab() {
        if (this.tabid && this.tabOpened) {
            emjyBack.log('closeTab tab', this.tabid);
            chrome.tabs.remove(this.tabid);
            this.tabOpened = false;
        };
    }
}

class DirectCommander extends CommanderBase {
    constructor(path) {
        super();
        this.url = EmjyUrlRoot + path;
    }

    onReactResponsed(r) {
        if (r.command == 'step') {
            if (r.step == 'waiting') {
                this.sendStepMessage('get');
                emjyBack.log(JSON.stringify(r), 'tab', this.tabid);
                return;
            }
            if (r.step == 'got') {
                this.onGotResponsed(r);
                this.closeTab();
                return;
            }
        }
        emjyBack.log('Direct command', this.command, JSON.stringify(r), 'tab', this.tabid);
    }
}

class NewStocksCommander extends CommanderBase {
    constructor() {
        super();
        this.url = NewStockPurchaseUrl;
        this.command = 'emjy.trade.newstocks';
    }

    onReactResponsed(r) {
        if (r.command == 'step') {
            if (r.step == 'set') {
                var count = r.count;
                if (count > 0) {
                    this.sendStepMessage('batclick');
                    return;
                } else {
                    emjyBack.log(this.command, 'stock/bond count =', count, 'tab', this.tabid);
                    this.closeTab();
                    return;
                }
            } else if (r.step == 'batclick') {
                if (r.status == 'done') {
                    this.sendStepMessage('confirm');
                    return;
                }
            } else if (r.step == 'confirm') {
                if (r.status == 'done') {
                    this.sendStepMessage('waitcomplete');
                    return;
                } else if (r.status == 'waiting') {
                    this.sendStepMessage('confirm');
                    return;
                }
            } else if (r.step == 'waitcomplete') {
                if (r.status == 'done') {
                    emjyBack.log('new stock/bond bat buy success, alert =', r.alert, 'tab', this.tabid);
                    this.closeTab();
                    return;
                } else if (r.status == 'waiting') {
                    this.sendStepMessage('waitcomplete');
                    return;
                }
            }
            emjyBack.log('error: ', r, 'tab', this.tabid);
        }
    }
}

class NewBondsCommander extends NewStocksCommander {
    constructor() {
        super();
        this.url = NewBondsPurchaseUrl;
        this.command = 'emjy.trade.newbonds';
    }
}

class BondRepurchaseCommander extends CommanderBase {
    constructor(code, active) {
        super();
        this.url = BondRepurchaseUrl;
        this.command = 'emjy.trade.bonds';
        this.code = code;
        this.active = active;
        this.chkcountRetry = 0;
    }

    sendTaskMessage() {
        emjyBack.log('sendTaskMessage', this.command, 'to tab', this.tabid);
        chrome.tabs.sendMessage(this.tabid, {command: this.command, code: this.code}, r => {
            this.onReactResponsed(r);
        });
    }

    onReactResponsed(r) {
        if (r.command == 'step') {
            if (r.step == 'codeinput') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('codeinput');
                    return;
                }
                if (r.status == 'done') {
                    this.sendStepMessage('quicksale');
                    return;
                }
            }
            if (r.step == 'quicksale') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('quicksale');
                    return;
                }
                if (r.status == 'done') {
                    this.sendStepMessage('chkcount');
                    return;
                }
            }
            if (r.step == 'chkcount') {
                if (r.status == 'done') {
                    this.sendStepMessage('confirm');
                    return;
                }
                if (r.status == 'waiting') {
                    if (this.chkcountRetry < 80) {
                        this.sendStepMessage('chkcount');
                        this.chkcountRetry ++;
                        return;
                    } else {
                        emjyBack.log('BondRepurchase retry =', this.chkcountRetry, 'tab', this.tabid);
                        this.closeTab();
                        return;
                    }
                }
            }
            if (r.step == 'confirm') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('confirm');
                    return;
                }
                if (r.status == 'done') {
                    this.sendStepMessage('waitcomplete');
                    return;
                }
            }
            if (r.step == 'waitcomplete') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('waitcomplete');
                    return;
                }
                if (r.status == 'done') {
                    emjyBack.log('BondRepurchase complete, alert =', r.alert, 'tab', this.tabid);
                    this.closeTab();
                    return;
                }
            }
        }
        emjyBack.log(JSON.stringify(r), 'tab', this.tabid);
    }
}

class TradeCommander extends CommanderBase {
    constructor(path, code, name, count, price) {
        super();
        this.command = 'emjy.trade';
        this.url = EmjyUrlRoot + path;
        this.url += '?code=' + code;
        var market = emjyBack.getHSMarketFlag(code);
        if (market != '') {
            this.url += '&mt=' + market;
        };
        this.code = code;
        this.name = name;
        this.count = count;
        this.price = price;
        this.chksubmitRetry = 0;
    }

    sendTaskMessage() {
        emjyBack.log('sendTaskMessage', this.command, 'to tab', this.tabid);
        chrome.tabs.sendMessage(this.tabid, {command: this.command, code: this.code, name: this.name, count: this.count, price: this.price}, r => {
            this.onReactResponsed(r);
        });
    }

    onReactResponsed(r) {
        if (r.command == 'step') {
            if (r.step == 'stockinput') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('stockinput');
                } else if (r.status == 'done') {
                    this.sendStepMessage('chksubmit');
                } else if (r.status == 'error') {
                    emjyBack.log('Trade error, what =', r.what, 'tab', this.tabid);
                }
                return;
            }
            if (r.step == 'chksubmit') {
                if (r.status == 'waiting') {
                    if (r.what !== undefined) {
                        emjyBack.log('Trade submit waiting, what =', r.what, 'tab', this.tabid);
                    }
                    if (this.chksubmitRetry < 80) {
                        this.sendStepMessage('chksubmit');
                        this.chksubmitRetry ++;
                        return;
                    } else {
                        emjyBack.log('Trade check submit retry =', this.chksubmitRetry, 'tab', this.tabid);
                        this.closeTab();
                        return;
                    }
                }
                if (r.status == 'error') {
                    emjyBack.log('Trade error, what =', r.what, 'tab', this.tabid);
                    return;
                }
                if (r.status == 'done') {
                    this.sendStepMessage('confirm');
                    return;
                }
            }
            if (r.step == 'confirm') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('confirm');
                    return;
                }
                if (r.status == 'done') {
                    this.sendStepMessage('waitcomplete');
                    return;
                }
            }
            if (r.step == 'waitcomplete') {
                if (r.status == 'waiting') {
                    this.sendStepMessage('waitcomplete');
                    return;
                }
                if (r.status == 'done') {
                    emjyBack.log('Trade complete, alert =', r.alert, 'tab', this.tabid);
                    this.closeTab();
                    return;
                }
            }
        }
        emjyBack.log(JSON.stringify(r), 'tab', this.tabid);
    }
}
