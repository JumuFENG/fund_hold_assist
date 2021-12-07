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
        var tmpBtn = document.createElement('button');
        tmpBtn.textContent = 'Test';
        tmpBtn.onclick = e => {
            this.tmpEvents();
        }
        this.container.appendChild(tmpBtn);
        if (emjyManager.zt1stocks && emjyManager.zt1stocks.length > 0) {
            this.showSelectedTable();
        }
    }

    show() {
        super.show();
        if (!this.selectedTable.table) {
            this.showSelectedTable();
        }
    }

    tmpEvents() {
        var today = utils.getTodayDate('-');
        for (var i = 0; i < emjyManager.zt1stocks.length; i++) {
            var stkzt = emjyManager.zt1stocks[i];
            if (stkzt.ztdate != today) {
                continue;
            }
            if (stkzt.vscale == 4) {
                var ownAccount = emjyManager.stockAccountFrom(stkzt.code);
                var account = ownAccount == 'normal' ? 'normal' : 'credit';
                var strgrp = {
                    grptype: "GroupStandard",
                    transfers: {"0":{transfer: "2"}, "1":{transfer: "2"}, "2":{transfer: "1"}, "3":{transfer: "1"}},
                    strategies: {
                        "0": {key:"StrategyBuy", enabled:true, account},
                        "1": {key:"StrategyBuyMAD", enabled:false, account, kltype:"60"},
                        "2": {key:"StrategySellMAD", enabled:false, kltype:"60"},
                        "3": {key:"StrategySellEL", enabled:false}
                    }
                };
                var amount = 5000;
                strgrp.count0 = utils.calcBuyCount(amount, stkzt.price);
                emjyManager.addWatchingStock(stkzt.code, ownAccount, strgrp);
                console.log('add code', ownAccount, stkzt.code, stkzt.name, strgrp);
            }
        }
    }

    showSelectedTable() {
        this.selectedTable.reset();
        this.selectedTable.setClickableHeader('删除', '代码', '名称', '日期', '放量程度', '股价区间', '低点日', '高点日', '删除日');
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
            if (stocki.vscale) {
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
    }
}
