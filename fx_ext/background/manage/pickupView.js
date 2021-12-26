'use strict';

let futuStockUrl = 'https://www.futunn.com/stock/';
let emStockUrl = 'http://quote.eastmoney.com/concept/';
let emStockUrlTail = '.html#fschart-k';
let BkRZRQ = 'BK0596';
let stockPriceRanges = {0:'低位', 1:'高位', 2:'上涨中继', 3:'下跌中继'};
let stockVolScales = {0:'微量', 1:'缩量', 2:'平量', 3:'放量', 4:'天量'};

class PickupPanelPage extends RadioAnchorPage {
    constructor() {
        super('选股入口');
        this.selectedTable = new SortableTable();
        this.container.appendChild(this.selectedTable.container);
        var saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.onclick = e => {
            this.save();
        }
        this.container.appendChild(saveBtn);

        this.dtrngSelector = document.createElement('select');
        var daterange = ['当日', '前日', '所有']
        for (var i = 0; i < daterange.length; ++i) {
            var opt = document.createElement('option');
            opt.value = i;
            opt.textContent = daterange[i];
            this.dtrngSelector.appendChild(opt);
        }
        this.container.appendChild(this.dtrngSelector);

        this.volSelector = document.createElement('select');
        for (var v in stockVolScales) {
            var opt = document.createElement('option');
            opt.value = v;
            opt.textContent = stockVolScales[v];
            this.volSelector.appendChild(opt);
        }
        this.container.appendChild(this.volSelector);

        this.prngSelector = document.createElement('select');
        var opt0 = document.createElement('option');
        opt0.value = -1;
        opt0.textContent = '-';
        this.prngSelector.appendChild(opt0);
        for (var p in stockPriceRanges) {
            var opt = document.createElement('option');
            opt.value = p;
            opt.textContent = stockPriceRanges[p];
            this.prngSelector.appendChild(opt);
        }
        this.container.appendChild(this.prngSelector);

        var filterBtn = document.createElement('button');
        filterBtn.textContent = '筛选';
        filterBtn.onclick = e => {
            this.showFilteredTable();
        }
        this.container.appendChild(filterBtn);

        this.filteredTable = new SortableTable();
        this.container.appendChild(this.filteredTable.container);

        var addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.onclick = e => {
            this.addFilteredToWatching();
        }
        this.container.appendChild(addBtn);

        if (emjyManager.zt1stocks && emjyManager.zt1stocks.length > 0) {
            this.showSelectedTable();
        }

        this.selectedFiltered = new Set();
    }

    show() {
        super.show();
        if (!this.selectedTable.table) {
            this.showSelectedTable();
        }
    }

    addFilteredToWatching() {
        this.selectedFiltered.forEach(code => {
            var ownAccount = emjyManager.stockAccountFrom(code);
            var account = ownAccount == 'normal' ? 'normal' : 'credit';
            var strgrp = {
                grptype: "GroupStandard",
                transfers: {"0":{transfer: "2"}, "1":{transfer: "2"}, "2":{transfer: "-1"}, "3":{transfer: "-1"}},
                strategies: {
                    "0": {key:"StrategyBuy", enabled:true, account},
                    "1": {key:"StrategyBuyMAD", enabled:false, account, kltype:"60"},
                    "2": {key:"StrategySellMAD", enabled:false, kltype:"60"},
                    "3": {key:"StrategySellEL", enabled:false}
                }
            };
            var amount = 5000;
            strgrp.count0 = utils.calcBuyCount(amount, emjyManager.klines[code].getLatestKline('101').c);
            emjyManager.addWatchingStock(code, ownAccount, strgrp);
            console.log('add code', ownAccount, code, strgrp);
        });
    }

    showSelectedTable() {
        if (!emjyManager.zt1stocks || emjyManager.zt1stocks.length == 0) {
            return;
        }

        this.selectedTable.reset();
        this.selectedTable.setClickableHeader('', '代码', '名称', '日期', '放量程度', '股价区间', '低点日', '高点日', '删除日');
        for (var i = 0; i < emjyManager.zt1stocks.length; i++) {
            var stocki = emjyManager.zt1stocks[i];
            var anchor = document.createElement('a');
            anchor.textContent = stocki.name;
            if (stocki.m !== undefined) {
                anchor.href = emStockUrl + (stocki.m == '0' ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            } else {
                anchor.href = emStockUrl + (stocki.code.startsWith('00') ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            }
            anchor.target = '_blank';

            var vol = document.createElement('select');
            for (var v in stockVolScales) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = stockVolScales[v];
                vol.appendChild(opt);
            }
            if (stocki.vscale !== undefined) {
                vol.value = stocki.vscale;
            } else {
                vol.value = 2;
            }
            if (vol.value == 3) {
                vol.style.backgroundColor = 'red';
            } else if (vol.value > 3) {
                vol.style.backgroundColor = 'deeppink';
            } else if (vol.value == 0) {
                vol.style.backgroundColor = 'deepskyblue';
            }
            vol.idx = i;
            vol.onchange = e => {
                emjyManager.setVolScale(e.target.idx, e.target.value);
            }
            var prng = document.createElement('select');
            var opt0 = document.createElement('option');
            opt0.textContent = '--------';
            opt0.disabled = true;
            opt0.selected = true;
            prng.appendChild(opt0);
            for (var p in stockPriceRanges) {
                var opt = document.createElement('option');
                opt.value = p;
                opt.textContent = stockPriceRanges[p];
                prng.appendChild(opt);
            }
            if (stocki.prng) {
                prng.value = stocki.prng;
            }
            if (prng.value == 0) {
                prng.style.backgroundColor = 'red';
            }
            prng.idx = i;
            prng.onchange = e => {
                emjyManager.setPrng(e.target.idx, e.target.value);
                if (e.target.value == 0) {
                    e.target.style.backgroundColor = 'red';
                } else {
                    e.target.style.backgroundColor = '';
                }
            }
            var lowdate = document.createElement('input');
            lowdate.idx = i;
            lowdate.style.maxWidth = 80;
            lowdate.value = stocki.lowdt ? stocki.lowdt : stocki.ztdate;
            lowdate.onchange = e => {
                emjyManager.setLowDate(e.target.idx, e.target.value);
            }
            var highdate = document.createElement('input');
            highdate.idx = i;
            highdate.style.maxWidth = 80;
            highdate.value = stocki.hidate ? stocki.hidate : stocki.ztdate;
            highdate.onchange = e => {
                emjyManager.setHighDate(e.target.idx, e.target.value);
            }
            var deldate = document.createElement('input');
            deldate.idx = i;
            deldate.style.maxWidth = 80;
            deldate.value = stocki.rmvdate ? stocki.rmvdate : stocki.ztdate;
            deldate.onchange = e => {
                emjyManager.setDelDate(e.target.idx, e.target.value);
            }
            this.selectedTable.addRow(
                i,
                stocki.code,
                anchor,
                stocki.ztdate,
                vol,
                prng,
                lowdate,
                highdate,
                deldate
                );
        }
    }

    removeSelected(idx) {
        emjyManager.zt1stocks.splice(idx, 1);
        this.showSelectedTable();
    }

    showFilteredTable() {
        var filteredStocks = [];
        var today = emjyManager.zt1stocks[emjyManager.zt1stocks.length - 1].ztdate;
        if (this.dtrngSelector.value == 1) {
            for (let i = emjyManager.zt1stocks.length - 1; i > 0; i--) {
                if (emjyManager.zt1stocks[i].ztdate != today) {
                    today = emjyManager.zt1stocks[i].ztdate;
                    break;
                }
            }
        }

        for (var i = 0; i < emjyManager.zt1stocks.length; i++) {
            var stkzt = emjyManager.zt1stocks[i];
            if (this.dtrngSelector.value != 2 && stkzt.ztdate != today) {
                continue;
            }

            if (this.volSelector.value != stkzt.vscale) {
                continue;
            }

            if (this.prngSelector.value >= 0 && this.prngSelector.value != stkzt.prng) {
                continue;
            }
            filteredStocks.push(stkzt);
        }

        this.filteredTable.reset();
        this.selectedFiltered.clear();
        this.filteredTable.setClickableHeader('', '代码', '名称', '日期', '放量程度', '股价区间', '两融');
        for (let i = 0; i < filteredStocks.length; i++) {
            const stocki = filteredStocks[i];

            var chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = stocki.code;
            chk.onclick = e => {
                if (e.target.checked) {
                    this.selectedFiltered.add(e.target.value);
                } else {
                    this.selectedFiltered.delete(e.target.value);
                }
            };

            var anchor = document.createElement('a');
            anchor.textContent = stocki.name;
            if (stocki.m !== undefined) {
                anchor.href = emStockUrl + (stocki.m == '0' ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            } else {
                anchor.href = emStockUrl + (stocki.code.startsWith('00') ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            }
            anchor.target = '_blank';

            var vscaleDiv = document.createElement('div');
            vscaleDiv.textContent = stockVolScales[stocki.vscale];
            var prngDiv = document.createElement('div');
            prngDiv.textContent = stockPriceRanges[stocki.prng];
            var rzrq = emjyManager.isRzRq(stocki.code) ? '是' : '否';
            this.filteredTable.addRow(
                chk,
                stocki.code,
                anchor,
                stocki.ztdate,
                vscaleDiv,
                prngDiv,
                rzrq
            );
        }
    }

    save() {
        var zt1stocks = [];
        var ztdels = emjyManager.delstocks;
        for (var i = 0; i < emjyManager.zt1stocks.length; i++) {
            var stocki = emjyManager.zt1stocks[i];
            if (stocki.rmvdate !== undefined && stocki.rmvdate > stocki.ztdate) {
                if (!ztdels.find(s => {s.code == stocki.code && s.ztdate == stocki.ztdate})) {
                    ztdels.push(stocki);
                }
            } else {
                zt1stocks.push(stocki);
            }
        }
        chrome.storage.local.set({'ztstocks': zt1stocks});
        chrome.storage.local.set({'ztdels': ztdels});
        emjyManager.zt1stocks = zt1stocks;
        emjyManager.delstocks = ztdels;
        this.showSelectedTable();
    }
}
