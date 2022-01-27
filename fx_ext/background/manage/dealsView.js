'use strict';

class DealsPanelPage extends RadioAnchorPage {
    constructor() {
        super('成交记录');
        var allBtn = document.createElement('button');
        allBtn.textContent = '全部';
        allBtn.onclick = e => {
            this.showDealsTable();
        }
        this.container.appendChild(allBtn);
        this.inputCode = document.createElement('input');
        this.container.appendChild(this.inputCode);
        var btn1Stock = document.createElement('button');
        btn1Stock.textContent = '确定';
        btn1Stock.onclick = e => {
            this.showSingleStock(this.inputCode.value);
        }
        this.container.appendChild(btn1Stock);
        var btnShowShorts = document.createElement('button');
        btnShowShorts.textContent = '短线';
        btnShowShorts.onclick = e => {
            this.showShortTerms();
        }
        this.container.appendChild(btnShowShorts);
        var btnTest = document.createElement('button');
        btnTest.textContent = '测试';
        btnTest.onclick = e => {
            //this.countMaxAmount();
            //this.showDealsWithouYdb();
            //this.bsStatistics();
            //this.getMarketValued();
            this.getStocksIncreaseTooMuch();
        }
        this.container.appendChild(btnTest);
        this.dealsTable = new SortableTable(1, 0, false);
        this.container.appendChild(this.dealsTable.container);
        this.showDealsTable();
        this.ignored = new Set(['511880', '511010', '161129', '162411', '159994','160416',
        '159949', '518880', '159939', '512880', '512660', '512290', '512400', '512800', '513050',
        '161226', '161130', '588000', '512480', '513100', '512480', '513100', '588300', 
        '510510', '510300', '510800', '161725']);
        this.longterms = new Set(['600905','000858','002460','601101','002847','605033','605162',
        '605599','605598','001213','601728','000998','600918','600276','601600','002041','600546',
        '600022','601016','601601','600031','601101','601117','002241','600010','002531','600150',
        '000401','600089','600862','601800','000630','000651','601088','601012','600019','601328',
        '600893','603301','605167','601225','603363']);
        this.newstkbonds = new Set(['718599','127043','118002','072895','733029','110075','783108',
        '113043','783229','370078','113042','123096','733926','370059','783636','072966','110079',
        '123111','783778','113047','127032','113048','127047']);
    }

    getAllDeals() {
        // return emjyManager.savedDeals;
        return emjyManager.retroDeals;
    }

    show() {
        super.show();
        if (!this.dealsTable.table) {
            this.showDealsTable();
        }
    }

    addDealsOf(code) {
        var allDeals = this.getAllDeals();
        if (!allDeals || allDeals.length == 0) {
            return;
        }

        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        var totalCost = 0;
        var partEarned = 0;
        var partCost = 0;
        var deals = allDeals.filter(d => d.code == code);
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];
            var anchor = emjyManager.stockAnchor(deali.code);
            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            if (isNaN(fee)) {
                fee = 0;
            }
            totalFee += fee;
            fee  = fee.toFixed(2);
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
                totalEarned -= amount;
                totalCost += amount;
                partEarned -= amount;
                partCost += amount;
            } else {
                amount -= fee;
                partEarned += amount;
                totalEarned += amount;
            }
            amount = amount.toFixed(2);
            this.dealsTable.addRow(
                deali.time,
                deali.code,
                anchor,
                deali.tradeType,
                deali.price,
                deali.count,
                fee,
                amount
            );
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
            if (resCount == 0) {
                this.dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
                partEarned = 0;
                partCost = 0;
            }
        }
        totalEarned += emjyManager.getCurrentHoldValue(code, resCount); // filtered.values().next().value
        if (resCount == 0) {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        } else {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), '-');
        }
        return {cost: totalCost, earn: totalEarned, fee: totalFee};
    }

    showDeals(ignored, filtered) {
        var allDeals = this.getAllDeals();
        if (!allDeals || allDeals.length == 0) {
            return;
        }

        var toShow = new Set();
        if (filtered && filtered.size > 0) {
            toShow = filtered;
        } else {
            for (let i = 0; i < allDeals.length; i++) {
                const deali = allDeals[i];
                if (ignored && ignored.has(deali.code)) {
                    continue;
                }
                toShow.add(deali.code);
            }
        }

        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var collections = [];
        toShow.forEach(ds => {
            if (!ignored || !ignored.has(ds)) {
                var result = this.addDealsOf(ds);
                result.code = ds;
                collections.push(result);
            }
        });
        var totalCost = 0, totalEarned = 0, totalFee = 0;
        collections.sort((a, b) => {return a.earn - b.earn > 0;});
        for (let i = 0; i < collections.length; i++) {
            const collecti = collections[i];
            totalCost += collecti.cost;
            totalEarned += collecti.earn;
            totalFee += collecti.fee;
            this.dealsTable.addRow(i, collecti.code, emjyManager.stockAnchor(collecti.code), '', collecti.cost.toFixed(2), collecti.fee.toFixed(2), collecti.earn.toFixed(2), (100 * (collecti.earn / collecti.cost)).toFixed(2) + '%');
        }
        this.dealsTable.addRow('TOTAL', '', '', '', totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
    }

    showDealsTable() {
        this.showDeals(this.ignored);
    }

    showDealsWithouYdb() {
        this.showDeals(new Set(bankStocks));
    }

    showSingleStock(code) {
        this.showDeals(null, new Set([code]));
    }

    showShortTerms() {
        var notshow = new Set();
        this.ignored.forEach(i => notshow.add(i));
        this.longterms.forEach(l => notshow.add(l));
        this.newstkbonds.forEach(n => notshow.add(n));
        var daban = new Set(['601528','000561','600331','002309','002224','603090','002170','600888','600490',
        '002121','002913','002503','603214','002435','002435','603305','000829','601969','600256','002074',
        '601001','600039','600367','000697','001208','600032','002155','002895','002538','002941','003040',
        '605080','605077','600727','002132','002015','002943','600961','002897','605077','600281','603505',
        '600602','600096','600281','002539','002248','600295','000762','603938','600783','002206','000540',
        '600815','000791','600011','600163','600863','002487','603507','002349','000852','600691','000968',
        '603351','002452','600259','002529','002606','002667','603088','603665','001896','601068','600955',
        '600955','000875','603861','000993','000695']);
        daban.forEach(d => notshow.add(d));
        for (let i = 0; i < emjyManager.stockList.stocks.length; i++) {
            const stocki = emjyManager.stockList.stocks[i].stock;
            if (stocki.holdCount > 0) {
                notshow.add(stocki.code);
            }
        }
        // this.showDeals(notshow);
        var shown = new Set();
        var allDeals = this.getAllDeals();
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            if (notshow.has(deali.code)) {
                continue;
            }
            shown.add(deali.code);
        }
        //this.showDeals(null, shown);
        this.show1stRoundTrade(shown);
    }

    show1stRoundTrade(filtered) {
        var allDeals = this.getAllDeals();
        var deals = allDeals.filter(d => filtered.has(d.code));
        deals.sort((d1, d2) => {
            if (d1.code == d2.code) {
                return d1.time > d2.time;
            }
            return d1.code > d2.code;
        });
        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        var totalCost = 0;
        var partEarned = 0;
        var partCost = 0;
        var shown1stRound = new Set();
        var lost1stRound = new Set();
        for (let i = 0; i < deals.length; i++) {
            const deali = deals[i];

            if (shown1stRound.has(deali.code)) {
                continue;
            }

            var anchor = emjyManager.stockAnchor(deali.code);
            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            if (!isNaN(fee)) {
                totalFee += fee;
                fee  = fee.toFixed(2);
            } else {
                fee = 0;
            }
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
                totalEarned -= amount;
                totalCost += amount;
                partEarned -= amount;
                partCost += amount;
            } else {
                amount -= fee;
                partEarned += amount;
                totalEarned += amount;
            }
            amount = amount.toFixed(2);
            this.dealsTable.addRow(
                deali.time,
                deali.code,
                anchor,
                deali.tradeType,
                deali.price,
                deali.count,
                fee,
                amount
            );
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
            if (resCount == 0) {
                this.dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
                if (partEarned > 0 && !lost1stRound.has(deali.code)) {
                    shown1stRound.add(deali.code);
                }
                if (partEarned < 0) {
                    lost1stRound.add(deali.code);
                }
                partEarned = 0;
                partCost = 0;
            }
        }
        if (filtered && filtered.size == 1 && resCount != 0) {
            totalEarned += emjyManager.getCurrentHoldValue(filtered.values().next().value);
        }
        if (resCount == 0) {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), (100 * (totalEarned / totalCost)).toFixed(2) + '%');
        } else {
            this.dealsTable.addRow('total', '', '', resCount, totalCost.toFixed(2), totalFee.toFixed(2), totalEarned.toFixed(2), '-');
        }
    }

    countMaxAmount() {
        var allDeals = this.getAllDeals();
        var amount = 0;
        var maxMt = 0;
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            if (deali.tradeType == 'B') {
                amount += (deali.count * deali.price);
            } else {
                amount -= (deali.count * deali.price);
            }
            if (amount > maxMt) {
                maxMt = amount;
            }
        }
        console.log(maxMt);
        return maxMt;
    }

    bsStatistics() {
        var allDeals = this.getAllDeals();
        var codes = new Set();
        for (let i = 0; i < allDeals.length; i++) {
            codes.add((allDeals[i].code));
        }

        var dealsStats = [];
        var kltype = '101';
        codes.forEach(c => {
            var kline = emjyManager.klines[c].getKline(kltype);
            if (!kline) {
                console.log('no kline for', c);
                return;
            }
            if (!c.startsWith('60') && !c.startsWith('00')) {
                return;
            }
            var bi = -1;
            while (true) {
                bi = kline.findIndex((k, i)=>{return i > bi && k.bss18 == 'b';});
                if (bi == -1) {
                    break;
                }
                var si = kline.findIndex((k, i)=>{return i > bi && k.bss18 == 's';});
                if (si == -1) {
                    break;
                }
                var bprc = kline[bi].c;
                var sprc = kline[si].c;
                var earn = 100 * (sprc - bprc) / bprc;
                var bma = kline[bi].ma18;
                var mkl = kline[bi];
                for (let j = bi; j >= 0; j--) {
                    const kl = kline[j];
                    if (kl.bss18 == 's') {
                        break;
                    }
                    if (kl.l - mkl.l < 0) {
                        mkl = kl;
                    }
                }
                var time = kline[bi].time;
                var mma = mkl.ma18;
                var mprc = mkl.l;
                var moff = ((mma - mprc) * 100 / mma).toFixed(2);
                var boff = ((bprc - bma) * 100 / bma).toFixed(2);
                var bct = ((bprc - mprc) * 100 / bprc).toFixed(2);
                dealsStats.push({code: c, time, mma, mprc, moff, bma, bprc, boff, bct, sprc, earn});
            }
        });
        console.log(dealsStats);
        if (!this.statsTable) {
            this.statsTable = new SortableTable(1,0);
            this.container.appendChild(this.statsTable.container);
        }
        this.statsTable.reset();
        this.statsTable.setClickableHeader('', 'code', 'name', '前低','前低ma','前偏', '时间','买入','买入ma','买偏', '止损','卖出','收益');
        // var getAverEarned = function(l, r) {
        //     var totalEarn = 0;
        //     var count = 0;
        //     for (let i = 0; i < dealsStats.length; i++) {
        //         const statsi = dealsStats[i];
        //         if (statsi.bct < l || statsi.bct > r) {
        //             continue;
        //         }
        //         totalEarn += statsi.earn;
        //         count++;
        //     }
        //     if (count == 0) {
        //         return {aver: 0, count};
        //     }
        //     return {aver: totalEarn/count, count};
        // }

        // var d = 5;
        // for (let j = 0; j < 35; j+=d) {
        //     var rt = getAverEarned(j, j + d);
        //     this.statsTable.addRow(j, '(' + j + ',' + (j + d) +']', rt.count, rt.aver.toFixed(4));
        // }

        var totalEarn = 0;
        var count = 0;
        for (let i = 0; i < dealsStats.length; i++) {
            const statsi = dealsStats[i];
            if (statsi.bct > 24 || statsi.bct < 14) { // 14, 24 for '101'
                continue;
            }
            totalEarn += statsi.earn;
            this.statsTable.addRow(
                i, statsi.code, emjyManager.stockAnchor(statsi.code),
                statsi.mprc, statsi.mma, statsi.moff, statsi.time,
                statsi.bprc, statsi.bma, statsi.boff, statsi.bct, 
                statsi.sprc, statsi.earn.toFixed(2));
            count++;
        }
        this.statsTable.addRow(count, '', '', '', '','','','','','','','',(totalEarn/count).toFixed(4))
    }

    getMarketValued() {
        // wencaiCommon.getWencaiMarketValuesTop(700, datas => {
        //     var rank = [];
        //     for (let i = 0; i < datas.length; i++) {
        //         rank.push(datas[i].code);
        //     }
        //     console.log(rank);
        // });
        var normal = [];
        var collat = [];
        maxValueSelected.forEach(s => {
            if (emjyManager.isRzRq(s)) {
                collat.push(s);
            } else {
                normal.push(s);
            }
        });
        console.log(normal);
        console.log(collat);
    }

    getStocksIncreaseTooMuch() {
        var increaseTooMuch = [];
        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('','代码', '名称');
        for (let i = 0; i < increaseTooMuch.length; i++) {
            var anch = emjyManager.stockAnchor(increaseTooMuch[i]);
            this.dealsTable.addRow(i, increaseTooMuch[i], anch);
        }
    }
}