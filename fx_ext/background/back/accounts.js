'use strict';
let BondRepurchasePath = '/BondRepurchase/SecuritiesLendingRepurchase';

class Wallet {
    constructor() {
        this.fundcode = '511880';
        this.name = '';
        this.state = 'none';
        this.holdCount = 0;
        this.log = emjyBack.log;
    }

    updateFundPrice(snapshot, account) {
        this.log('updateFundPrice');
        if (snapshot.code != this.fundcode) {
            return;
        };

        this.latestPrice = snapshot.realtimequote.currentPrice;
        this.buy1Prices = snapshot.fivequote.buy1;
        this.sell1Prices = snapshot.fivequote.sale1;
        if (this.state == 'fetchBuy') {
            this.state = 'none';
            emjyBack.tryBuyStock(this.fundcode, this.name, this.sell1Prices, 1, account);
        } else if (this.state == 'fetchSell') {
            this.state = 'none';
            emjyBack.trySellStock(this.fundcode, this.buy1Prices, 1, account);
        }
    }
}

class AccountInfo {
    constructor() {
        this.keyword = null;
        this.buyPath = null;
        this.sellPath = null;
        this.assetsPath = null;
        this.stocks = [];
        this.wallet = null;
        this.log = emjyBack.log;
    }

    initAccount(key, buyPath, sellPath, assetsPath) {
        this.keyword = key;
        this.buyPath = buyPath;
        this.sellPath = sellPath;
        this.assetsPath = assetsPath;
        this.wallet = new Wallet();
    }

    parseStockInfoList(stocks) {
        for (var i = 0; i < stocks.length; i++) {
            if (this.wallet && stocks[i].code == this.wallet.fundcode) {
                this.wallet.name = stocks[i].name;
                this.wallet.holdCount = stocks[i].holdCount;
                continue;
            };
            var stockInfo = this.stocks.find(function(s) {return s.code == stocks[i].code});
            if (!stockInfo) {
                stockInfo = new StockInfo(stocks[i]);
                this.stocks.push(stockInfo);
            };
            stockInfo.code = stocks[i].code;
            stockInfo.name = stocks[i].name;
            stockInfo.holdCount = parseInt(stocks[i].holdCount);
            stockInfo.availableCount = parseInt(stocks[i].availableCount);
            stockInfo.holdCost = stocks[i].holdCost;
            stockInfo.market = stocks[i].market;
        };
    }

    getAccountStocks() {
        if (!this.stocks || this.stocks.length == 0) {
            return null;
        };

        return {account: this.keyword, stocks: JSON.stringify(this.stocks)};
    }

    updateStockRtPrice(snapshot) {
        // this.log('updateStockRtPrice', JSON.stringify(snapshot));
        if (this.wallet && snapshot.code == this.wallet.fundcode) {
            this.wallet.updateFundPrice(snapshot, this.keyword);
            return;
        };

        if (!this.stocks) {
            return;
        };

        var stock = this.stocks.find(function(s) { return s.code == snapshot.code});
        if (stock) {
            if (!stock.name) {
                stock.name = snapshot.name;
            }
            stock.latestPrice = snapshot.realtimequote.currentPrice;
            var rtInfo = {};
            rtInfo.latestPrice = stock.latestPrice;
            rtInfo.openPrice = snapshot.fivequote.openPrice;
            var buyPrices = [snapshot.fivequote.buy1, snapshot.fivequote.buy2, snapshot.fivequote.buy3, snapshot.fivequote.buy4, snapshot.fivequote.buy5];
            if (buyPrices[0] == '-') {
                buyPrices[0] = stock.latestPrice;
            };
            for (var i = 1; i < buyPrices.length; i++) {
                if (buyPrices[i] == '-') {
                    buyPrices[i] = buyPrices[i - 1];
                };
            };
            rtInfo.buyPrices = buyPrices;
            var sellPrices = [snapshot.fivequote.sale1, snapshot.fivequote.sale2, snapshot.fivequote.sale3, snapshot.fivequote.sale4, snapshot.fivequote.sale5];
            if (sellPrices[0] == '-') {
                sellPrices[0] = stock.latestPrice;
            };
            for (var i = 1; i < sellPrices.length; i++) {
                if (sellPrices[i]) {
                    sellPrices[i] = sellPrices[i - 1];
                };
            };
            rtInfo.sellPrices = sellPrices;
            rtInfo.topprice = snapshot.topprice;
            rtInfo.bottomprice = snapshot.bottomprice;
            stock.rtInfo = rtInfo;
            stock.checkStrategies();
            tradeAnalyzer.updateStockRtPrice(snapshot);
        }
    }

    parseKlines(kline) {
        var klines = [];
        for (var i = 0; kline && i < kline.length; i++) {
            var kl = kline[i].split(',');
            var time = kl[0];
            if (new Date() < new Date(time)) {
                continue;
            };
            var o = kl[1];
            var c = kl[2];
            var h = kl[3];
            var l = kl[4];
            klines.push({time, o, c, h, l});
        };
        return klines;
    }

    applyStockKlines(klines, fecthed) {
        if (klines.length == 0) {
            klines = fecthed;
            this.calcKlineMA(klines);
            return;
        };

        var sum5 = 0;
        for (var i = 1; i <= 5 && i <= klines.length; i++) {
            sum5 += parseFloat(klines[klines.length - i].c);
        };
        var sum18 = 0;
        for (var i = 1; i <= 18 && i <= klines.length; i++) {
            sum18 += parseFloat(klines[klines.length - i].c);
        };
        var len5 = klines.length >= 5 ? 5 : klines.length;
        var len18 = klines.length >= 18 ? 18 : klines.length;
        var lastTime = klines[klines.length - 1].time;
        fecthed.forEach(k => {
            if (k.time > lastTime) {
                sum5 += parseFloat(k.c);
                if (len5 < 5) {
                    len5 ++;
                } else {
                    sum5 -= klines[klines.length - 6].c;
                };
                k.ma5 = (sum5 / len5).toFixed(3);

                sum18 += parseFloat(k.c);
                if (len18 < 18) {
                    len18 ++;
                } else {
                    sum18 -= klines[klines.length - 19].c;
                };
                k.ma18 = (sum18 / len18).toFixed(3);

                klines.push(k);
            };
        });
    }

    calcKlineMA(klines) {
        var len = 0;
        var sum = 0;
        var len5 = 0;
        var sum5 = 0;
        for (var i = 0; i < klines.length; i++) {
            sum += parseFloat(klines[i].c);
            sum5 += parseFloat(klines[i].c);
            if (len5 < 5) {
                len5 ++;
            } else {
                if (i >= 5) {
                    sum5 -= klines[i - 5].c;
                };
            };
            klines[i].ma5 = (sum5 / len5).toFixed(3);
            if (len < 18) {
                len ++;
            } else {
                if (i >= 18) {
                    sum -= klines[i - 18].c;
                };
            };
            klines[i].ma18 = (sum / len).toFixed(3);
        };
    }

    updateStockRtKline(message) {
        if (!this.stocks) {
            return;
        };

        var code = message.kline.data.code;
        var kltype = message.kltype;
        var klines = this.parseKlines(message.kline.data.klines);
        var stock = this.stocks.find((s) => { return s.code == code});
        if (stock && stock.buyStrategy && stock.buyStrategy.shouldGetKline() && stock.buyStrategy.kltype == kltype) {
            if (kltype == '60') {
                if (stock.buyStrategy.klines === undefined) {
                    stock.buyStrategy.klines = klines;
                    this.calcKlineMA(stock.buyStrategy.klines);
                } else {
                    this.applyStockKlines(stock.buyStrategy.klines, klines);
                };
            } else if (kltype == '101') {
                if (stock.buyStrategy.klines === undefined) {
                    stock.buyStrategy.klines = klines;
                    this.calcKlineMA(stock.buyStrategy.klines);
                } else {
                    this.applyStockKlines(stock.buyStrategy.klines, klines);
                };
            };
            stock.buyStrategy.checkKlines();
            strategyManager.flushStrategy(stock.buyStrategy);
            if (stock.buyStrategy.inCritical && (new Date()).getHours() < 15) {
                emjyBack.fetchStockSnapshot(stock.code);
            };
        } else if (stock && stock.sellStrategy && stock.sellStrategy.shouldGetKline() && stock.sellStrategy.kltype == kltype) {
            if (kltype == '60') {
                if (stock.sellStrategy.klines === undefined) {
                    stock.sellStrategy.klines = klines;
                    this.calcKlineMA(stock.sellStrategy.klines);
                } else {
                    this.applyStockKlines(stock.sellStrategy.klines, klines);
                };
            } else if (kltype == '101') {
                if (stock.sellStrategy.klines === undefined) {
                    stock.sellStrategy.klines = klines;
                    this.calcKlineMA(stock.sellStrategy.klines);
                } else {
                    this.applyStockKlines(stock.sellStrategy.klines, klines);
                };
            };
            strategyManager.flushStrategy(stock.sellStrategy);
            stock.sellStrategy.checkKlines();
            if (stock.sellStrategy.inCritical && (new Date()).getHours() < 15) {
                emjyBack.fetchStockSnapshot(stock.code);
            };
        };
    }

    buyStock(code, name, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = {code, name};

        if (count < 100) {
            this.log('Buy', code, name, 'price:', price, 'count: 1/', finalCount);
            emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
            return;
        };

        var moneyNeed = finalCount * price;
        if (this.availableMoney < moneyNeed) {
            finalCount = 100 * Math.floor(this.availableMoney / (100 * price));
        }

        moneyNeed = finalCount * price;

        if (this.availableMoney < moneyNeed) {
            this.log('No availableMoney match');
            return;
        }
        emjyBack.sendTradeMessage(this.buyPath, stockInfo, price, finalCount);
        this.availableMoney -= moneyNeed;
    }

    sellStock(code, price, count) {
        var finalCount = count;
        if (count <= 0) {
            finalCount = parseInt(400 / price);
            if (finalCount * price < 390) {
                finalCount++;
            }
            finalCount *= 100;
        }

        var stockInfo = this.stocks.find(function(s) { return s.code == code; });
        if (stockInfo) {
            if (finalCount > stockInfo.availableCount) {
                finalCount = stockInfo.availableCount;
            }
            if (finalCount == 0) {
                this.log('error: availableCount is 0');
                return;
            };

            emjyBack.sendTradeMessage(this.sellPath, {code: stockInfo.code, name: stockInfo.name}, price, finalCount);
            stockInfo.availableCount -= finalCount;
            this.availableMoney += finalCount * price;
        } else if (code == this.wallet.fundcode) {
            emjyBack.sendTradeMessage(this.sellPath, {code}, price, finalCount);
            this.availableMoney += this.wallet.holdCount * price;
            this.wallet.holdCount = 0;
        }
    }

    applyStrategy(code, bstr, sstr) {
        var stock = this.stocks.find(function(s) {return s.code == code; });
        if (!stock) {
            return;
        };
        if (bstr) {
            stock.buyStrategy = bstr;
        };
        if (sstr) {
            if (sstr.key == 'StrategySellEL' && stock.holdCost) {
                sstr.setHoldCost(stock.holdCost);
            };
            stock.sellStrategy = sstr;
        };
    }

    addStock(code) {
        this.stocks.push(new StockInfo({ code, name: '', holdCount: 0, availableCount: 0, market: ''}));
        if (!emjyBack.stockGuard.has(code)) {
            emjyBack.stockGuard.add(code);
            emjyBack.updateMonitor();
        };
    }

    removeStock(code) {
        this.stocks.forEach(function(item, index, arr) {
            if (item.code == code) {
                arr.splice(index, 1);
            };
        });
    }

    save() {
        this.stocks.forEach(function(s) {
            if (s.buyStrategy) {
                strategyManager.flushStrategy(s.buyStrategy);
            };
            if (s.sellStrategy) {
                strategyManager.flushStrategy(s.sellStrategy);
            };
        });
    }

    buyFundBeforeClose() {
        var anyCritial = this.stocks.find(function(s) {
            return s.buyStrategy && s.buyStrategy.enabled && s.buyStrategy.inCritical
        });

        if (!anyCritial) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchBuy';
        };
    }

    checkAvailableMoney(price) {
        var count = 100 * Math.ceil(400 / price);
        var moneyNeed = count * price;
        if (moneyNeed > this.availableMoney && this.wallet.holdCount > 0) {
            emjyBack.fetchStockSnapshot(this.wallet.fundcode);
            this.wallet.state = 'fetchSell';
        };
    }
}

class WatchAccount extends AccountInfo {
    constructor() {
        super();
        this.keyword = 'watch';
    }

    buyFundBeforeClose() {
        var repCodes = [{code: '204001', active: true}, {code:'131810', active: false}];
        repCodes.forEach(r => {
            this.log('Buy', r.code);
            emjyBack.scheduleTaskInNewTab({command: 'emjy.trade.bonds', code: r.code, path: BondRepurchasePath}, r.active);
        });
    }

    save() {
        var codes = [];
        this.stocks.forEach(function(s) {
            codes.push(s.code);
        });
        chrome.storage.local.set({'watching_stocks': codes});

        super.save();
    }
}
