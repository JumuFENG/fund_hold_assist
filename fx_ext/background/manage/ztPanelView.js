'use strict';

var startDate = new Date('2021-07-23');
var endDate = new Date('2021-07-23');

class ZtTablePage extends RadioAnchorPage {
    constructor(zt, ztStocks) {
        var zttitle = zt > 1 ? zt + '连板' : '首板';
        super(zttitle);

        if (!ztStocks) {
            return;
        }
       
        this.ztTable = new SortableTable();
        this.ztTable.reset();
        this.container.appendChild(this.ztTable.container);
        this.ztTable.setClickableHeader('序号', '名称(代码)', '总市值', '流通市值', '炸板次数', '换手率(%)', zttitle + '价格', zttitle + '日期');
        for (var i = 0; i < ztStocks.length; i++) {
            var stocki = ztStocks[i];
            if (zt == 1) {
                emjyManager.addZt1Stock(stocki);
            }
            var anchor = document.createElement('a');
            anchor.textContent = stocki.name + '(' + stocki.code + ')';
            if (stocki.m !== undefined) {
                anchor.href = emStockUrl + (stocki.m == '0' ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            } else {
                anchor.href = emStockUrl + (stocki.code.startsWith('00') ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            }
            anchor.target = '_blank';
            this.ztTable.addRow(
                i + 1, anchor,
                parseFloat(stocki.zsz.toFixed(4)),
                parseFloat(stocki.ltsz.toFixed(4)),
                stocki.zbc,
                parseFloat(stocki.hsl.toFixed(2)),
                stocki.price,
                stocki.ztdate,
                );
        }
    }
}

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停一览');
        this.createZtArea();

        this.ztListDiv = null;
        this.emulator = null;
        this.ztpool = [];
        this.ztData = {};
        this.gettingDate = null;
    }

    getLastTradingDate(sep = '') {
        var now = new Date();
        var dateVal = now.getDate();
        if (now.getDay() == 0) {
            dateVal -= 2;
        } else if (now.getDay() == 6 || now.getHours() < 10) {
            dateVal -= 1;
        };
        now.setDate(dateVal);
        this.gettingDate = now;
        return utils.dateToString(now, sep);
    }

    getNextDate(date, sep = '') {
        var d = new Date(date);
        d.setDate(d.getDate() + 1);
        return utils.dateToString(d, sep);
    }

    createZtArea() {
        var fileIptDiv = document.createElement('div');
        var inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.multiple = true;
        inputFile.onchange = e => {
            this.onFileLoaded(e.target.files);
        };
        fileIptDiv.appendChild(document.createTextNode('涨停板文件 '));
        fileIptDiv.appendChild(inputFile);
        fileIptDiv.appendChild(document.createElement('br'));
        this.container.appendChild(fileIptDiv);
        var getZtBtn = document.createElement('button');
        getZtBtn.textContent = '获取最新涨停股池';
        getZtBtn.onclick = e => {
            this.getZTPool(this.getLastTradingDate());
            // this.getHistZTPool();
        };
        this.container.appendChild(getZtBtn);
        var hideLbl = document.createElement('label');
        hideLbl.textContent = '隐藏涨停列表';
        var checkHide = document.createElement('input');
        checkHide.type = 'checkbox';
        checkHide.checked = false;
        checkHide.onclick = e => {
            if (this.ztListDiv) {
                this.ztListDiv.style.display = e.target.checked ? 'none': 'block';
            };
        };
        hideLbl.appendChild(checkHide);
        this.container.appendChild(hideLbl);
    }

    createEmulateArea() {
        var emulateDiv = document.createElement('div');
        var ztSelector = utils.createSelector({1: '首板', 2: '二连板', 3: '三连板'}, '--连板类型--');
        ztSelector.onchange = e => {
            for (var i = 0; i < this.ztData.length; i++) {
                if (this.ztData[i].ztcount == e.target.value) {
                    this.emulator.setZtData(this.ztData[i].ztStocks);
                    break;
                };
            };
        };
        emulateDiv.appendChild(ztSelector);

        var szSelector = utils.createSelector({20: '20亿', 50: '50亿', 100:'100亿', 200:'200亿'}, '--最低流通值--');
        szSelector.onchange = e => {
            this.emulator.setMinMarketVal(e.target.value);
        };
        emulateDiv.appendChild(szSelector);

        var buySelector = utils.createSelector({0: '开盘买入', 1: '开盘买，低位补'}, '--买入时机--');
        buySelector.onchange = e => {
            this.emulator.setBuyPoint(e.target.value);
        };
        emulateDiv.appendChild(buySelector);

        var iptDays = document.createElement('input');
        iptDays.placeholder = '持有天数(默认1)';
        iptDays.onchange = e => {
            this.emulator.setHoldDays(e.target.value);
        };
        emulateDiv.appendChild(iptDays);

        var sellSelector = utils.createSelector({0: 'N日开盘', 1: 'N日收盘', 2: 'N日最高', 3: 'N日高点回落', 4:'不创新高卖出',5:'止损止盈'}, '--卖出时机--');
        sellSelector.onchange = e => {
            this.emulator.setSellPoint(e.target.value);
            this.sellExtraDiv.style.display = e.target.value == 5 ? 'inline' : 'none';
        };
        emulateDiv.appendChild(sellSelector);

        this.sellExtraDiv = document.createElement('div');
        emulateDiv.appendChild(this.sellExtraDiv);
        var iptMaxEarn = document.createElement('input');
        iptMaxEarn.placeholder = '止盈(%)';
        iptMaxEarn.onchange = e => {
            this.emulator.setMaxEarn(e.target.value);
        };
        this.sellExtraDiv.appendChild(iptMaxEarn);

        var iptMaxLose = document.createElement('input');
        iptMaxLose.placeholder = '止损(%)';
        iptMaxLose.onchange = e => {
            this.emulator.setMaxLose(e.target.value);
        };
        this.sellExtraDiv.appendChild(iptMaxLose);
        this.sellExtraDiv.style.display = 'none';

        var confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确定';
        confirmBtn.onclick = e => {
            this.emulator.doEmulator();
        }
        emulateDiv.appendChild(confirmBtn);

        return emulateDiv;
    }

    getHistZTPool() {
        this.getZTPool(utils.dateToString(startDate));
        this.gettingDate = startDate;
    }

    getZTPool(date) {
        emjyManager.sendExtensionMessage({command:'mngr.getZTPool', date});
    }

    archiveZTPool(ztpool) {
        for (var k = 0; k < ztpool.length; k++) {
            var ztdate = ztpool[k].ztdate;
            for (var i = 0; i < ztpool[k].pool.length; ++i) {
                var stock = ztpool[k].pool[i];
                if (stock.c.startsWith('68') || stock.c.startsWith('30')) {
                    continue;
                }
                if (stock.n.includes("ST")) {
                    continue;
                }
                if (stock.n.endsWith('退')) {
                    continue;
                }
                if (stock.n.startsWith('退市')) {
                    continue;
                }
                if (stock.zttj.days != stock.zttj.ct) {
                    continue;
                }
                var name = stock.n;
                var code = stock.c;
                var m = stock.m;
                var ltsz = stock.ltsz / 100000000; // 流通市值
                var zsz = stock.tshare / 100000000; // 总市值
                var hsl = stock.hs;  // 换手率 %
                var zbc = stock.zbc; // 炸板次数
                var price = stock.p / 1000; // 最新价
                if (this.ztData[stock.lbc] === undefined) {
                    this.ztData[stock.lbc] = [];
                }
                var stk = this.ztData[stock.lbc].find(s => {return s.code == stock.c && s.ztdate == ztdate;});
                if (!stk) {
                    this.ztData[stock.lbc].push({name, code, m, ltsz, zsz, hsl, zbc, price, ztdate});
                };
            }
        };
    }

    onZTPoolback(ztpool) {
        var ztdate = utils.dateToString(this.gettingDate, '-');
        this.gettingDate.setDate(this.gettingDate.getDate() + 1);
        if (this.gettingDate < endDate) {
            this.getZTPool(utils.dateToString(this.gettingDate));
        };
        if (!ztpool || !ztpool.data) {
            console.log('onZTPoolback', ztpool);
            return;
        };

        this.ztpool.push({ztdate, pool: ztpool.data.pool});
        this.archiveZTPool(this.ztpool);
        this.refreshZtPool();
        this.saveZtPool();
    }

    onFileLoaded(files) {
        if (files.length > 1) {
            this.onMergeZTPools(files);
            return;
        };
        files[0].text().then(text => {
            var fobj = JSON.parse(text);
            if (Array.isArray(fobj) && fobj.length > 0) {
                if (fobj[0].ztdate !== undefined && Array.isArray(fobj[0].pool)) {
                    this.onSavedZTPoolLoaded(fobj);
                };
            } else if (fobj[1]|| fobj[2]) {
                this.addMoreZTData(fobj);
                this.refreshZtPool();
            }
        });
    }

    addMoreZTData(fobj) {
        for (var i in fobj) {
            if (this.ztData[i] === undefined) {
                this.ztData[i] = [];
            }
            for (var j = 0; j < fobj[i].length; j++) {
                var stk = this.ztData[i].find(s => {
                    return s.code == fobj[i][j].code && s.ztdate == fobj[i][j].ztdate;
                });
                if (!stk) {
                    this.ztData[i].push(fobj[i][j]);
                }
            }
        };
    }

    onSavedZTPoolLoaded(ztpool) {
        this.archiveZTPool(ztpool);
        this.refreshZtPool();
        // var ztstats = new ZtPoolStats();
        // ztstats.onSavedZTPoolLoaded(ztpool);
    }

    onMergeZTPools(files) {
        var ztpool = [];
        var flen = files.length;
        for (var i = 0; i < files.length; i++) {
            files[i].text().then(text => {
                (JSON.parse(text)).forEach(z => {
                    if (!ztpool.find(d => {return d.ztdate == z.ztdate;})) {
                        ztpool.push(z);
                    };
                });
                flen--;
                if (flen == 0 && ztpool.length > 0) {
                    ztpool.sort((a, b) => {return a.ztdate > b .ztdate; });
                    var blob = new Blob([JSON.stringify(ztpool)], {type: 'application/json'});
                    var filename = 'StockDailyPrices/首板统计/ztdaily/' + ztpool[0].ztdate + '-' + ztpool[ztpool.length - 1].ztdate + '.json';
                    emjyManager.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
                };
            });
        };
    }

    refreshZtPool() {
        if (!this.ztListDiv) {
            this.ztListDiv = document.createElement('div');
            this.container.appendChild(this.ztListDiv);
            this.ztRadioBar = new RadioAnchorBar();
            this.ztListDiv.appendChild(this.ztRadioBar.container);
        };
        if (!this.emulator) {
            this.emulator = new TradeEmulate();
            var emulateDiv = this.createEmulateArea();
            this.container.appendChild(emulateDiv);
            this.emulator.initUi(emulateDiv);
        };
        this.ztRadioBar.clearAllAnchors();
        for (var i in this.ztData) {
            var ztTbl = new ZtTablePage(i, this.ztData[i]);
            this.ztRadioBar.addRadio(ztTbl);
            this.ztListDiv.appendChild(ztTbl.container);
        }
        this.ztRadioBar.selectDefault();
    }

    saveZtPool() {
        var date = utils.getTodayDate('');
        if (this.ztData) {
            var blob = new Blob([JSON.stringify(this.ztData)], {type: 'application/json'});
            var filename = 'StockDailyPrices/首板统计/ztpool' + date + '.json';
            emjyManager.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
        };
        if (this.ztpool.length > 0) {
            var blob = new Blob([JSON.stringify(this.ztpool)], {type: 'application/json'});
            var filename = 'StockDailyPrices/首板统计/ztdaily/' + this.ztpool[0].ztdate + '.json';
            emjyManager.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
        };
    }

    addNewStockToWatchList(ztStocks) {
        return;
        var ztdate = utils.getTodayDate('-');
        var account = 'normal';
        for (var i = 0; i < ztStocks.length; i++) {
            var stocki = ztStocks[i];
            if (stocki.ztdate != ztdate) {
                continue;
            };
            if (stocki.name.startsWith('N')) {
                var strgrp = {grptype:'GroupStandard',amount:10000,transfers:{'0':{'transfer':'-1'}},strategies:{'0':{key:'StrategyBuyZT',enabled:true,backRate:0.01,stepRate:0.08}}};
                emjyManager.addWatchingStock(stocki.code, account, strgrp);
            };
        };
    }

    addToWatchList(ztStocks) {
        return;
        var ztdate = utils.getTodayDate('-');
        var account = 'normal';
        for (var i = 0; i < ztStocks.length; i++) {
            var stocki = ztStocks[i];
            if (stocki.ztdate != ztdate) {
                continue;
            };
            var strgrp = {grptype:'GroupStandard', amount: 10000, transfers:{'0':{'transfer':'1'}},strategies:{'0':{key: 'StrategyBuyZTBoard', enabled: true, account, ztdate},'1': {key: 'StrategySellELS', enabled: false, account}}};
            emjyManager.addWatchingStock(stocki.code, account, strgrp);
        };
    }
};

class TradeEmulate {
    constructor() {
        this.fee = 0.0012; // 费率
        this.fee2 = 0.00012; // 佣金
        this.minMV = 50;
        this.buyPoint = 0;  // 0: 开盘买入 
        this.sellPoint = 0; // 0: 'N日开盘', 1: 'N日收盘', 2: 'N日最高', 3: 'N日高点回落', 4:'不创新高卖出',5:'止损止盈'
        this.maxEarn = 0.2;
        this.maxLose = 0.15;
        this.holdDays = 1;
        this.ztStocks = [];
        this.emuStocks = [];
    }

    initUi(root) {
        this.root = root;
        this.emulateTable = new SortableTable(1, 1);
        this.root.appendChild(this.emulateTable.container);
        this.statsDiv = document.createElement('div');
        this.root.appendChild(this.statsDiv);
    }

    setZtData(data) {
        this.ztStocks = data;
    }

    setMinMarketVal(val) {
        this.minMV = val;
    }

    setBuyPoint(pt) {
        this.buyPoint = pt;
    }

    setHoldDays(t) {
        this.holdDays = t > 0 ? t : 1;
    }

    setSellPoint(pt) {
        this.sellPoint = pt;
    }

    setMaxEarn(val) {
        this.maxEarn = val / 100;
    }

    setMaxLose(val) {
        this.maxLose = val / 100;
    }

    calcCount(p) {
        return 100 * Math.ceil(400 / p);
    }

    getBuyInfo(kline, bp) {
        if (kline[0].l == kline[0].h) {
            return {buy: 0};
        };

        if (bp == 0) {
            var buy = kline[0].o;
            var count = this.calcCount(buy);
            var cost = buy * count;
            cost += (cost * this.fee2 < 5 ? 5 : cost * this.fee2);
            return {buy, count, cost};
        };
        
        if (bp == 1) {
            var buy = kline[0].o;
            var count = this.calcCount(buy);
            var cost = buy * count;
            cost += (cost * this.fee2 < 5 ? 5 : cost * this.fee2);
            if (kline[0].l < 0.92 * kline[0].o) {
                var buy2 = kline[0].l * 1.01;
                var count2 = this.calcCount(buy2);
                var cost2 = buy2 * count2;
                cost2 += (cost2 * this.fee2 < 5 ? 5 : cost2 * this.fee2);
                cost += cost2;
                count += count2;
            };
            buy = parseFloat((cost / count).toFixed(2));
            return {buy, count, cost};
        };

        return {buy: 0};
    }

    getSellPrice(kline, sp, price) {
        if (sp == 0) {
            return kline[this.holdDays].o;
        };
        if (sp == 1) {
            return kline[this.holdDays].c;
        };
        if (sp == 2) {
            return kline[this.holdDays].h;
        };
        if (sp == 3) {
            return kline[this.holdDays].h * 0.98;
        };
        if (sp == 4) {
            var si = 1;
            for (var i = 1; i < kline.length; i++) {
                if (kline[i].h < kline[i - 1].h) {
                    si = i;
                    break;
                };
            };
            return kline[si].c;
        };
        if (sp == 5) {
            var sellh = price * (1 + this.maxEarn);
            var selll = price * (1 - this.maxLose);
            for (var i = 1; i < kline.length; i++) {
                if (kline[i].l <= selll) {
                    return selll;
                };
                if (kline[i].h >= sellh) {
                    return Math.max(kline[i].h * 0.99, sellh);
                };
            };
            return kline[kline.length - 1].o;
        };
    }

    doEmulator() {
        if (this.ztStocks.length == 0) {
            console.log('this.ztStocks not valid!');
        };

        this.emuStocks = [];
        for (var i = 0; i < this.ztStocks.length; i++) {
            var stocki = this.ztStocks[i];
            if (!stocki.kline || stocki.kline.length <= this.holdDays) {
                continue;
            };
            if (stocki.ltsz < this.minMV) {
                continue;
            };
            var code = stocki.code;
            var name = stocki.name;
            var m = stocki.m;
            var price = stocki.price;
            var ztdate = stocki.ztdate;
            var kline = stocki.kline;
            if (kline[0].date <= ztdate) {
                console.log('kline error:', stocki);
            };
            var date = kline[0].date;
            var bi = this.getBuyInfo(kline, this.buyPoint);
            if (bi.buy == 0) {
                console.log('not buy for', stocki);
                continue;
            };
            var buy = bi.buy;
            var count = bi.count;
            var cost = bi.cost;
            var sell = this.getSellPrice(kline, this.sellPoint, bi.buy);
            var sold = sell * count;
            sold -= sold * this.fee + (sold * this.fee2 < 5 ? 5 : sold * this.fee2)
            var earned = sold - cost;
            var yld = earned * 100 / cost;
            var trade = {date, buy, sell, count, cost, sold, earned, yld};
            this.emuStocks.push({code, name, m, price, ztdate, trade});
        };

        this.refreshEmuTable();
    }

    refreshEmuTable() {
        this.emulateTable.reset();
        this.emulateTable.setClickableHeader('序号', '名称(代码)', '封板价格', '封板日期', '买入日期', '买入价', '数量', '买入额', '卖出价', '卖出额', '毛收益', '收益率%');
        var totalCost = 0, totalSold = 0, dailyCost = 0;
        var costByDay = [];
        var curDay = this.emuStocks[0].trade.date;
        var earnedCount = 0;
        for (var i = 0; i < this.emuStocks.length; i++) {
            var stocki = this.emuStocks[i];
            var anchor = document.createElement('a');
            anchor.textContent = stocki.name + '(' + stocki.code + ')';
            if (stocki.m !== undefined) {
                anchor.href = emStockUrl + (stocki.m == '0' ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            };
            anchor.target = '_blank';
            this.emulateTable.addRow(
                i + 1, anchor,
                stocki.price,
                stocki.ztdate,
                stocki.trade.date,
                stocki.trade.buy,
                stocki.trade.count,
                stocki.trade.cost.toFixed(2),
                typeof (stocki.trade.sell) === 'string' ? stocki.trade.sell: stocki.trade.sell.toFixed(2),
                stocki.trade.sold.toFixed(2),
                stocki.trade.earned.toFixed(2),
                stocki.trade.yld.toFixed(3)
                );
            if (stocki.trade.date == curDay) {
                dailyCost += stocki.trade.cost;
            } else {
                costByDay.push(dailyCost);
                dailyCost = stocki.trade.cost;
                curDay = stocki.trade.date;
            };
            if (stocki.trade.earned > 0) {
                earnedCount++;
            };
            totalCost += stocki.trade.cost;
            totalSold += stocki.trade.sold;
        };
        costByDay.push(dailyCost);

        this.emulateTable.addRow(
            '总计', '', '', '', '', '', '', totalCost.toFixed(2),
            '', totalSold.toFixed(2), 
            (totalSold - totalCost).toFixed(2),
            ((totalSold - totalCost) * 100 / totalCost).toFixed(3)
            );
        utils.removeAllChild(this.statsDiv);
        this.statsDiv.appendChild(document.createTextNode(costByDay.join(' ')));
        this.statsDiv.appendChild(document.createTextNode(' Avg: ' + (totalCost / costByDay.length).toFixed(2) + ' Max: ' + Math.max(...costByDay)));
        this.statsDiv.appendChild(document.createTextNode(' 胜率: (' + earnedCount + '/' + this.emuStocks.length + ')' + (earnedCount * 100 / this.emuStocks.length).toFixed(3) + '%'));
    }
};

class ZtPoolStats {
    onSavedZTPoolLoaded(ztpool) {
        this.ztData = {};
        this.maxZtCount = 0;
        for (var k = 0; k < ztpool.length; k++) {
            var ztdate = ztpool[k].ztdate;
            for (var i = 0; i < ztpool[k].pool.length; ++i) {
                var stock = ztpool[k].pool[i];
                if (stock.c.startsWith('68') || stock.c.startsWith('30')) {
                    continue;
                }
                if (stock.n.includes("ST")) {
                    continue;
                }
                if (stock.n.endsWith('退')) {
                    continue;
                }
                if (stock.n.startsWith('退市')) {
                    continue;
                }
                if (stock.zttj.days != stock.zttj.ct) {
                    continue;
                }
                var name = stock.n;
                var code = stock.c;
                var m = stock.m;
                var ltsz = stock.ltsz / 100000000; // 流通市值
                var zsz = stock.tshare / 100000000; // 总市值
                var hsl = stock.hs;  // 换手率 %
                var zbc = stock.zbc; // 炸板次数
                var price = stock.p / 1000; // 最新价
                var ztcount = stock.lbc; // 
                if (ztcount - this.maxZtCount > 0) {
                    this.maxZtCount = ztcount;
                };
                if (!this.ztData[ztdate]) {
                    this.ztData[ztdate] = [];
                };
                if (!this.ztData[ztdate][ztcount]) {
                    this.ztData[ztdate][ztcount] = [];
                };
                this.ztData[ztdate][ztcount].push({code, name});
            }
        };

        console.log(this.ztData);
        var ztNums = [];
        for (var dt in this.ztData) {
            var ztLen = [];
            for (var i = 1; i <= this.maxZtCount; i++) {
                if (this.ztData[dt][i]) {
                    ztLen.push(this.ztData[dt][i].length);
                } else {
                    ztLen.push(0);
                }
            };
            ztNums.push(ztLen);
        };
        for (var n = 1; n < 6; n++) {
            for (var j = 0; j < this.maxZtCount - n; j++) {
                var sumj = 0;
                var sumj1 = 0;
                for (var i = 0; i < ztNums.length - n; i++) {
                    sumj += ztNums[i][j];
                    sumj1 += ztNums[i + n][j + n];
                };
                console.log(j + 1, 'to', j + n + 1, sumj, sumj1, (sumj1 / sumj).toFixed(2));
            };
        }
    }
}