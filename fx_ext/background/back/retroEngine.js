'use strict';

class TradingData {
    constructor() {
        this.dayPriceAvg = {};
    }

    updateStockRtPrice(snapshot) {
        if (!this.dayPriceAvg[snapshot.code]) {
            this.dayPriceAvg[snapshot.code] = [];
        };
        this.dayPriceAvg[snapshot.code].push([snapshot.realtimequote.currentPrice, snapshot.realtimequote.avg]);
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + ('' + (now.getMonth()+1)).padStart(2, '0') + ('' + now.getDate()).padStart(2, '0');
    }

    save() {
        var fileDate = this.getTodayDate();
        for (var c in this.dayPriceAvg) {
            var blob = new Blob([JSON.stringify(this.dayPriceAvg[c])], {type: 'application/json'});
            var url = URL.createObjectURL(blob);
            var filename = 'StockDailyPrices/' + fileDate + '_' + c + '.json';
            chrome.downloads.download({url, filename, saveAs:false});
        }
    }

    listAllBuySellPrice(stockKl, code, name) {
        var codes = new Set(['000858', '002460', '000401', '002041', '600862', '601600', '601101', '000998', '600546', '600918', '600276', '600031', '000630', '002241', '600010', '600089', '600150', '601016', '601117', '601601', '601800', '600905', '002847']);
        if (!codes.has(code)) {
            return;
        }
        for (var i in stockKl) {
            var afterbuy = false;
            var bcount = 0;
            var ecount = 0;
            var lcount = 0;
            var b = 0;
            var rec = [];
            var earned = 0;
            for (var j = 0; j < stockKl[i].length; j++) {
                if (stockKl[i][j].bss18 == 'b') {
                    afterbuy = true;
                    bcount ++;
                    b = stockKl[i][j].c;
                }
                if (stockKl[i][j].bss18 == 's' && afterbuy) {
                    var e = stockKl[i][j].c - b;
                    rec.push('b:' + b + ' s:' + stockKl[i][j].c + ' e:' + e.toFixed(2));
                    if (e > 0) {
                        ecount ++;
                    } else {
                        lcount ++;
                    }
                    earned += e * 100 / b;
                    afterbuy = false;
                }
            }

            console.log(name, 'kltype' + i, stockKl[i].length, 'b:', bcount, 'e', ecount, 'l', lcount, 'total', earned.toFixed(2));
        }
    }
}

let tradeAnalyzer = new TradingData();

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

class RetrospectAccount extends TrackingAccount {
    constructor() {
        super();
        this.keyword = 'retro';
        this.key_deals = 'retro_deals';
    }

    createTradeClient() {
        this.tradeClient = new TestTradeClient(this);
    }

    loadAssets() {
        chrome.storage.local.get(this.key_deals, item => {
            if (item && item[this.key_deals]) {
                this.deals = item[this.key_deals];
            }
        });
    }

    save() {
        var dsobj = {};
        dsobj[this.key_deals] = this.deals;
        chrome.storage.local.set(dsobj);
    }
}

class RetroEngine {
    constructor() {

    }

    runAllTests() {
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        var checkDeal = function(name, expect, actual) {
            if (!actual) {
                console.log('Test Failed!', name, 'no actual deal!');
                return;
            }
            if (expect.count != actual.count) {
                console.log('Test Failed!', name, 'expect count', expect.count, 'actual', actual.count);
                return;
            }
            if (expect.price != actual.price) {
                console.log('Test Failed!', name, 'expect price', expect.price, 'actual', actual.price);
                return;
            }
            if (expect.tradeType != actual.tradeType) {
                console.log('Test Failed!', name, 'expect tradeType', expect.tradeType, 'actual', actual.tradeType);
                return;
            }
            console.log('Test Passed!', name);
        }

        for (let i = 0; i < testMeta.length; i++) {
            var code = testMeta[i].code;
            var str = testMeta[i].strategy;
            if (emjyBack.retroAccount.stocks.find(s=>s.code == code)) {
                emjyBack.retroAccount.applyStrategy(code, str);
            } else {
                emjyBack.retroAccount.addWatchStock(code, str);
            }
            var stock = emjyBack.retroAccount.getStock(code)
            if (testMeta[i].snapshot) {
                for (let j = 0; j < testMeta[i].snapshot.length; j++) {
                    stock.updateRtPrice(testMeta[i].snapshot[j].sn);
                    var expect = testMeta[i].snapshot[j].expect;
                    if (expect) {
                        checkDeal(testMeta[i].testname, expect, emjyBack.retroAccount.deals[emjyBack.retroAccount.deals.length - 1]);
                    }
                }
            } else if (testMeta[i].kdata) {
                emjyBack.klines[code].klines = {};
                for (let k = 0; k < testMeta[i].kdata.length; k++) {
                    const datai = testMeta[i].kdata[k];
                    var kltype = datai.kltype;
                    emjyBack.klines[code].klines[kltype] = [];
                }
                while (testMeta[i].kdata.length > 0) {
                    var earliest = testMeta[i].kdata[0];
                    var earlk = 0;
                    for (let k = 1; k < testMeta[i].kdata.length; k++) {
                        const datai = testMeta[i].kdata[k].kldata[0];
                        if (earliest.kldata[0].kl.time < datai.kl.time) {
                            earlk = k;
                            earliest = datai;
                        }
                    }
                    var kldataj = testMeta[i].kdata[earlk].kldata.shift();
                    var kltype = testMeta[i].kdata[earlk].kltype;
                    if (testMeta[i].kdata[earlk].kldata.length == 0) {
                        testMeta[i].kdata.splice(earlk, 1);
                    }
                    emjyBack.klines[code].klines[kltype].push(kldataj.kl);
                    stock.strategies.checkKlines([kltype]);
                    var expect = kldataj.expect;
                    if (expect) {
                        checkDeal(testMeta[i].testname, expect, emjyBack.retroAccount.deals[emjyBack.retroAccount.deals.length - 1]);
                    }
                }
            }
        }
    }

    initKlines(code, startDate) {
        emjyBack.loadKlines(code,() => {
            if (!emjyBack.klines[code].klines) {
                emjyBack.fetchStockKline(code, this.kltype, startDate);
                return;
            }
            var dKline = emjyBack.klines[code].klines[this.kltype];
            if (this.kltype == '101' && (!dKline || dKline[0].time > startDate)) {
                emjyBack.klines[code].klines[this.kltype] = [];
                emjyBack.fetchStockKline(code, this.kltype, startDate);
            }
        });
    }

    clearRetroDeals() {
        emjyBack.retroAccount.deals = [];
    }

    saveRetroDeals() {
        emjyBack.retroAccount.save();
    }

    initRetro(code, str, startDate, endDate = null) {
        this.code = code;
        this.startDate = startDate;
        this.endDate = endDate;
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        if (emjyBack.retroAccount.stocks.find(s=>s.code == code)) {
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }
        this.initKlines(code, startDate);
    }

    retroStrategyMa(code, startDate, kltype = '101', endDate = null) {
        this.kltype = kltype;
        this.code = code;
        this.startDate = startDate;
        this.endDate = endDate;
        var str = {"grptype":"GroupStandard","strategies":{"0":{"key":"StrategyMA","enabled":true, kltype}},"amount":40000};
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        if (emjyBack.retroAccount.stocks.find(s=>s.code == code)) {
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        this.startRetro();
    }

    retroStrategyGe(code, kltype = '30') {
        this.kltype = kltype;
        this.code = code;
        var str = {
            "grptype":"GroupStandard",
            "strategies":{"0":{"key":"StrategyGE","enabled":true,"stepRate":0.04, kltype, "period":"l"}},
            "transfers":{"0":{"transfer":"-1"}},
            "amount":10000};
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (stock) {
            stock.strategies = null;
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        var skltype = '1';
        var dKline = emjyBack.klines[this.code].klines[this.kltype];
        var rKline = emjyBack.klines[this.code].klines[skltype];
        var startIdx = dKline.findIndex(kl => kl.time >= rKline[0].time);
        var resKline = dKline.splice(startIdx);
        var resRtKline = rKline.splice(0);
        var j = 0;
        for (var i = 0; i < resRtKline.length; i++) {
            rKline.push(resRtKline[i]);
            emjyBack.retroAccount.tradeTime = resRtKline[i].time;
            if (j < resKline.length && resRtKline[i].time == resKline[j].time) {
                dKline.push(resKline[j]);
                j++;
                stock.strategies.checkKlines([skltype, this.kltype]);
            } else {
                stock.strategies.checkKlines([skltype]);
            }
        }
    }

    retroStrategyBuySD(code, kltype = '30') {
        this.kltype = kltype;
        this.code = code;
        var str = {
            "grptype":"GroupStandard",
            "strategies":{"0":{"key":"StrategyBuySD","enabled":true, kltype}},
            "transfers":{"0":{"transfer":"-1"}},
            "amount":10000};
        if (!emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }

        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (stock) {
            stock.strategies = null;
            emjyBack.retroAccount.applyStrategy(code, str);
        } else {
            emjyBack.retroAccount.addWatchStock(code, str);
        }

        this.startRetro();
    }

    startRetro() {
        var stock = emjyBack.retroAccount.stocks.find(s => s.code == this.code);
        if (!stock) {
            console.log('stock not exists')
            return;
        }
        if (!emjyBack.klines[this.code] || !emjyBack.klines[this.code].klines) {
            console.log('stock klines not find!');
            return;
        }

        var dKline = emjyBack.klines[this.code].klines[this.kltype];

        var startIdx = 0
        if (this.startDate) {
            startIdx = dKline.findIndex(k => k.time >= this.startDate);
        }
        if (startIdx < 0) {
            console.log('can not find kl data at', this.startDate);
            return;
        }
        var resKline = dKline.splice(startIdx);
        for (var i = 0; i < resKline.length; i++) {
            dKline.push(resKline[i]);
            emjyBack.retroAccount.tradeTime = resKline[i].time;
            stock.strategies.checkKlines([this.kltype]);
        }
    }
}
