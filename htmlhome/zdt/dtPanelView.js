'use strict';

class DtPanelPage extends RadioAnchorPage {
    constructor() {
        super('跌停统计');
        this.MaxStocksPerRow = 7;
    }

    show() {
        super.show();
        this.container.style.display = 'flex';
        if (this.dtTable === undefined) {
            this.container.style = 'display: flex; flex-direction: row; height: 100%;';

            this.leftPanel = document.createElement('div');
            this.leftPanel.style.width = '25%';
            this.container.appendChild(this.leftPanel);
            this.dtTable = new SortableTable();
            this.leftPanel.appendChild(document.createTextNode('今日跌停'));
            this.leftPanel.appendChild(this.dtTable.container);

            this.contentPanel = document.createElement('div');
            this.contentPanel.style.maxWidth = '75%';
            this.container.appendChild(this.contentPanel);
            this.dtMapTable = new SortableTable(1, 0, false);
            this.contentPanel.appendChild(document.createTextNode('跌停进度'));
            var btnDtMerge = document.createElement('button');
            btnDtMerge.textContent = '合并进度';
            btnDtMerge.onclick = () => {
                this.mergePredtmap();
                this.showDtMaps();
            }
            this.contentPanel.appendChild(btnDtMerge);
            this.contentPanel.appendChild(this.dtMapTable.container);
            var btnSaveDtMap = document.createElement('button');
            btnSaveDtMap.textContent = '保存';
            btnSaveDtMap.onclick = () => {
                this.saveDtMap();
            }
            this.contentPanel.appendChild(btnSaveDtMap);
            this.predtMapPanel = document.createElement('div');
            this.contentPanel.appendChild(this.predtMapPanel);
            this.predtMapTable = new SortableTable(false);
            this.predtMapPanel.appendChild(document.createTextNode('待定'));
            this.predtMapPanel.appendChild(this.predtMapTable.container);
            this.getDtMap();
        }
    }

    mergeDt(dtdata) {
        var premap = null;
        if (this.dtmap) {
            if (this.dtmap.date == dtdata.date) {
                console.log('dtmap already exists!');
                this.showDtMaps();
                return;
            }
            if (this.dtmap.date < dtdata.date) {
                premap = this.dtmap;
            }
        }
        if (!premap) {
            premap = {date: '0', map: {}, details: {}};
        }

        var getExistingCt = function(mp, code) {
            for (const ct in mp) {
                if (Object.hasOwnProperty.call(mp, ct)) {
                    if (mp[ct].suc && mp[ct].suc.has(code)) {
                        return ct;
                    } else if (mp[ct].fai && mp[ct].fai.has(code)) {
                        return ct - 1;
                    }
                }
            }
            return 0;
        }

        var dtmap = {date: dtdata.date, map: {}, details: {}}
        var mp = dtmap.map;
        var dtl = dtmap.details;
        if (premap && premap.details) {
            for (var k in premap.details) {
                dtl[k] = premap.details[k];
            }
        }
        for (var i = 0; i < dtdata.pool.length; ++i) {
            var code = dtdata.pool[i][0];
            var dtct = dtdata.pool[i][1];
            var exct = getExistingCt(premap.map, code);
            if (exct > 0) {
                var ndtct = -(-exct - 1);
                if (!mp[ndtct]) {
                    mp[ndtct] = {suc: new Set(), fai: new Set()};
                }
                mp[ndtct].suc.add(code);
                if (premap.map[ndtct] && premap.map[ndtct].fai && premap.map[ndtct].fai.has(code)) {
                    premap.map[ndtct].fai.delete(code);
                } else if (premap.map[exct] && premap.map[exct].suc && premap.map[exct].suc.has(code)) {
                    premap.map[exct].suc.delete(code);
                }
                if (dtl[code]) {
                    dtl[code].push({ct: ndtct, date: dtdata.date});
                } else {
                    dtl[code] = [{ct: ndtct, date: dtdata.date}];
                }
            } else {
                if (!mp[dtct]) {
                    mp[dtct] = {suc: new Set(), fai: new Set()};
                    mp[dtct].suc.add(code);
                } else {
                    mp[dtct].suc.add(code);
                }
                dtl[code] = [{ct: 1, date: dtdata.date}];
            }
            this.getDtStockKlines(code, dtmap.date);
        }

        this.premap = premap;
        this.dtmap = dtmap;
        this.mergePredtmap();
        this.showDtMaps();
    }

    mergePredtmap() {
        if (!this.premap) {
            return;
        }
        var premap = this.premap.map;
        for (var prect in premap) {
            if (premap[prect].suc) {
                var fcodes = this.calcPredtSuc(premap[prect].suc, prect - 1 + 2);
                fcodes.forEach(c => {
                    premap[prect].suc.delete(c);
                });
                if (premap[prect].suc.size == 0) {
                    delete(premap[prect].suc);
                }
            }
            if (premap[prect].fai) {
                var fcodes = this.calcPredtSuc(premap[prect].fai, prect);
                fcodes.forEach(c => {
                    premap[prect].fai.delete(c);
                });
                if (premap[prect].fai.size == 0) {
                    delete(premap[prect].fai);
                }
            }
            if (!premap[prect].suc && !premap[prect].fai) {
                delete(premap[prect]);
            }
        }
        if (Object.keys(this.premap.map).length == 0) {
            this.premap = null;
        }
    }

    calcPredtSuc(sfset, nct) {
        var addToFail = function(dtmp, code, ct) {
            if (!dtmp[ct]) {
                dtmp[ct] = {suc: new Set(), fai: new Set()};
            }
            dtmp[ct].fai.add(code);
        }
        var addToSuc = function(dtmp, code, ct) {
            if (!dtmp[ct]) {
                dtmp[ct] = {suc: new Set(), fai: new Set()};
            }
            dtmp[ct].suc.add(code);
        }
        var klOfDate = function(klines, date) {
            for (var i = klines.length - 1; i >= 0; i--) {
                if (klines[i].time == date) {
                    return klines[i];
                }
            }
        }
        var waitDays = function(klines, sdate, edate) {
            var eidx = klines.findIndex(kl => kl.time == edate);
            var sidx = klines.findIndex(kl => kl.time == sdate);
            return eidx - sidx;
        }
        var fcodes = [];
        var dtmap = this.dtmap;
        var premap = this.premap;
        sfset.forEach(c => {
            if (!emjyBack.klines[c] || !emjyBack.klines[c].klines) {
                this.getDtStockKlines(c, premap.date);
                return;
            }
            var klines = emjyBack.klines[c].getKline('101');
            var kl = klOfDate(klines, dtmap.date);
            if (!kl) {
                if (klines[klines.length - 1].time < dtmap.date) {
                    this.getDtStockKlines(c, dtmap.date);
                }
                return;
            }
            var predate = premap.date;
            if (premap.details && premap.details[c] && premap.details[c].length > 0) {
                predate = premap.details[c][premap.details[c].length - 1].date;
            }
            var prekl = klOfDate(klines, predate);
            var dtl = dtmap.details;
            if (prekl.c * 0.9 - kl.l >= 0) {
                addToSuc(dtmap.map, c, nct);
                if (dtl[c]) {
                    dtl[c].push({ct:  nct, date:this.dtmap.date});
                } else {
                    dtl[c] = [{ct:  nct, date:this.dtmap.date}];
                }
            } else {
                if (premap.details && premap.details[c] && premap.details[c].length > 0) {
                    if (kl.c - prekl.c * 1.08 > 0 || waitDays(klines, predate, dtmap.date) > 3) {
                        console.log(c, 'remove from dtmap');
                        this.removeFailed(c, nct);
                        fcodes.push(c);
                        return;
                    }
                }
                addToFail(dtmap.map, c, nct);
            }
            fcodes.push(c);
        });
        return fcodes;
    }

    manualMergePremap(code, prect, presuc, ct, suc) {
        if (suc == 'suc') {
            this.dtmap.map[ct].suc.add(code);
            if (this.dtmap.details[code]) {
                this.dtmap.details[code].push({ct, date: this.dtmap.date});
            } else {
                this.dtmap.details[code] = [{ct, date: this.dtmap.date}];
            }
        } else {
            this.dtmap.map[ct].fai.add(code);
        }

        if (presuc == 'suc') {
            this.premap.map[prect].suc.delete(code);
            if (this.premap.map[prect].suc.size == 0) {
                delete(this.premap.map[prect].suc);
            }
        } else {
            this.premap.map[prect].fai.delete(code);
            if (this.premap.map[prect].fai.size == 0) {
                delete(this.premap.map[prect].fai);
            }
        }
        if (this.premap.map[prect].suc === undefined && this.premap.map[prect].fai === undefined) {
            delete(this.premap[prect]);
        }
    }

    removeFailed(code, ct) {
        if (this.dtmap.map[ct]) {
            this.dtmap.map[ct].fai.delete(code);
        }
        if (this.dtmap.details[code]) {
            delete(this.dtmap.details[code]);
        }
    }

    initDt(dtdata) {
        var dtmap = {date: dtdata.date, map: {}}
        var mp = JSON.parse(dtdata.map);
        for (var ct in mp) {
            var mct = {suc: new Set(), fai: new Set()};
            for (var key in mp[ct]) {
                mct[key] = new Set(mp[ct][key]);
            }
            if (Object.keys(mct).length > 0) {
                dtmap.map[ct] = mct;
            }
        }
        if (dtdata.details) {
            dtmap.details = JSON.parse(dtdata.details);
        } else {
            dtmap.details = {};
        }
        for (var c in dtmap.details) {
            this.getDtStockKlines(c, dtmap.date);
        }
        this.dtmap = dtmap;
    }

    getDtMap() {
        var mapUrl = emjyBack.fha.server + 'stock?act=dtmap';
        if (this.startdate) {
            mapUrl += '&date=' + this.startdate;
        }
        utils.get(mapUrl, null, dt => {
            var dtdata = JSON.parse(dt);
            if (dtdata) {
                this.initDt(dtdata);
            }
            var date = undefined;
            if (this.dtmap) {
                date = this.dtmap.date;
                var dtdate = new Date(date);
                dtdate.setDate(dtdate.getDate() + 1);
                date = utils.dateToString(dtdate, '-');
            }
            this.getDtPool(date);
        });
    }

    saveDtMap() {
        if (!this.dtmap) {
            return;
        }

        var dtmap = this.dtmap;
        var date = dtmap.date;
        var mapUrl = emjyBack.fha.server + 'stock';
        var fd = new FormData();
        fd.append('act', 'dtmap');
        fd.append('date', date);
        var fmp = {};
        for (var ct in dtmap.map) {
            var suc = null;
            if (dtmap.map[ct].suc.size > 0) {
                suc = Array.from(dtmap.map[ct].suc);
            }
            var fai = null;
            if (dtmap.map[ct].fai.size > 0) {
                fai = Array.from(dtmap.map[ct].fai);
            }
            if (suc && fai) {
                fmp[ct] = {suc, fai};
            } else if (suc) {
                fmp[ct] = {suc};
            } else if (fai) {
                fmp[ct] = {fai};
            }
        }
        fd.append('map', JSON.stringify(fmp));
        fd.append('details', JSON.stringify(this.dtmap.details));
        utils.post(mapUrl, fd, null, dt => {
            console.log('save dt map', dt);
        });
    }

    getDtPool(date) {
        var dtUrl = emjyBack.fha.server + 'api/stockdthist?';
        if (date !== undefined) {
            dtUrl += 'date=' + date;
        }
        utils.get(dtUrl, null, dt => {
            this.dtdata = JSON.parse(dt);
            this.showDtTable();
            this.mergeDt(this.dtdata);
        });
    }

    getDtStockKlines(code, date) {
        emjyBack.loadKlines(code, () => {
            if (!emjyBack.klines[code] || !emjyBack.klines[code].klines|| !emjyBack.klines[code].klines['101'] || emjyBack.klines[code].klines['101'].length == 0) {
                emjyBack.fetchStockKline(code);
            } else {
                var klines = emjyBack.klines[code].klines['101'];
                if (klines[klines.length - 1].time < date) {
                    emjyBack.fetchStockKline(code, '101', klines[klines.length - 1].time);
                }
            }
        });
    }

    showDtTable() {
        if (!this.dtdata || !this.dtTable) {
            return;
        }

        this.dtTable.reset();
        this.dtTable.setClickableHeader('序号', '日期', '名称(代码)', '连板数', '板块');
        var date = this.dtdata.date;
        for (var i = 0; i < this.dtdata.pool.length; i++) {
            var stocki = this.dtdata.pool[i];
            var anchor = emjyBack.stockAnchor(stocki[0].substring(2));
            this.dtTable.addRow(
                i + 1,
                date,
                anchor,
                stocki[1],
                stocki[2]
            );
        }
    }

    createDeleteBlock() {
        var d = document.createElement('div');
        d.style = 'color: red;text-align: center;';
        d.appendChild(document.createTextNode('xx 拖拽到该区域以移除 xx'));
        d.ondragover = e => {
            e.preventDefault();
        }
        d.ondrop = (e) => {
            e.preventDefault();
            var adiv = e.target;
            if (e.target.tagName == 'A') {
                adiv = e.target.parentElement;
            }
            if (this.dragging && this.dragging.ect !== undefined) {
                this.dragging.parentElement.removeChild(this.dragging);
                this.removeFailed(this.dragging.code, this.dragging.ect);
            }
        }
        return d;
    }

    createEditAnchors(codes, ect, sucfai) {
        if (codes === undefined) {
            codes = new Set();
        }
        var d = document.createElement('div');
        d.style = 'display: contents;';
        var ct = 0;
        codes.forEach(c => {
            var a = emjyBack.stockAnchor(c.substring(2));
            a.code = c;
            a.ect = ect;
            a.sucfail = sucfai;
            a.ondragstart = e => {
                this.dragging = e.target;
            }
            a.ondragend = e => {
                this.dragging = null;
            }
            d.appendChild(a);
            ct++;
            if (ct == this.MaxStocksPerRow) {
                d.appendChild(document.createElement('br'));
                ct = 0;
            }
        });
        return d;
    }

    createAnchors(codes, sct, sucfai) {
        if (codes === undefined) {
            codes = new Set();
        }
        var d = document.createElement('div');
        d.sct = sct;
        d.sucfail = sucfai;
        d.ondragover = e => {
            e.preventDefault();
        }
        d.ondrop = (e) => {
            e.preventDefault();
            var adiv = e.target;
            if (e.target.tagName == 'A') {
                adiv = e.target.parentElement;
            }
            if (adiv.sct >= this.dragging.ect) {
                this.dragging.parentElement.removeChild(this.dragging);
                adiv.appendChild(this.dragging);
                for (var i = 0; ; i++) {
                    var nextId = i * this.MaxStocksPerRow + i + this.MaxStocksPerRow;
                    if (nextId < adiv.childNodes.length) {
                        if (adiv.childNodes[nextId].tagName != 'BR') {
                            adiv.insertBefore(document.createElement('br'), adiv.childNodes[nextId]);
                        }
                    } else {
                        break;
                    }
                }
                if (adiv.style.height != '') {
                    adiv.style.height = '';
                }
                this.manualMergePremap(this.dragging.code, this.dragging.ect, this.dragging.sucfail, adiv.sct, adiv.sucfail);
            }
        }
        var ct = 0;
        codes.forEach(c => {
            d.appendChild(emjyBack.stockAnchor(c.substring(2)));
            ct ++;
            if (ct == this.MaxStocksPerRow) {
                d.appendChild(document.createElement('br'));
                ct = 0;
            }
        });
        if (codes.size == 0) {
            d.style.height = '22px';
        }
        return d;
    }

    showDtMaps() {
        if (!this.dtmap || !this.dtMapTable) {
            return;
        }

        var dtmap = this.dtmap;
        this.dtMapTable.reset();
        this.dtMapTable.setClickableHeader(dtmap.date, '成', '败');
        var getCtName = function(t) {
            if (t - 1 == 0) {
                return '首板';
            }
            var nums = ['0', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
            var n1 = t - 1 < nums.length ? nums[t - 1] : t - 1;
            var n2 = t < nums.length ? nums[t] : t;
            return n1 + '进' + n2;
        }

        for (var ct in dtmap.map) {
            var ctName = getCtName(ct);
            this.dtMapTable.addRow(ctName,
                this.createAnchors(dtmap.map[ct].suc, ct, 'suc'),
                ct == 1 ? this.createDeleteBlock() : this.createAnchors(dtmap.map[ct].fai, ct, 'fai')
            );
        }

        this.predtMapTable.reset();
        if (this.premap && this.premap.map) {
            this.predtMapPanel.style.display = 'block';
            this.predtMapTable.setClickableHeader(this.premap.date, '成', '败');
            for (var ct in this.premap.map) {
                var ctName = getCtName(ct);
                this.predtMapTable.addRow(ctName,
                    this.createEditAnchors(this.premap.map[ct].suc, ct, 'suc'),
                    this.createEditAnchors(this.premap.map[ct].fai, ct, 'fai')
                );
            }
        } else {
            this.predtMapPanel.style.display = 'none';
        }
    }
}