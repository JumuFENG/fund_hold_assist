'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
        this.ztPool = null;
        this.klines = {};
        this.accountNames = {'normal':'普通账户', 'collat': '担保品账户', 'credit': '融资账户'};
        this.accountsMap = {'normal': ['normal'], 'collat': ['credit', 'collat']};
        this.zt1stocks = [];
        chrome.storage.local.get('ztstocks', item => {
            if (item && item['ztstocks']) {
                this.zt1stocks = item['ztstocks'];
                for (var i = 0; i < this.zt1stocks.length; i++) {
                    this.loadKlines(this.zt1stocks[i].code);
                }
            }
        });
        this.delstocks = [];
        chrome.storage.local.get('ztdels', item => {
            if (item && item['ztdels']) {
                this.delstocks = item['ztdels'];
            }
        });
        this.rzrqStocks = new Set();
        chrome.storage.local.get('bkstocks_' + BkRZRQ, item => {
            if (item && item['bkstocks_' + BkRZRQ]) {
                this.rzrqStocks = new Set(item['bkstocks_' + BkRZRQ]);
            }
        });
    }

    sendExtensionMessage(message) {
        chrome.runtime.sendMessage(message);
    }

    handleExtensionMessage(message) {
        if (message.command == 'mngr.stocks') {
            this.initStocks(message.stocks);
        } else if (message.command == 'mngr.getZTPool') {
            if (this.ztPool) {
                this.ztPool.onZTPoolback(message.ztpool);
            };
        } else if (message.command == 'mngr.getkline') {
            var code = message.kline.data.code;
            if (this.klines[code] === undefined) {
                this.klines[code] = new KLine(code);
            }
            this.klines[code].updateRtKline(message);
            this.klines[code].save();
            this.updateZt1stockInfo(code);
            this.stockList.updateStockPrice(code);
        }
    }

    getDailyKlineSinceMonthAgo(code, ztdate) {
        var zdate = new Date(ztdate);
        zdate.setMonth(zdate.getMonth() - 1);
        if (!this.klines[code]) {
            this.klines[code] = new KLine(code);
        } else if (this.klines[code].klines && this.klines[code].klines['101'].length > 1) {
            zdate = new Date(this.klines[code].klines['101'][this.klines[code].klines['101'].length - 1].time);
        }
        zdate.setHours(15);
        if (new Date() - zdate > 24 * 3600000) {
            var date = utils.dateToString(zdate);
            this.sendExtensionMessage({command:'mngr.getkline', code, date});
        }
    }

    updateKlineDaily(code) {
        var ldate = new Date(this.klines[code].getLatestKline('101').time);
        ldate.setDate(ldate.getDate() + 1);
        if (ldate < new Date()) {
            var date = utils.dateToString(ldate);
            this.sendExtensionMessage({command:'mngr.getkline', code, date});
            return true;
        }
        return false;
    }

    updateShownStocksDailyKline() {
        var today = utils.getTodayDate('');
        for (var i = 0; i < this.stockList.stocks.length; i++) {
            var code = this.stockList.stocks[i].stock.code;
            if (this.klines[code] === undefined || this.klines[code].klines === undefined) {
                this.getDailyKlineSinceMonthAgo(code, today);
                continue;
            }
            if (!this.updateKlineDaily(code)) {
                this.stockList.updateStockPrice(code);
            }
        }
        
        for (var i = 0; i < this.zt1stocks.length; i++) {
            var code = this.zt1stocks[i].code;
            if (this.klines[code].klines === undefined) {
                this.getDailyKlineSinceMonthAgo(code, this.zt1stocks[i].ztdate);
                continue;
            }
            this.updateKlineDaily(code);
        }
    }

    loadKlines(code) {
        if (this.klines[code] === undefined) {
            this.klines[code] = new KLine(code);
        }
        this.klines[code].loadSaved();
    }

    addZt1Stock(stkzt) {
        var stk = this.zt1stocks.find(s => s.code == stkzt.code);
        if (!stk || (stk.rmvdate !== undefined && stk.rmvdate > stk.ztdate)) {
            this.zt1stocks.push(stkzt);
        } else {
            console.log('addZt1Stock existing stock code ', stk.code, 'zt date ', stk.ztdate);
        }
        if (!this.klines[stkzt.code] || !this.klines[stkzt.code].klines) {
            this.getDailyKlineSinceMonthAgo(stkzt.code, stkzt.ztdate);
        }
    }

    updateZt1stockInfo(code) {
        this.zt1stocks.forEach((s, idx) => {
            if (s.code == code && s.vscale === undefined) {
                var vscale = this.klines[code].getVolScale('101', s.ztdate, 10);
                if (vscale < 0.1) {
                    s.vscale = 0;
                } else if (vscale < 0.8) {
                    s.vscale = 1;
                } else if (vscale < 1.2) {
                    s.vscale = 2;
                } else if (vscale < 4) {
                    s.vscale = 3;
                } else {
                    s.vscale = 4;
                }
                this.checkDelDate(idx);
            }
        })
    }

    checkDelDate(idx) {
        var code = this.zt1stocks[idx].code;
        var ztdate = this.zt1stocks[idx].ztdate;
        var kline = this.klines[code].klines['101'];
        var ldays = 0;
        var rmvdate = ztdate;
        var hidate = ztdate;
        var highPrice = 0;
        for (var i = 0; i < kline.length; i++) {
            if (kline[i].time < ztdate) {
                continue;
            }
            if (kline[i].time == ztdate) {
                highPrice = kline[i].h;
            }
            var t = kline[i].o - kline[i].c > 0 ? kline[i].o : kline[i].c;
            if (kline[i].ma18 - t > 0) {
                ldays++;
            } else {
                ldays = 0;
            }
            if (kline[i].h - highPrice > 0) {
                highPrice = kline[i].h;
                hidate = kline[i].time;
            }
            if (ldays >= 5) {
                rmvdate = kline[i].time;
                break;
            }
        }
        if (ldays >= 5 && rmvdate > ztdate) {
            this.setHighDate(idx, hidate);
            this.setDelDate(idx, rmvdate);
            console.log('setDelDate', code, rmvdate);
        }
    }

    setVolScale(idx, val) {
        this.zt1stocks[idx].vscale = val;
    }

    setPrng(idx, val) {
        this.zt1stocks[idx].prng = val;
    }

    setLowDate(idx, date) {
        if (this.zt1stocks[idx].lowdt === undefined && this.zt1stocks[idx].ztdate == date) {
            return;
        }
        this.zt1stocks[idx].lowdt = date;
    }

    setHighDate(idx, date) {
        if (this.zt1stocks[idx].hidate === undefined && this.zt1stocks[idx].ztdate == date) {
            return;
        }
        this.zt1stocks[idx].hidate = date;
    }

    setDelDate(idx, date) {
        if (this.zt1stocks[idx].rmvdate === undefined && this.zt1stocks[idx].ztdate == date) {
            return;
        }
        this.zt1stocks[idx].rmvdate = date;
    }

    initStocks(stocks) {
        this.log('initStocks');
        if (!this.page) {
            this.page = new ManagerPage();
            document.body.appendChild(this.page.root);
        }

        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.initStockList(this.stockList.root);
        };

        var accstocks = [];
        for (var i = 0; i < stocks.length; i++) {
            var tstocks = stocks[i].stocks;
            var account = stocks[i].account;
            for (var j = 0; j < tstocks.length; j++) {
                var ts = tstocks[j];
                this.loadKlines(ts.code);
                ts.acccode = account + '_' + ts.code;
                ts.account = account;
                accstocks.push(ts);
            };
        };
        this.stockList.initUi(accstocks);
    }

    initUi() {
        if (!this.page) {
            this.page = new ManagerPage();
            document.body.appendChild(this.page.root);
        };

        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.initStockList(this.stockList.root);
        };

        this.page.addWatchArea();
        if (!this.ztPool) {
            this.ztPool = new ZtPool(this.sendExtensionMessage);
        };
        this.page.initZtPanel(this.ztPool);
    }

    addStock(code, account, strGrp = null) {
        if (!this.stockList) {
            this.stockList = new StockList(this.log);
            this.page.root.appendChild(this.stockList.root);
        };
        var stock = {code, name:'', account, holdCount: 0, holdCost: 0};
        stock.acccode = account + '_' + code;
        stock.strategies = strGrp;
        this.stockList.addStock(stock);
    }

    addWatchingStock(code, account, strGrp = null) {
        if (!this.stockList.stockExist(code, account)) {
            this.addStock(code, account, strGrp);
            this.sendExtensionMessage({command:'mngr.addwatch', code, account, strategies: strGrp});
        }
    }

    stockAccountFrom(code) {
        if (this.rzrqStocks && this.rzrqStocks.has(code)) {
            return 'collat';
        }
        return 'normal';
    }
}

class ManagerPage {
    constructor() {
        this.root = document.createElement('div');
        this.navigator = new RadioAnchorBar();
        this.navigator.addRadio('自选管理', function(that) {
            that.showStocksList();
        }, this);
        this.navigator.addRadio('涨停一览', function(that) {
            that.showZTPanel();
        }, this);
        this.navigator.addRadio('选股入口', function(that) {
            that.showPickupPanel();
        }, this);
        this.navigator.addRadio('设置', function(that) {
            that.showSettings();
        }, this);
        this.navigator.selectDefault();
        this.root.appendChild(this.navigator.container);
    }

    addWatchArea() {
        if (!this.stockListDiv) {
            this.stockListDiv = document.createElement('div');
            this.root.appendChild(this.stockListDiv);
        }
        var watchDiv = document.createElement('div');
        var inputCode = document.createElement('input');
        watchDiv.appendChild(inputCode);
        var watchAccountSelector = document.createElement('select');
        var accounts = ['normal', 'collat'];
        for (var i in emjyManager.accountsMap) {
            var opt = document.createElement('option');
            opt.value = i;
            opt.textContent = emjyManager.accountNames[i];
            watchAccountSelector.appendChild(opt);
        };
        watchDiv.appendChild(watchAccountSelector);
        var btnOk = document.createElement('button');
        btnOk.textContent = '新增观察股票';
        btnOk.parentPage = this;
        btnOk.onclick = (e) => {
            if (inputCode.value.length != 6) {
                alert('Wrong stock code');
                return;
            };
            emjyManager.addWatchingStock(inputCode.value, watchAccountSelector.value);
            inputCode.value = '';
        };
        watchDiv.appendChild(btnOk);
        this.stockListDiv.appendChild(watchDiv);
    }

    initStockList(stockList) {
        if (!this.stockListDiv) {
            this.stockListDiv = document.createElement('div');
            var updateBtn = document.createElement('button');
            updateBtn.textContent = '更新数据';
            updateBtn.onclick = e => {
                emjyManager.updateShownStocksDailyKline();
            }
            this.stockListDiv.appendChild(updateBtn);
            this.root.appendChild(this.stockListDiv);
        }
        this.stockListDiv.appendChild(stockList);
    }

    showStocksList() {
        if (this.settingsDiv) {
            this.settingsDiv.style.display = 'none';
        }
        if (this.ztPanelDiv) {
            this.ztPanelDiv.style.display = 'none';
        }
        if (this.pickupDiv && this.pickupDiv.style.display != 'none') {
            this.pickupDiv.style.display = 'none';
        }
        if (this.stockListDiv) {
            this.stockListDiv.style.display = 'block';
        }
    }

    initZtPanel(ztPool) {
        if (!this.ztPanelDiv) {
            this.ztPanelDiv = document.createElement('div');
            this.root.appendChild(this.ztPanelDiv);
            this.ztPanelDiv.style.display = 'none';
        }
        ztPool.createZtArea();
        this.ztPanelDiv.appendChild(ztPool.root);
    }

    showZTPanel() {
        if (this.settingsDiv) {
            this.settingsDiv.style.display = 'none';
        }
        if (this.stockListDiv) {
            this.stockListDiv.style.display = 'none';
        }
        if (this.pickupDiv && this.pickupDiv.style.display != 'none') {
            this.pickupDiv.style.display = 'none';
        }
        if (this.ztPanelDiv) {
            this.ztPanelDiv.style.display = 'block';
        }
    }

    showPickupPanel() {
        if (this.stockListDiv) {
            this.stockListDiv.style.display = 'none';
        }
        if (this.ztPanelDiv) {
            this.ztPanelDiv.style.display = 'none';
        }
        if (this.settingsDiv) {
            this.settingsDiv.style.display = 'none';
        }
        if (!this.pickupDiv) {
            this.pickupDiv = document.createElement('div');
            this.root.appendChild(this.pickupDiv);
            this.pickupPanel = new PickupPanel();
            this.pickupPanel.showSelectedTable();
            this.pickupDiv.appendChild(this.pickupPanel.root);
        }
        this.pickupDiv.style.display = 'block';
    }

    showSettings() {
        if (!this.settingsDiv) {
            this.settingsDiv = document.createElement('div');
            this.root.appendChild(this.settingsDiv);
            var btnExport = document.createElement('button');
            btnExport.textContent = '导出';
            btnExport.onclick = e => {
                emjyManager.sendExtensionMessage({command:'mngr.export'});
            };
            this.settingsDiv.appendChild(btnExport);
            var importDiv = document.createElement('div');
            var fileIpt = document.createElement('input');
            fileIpt.type = 'file';
            fileIpt.multiple = false;
            fileIpt.onchange = e => {
                e.target.files[0].text().then(text => {
                    emjyManager.sendExtensionMessage({command:'mngr.import', config: JSON.parse(text)});
                });
            };
            importDiv.appendChild(document.createTextNode('导入'));
            importDiv.appendChild(fileIpt);
            this.settingsDiv.appendChild(importDiv);
        }
        if (this.stockListDiv) {
            this.stockListDiv.style.display = 'none';
        }
        if (this.ztPanelDiv) {
            this.ztPanelDiv.style.display = 'none';
        }
        if (this.pickupDiv && this.pickupDiv.style.display != 'none') {
            this.pickupDiv.style.display = 'none';
        }
        this.settingsDiv.style.display = 'block';
    }
}

window.addEventListener('beforeunload', e => {
    if (emjyManager.stockList.strategyGroupView) {
        emjyManager.stockList.strategyGroupView.saveStrategy();
    };
});

window.onload = function() {
    emjyManager.initUi();
}

function onExtensionBackMessage(message) {
    if (message.command.startsWith('mngr.')) {
        emjyManager.handleExtensionMessage(message);
    }
}

chrome.runtime.onMessage.addListener(onExtensionBackMessage);

let emjyManager = new Manager(logInfo);
emjyManager.sendExtensionMessage({command: 'mngr.init'});
