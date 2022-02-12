'use strict';

class TestsPanelPage extends RadioAnchorPage {
    constructor() {
        super('测试');
        this.testEngine = new TestEngine();
        this.testEngine.passcb = (id, code, name) => {
            this.addTestSuccessResult(id, code, name);
        };
        this.testEngine.failcb = (id, code, name, msg) => {
            this.addTestFailedResult(id, code, name, msg);
        };

        this.initTestPanel();
    }

    initTestPanel() {
        this.iptTestId = document.createElement('input');
        this.iptTestId.placeholder = '测试id,默认全部执行';
        this.container.appendChild(this.iptTestId);

        var btnRunAll = document.createElement('button');
        btnRunAll.textContent = '执行';
        btnRunAll.onclick = e => {
            var id = this.iptTestId.value;
            if (isNaN(id) || id.length == 0) {
                this.testEngine.runTests();
            } else {
                this.testEngine.runTests(id);
            }
        }
        this.container.appendChild(btnRunAll);

        var btnClear = document.createElement('button');
        btnClear.textContent = '清空';
        btnClear.onclick = e => {
            if (this.resultPanel) {
                utils.removeAllChild(this.resultPanel);
            }
        }
        this.container.appendChild(btnClear);

        this.resultPanel = document.createElement('div');
        this.container.appendChild(this.resultPanel);
    }

    addTestSuccessResult(id, code, name) {
        var rdiv = document.createElement('div');
        rdiv.appendChild(document.createTextNode('Test ' + id + ' ' + name + ' ' + code + ' Pass!'));
        this.resultPanel.appendChild(rdiv);
    }

    addTestFailedResult(id, code, name, msg) {
        var rdiv = document.createElement('div');
        rdiv.appendChild(document.createTextNode('Test ' + id + ' ' + name + ' ' + code + ' Failed! ' + msg));
        this.resultPanel.appendChild(rdiv);
    }
}

class TestTradeClient extends TradeClient {
    constructor(account) {
        super('');
        this.bindingAccount = account;
    }

    trade(code, price, count, tradeType, jylx, cb) {
        console.log(this.bindingAccount.keyword, 'trade', tradeType, code, price, count, jylx);
        if (price == 0 || count < 100) {
            console.log('please set correct price and count for test trade!');
            return;
        } else {
            var time = this.bindingAccount.tradeTime;
            if (!time) {
                time = emjyBack.getTodayDate('-');
            }
            var sid = this.bindingAccount.sid;
            this.bindingAccount.addDeal(code, price, count, tradeType);
            if (typeof(cb) === 'function') {
                cb({time, code, price, count, sid});
            }
        }
    }
}

class TrackingAccount extends NormalAccount {
    constructor() {
        super();
        this.keyword = 'track';
        this.key_deals = 'track_deals';
        this.buyPath = null;
        this.sellPath = null;
        this.sid = 1;
        this.deals = [];
    }

    applyStrategy(code, str) {
        if (!str) {
            return;
        };
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        var strategyGroup = strategyGroupManager.create(str, this.keyword, code, this.keyword + '_' + code + '_strategies');
        strategyGroup.applyGuardLevel(false);
        stock.strategies = strategyGroup;
    }

    loadAssets() {
        var watchingStorageKey = this.keyword + '_watchings';
        chrome.storage.local.get(watchingStorageKey, item => {
            emjyBack.log('get watching_stocks', JSON.stringify(item));
            if (item && item[watchingStorageKey]) {
                item[watchingStorageKey].forEach(s => {
                    this.addWatchStock(s);
                    var strStorageKey = this.keyword + '_' + s + '_strategies';
                    chrome.storage.local.get(strStorageKey, sitem => {
                        if (sitem && sitem[strStorageKey]) {
                            this.applyStrategy(s, JSON.parse(sitem[strStorageKey]));
                        };
                    });
                });
            };
        });
        chrome.storage.local.get(this.key_deals, item => {
            if (item && item[this.key_deals]) {
                this.deals = item[this.key_deals];
            }
        });
    }

    addDeal(code, price, count, tradeType) {
        var time = this.tradeTime;
        if (!time) {
            time = emjyBack.getTodayDate('-');
        }
        this.deals.push({time, sid: this.sid, code, tradeType, price, count});
        this.sid ++;
        this.tradeTime = undefined;
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    buyStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        this.tradeClient.buy(code, price, count, cb);
    }

    sellStock(code, price, count, cb) {
        if (!this.tradeClient) {
            this.createTradeClient();
        }
        this.tradeClient.sell(code, price, count, cb);
    }

    save() {
        super.save();
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        chrome.storage.local.set(dsobj);
    }
}

class TestingAccount extends TrackingAccount {
    constructor() {
        super();
        this.keyword = 'test';
        this.key_deals = 'test_deals';
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    loadAssets() {
    }

    addWatchStock(code, strgrp) {
        emjyBack.klines[code] = new KLine(code);
        var stock = this.stocks.find(s => {return s.code == code;});

        if (stock) {
            this.addStockStrategy(stock, strgrp);
            return;
        };

        var name = '';
        var market = '';
        var stock = new StockInfo({ code, name, holdCount: 0, availableCount: 0, market});
        this.addStockStrategy(stock, strgrp);
        this.stocks.push(stock);
    }

    removeStock(code) {
        var ic = this.stocks.findIndex(s => {return s.code == code;});
        if (ic == -1) {
            return;
        };

        this.stocks.splice(ic, 1);
    }

    save() {
    }
}

class TestEngine {
    constructor() {
        this.failcb = null;
        this.passcb = null;
    }

    checkTestResultDeal(testid, code, name, expect, actual) {
        if (!actual) {
            if (typeof(this.failcb) === 'function') {
                this.failcb(testid, code, name, 'no actual deal!');
            }
            return;
        }
        var deals = actual.filter(d => d.code == code);
        if (expect.dcount !== undefined) {
            if (expect.dcount != deals.length) {
                if (typeof(this.failcb) === 'function') {
                    this.failcb(testid, code, name, 'expect deals count: ' + expect.dcount + ' actual: ' + actual.length);
                }
                return;
            }
        }

        if (expect.deal !== undefined) {
            var actdeal = deals[deals.length - 1];
            var expdeal = expect.deal;
            if (expdeal.count != actdeal.count) {
                if (typeof(this.failcb) === 'function') {
                    this.failcb(testid, code, name, 'expect count: ' +expdeal.count + ' actual: ' + actdeal.count);
                }
                return;
            }
            if (expdeal.price != actdeal.price) {
                if (typeof(this.failcb) === 'function') {
                    this.failcb(testid, code, name, 'expect price: ' + expdeal.price + ' actual: ' + actdeal.price);
                }
                return;
            }
            if (expdeal.tradeType != actdeal.tradeType) {
                if (typeof(this.failcb) === 'function') {
                    this.failcb(testid, code, name, 'expect tradeType: ' + expdeal.tradeType + ' actual: ' + actdeal.tradeType);
                }
                return;
            }
        }

        if (typeof(this.passcb) === 'function') {
            this.passcb(testid, code, name);
        }
    }

    doRunTest(testid) {
        var code = testMeta[testid].code;
        var str = JSON.parse(JSON.stringify(testMeta[testid].strategy));
        emjyBack.testAccount.removeStock(code);
        emjyBack.testAccount.addWatchStock(code, str);
        var stock = emjyBack.testAccount.getStock(code);
        if (testMeta[testid].snapshot) {
            for (let j = 0; j < testMeta[testid].snapshot.length; j++) {
                emjyBack.testAccount.tradeTime = testMeta[testid].snapshot[j].time;
                stock.updateRtPrice(testMeta[testid].snapshot[j].sn);
                var expect = testMeta[testid].snapshot[j].expect;
                if (expect) {
                    this.checkTestResultDeal(testid, code, testMeta[testid].testname, expect, emjyBack.testAccount.deals);
                }
            }
        } else if (testMeta[testid].kdata) {
            emjyBack.klines[code].klines = {};
            for (let k = 0; k < testMeta[testid].kdata.length; k++) {
                const datai = testMeta[testid].kdata[k];
                var kltype = datai.kltype;
                emjyBack.klines[code].klines[kltype] = [];
            }
            var testKdata = JSON.parse(JSON.stringify(testMeta[testid].kdata));
            while (testKdata.length > 0) {
                var earliest = testKdata[0];
                var earlk = 0;
                for (let k = 1; k < testKdata.length; k++) {
                    const datai = testKdata[k].kldata[0];
                    if (datai.kl.time < earliest.kldata[0].kl.time) {
                        earlk = k;
                        earliest = datai;
                    }
                }
                var kldataj = testKdata[earlk].kldata.shift();
                var kltype = testKdata[earlk].kltype;
                if (testKdata[earlk].kldata.length == 0) {
                    testKdata.splice(earlk, 1);
                }
                emjyBack.klines[code].klines[kltype].push(kldataj.kl);
                emjyBack.testAccount.tradeTime = kldataj.kl.time;
                stock.strategies.checkKlines([kltype]);
                var expect = kldataj.expect;
                if (expect) {
                    this.checkTestResultDeal(testid, code, testMeta[testid].testname, expect, emjyBack.testAccount.deals);
                }
            }
        }
    }

    runTests(testid) {
        if (!emjyBack.testAccount) {
            emjyBack.setupRetroAccount();
        }

        emjyBack.testAccount.deals = [];
        if (testid !== undefined && testid >= 0) {
            this.doRunTest(testid);
            return;
        }
        for (let i = 0; i < testMeta.length; i++) {
            this.doRunTest(i);
        }
    }

    listTests() {
        for (let i = 0; i < testMeta.length; i++) {
            console.log(i, testMeta[i].testname);
        }
    }
}
