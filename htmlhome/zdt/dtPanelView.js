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
            this.dtMapTable = new SortableTable();
            this.contentPanel.appendChild(document.createTextNode('跌停进度'));
            this.contentPanel.appendChild(this.dtMapTable.container);
            var btnSaveDtMap = document.createElement('button');
            btnSaveDtMap.textContent = '保存';
            btnSaveDtMap.onclick = e => {
                this.saveDtMap();
            }
            this.contentPanel.appendChild(btnSaveDtMap);

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
            premap = {date: '0', map: {}};
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
                if (premap.details[code]) {
                    dtl[code] = premap.details[code];
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
        }

        var addToFail = function(dtmp, dtcodes, ct) {
            if (!dtmp[ct]) {
                dtmp[ct] = {suc: new Set(), fai: dtcodes};
            } else {
                dtcodes.forEach(c => {dtmp[ct].fai.add(c)});
            }
        }
        var premap = premap.map;
        for (var prect in premap) {
            if (premap[prect].suc) {
                var fcodes = new Set();
                premap[prect].suc.forEach(c => {
                    fcodes.add(c);
                });
                addToFail(dtmap.map, fcodes, prect - 1 + 2);
            }
            if (premap[prect].fai) {
                var fcodes = new Set();
                premap[prect].fai.forEach(c => {
                    fcodes.add(c);
                });
                addToFail(dtmap.map, fcodes, prect);
            }
        }
        premap = null;
        this.dtmap = dtmap;
        this.showDtMaps();
    }

    makeFailedSuccess(code, ct) {
        this.dtmap.map[ct].suc.add(code);
        if (this.dtmap.details[code]) {
            this.dtmap.details[code].push({ct, date: this.dtmap.date});
        } else {
            this.dtmap.details[code] = [{ct, date: this.dtmap.date}];
        }

        this.dtmap.map[ct].fai.delete(code);
    }

    removeFailed(code, ct) {
        this.dtmap.map[ct].fai.delete(code);
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
        this.dtmap = dtmap;
    }

    getDtMap() {
        var mapUrl = emjyBack.fha.server + 'stock?act=dtmap';
        utils.get(mapUrl, null, dt => {
            var dtdata = JSON.parse(dt);
            if (dtdata) {
                this.initDt(dtdata);
            }
            var date = '2022-03-07';
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

    createEditAnchors(codes, ect) {
        if (ect == 1) {
            return this.createDeleteBlock();
        }
        var d = document.createElement('div');
        d.style = 'display: contents;';
        var ct = 0;
        codes.forEach(c => {
            var a = emjyBack.stockAnchor(c.substring(2));
            a.code = c;
            a.ect = ect;
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

    createAnchors(codes, sct) {
        var d = document.createElement('div');
        d.sct = sct;
        d.ondragover = e => {
            e.preventDefault();
        }
        d.ondrop = (e) => {
            e.preventDefault();
            var adiv = e.target;
            if (e.target.tagName == 'A') {
                adiv = e.target.parentElement;
            }
            if (adiv.sct == this.dragging.ect) {
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
                this.makeFailedSuccess(this.dragging.code, this.dragging.ect);
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
            var scodes = dtmap.map[ct].suc;
            var fcodes = new Set();
            dtmap.map[ct].fai.forEach(c => {
                fcodes.add(c);
            });
            this.dtMapTable.addRow(ctName, this.createAnchors(scodes, ct), this.createEditAnchors(fcodes, ct));
        }
    }
}