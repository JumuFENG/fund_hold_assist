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

class NewStocksClient {
    constructor(validateKey) {
        this.validateKey = validateKey;
    }

    GetCanBuy() {
        var url = 'https://jywg.18.cn/Trade/GetCanBuyNewStockListV3?validatekey=' + this.validateKey;
        xmlHttpPost(url, null, null, response => {
            var robj = JSON.parse(response);
            if (robj.NewStockList && robj.NewStockList.length > 0) {
                this.buyNewStocks(robj.NewStockList);
                return;
            }
            console.log(robj);
        });
    }

    buyNewStocks(stocks) {
        var data = [];
        for (let i = 0; i < stocks.length; i++) {
            const stk = stocks[i];
            // if (!stk.Zqdm.startsWith('00') && !stk.Zqdm.startsWith('60')) {
            //     continue;
            // }
            if (!stk.Fxj - 100 > 0) {
                // ignore.
                continue;
            }
            if (stk.Ksgsx - 0 <= 0) {
                continue;
            }
            var StockCode = stk.Sgdm;
            var StockName = stk.Zqmc;
            var Price = stk.Fxj;
            var Amount = parseInt(stk.Ksgsx);
            var TradeType = "B";
            var Market = stk.Market;
            data.push({StockCode, StockName, Price, Amount, TradeType, Market});
        }

        if (data.length == 0) {
            emjyBack.log('buyNewStocks no new stocks to buy!');
            return;
        }

        var jdata = JSON.stringify(data);
        emjyBack.log('buyNewStocks', jdata);
        var url = 'https://jywg.18.cn/Trade/SubmitBatTradeV2?validatekey=' + this.validateKey;
        var header = {"Content-Type": "application/json"}
        xmlHttpPost(url, jdata, header, response => {
            var robj = JSON.parse(response);
            if (robj.Status == 0) {
                emjyBack.log('buyNewStocks success', robj.Message);
            } else {
                emjyBack.log('buyNewStocks error', response);
            }
        });
    }

    buy() {
        if (!this.validateKey) {
            emjyBack.log('no valid validateKey', this.validateKey);
            return;
        }
        this.GetCanBuy();
    }
}

class NewBondsClient {
    constructor(validateKey) {
        this.validateKey = validateKey;
    }

    GetCanBuy() {
        var url = 'https://jywg.18.cn/Trade/GetConvertibleBondListV2?validatekey=' + this.validateKey;
        xmlHttpPost(url, null, null, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log('unknown error', response);
                return;
            }
            if (robj.Data && robj.Data.length > 0) {
                this.buyNewBonds(robj.Data);
                return;
            }
            emjyBack.log('no new bonds', response);
        });
    }

    buyNewBonds(bonds) {
        var data = [];
        for (let i = 0; i < bonds.length; i++) {
            const bondi = bonds[i];
            if (!bondi.ExIsToday) {
                continue;
            }
            var StockCode = bondi.SUBCODE;
            var StockName = bondi.SUBNAME;
            var Price = bondi.PARVALUE;
            var Amount = bondi.LIMITBUYVOL;
            var TradeType = "B";
            var Market = bondi.Market;
            data.push({StockCode, StockName, Price, Amount, TradeType, Market});
        }

        if (data.length == 0) {
            emjyBack.log('buyNewBonds no new bonds to buy!');
            return;
        }

        var jdata = JSON.stringify(data);
        emjyBack.log('buyNewStocks', jdata);
        var url = 'https://jywg.18.cn/Trade/SubmitBatTradeV2?validatekey=' + this.validateKey;
        var header = {"Content-Type": "application/json"}
        xmlHttpPost(url, jdata, header, response => {
            var robj = JSON.parse(response);
            if (robj.Status == 0) {
                emjyBack.log('buyNewBonds success', robj.Message);
            } else {
                emjyBack.log('buyNewBonds error', response);
            }
        });
    }

    buy() {
        if (!this.validateKey) {
            emjyBack.log('no valid validateKey', this.validateKey);
            return;
        }
        this.GetCanBuy();
    }
}

class BondRepurchaseClient {
    constructor(validateKey, cb) {
        this.validateKey = validateKey;
        this.exitcb = cb;
    }

    exit() {
        if (typeof(this.exitcb) == 'function') {
            this.exitcb();
        }
    }

    checkCount(code, price) {
        var url = 'https://jywg.18.cn/Com/GetCanOperateAmount?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('stockCode', code);
        fd.append('price', price);
        fd.append('tradeType', '0S');
        xmlHttpPost(url, fd, null, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log('unknown error', response);
                this.exit();
                return;
            }
            if (robj.Data && robj.Data.length > 0 && robj.Data[0].Kczsl > 0) {
                this.bondRepurchase(code, price, robj.Data[0].Kczsl);
                return;
            }
            emjyBack.log('no enough money to repurchase', response);
            this.exit();
        });
    }

    bondRepurchase(code, price, count) {
        var url = 'https://jywg.18.cn/BondRepurchase/SecuritiesLendingRepurchaseTrade?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('zqdm', code);
        fd.append('rqjg', price);
        fd.append('rqsl', count);
        emjyBack.log('bondRepurchase', code, price, count);
        xmlHttpPost(url, fd, null, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0) {
                emjyBack.log('repurchase error', response);
                this.exit();
                return;
            }
            if (robj.Data && robj.Data.length > 0) {
                emjyBack.log('repurchase success');
            }
            emjyBack.log(response);
            this.exit();
        });
    }

    buy(code, price) {
        if (!this.validateKey) {
            emjyBack.log('no valid validateKey', this.validateKey);
            this.exit();
            return;
        }

        this.checkCount(code, price);
    }
}

class RepaymentClient {
    constructor(validateKey, cb) {
        this.validateKey = validateKey;
        this.exitcb = cb;
    }

    exit() {
        if (typeof(this.exitcb) == 'function') {
            this.exitcb();
        }
    }

    GetRzrqAssets() {
        var url = 'https://jywg.18.cn/MarginSearch/GetRzrqAssets?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('hblx', 'RMB');
        xmlHttpPost(url, fd, null, response => {
            var robj = JSON.parse(response);
            if (robj.Status != 0 || !robj.Data) {
                emjyBack.log(response);
                this.exit();
                return;
            }
            var total = -(-robj.Data.Rzfzhj - robj.Data.Rqxf);
            if (total <= 0 || robj.Data.Zjkys - 1 < 0) {
                emjyBack.log('待还款金额', total, '可用金额', robj.Data.Zjkys);
                this.exit();
                return;
            }

            var payAmount = total;
            if (total > robj.Data.Zjkys - 0.1) {
                if ((new Date()).getDate() > 25) {
                    payAmount = (robj.Data.Zjkys - robj.Data.Rzxf - robj.Data.Rqxf);
                } else {
                    payAmount = (robj.Data.Zjkys - 0.11).toFixed(2);
                }
            }
            this.Repayment(payAmount);
        });
    }

    Repayment(hkje) {
        if (hkje <= 0) {
            emjyBack.log('Error number hkje', hkje);
            this.exit();
            return;
        }

        var url = 'https://jywg.18.cn/MarginTrade/submitZjhk?validatekey=' + this.validateKey;
        var fd = new FormData();
        fd.append('hbdm', 'RMB');
        fd.append('hkje', hkje);
        fd.append('bzxx', ''); // 备注信息
        xmlHttpPost(url, fd, null, response => {
            var robj = JSON.parse(response);
            if (robj.Status == 0) {
                emjyBack.log('Repayment success!', robj.Data[0].Sjhkje);
            }
            emjyBack.log('Repayment response:', response);
            this.exit();
        });
    }

    go() {
        if (!this.validateKey) {
            emjyBack.log('no valid validateKey', this.validateKey);
            this.exit();
            return;
        }
        this.GetRzrqAssets();
    }
}