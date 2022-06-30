'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
        this.page = null;
        this.stockList = null;
        this.klines = {};
        this.accountNames = {'normal':'普通账户', 'collat': '担保品账户', 'credit': '融资账户'};
        this.accountsMap = {'normal': ['normal'], 'collat': ['credit', 'collat']};
        this.loadAllSavedData();
    }

    getFromLocal(key, cb) {
        chrome.storage.local.get(key, item => {
            if (typeof(cb) === 'function') {
                if (!key) {
                    cb(item);
                } else if (item && item[key]) {
                    cb(item[key]);
                } else {
                    cb(item);
                }
            }
        });
    }

    saveToLocal(data) {
        chrome.storage.local.set(data);
    }

    removeLocal(key) {
        chrome.storage.local.remove(key);
    }

    loadAllSavedData() {
        chrome.storage.local.get(null, item => {
            if (item) {
                if (item['hsj_stocks']) {
                    this.stockMarket = item['hsj_stocks'];
                    this.sendExtensionMessage({command: 'mngr.init'});
                }
                if (item['fha_server']) {
                    this.fha = item['fha_server'];
                }
                if (item['hist_deals']) {
                    this.savedDeals = item['hist_deals'];
                }
                if (item['retro_deals']) {
                    this.retroDeals = item['retro_deals'];
                }
                if (item['track_deals']) {
                    this.trackDeals = item['track_deals'];
                }
                if (item['bkstocks_' + BkRZRQ]) {
                    this.rzrqStocks = new Set(item['bkstocks_' + BkRZRQ]);
                }
                for (const key in item) {
                    if (!key.startsWith('kline_')) {
                        // console.log('key in storage', key);
                        // if (key === 'undefined') {
                        //     console.log(item[key]);
                        // }
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
        } else if (message.command == 'mngr.getkline') {
            var code = message.kline.data.code;
            if (this.klines[code] === undefined) {
                this.klines[code] = new KLine(code);
            }
            this.klines[code].updateRtKline(message);
            this.klines[code].save();
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
            if (this.fha) {
                this.fetchStockKline(code, '101', date);
            } else {
                this.sendExtensionMessage({command:'mngr.getkline', code, date});
            }
        }
    }

    updateKlineDaily(code) {
        if (!this.klines[code].getLatestKline('101')) {
            console.log(code, 'kline not exists!');
            return false;
        }
        var ldate = new Date(this.klines[code].getLatestKline('101').time);
        ldate.setDate(ldate.getDate() + 1);
        if (ldate < new Date()) {
            var date = utils.dateToString(ldate);
            if (this.fha) {
                this.fetchStockKline(code, '101', date);
            } else {
                this.sendExtensionMessage({command:'mngr.getkline', code, date});
            }
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
    }

    loadKlines(code) {
        if (this.klines[code] === undefined) {
            this.klines[code] = new KLine(code);
        }
        this.klines[code].loadSaved();
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

    getTotalEarned(code, cb) {
        if (this.fha) {
            this.getEarned(code, cb);
        }

        if (!emjyManager.savedDeals || emjyManager.savedDeals.length == 0) {
            if (typeof(cb) === 'function') {
                cb(0);
            }
            return;
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
        if (typeof(cb) === 'function') {
            cb(earned);
        }
    }

    getCurrentHoldValue(code, count = 0) {
        if (count > 0) {
            if (this.klines[code] && this.klines[code].klines) {
                return count * this.klines[code].getLatestKline('101').c;
            }
            console.log(code, count, 'no kline data');
            return 0;
        }

        var stock = this.stockList.stocks.find(s => s.stock.code == code);
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

    getStockCode(name) {
        for (const code in this.stockMarket) {
            if (this.stockMarket[code].n == name) {
                return code;
            }
            if (name.includes('ST') && ('*' + name == this.stockMarket[code].n || name == '*' + this.stockMarket[code].n)) {
                return code;
            }
        }
        console.log('cannot find code for name:', name);
        return '';
    }

    stockEmLink(code) {
        if (this.stockMarket && this.stockMarket[code]) {
            if (this.stockMarket[code].c) {
                return emStockUrl + this.stockMarket[code].c.toLowerCase() + emStockUrlTail;
            }
            return emStockUrl + (this.stockMarket[code].mkt == '0' ? 'sz' : 'sh') + code + emStockUrlTail;
        }
        return emStockUrl + (code.startsWith('00') ? 'sz' : 'sh') + code + emStockUrlTail;
    }

    getStockMarketHS(code) {
        var stk = this.stockMarket[code];
        if (!stk) {
            return (code.startsWith('00') || code.startsWith('30')) ? 'SZ' : 'SH';
        }

        if (stk.c) {
            return stk.c.substring(0, 2);
        }
        return stk.mkt == '0' ? 'SZ' : 'SH';
    }

    getLongStockCode(code) {
        if (code.startsWith('S')) {
            return code;
        }

        var stk = this.stockMarket[code];
        if (stk && stk.c) {
            return stk.c;
        }
        return this.getStockMarketHS(code) + code;
    }

    stockAnchor(code, text) {
        var anchor = document.createElement('a');
        if (text) {
            anchor.textContent = text;
        } else {
            anchor.textContent = code;
            if (this.stockMarket && this.stockMarket[code]) {
                anchor.textContent = this.stockMarket[code].n;
            }
        }
        anchor.href = this.stockEmLink(code);
        anchor.target = '_blank';
        return anchor;
    }

    stockAccountFrom(code) {
        if (this.rzrqStocks && this.rzrqStocks.has(code)) {
            return 'collat';
        }
        return 'normal';
    }

    getEarned(code, cb) {
        if (this.fha) {
            var url = this.fha.server + 'stock?act=getearned&code=' + this.getLongStockCode(code);
            var header = {'Authorization': 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd)}
            utils.get(url, header, rsp => {
                if (typeof(cb) === 'function') {
                    cb(rsp);
                }
            });
            return;
        }
        if (typeof(cb) === 'function') {
            cb(0);
        }
    }

    checkDividened(code, sdate) {
        var mktCode = this.getLongStockCode(code);
        if (this.fha) {
            var url = this.fha.server + 'stock?act=checkdividen&code=' + mktCode + '&date=' + sdate;
            utils.get(url, null, rd => {
                if (rd === 'True') {
                    this.klines[code].klines = {};
                    var zdate = new Date(sdate);
                    zdate.setMonth(zdate.getMonth() - 1);
                    var ndate = utils.dateToString(zdate, '-');
                    this.doFetchKline(code, '101', sdate < ndate ? sdate : ndate);
                } else {
                    this.doFetchKline(code, '101', sdate);
                }
            });
            return;
        }
        if (typeof(cb) === 'function') {
            this.doFetchKline(code, '101', sdate);
        }
    }

    fetchStockKline(code, kltype, sdate) {
        if (this.klines[code] && kltype == '101' && sdate !== undefined) {
            this.checkDividened(code, sdate);
            return;
        }
        this.doFetchKline(code, kltype, sdate);
    }

    doFetchKline(code, kltype, sdate) {
        var mktCode = this.getLongStockCode(code);
        var url = this.fha.server + 'api/stockhist?fqt=1&code=' + mktCode;
        if (!kltype) {
            url += '&kltype=101';
        } else if (kltype == '30' || kltype == '60' || kltype == '120') {
            url += '&kltype=15';
        } else if (kltype == '202' || kltype == '404' || kltype == '808') {
            url += '&kltype=101';
        } else {
            url += '&kltype=' + kltype;
        }

        if (sdate !== undefined) {
            if (sdate.length != 8 && sdate.length != 10) {
                console.error('invalid start date', sdate);
                return;
            }
            var dashdate = sdate;
            if (!sdate.includes('-')) {
                dashdate = sdate.substring(0,4) + '-' + sdate.substring(4,6) + '-' + sdate.substring(6,8);
            }
            url += '&start=' + dashdate;
        }

        utils.get(url, null, ksdata => {
            var kdata = JSON.parse(ksdata);
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', code, 'kltype:', kltype);
                return;
            }

            var klmessage = {kltype, kline:{data:{klines:[]}}};
            kdata.forEach(kl => {
                klmessage.kline.data.klines.push(kl[1] + ',' + kl[5] + ',' + kl[2] + ',' + kl[3] + ',' + kl[4] + ',' +kl[8]);
            });
            if (!this.klines[code]) {
                this.klines[code] = new KLine(code);
            }
            this.klines[code].updateRtKline(klmessage);
            this.klines[code].save();
        });
    }

    checkHoldingStocks() {
        var url = this.fha.server + 'stock?act=allstkscount';
        var header = {'Authorization': 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd)};
        utils.get(url, header, hstks => {
            hstks = JSON.parse(hstks);
            emjyBack.stockList.stocks.forEach(stk => {
                var stkinfo = stk.stock;
                var code = stkinfo.market + stkinfo.code;
                var mgrCount = stkinfo.holdCount;
                var svrCount = 0;
                if (Object.keys(hstks).includes(code)) {
                    svrCount = hstks[code];
                }
                if (svrCount - mgrCount != 0) {
                    alert(stkinfo.name + stkinfo.code + 'not consitent svr:' + svrCount + ' act:' + mgrCount);
                }
            });
            console.log('Check done!');
        });
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
let emjyBack = emjyManager;
