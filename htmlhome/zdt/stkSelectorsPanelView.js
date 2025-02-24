'use strict';

class StkSelector {
    constructor() {
        this.name = '';
        this.key = '';
        this.toolbar = null;
        this.stkTable = null;
        this.chkbxSelectAll = document.createElement('input');
        this.chkbxSelectAll.type = 'checkbox';
        this.chkbxSelectAll.onchange = e => {
            this.selectAllStocks(e.target.checked);
        }
    }

    selectAllStocks(select) {
        if (!this.stkTable) {
            return;
        }

        var chkbx = this.stkTable.container.querySelectorAll('input[type="checkbox"]');
        for (const chk of chkbx) {
            if (chk.checked != select) {
                chk.click();
            }
        }
    }

    createSelCheckbox(code) {
        var sel = document.createElement('input');
        sel.type = 'checkbox';
        sel.code = code;
        sel.onchange = e => {
            if (e.target.checked) {
                if (!this.filteredStks) {
                    this.filteredStks = new Set();
                }
                this.filteredStks.add(e.target.code);
            } else {
                if (this.filteredStks) {
                    this.filteredStks.delete(e.target.code);
                }
            }
        }
        return sel;
    }

    getSelectorData() {}

    doShowSelected() {}

    showSelected(table) {
        if (table) {
            this.stkTable = table;
        }
        if (this.stkTable) {
            this.stkTable.reset();
            if (this.chkbxSelectAll) {
                this.chkbxSelectAll.checked = false;
            }
        }
        if (this.toolbar) {
            utils.removeAllChild(this.toolbar);
        }

        if (!this.selStocks) {
            this.getSelectorData();
            return;
        }

        if (this.filteredStks) {
            this.filteredStks.clear();
        }
        this.showToolbar();
        if (this.stkTable) {
            this.doShowSelected();
        }
    }

    createCandidateToolbar() {
        if (!this.selStocks || !this.toolbar) {
            return;
        }

        var btnCandidate = document.createElement('button');
        btnCandidate.textContent = '设置预选';
        btnCandidate.onclick = e => {
            if (this.filteredStks.length <= 0) {
                return;
            }
            var url = emjyBack.fha.server + 'stock';
            var fd = this.candidatesForm();
            utils.post(url, fd, null, c => {
                if (c != 'OK') {
                    console.error('set candidates error!');
                } else {
                    console.log('set candidates success!');
                }
            });
        }
        this.toolbar.appendChild(btnCandidate);
    }

    candidatesAction() {
        return ''
    }

    candidatesForm() {
        var fd = new FormData();
        var codes = [];
        var stocks = this.selStocks.pool ? this.selStocks.pool : this.selStocks;
        for (const c of this.filteredStks) {
            for (var i = 0; i < stocks.length; i ++) {
                if (stocks[i][0].endsWith(c)) {
                    codes.push(stocks[i][0]);
                    break;
                }
            }
        }

        fd.append('act', this.candidatesAction());
        fd.append('date', this.ztdate);
        fd.append('stocks', Array.from(codes).join(','));
        return fd;
    }

    showToolbar() {}

    makeStrategyGrp(code, strategies, transfers, amount, gmeta=null) {
        var strgrp = {"grptype":"GroupStandard", strategies, transfers, amount};
        if (emjyBack.klines[code]) {
            var kl = emjyBack.klines[code].getLatestKline('101');
            if (kl) {
                strgrp['count0'] = Math.ceil(100/kl.c) * 100;
            }
        }
        if (gmeta) {
            strgrp['gmeta'] = gmeta;
        }
        return strgrp;
    }

    createStrategyFor(code) {}

    filteredStrategies() {
        if (!this.filteredStks) {
            return {}
        }

        var candidatesObj = {}
        this.filteredStks.forEach(c => {
            candidatesObj[c] = this.createStrategyFor(c);
        });
        return candidatesObj;
    }

    saveName() {
        return this.name;
    }
}

class Zt1Selector extends StkSelector {
    constructor() {
        super();
        this.key = 'zt1';
        this.name = '今日首板';
    }

    getSelectorData() {
        var ztUrl = emjyBack.fha.server + 'stock?act=pickup&key=zt1';
        utils.get(ztUrl, null, zt => {
            this.selStocks = JSON.parse(zt);
            this.ztdate = this.selStocks.date;
            this.selStocks.pool.sort((x, y) => {
                return x[0].substring(2) < y[0].substring(2);
            });
            this.showSelected();
        });
    }

    showToolbar() {
        this.createCandidateToolbar();
        if (!this.selStocks || !this.toolbar) {
            return;
        }

        var btnCandidate = document.createElement('button');
        btnCandidate.textContent = '添加烂板';
        btnCandidate.onclick = e => {
            if (this.filteredStks.length <= 0) {
                return;
            }
            var url = emjyBack.fha.server + 'stock';
            var fd = this.candidatesForm();
            fd.set('act', 'add_zt1wb');
            utils.post(url, fd, null, c => {
                if (c != 'OK') {
                    console.error('add zt1wb error!');
                } else {
                    console.log('add zt1wb success!');
                }
            });
        }
        this.toolbar.appendChild(btnCandidate);
    }

    candidatesAction() {
        return 'select_zt1j2';
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称', '代码', '板块', '涨停概念', this.chkbxSelectAll);
        var date = this.selStocks.date;
        this.ztdate = date;
        var n = 1;
        for (const stocki of this.selStocks.pool) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            var cpts = document.createElement('div');
            cpts.innerHTML = stocki[2].split('+').join('<br/>');
            table.addRow(
                n++,
                date,
                anchor,
                code,
                stocki[1],
                cpts,
                sel
            );
        }
    }
}

class ZtLeadSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'zt_lead';
        this.name = '今日龙头';
        this.ztdate = '';
    }

    getSelectorData() {
        var ldUrl = emjyBack.fha.server + 'stock?act=pickup&key=zt_lead&date=' + this.ztdate;
        utils.get(ldUrl, null, zt => {
            this.selStocks = JSON.parse(zt);
            this.showSelected();
        });
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', '首日连板数', '龙头天数', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            anchor.textContent = anchor.textContent + '(' + code + ')'
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                this.ztdate,
                anchor,
                stocki[1],
                stocki[2],
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuy","enabled":true}).data;
        var strategies = {"0":strategy}
        strategies['1'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
        strategies['2'] = {"key":"StrategySellBE","enabled":false,"selltype":"single"};
        var transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};

        return this.makeStrategyGrp(code, strategies, transfers, 10000);
    }
}


class ZtPredictLeadSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'zt_predict';
        this.name = '潜龙打板';
        this.ztdate = '';
        this.cptKey = null;
    }

    getSelectorData() {
        var zpUrl = emjyBack.fha.server + 'stock?act=pickup&key=zt_predict';
        if (this.ztdate) {
            zpUrl += '&date=' + this.ztdate;
        }
        utils.get(zpUrl, null, zp => {
            this.selStocks = JSON.parse(zp);
            this.selStocks.sort((x,y) => {
                if (x[3] == y[3]) {
                    return x[2] > y[2];
                }
                return x[3] < y[3];
            });
            this.showSelected();
        });
    }

    saveName() {
        if (this.cptSelector && this.cptSelector.selectedIndex !== -1) {
            if (this.cptSelector.value == 'dayzt') {
                return '涨停';
            }
            if (this.cptSelector.value == 'notzt') {
                return '涨停断板';
            }
            if (this.cptSelector.value == '') {
                return this.name;
            }
            return this.cptSelector.value;
        }
        if (this.bkSelector && this.bkSelector.selectedIndex !== -1) {
            return this.bkSelector.value;
        }
        return this.name;
    }

    showToolbar() {
        if (!this.selStocks || !this.toolbar) {
            return;
        }
        this.cptKey = null;

        var cptCnts = {};
        for (const stocki of this.selStocks) {
            var cpt = stocki[7].split('+');
            for (const c of cpt) {
                if (!cptCnts[c]) {
                    cptCnts[c] = 1;
                } else {
                    cptCnts[c] += 1;
                }
            }
        }
        var cpts = Object.keys(cptCnts);
        cpts = cpts.filter(c => cptCnts[c] > 3);
        cpts.sort((c1, c2) => cptCnts[c1] < cptCnts[c2]);
        this.cptSelector = document.createElement('select');
        this.cptSelector.options.add(new Option('全部' + this.selStocks.length, ''));
        this.cptSelector.options.add(new Option('今日涨停', 'dayzt'));
        this.cptSelector.options.add(new Option('断板', 'notzt'));
        for (const cpt of cpts) {
            this.cptSelector.options.add(new Option(cpt+cptCnts[cpt], cpt));
        }
        this.cptSelector.onchange = e => {
            if (this.filteredStks) {
                this.filteredStks.clear();
            }
            if (this.stkTable) {
                this.stkTable.reset();
                if (this.chkbxSelectAll) {
                    this.chkbxSelectAll.checked = false;
                }
            }
            if (this.bkSelector) {
                if (this.cptSelector.selectedIndex > 2) {
                    this.bkSelector.selectedIndex = -1;
                }
            }
            this.updateBkSelector();
            this.doShowSelected();
        }
        this.toolbar.appendChild(this.cptSelector);

        let nbkstocks = [];
        for (const stocki of this.selStocks) {
            var code = stocki[0];
            if (!emjyBack.stock_bks || !emjyBack.stock_bks[code]) {
                nbkstocks.push(code);
                continue;
            }
        }
        if (nbkstocks.length > 0) {
            emjyBack.fetchStockBks(nbkstocks);
            return;
        }
        this.updateBkSelector();
    }

    updateBkSelector() {
        let bks = [];
        if (!this.stockbks) {
            this.stockbks = {};
        }
        for (const stocki of this.selStocks) {
            var code = stocki[0];
            if (!emjyBack.stock_bks || !emjyBack.stock_bks[code]) {
                return;
            }
            emjyBack.stock_bks[code].forEach(bk=>{
                if (!this.stockbks[code]) {
                    this.stockbks[code] = [];
                }
                if (!this.stockbks[code].includes(bk[1])) {
                    this.stockbks[code].push(bk[1]);
                }
                if (!bks.includes(bk[1])) {
                    bks.push(bk[1]);
                }
            });
        }
        let bkcnt = {};
        for (const bk of bks) {
            for (const stocki of this.selStocks) {
                if (this.cptSelector.selectedIndex <= 2) {
                    if (stocki[1] != this.ztdate && this.cptSelector.value == 'dayzt') {
                        continue;
                    }
                    if (stocki[1] == this.ztdate && this.cptSelector.value == 'notzt') {
                        continue;
                    }
                }
                if (this.stockbks[stocki[0]] && this.stockbks[stocki[0]].includes(bk)) {
                    if (!bkcnt[bk]) {
                        bkcnt[bk] = 1;
                    } else {
                        bkcnt[bk] += 1;
                    }
                }
            }
        }
        bks = bks.filter(bk => bkcnt[bk] > 3);
        bks.sort((c1, c2) => bkcnt[c1] < bkcnt[c2]);
        if (!this.bkSelector) {
            this.bkSelector = document.createElement('select');
            this.toolbar.appendChild(this.bkSelector);
        } else {
            while (this.bkSelector.options.length > 0) {
                this.bkSelector.options.remove(0);
            }
        }
        if (!this.bkSelector.parentElement) {
            this.toolbar.appendChild(this.bkSelector);
        }
        for (const bk of bks) {
            this.bkSelector.options.add(new Option(bk + bkcnt[bk], bk));
        }
        this.bkSelector.selectedIndex = -1;
        this.bkSelector.onchange = e => {
            if (this.filteredStks) {
                this.filteredStks.clear();
            }
            if (this.stkTable) {
                this.stkTable.reset();
                if (this.chkbxSelectAll) {
                    this.chkbxSelectAll.checked = false;
                }
            }
            if (this.cptSelector.selectedIndex > 2) {
                this.cptSelector.selectedIndex = 0;
            }
            this.doShowSelected();
        };
    }

    shouldShow(stock) {
        let cptMatch = true;
        if (this.cptSelector.selectedIndex !== -1) {
            if (this.cptSelector.value == 'dayzt') {
                cptMatch = stock[1] == this.ztdate;
            } else if (this.cptSelector.value == 'notzt') {
                cptMatch = stock[1] != this.ztdate;
            } else if (this.cptSelector.value) {
                cptMatch = stock[7].includes(this.cptSelector.value);
            }
        }
        if (!this.bkSelector) {
            return cptMatch;
        }
        if (this.bkSelector.selectedIndex !== -1) {
            let code = stock[0];
            if (this.stockbks && this.stockbks[code]) {
                return cptMatch && this.stockbks[code].includes(this.bkSelector.value);
            }
        }
        return cptMatch;
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', '天数', '连板数', '10日涨幅', '30日涨幅', '行业板块', '概念', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            if (!this.shouldShow(stocki)) {
                continue;
            }
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            anchor.textContent = anchor.textContent + '(' + code + ')'
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                anchor,
                stocki[2],
                stocki[3],
                stocki[4].toFixed(2),
                stocki[5].toFixed(2),
                stocki[6],
                stocki[7],
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuyZTBoard","enabled":true}).data;
        var strategies = {"0":strategy}
        strategies['1'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
        strategies['2'] = {"key":"StrategySellBE","enabled":false,"selltype":"single"};
        var transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};

        return this.makeStrategyGrp(code, strategies, transfers, 10000);
    }
}

class Zt1d1Selector extends StkSelector {
    constructor() {
        super();
        this.key = 'zt1_1';
        this.name = '首板一字涨停';
        this.ztdate = '';
    }

    getSelectorData() {
        var ztUrl = emjyBack.fha.server + 'stock?act=pickup&key=zt1_1&date=' + this.ztdate;
        utils.get(ztUrl, null, zt => {
            this.selStocks = JSON.parse(zt);
            this.showSelected();
        });
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', '板块', '涨停概念', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                this.ztdate,
                anchor,
                stocki[1],
                stocki[2],
                sel
            );
        }
    }

    createStrategyFor(code) {
        var date = this.ztdate;
        var strategy = emjyBack.strategyManager.create({"key":"StrategyZt1","enabled":false,'kltype':'101',zt0date:date}).data;
        var strategies = {"0":strategy}
        var transfers = {"0":{"transfer":"-1"}};
        return this.makeStrategyGrp(code, strategies, transfers, 10000);
    }
}

class Zt1BrkSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'zt1_brk';
        this.name = '首板涨停突破';
        this.ztdate = '';
    }

    getSelectorData() {
        var ztUrl = emjyBack.fha.server + 'stock?act=pickup&key=zt1_brk&date=' + this.ztdate;
        utils.get(ztUrl, null, zt => {
            this.selStocks = JSON.parse(zt);
            this.selStocks.sort((x, y) => {
                return x[0].substring(2) < y[0].substring(2);
            });
            this.showSelected();
        });
    }

    showToolbar() {
        this.createCandidateToolbar();
    }

    candidatesAction() {
        return 'select_zt1_brk';
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                anchor,
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuyZTBoard","enabled":true}).data;
        var strategies = {"0":strategy}
        strategies['1'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
        strategies['2'] = {"key":"StrategySellBE","enabled":false,"selltype":"single"};
        var transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};

        return this.makeStrategyGrp(code, strategies, transfers, 10000);
    }
}


class TripleBullSelector extends StkSelector {
    constructor() {
        super();
        this.key = '3brk';
        this.name = '三阳开泰';
    }

    getSelectorData() {
        var tbrkUrl = emjyBack.fha.server + 'stock?act=pickup&key=3brk';
        utils.get(tbrkUrl, null, tbrk => {
            this.selStocks = JSON.parse(tbrk);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        });
    }

    showToolbar() {
        this.createCandidateToolbar();
    }

    candidatesAction() {
        return 'unselect_3brk';
    }

    candidatesForm() {
        var fd = new FormData();
        var selcodes = [];
        var stocks = this.selStocks;
        for (const c of this.filteredStks) {
            for (var i = 0; i < stocks.length; i ++) {
                if (stocks[i][0].endsWith(c)) {
                    selcodes.push(stocks[i][0]);
                    break;
                }
            }
        }
        var codes = [];
        for (const stk of this.selStocks) {
            if (!selcodes.includes(stk[0])) {
                codes.push(stk[0])
            }
        }

        fd.append('act', this.candidatesAction());
        fd.append('stocks', Array.from(codes).join(','));
        return fd;
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '1阳日期', '3阳日期', '名称', '代码', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                stocki[2],
                anchor,
                code,
                sel
            );
        }
    }
}


class EndVolumeSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'evol';
        this.name = '收盘竞价爆量';
        this.ztdate = '';
    }

    getSelectorData() {
        var evUrl = emjyBack.fha.server + 'stock?act=pickup&key=evol&date=' + this.ztdate;
        utils.get(evUrl, null, dzt => {
            this.selStocks = JSON.parse(dzt);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        });
    }

    showToolbar() {
        this.createCandidateToolbar();
    }

    candidatesAction() {
        return 'select_evol';
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称', '代码', '成交量', '成交额(万)', '换手率(%)', '竞价量(开)', '竞价量(收)',
            '未匹配量', '竞价占比', '涨停距今(日)', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                anchor,
                code,
                stocki[2],
                stocki[3],
                stocki[4],
                stocki[5],
                stocki[6],
                stocki[7],
                stocki[8],
                stocki[9],
                sel
            );
        }
    }
}


class DztSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'dzt';
        this.name = '昨跌停今涨停';
        this.ztdate = '';
    }

    getSelectorData() {
        var dztUrl = emjyBack.fha.server + 'stock?act=pickup&key=dzt&date=' + this.ztdate;
        utils.get(dztUrl, null, dzt => {
            this.selStocks = JSON.parse(dzt);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        });
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', '昨跌幅', '今涨幅', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[3],
                anchor,
                stocki[2],
                stocki[4],
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuy","enabled":true, 'bway':'lg', 'rate0':0.03, 'rate1':-0.05}).data;
        var strategies = {"0":strategy}
        var transfers = {"0":{"transfer":"-1"}};
        var gmeta = {};
        strategies['1'] = {"key":"StrategySellELS","enabled":false,"cutselltype":"single"};
        transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}};
        gmeta = {"setguard": true, "guardid": "1", "settop": true};

        return this.makeStrategyGrp(code, strategies, transfers, 100000, gmeta);
    }
}

class DtBoardSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'dztbd';
        this.name = '昨跌停打板';
        this.ztdate = '';
    }

    getSelectorData() {
        var dztUrl = emjyBack.fha.server + 'stock?act=pickup&key=dztbd&date=' + this.ztdate;
        utils.get(dztUrl, null, dzt => {
            this.selStocks = JSON.parse(dzt);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        });
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', '昨跌幅', '跌停', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                anchor,
                stocki[2],
                stocki[3],
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuyZTBoard","enabled":true}).data;
        var strategies = {"0":strategy}
        strategies['1'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
        strategies['2'] = {"key":"StrategySellBE","enabled":false,"selltype":"single"};
        var transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};

        return this.makeStrategyGrp(code, strategies, transfers, 100000);
    }
}

class MaConvSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'maconv';
        this.name = 'MA收敛突破';
    }

    getSelectorData() {
        var mcUrl = emjyBack.fha.server + 'stock?act=pickup&key=maconv';
        utils.get(mcUrl, null, mc => {
            this.selStocks = JSON.parse(mc);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        })
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '日期', '名称(代码)', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            anchor.textContent = anchor.textContent + '(' + code + ')'
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                stocki[1],
                anchor,
                sel
            );
        }
    }

    createStrategyFor(code) {
        var strategy = emjyBack.strategyManager.create({"key":"StrategyBuyMA","enabled":false,'kltype':'101'}).data;
        var strategies = {"0": strategy}
        var transfers = {"0":{"transfer":"-1"}};
        strategies['1'] = {"key":"StrategySellMA","enabled":false,"cutselltype":"single"};
        strategies['2'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
        transfers = {"0":{"transfer":"1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};

        return this.makeStrategyGrp(code, strategies, transfers, 10000);
    }
}

class UstSelector extends StkSelector {
    constructor() {
        super();
        this.key = 'ust';
        this.name = '摘星摘帽';
    }

    getSelectorData() {
        var ustUrl = emjyBack.fha.server + 'stock?act=pickup&key=ust';
        utils.get(ustUrl, null, mc => {
            this.selStocks = JSON.parse(mc);
            if (this.selStocks.length > 0) {
                this.showSelected();
            }
        })
    }

    doShowSelected() {
        var table = this.stkTable;
        table.setClickableHeader('序号', '名称(代码)', '申请日期', '摘帽/星日期', '公告', this.chkbxSelectAll);
        var n = 1;
        for (const stocki of this.selStocks) {
            var code = stocki[0].substring(2);
            var anchor = emjyBack.stockAnchor(code);
            var sel = this.createSelCheckbox(code);
            table.addRow(
                n++,
                anchor,
                stocki[2] ? stocki[2] : stocki[1],
                stocki[4] ? stocki[4] : (stocki[3] ? stocki[3] : ''),
                emjyBack.stockNoticeAnchor(code),
                sel
            )
        }
    }
}


class StkSelectorsPanelPage extends RadioAnchorPage {
    constructor() {
        super('选股');
        this.selectors = [
            new Zt1Selector(),
            new ZtLeadSelector(),
            new ZtPredictLeadSelector(),
            new Zt1d1Selector(),
            new Zt1BrkSelector(),
            new TripleBullSelector(),
            new EndVolumeSelector(),
            new DztSelector(),
            new DtBoardSelector(),
            new MaConvSelector(),
            new UstSelector()
        ];
    }

    show() {
        super.show();
        if (this.ztTable === undefined) {
            this.leftPanel = document.createElement('div');
            this.leftPanel.style.width = '65%';
            this.container.appendChild(this.leftPanel);
            this.stksSelector = document.createElement('select');
            var selectorToolbar = document.createElement('div');
            for (const s of this.selectors) {
                this.stksSelector.options.add(new Option(s.name, s.key));
                s.toolbar = selectorToolbar;
            };
            this.stksSelector.onchange = e => {
                if (this.candidatesArea.textContent) {
                    this.candidatesArea.textContent = '';
                }
                var selector = this.selectors[this.stksSelector.selectedIndex];
                if (!this.ztdate && this.selectors[0].ztdate) {
                    this.ztdate = this.selectors[0].ztdate;
                }
                selector.ztdate = this.ztdate
                selector.showSelected(this.ztTable);
            }
            this.ztTable = new SortableTable();
            this.leftPanel.appendChild(this.stksSelector);
            var btnExportStocks = document.createElement('button');
            btnExportStocks.textContent = '导出选中股票';
            btnExportStocks.onclick = e => {
                this.saveSelectedStocks();
            }
            this.leftPanel.appendChild(btnExportStocks);

            this.leftPanel.appendChild(selectorToolbar);
            this.leftPanel.appendChild(this.ztTable.container);

            var btnCreateStrategy = document.createElement('button');
            btnCreateStrategy.textContent = '生成策略';
            btnCreateStrategy.onclick = e => {
                this.setStrategyForSelected();
            }
            this.leftPanel.appendChild(btnCreateStrategy);

            this.candidatesArea = document.createElement('div');
            this.candidatesArea.style.paddingRight = 8;
            this.leftPanel.appendChild(this.candidatesArea);

            this.selectors[0].showSelected(this.ztTable);
        }
    }

    setStrategyForSelected() {
        this.candidatesArea.textContent = '';
        var selector = this.selectors[this.stksSelector.selectedIndex];
        if (!selector.filteredStks) {
            return;
        }

        var candidatesObj = selector.filteredStrategies();
        this.candidatesArea.textContent = JSON.stringify(candidatesObj, null, 1);
    }

    saveSelectedStocks() {
        var selector = this.selectors[this.stksSelector.selectedIndex];
        if (!selector.filteredStks) {
            return;
        }

        var stks = [];
        for (const stksObj of selector.filteredStks) {
            stks.push(stksObj + '\n');
        }
        if (!this.ztdate) {
            this.ztdate = selector.ztdate;
        }
        emjyBack.saveToFile(stks, 'stkexp_' + selector.saveName() + '_' + this.ztdate + '.txt' );
    }
}
