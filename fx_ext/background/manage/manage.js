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
        this.loadAllSavedData();
    }

    loadAllSavedData() {
        chrome.storage.local.get(null, item => {
            if (item) {
                if (item['hsj_stocks']) {
                    this.stockMarket = item['hsj_stocks'];
                }
                if (item['ztstocks']) {
                    this.zt1stocks = item['ztstocks'];
                }
                if (item['ztdels']) {
                    this.delstocks = item['ztdels'];
                }
                if (item['hist_deals']) {
                    this.savedDeals = item['hist_deals'];
                }
                if (item['bkstocks_' + BkRZRQ]) {
                    this.rzrqStocks = new Set(item['bkstocks_' + BkRZRQ]);
                }
                for (const key in item) {
                    if (!key.startsWith('kline_')) {
                        continue;
                    }
                    if (Object.hasOwnProperty.call(item, key)) {
                        var code = key.split('_')[1];
                        var kline = new KLine(code);
                        kline.klines = item[key];
                        this.klines[code] = kline;
                        if (this.stockList) {
                            this.stockList.updateStockPrice(code);
                        }
                    }
                }
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
        this.page.pickupPage.showSelectedTable();
    }

    toVscale(vs) {
        if (vs < 0.1) {
            return 0;
        } else if (vs < 0.8) {
            return 1;
        } else if (vs < 1.2) {
            return 2;
        } else if (vs < 4) {
            return 3;
        }
        return 4;
    }

    updateZt1stockInfo(code) {
        this.zt1stocks.forEach((s, idx) => {
            if (s.code == code) {
                if (s.vscale === undefined) {
                    var vscale = this.klines[code].getVolScale('101', s.ztdate, 10);
                    s.vscale = this.toVscale(vscale);
                }
                this.checkDelDate(idx);
            }
        });
    }

    updateAllVolScale() {
        this.zt1stocks.forEach(s => {
            var vscale = this.klines[s.code].getVolScale('101', s.ztdate, 10);
            s.vscale = this.toVscale(vscale);
        });
        this.delstocks.forEach(s => {
            var vscale = this.klines[s.code].getVolScale('101', s.ztdate, 10);
            s.vscale = this.toVscale(vscale);
        });
    }

    checkDelDate(idx) {
        var code = this.zt1stocks[idx].code;
        var ztdate = this.zt1stocks[idx].ztdate;
        if (!this.klines[code].klines || !this.klines[code].klines['101']) {
            console.log('error: kline not exists', code);
            return;
        }
        var kline = this.klines[code].klines['101'];
        var ldays = 0;
        var rmvdate = ztdate;
        var hidate = ztdate;
        var highPrice = 0;
        var izt = 0, ih = 0;
        for (var i = 0; i < kline.length; i++) {
            if (kline[i].time < ztdate) {
                continue;
            }
            if (kline[i].time == ztdate) {
                highPrice = kline[i].h;
                izt = i;
                continue;
            }
            if (kline[i].bss18 != 'w') {
                continue;
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
                ih = i;
            }
            if (ldays >= 5) {
                rmvdate = kline[i].time;
                break;
            }
        }

        if (ldays >= 5 && rmvdate > ztdate) {
            this.setHighDate(idx, hidate);
            this.setDelDate(idx, rmvdate);
            console.log('setDelDate', code, hidate, rmvdate);
            if (ih - izt > 1) {
                var lowdate = ztdate;
                var lowPrice = kline[izt + 1].o;
                for (let i = izt + 2; i < ih; i++) {
                    if (lowPrice - kline[i].l > 0) {
                        lowdate = kline[i].time;
                        lowPrice = kline[i].l;
                    }
                }
                if (lowdate != ztdate) {
                    this.setLowDate(idx, lowdate);
                }
            }
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

    getTotalEarned(code) {
        if (!emjyManager.savedDeals || emjyManager.savedDeals.length == 0) {
            return 0;
        }

        var allDeals = emjyManager.savedDeals.filter(d => d.code == code);
        var earned = 0;
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
                earned -= amount;
            } else {
                amount -= fee;
                earned += amount;
            }
        }
        return earned;
    }

    getCurrentHoldValue(code) {
        var stock = this.stockList.stocks.find(s => s.stock.code == code);
        console.log(stock);
        if (!stock || !stock.stock || !stock.stock.holdCount) {
            return 0;
        }
        if (!emjyManager.klines[code].klines) {
            return 0;
        }
        return stock.stock.holdCount * this.klines[code].getLatestKline('101').c;
    }

    initStocks(stocks) {
        this.log('initStocks');
        if (!this.page) {
            this.initUi();
        }

        var accstocks = [];
        for (var i = 0; i < stocks.length; i++) {
            var tstocks = stocks[i].stocks.sort((a, b) => {
                if (a.holdCount > 0 && b.holdCount > 0) {
                    return a.latestPrice * a.holdCount - b.latestPrice * b.holdCount < 0;
                }
                return a.holdCount < b.holdCount;
            });

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
            this.stockList = new StockListPanelPage();
        };

        if (!this.ztPool) {
            this.ztPool = new ZtPanelPage();
        };

        this.page.setupNavigators();
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

    isRzRq(code) {
        return this.rzrqStocks && this.rzrqStocks.has(code);
    }

    stockEmLink(code) {
        if (this.stockMarket[code]) {
            return emStockUrl + (this.stockMarket[code].mkt == '0' ? 'sz' : 'sh') + code + emStockUrlTail;
        }
        return emStockUrl + (code.startsWith('00') ? 'sz' : 'sh') + code + emStockUrlTail;
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
        this.root.appendChild(this.navigator.container);
    }

    setupNavigators() {
        this.navigator.addRadio(emjyManager.stockList);
        this.root.appendChild(emjyManager.stockList.container);

        this.navigator.addRadio(emjyManager.ztPool);
        this.root.appendChild(emjyManager.ztPool.container);

        this.pickupPage = new PickupPanelPage();
        this.navigator.addRadio(this.pickupPage);
        this.root.appendChild(this.pickupPage.container);

        var rvpage = new ReviewPanelPage();
        this.navigator.addRadio(rvpage);
        this.root.appendChild(rvpage.container);

        var dealsPage = new DealsPanelPage();
        this.navigator.addRadio(dealsPage);
        this.root.appendChild(dealsPage.container);

        var settingsPage = new SettingsPanelPage('设置');
        this.navigator.addRadio(settingsPage);
        this.root.appendChild(settingsPage.container);

        this.navigator.selectDefault();
    }
}

class SettingsPanelPage extends RadioAnchorPage {
    constructor(text) {
        super(text);
        var btnExport = document.createElement('button');
        btnExport.textContent = '导出';
        btnExport.onclick = e => {
            emjyManager.sendExtensionMessage({command:'mngr.export'});
        };
        this.container.appendChild(btnExport);
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
        this.container.appendChild(importDiv);
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
