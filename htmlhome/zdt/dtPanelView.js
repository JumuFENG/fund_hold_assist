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

            this.contentPanel.appendChild(this.dtMapTable.container);
            this.dt3Panel = document.createElement('div');
            this.contentPanel.appendChild(this.dt3Panel);
            this.dt3Table = new SortableTable(1, 0, false);
            this.dt3Panel.appendChild(document.createTextNode('跌停三进四买入'));
            this.dt3Panel.appendChild(this.dt3Table.container);

            this.getDtPool();
            this.getDtMap();
            this.getDt3Stocks();
        }
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

    getDtMap() {
        var mapUrl = emjyBack.fha.server + 'stock?act=dtmap';
        utils.get(mapUrl, null, dt => {
            this.dtmap = JSON.parse(dt);
            if (this.dtmap) {
                this.showDtMaps();
            }
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
        });
    }

    getDt3Stocks() {
        var dt3Url = emjyBack.fha.server + 'stock?act=pickup&key=dt3';
        utils.get(dt3Url, null, dt3 => {
            this.dt3stocks = JSON.parse(dt3);
            this.showDt3Table();
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

        var sucdata = {};
        var faidata = {};
        var mxct = 0;
        for (var i = 0; i < dtmap.data.length; ++i) {
            var dmp = dtmap.data[i];
            if (dmp[2] == 1) {
                if (sucdata[dmp[1]] === undefined) {
                    sucdata[dmp[1]] = [];
                }
                sucdata[dmp[1]].push(dmp[0]);
            } else {
                if (faidata[dmp[1]] === undefined) {
                    faidata[dmp[1]] = [];
                }
                faidata[dmp[1]].push(dmp[0]);
            }
            if (dmp[1] - mxct > 0) {
                mxct = dmp[1];
            }
        }

        for (var i = 1; mxct - i >= 0; ++i) {
            if (sucdata[i] === undefined && faidata[i] === undefined) {
                continue;
            }
            var ctName = getCtName(i);
            this.dtMapTable.addRow(ctName,
                this.createAnchors(sucdata[i], i, 'suc'),
                i == 1 ? this.createDeleteBlock() : this.createAnchors(faidata[i], i, 'fai')
            );
        }
    }

    showDt3Table() {
        if (!this.dt3stocks || !this.dt3Table) {
            return;
        }

        this.dt3Table.reset();
        this.dt3Table.setClickableHeader('序号', '日期', '名称(代码)', '建仓日期', '实盘', '买卖记录');
        for (var i = 0; i < this.dt3stocks.length; ++i) {
            var dt3i = this.dt3stocks[i];
            var anchor = emjyBack.stockAnchor(dt3i[0].substring(2));
            var traderecs = JSON.parse(dt3i[2]);
            this.dt3Table.addRow(i, dt3i[1], anchor, traderecs && traderecs.length > 0 ? traderecs[0].date : '', dt3i[3]?'是':'否', dt3i[2]);
        }
    }
}
