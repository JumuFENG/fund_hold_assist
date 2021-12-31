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
        this.dealsTable = new SortableTable();
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
        this.stockHis = new Set();
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

    showDeals(ignored, filtered) {
        var allDeals = this.getAllDeals();
        if (!allDeals || allDeals.length == 0) {
            return;
        }

        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        var totalCost = 0;
        var partEarned = 0;
        var partCost = 0;
        for (let i = 0; i < allDeals.length; i++) {
            const deali = allDeals[i];
            if (ignored && ignored.has(deali.code)) {
                continue;
            }
            if (filtered && !filtered.has(deali.code)) {
                continue;
            }

            this.stockHis.add(deali.code);
            var anchor = document.createElement('a');
            anchor.textContent = deali.code;
            if (emjyManager.stockMarket && emjyManager.stockMarket[deali.code]) {
                anchor.textContent = emjyManager.stockMarket[deali.code].name;
            }
            anchor.href = emjyManager.stockEmLink(deali.code);
            anchor.target = '_blank';

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
            if (resCount == 0 && filtered && filtered.size == 1) {
                this.dealsTable.addRow('part', '', '', '', '', '', partEarned.toFixed(2), (100 * (partEarned / partCost)).toFixed(2) + '%');
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

    showDealsTable() {
        this.showDeals(this.ignored);
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
            var anchor = document.createElement('a');
            anchor.textContent = deali.code;
            if (emjyManager.stockMarket && emjyManager.stockMarket[deali.code]) {
                anchor.textContent = emjyManager.stockMarket[deali.code].name;
            }
            anchor.href = emjyManager.stockEmLink(deali.code);
            anchor.target = '_blank';

            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
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
}