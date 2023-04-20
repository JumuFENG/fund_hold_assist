'use strict';

let strategyOptions = {
    'zt1':  {name:'首板次日买入', val:'zt1', strategy:'StrategyZt0'},
    'dt3':  {name:'连续跌停', val:'dt3'},
    'ipo':  {name:'新股', val:'ipo'},
    'cents': {name: '毛票', val:'cents', fqt:0},
}
let mktOptions = {'all': {name:'全部', val:0}, 'main': {name:'沪深主板', val: 1}, 'part': {name:'双创', val: 2}, 'st': {name:'ST股', val: 3}, 'h1': {name: '一字板', val: 4}}
let sortOptions = {'ztStrength': {name:'上板强度', val: 0}, 'vol': {name:'放量程度', val: 1}, 'earn': {name: '收益率', val: 2}}

class StockData {
    constructor(skey) {
        this.key = skey;
        this.klchecked = {};
    }

    fetchOriginStockData(cb) {
        var url = emjyBack.fha.server + 'stock?act=pickupdone&key='+this.key;
        utils.get(url, null, zt1 => {
            this.stocks = JSON.parse(zt1);
            this.stocks.sort((a,b) => {
                return a[2] - b[2] < 0;
            });
            this.sortType = 0;
            this.stocks.forEach(s => {
                var s6 = JSON.parse(s[6]);
                if (!s6 || s6.length < 2) {
                    console.log(s);
                    return;
                }
                var p1 = s6[0].price;
                var p2 = s6[1].price;
                s[6] = p1;
                s.push(p2);
                s.push((p2 - p1)*100/p1);
            });
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    filterStocks(mkt) {
        return this.stocks.filter(x => {
            var code = x[0].substring(2);
            if (mkt == 1) {
                return !code.startsWith('30') && !code.startsWith('68');
            }
            if (mkt == 2) {
                return code.startsWith('30') || code.startsWith('68');
            }
            if (mkt == 3) {
                if (!emjyBack.klines[code]) {
                    return false;
                }
                var date = x[1];
                var kl = emjyBack.klines[code].getKlineByTime(date);
                var kl0 = emjyBack.klines[code].getPrevKlineByTime(date);
                if (!kl || !kl0) {
                    return false;
                }
                if ((kl.c - kl0.c) / kl0.c > 0.08) {
                    return false;
                }
            }
            if (mkt == 4) {
                if (!emjyBack.klines[code]) {
                    return false;
                }
                var date = x[1];
                var kl = emjyBack.klines[code].getKlineByTime(date);
                if (!kl) {
                    return false;
                }
                return kl.h - kl.l == 0;
            }
            return true;
        });
    }

    showStocks(stkTable, mkt=0, srt=0) {
        if (!this.stocks || this.stocks.length == 0) {
            return;
        }

        stkTable.reset();
        stkTable.setClickableHeader('日期', '代码', '名称', '上板强度', '放量程度', '建仓日期', '清仓日期', '买入价', '卖出价', '收益(%)');
        if (this.sortType != srt) {
            var sidx = 2;
            if (srt == sortOptions['vol'].val) {
                sidx = 3;
            } else if (srt == sortOptions['earn'].val) {
                sidx = 8;
            }
            this.stocks.sort((a,b) => {return a[sidx] - b[sidx] < 0});
            this.sortType = srt;
        }
        var erate = 0;
        var mktstocks = this.filterStocks(mkt);
        mktstocks.forEach(s => {
            var code = s[0].substring(2);
            var date = s[1];
            var sname = emjyBack.stockAnchor(code);
            if (s[8] === undefined) {
                console.log(s);
                return;
            }
            stkTable.addRow(date, code, sname, s[2], s[3], s[4], s[5], s[6], s[7], s[8].toFixed(2));
            erate += s[8];
        });
        console.log(erate.toFixed(4) + '%');
        console.log(mktstocks);
    }

    prepareKlines(code, sdate, kltype) {
        if (this.klchecked[code] === undefined || sdate < this.klchecked[code]) {
            this.klchecked[code] = sdate;
            emjyBack.prepareKlines(code, sdate, kltype, false);
        }
    }

    retro(stkTable, mkt) {
        var mktstocks = this.filterStocks(mkt);
        emjyBack.retroAccount.deals = [];
        for (var i = 0; i < mktstocks.length; ++i) {
            var code = mktstocks[i][0].substring(2);
            var str = emjyBack.strategyManager.create({"key":strategyOptions[this.key].strategy,"enabled":true, 'kltype':'101'});
            if (!emjyBack.klines[code]) {
                var kltype = str.data.kltype;
                this.prepareKlines(code, mktstocks[i][1], kltype);
                continue;
            }
            str.data.zt0date = mktstocks[i][1];
            var strgrp = {
                "grptype":"GroupStandard",
                "strategies":{"0":str.data},
                "transfers":{"0":{"transfer":"-1"}},
                "amount":10000};
            emjyBack.retroEngine.retroStrategySingleKlt(code, strgrp, mktstocks[i][1]);
        }
        emjyBack.statsReport.showDeals(stkTable, emjyBack.retroAccount.deals, true);
    }
}

class StkDataPanelPage extends RadioAnchorPage {
    constructor() {
        super('数据分析');
        this.dataProcesors = {};
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initView();
        }
    }

    initView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
        var topControl = document.createElement('div');
        topControl.style.display = 'flex';
        this.topPanel.appendChild(topControl);

        this.stkKeySelector = document.createElement('select');
        for (var k in strategyOptions) {
            this.stkKeySelector.options.add(new Option(strategyOptions[k].name, strategyOptions[k].val));
        }
        this.stkKeySelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.stkKeySelector);

        this.mktSelector = document.createElement('select');
        for (var k in mktOptions) {
            this.mktSelector.options.add(new Option(mktOptions[k].name, mktOptions[k].val));
        }
        this.mktSelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.mktSelector);

        this.sortSelector = document.createElement('select');
        for (var k in sortOptions) {
            this.sortSelector.options.add(new Option(sortOptions[k].name, sortOptions[k].val));
        }
        this.sortSelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.sortSelector);

        var btnDoRetro = document.createElement('button');
        btnDoRetro.textContent = '模拟交易';
        btnDoRetro.onclick = e => {
            this.doRetroStrategy();
        }
        topControl.appendChild(btnDoRetro);

        this.contentPanel = document.createElement('div');
        this.container.appendChild(this.contentPanel);

        this.viewTable = new SortableTable();
        this.contentPanel.appendChild(this.viewTable.container);
        this.onStkKeySelected();
    }

    onStkKeySelected() {
        var skey = this.stkKeySelector.value;
        if (!this.dataProcesors[skey]) {
            this.dataProcesors[skey] = new StockData(skey);
            this.dataProcesors[skey].fetchOriginStockData(() => {
                this.showOriginStocks();
            });
        } else {
            this.showOriginStocks();
        }
    }

    showOriginStocks() {
        var skey = this.stkKeySelector.value;
        if (this.dataProcesors[skey]) {
            this.dataProcesors[skey].showStocks(this.viewTable, this.mktSelector.value, this.sortSelector.value);
        }
    }

    doRetroStrategy() {
        if (!emjyBack.retroEngine || !emjyBack.retroAccount) {
            emjyBack.setupRetroAccount();
        }
        var skey = this.stkKeySelector.value;
        if (this.dataProcesors[skey]) {
            this.dataProcesors[skey].retro(this.viewTable, this.mktSelector.value);
        }
    }
}
