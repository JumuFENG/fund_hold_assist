'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停复盘');
        this.hideZ1 = false;
        this.markets = {'A': '主板', 'K': '双创', 'B': '北交所', 'S': 'ST股'};
    }

    createMktAnchor(v, lbl) {
        var ramkt = document.createElement('input');
        ramkt.type = 'radio';
        ramkt.value = v;
        ramkt.name = 'mktradio';
        ramkt.id = 'mktradio_' + v;
        if (v == 'A') {
            ramkt.checked = true;
        }
        ramkt.onchange = e => {
            if (e.target.checked) {
                this.showZtMapTable();
            }
        };
        var rlbl = document.createElement('label');
        rlbl.textContent = lbl;
        rlbl.setAttribute('for', 'mktradio_' + v);
        this.topPanel.appendChild(ramkt);
        this.topPanel.appendChild(rlbl);
    }

    show() {
        super.show();
        if (this.ztMapTable === undefined) {
            this.topPanel = document.createElement('div');
            this.container.appendChild(this.topPanel);
            for (var k in this.markets) {
                this.createMktAnchor(k, this.markets[k]);
            }

            this.contentPanel = document.createElement('div');
            this.container.appendChild(this.contentPanel);

            this.ztMapTable = new SortableTable(1, 0, false);
            this.contentPanel.appendChild(this.ztMapTable.container);
            this.showZtMapTable();

            var btnLoadMore = document.createElement('button');
            btnLoadMore.textContent = '显示更多';
            btnLoadMore.onclick = e => {
                this.getZTMap(this.container.querySelector('input[name="mktradio"]:checked').value);
            }
            this.contentPanel.appendChild(btnLoadMore);
        }
    }

    checkZtLeads(ztmap) {
        for (let ztm of ztmap) {
            if (ztm.lead.length == 0 && ztm.candidates.length == 0) {
                let d = 1;
                for (let k in ztm) {
                    if (isNaN(parseInt(k))) {
                        continue;
                    }
                    if (k - d > 0) {
                        d = k;
                    }
                }
                if (d - 1 > 0) {
                    if (ztm[d].length == 1) {
                        ztm.lead.push(ztm[d][0]);
                    } else {
                        for (const s of ztm[d]) {
                            ztm.candidates.push(s);
                        }
                    }
                    delete(ztm[d]);
                }
            }
        }
        return ztmap;
    }

    getZTMap(mkt='A') {
        var ztUrl = emjyBack.fha.server + 'stock?act=ztmap&days=30&mkt=' + mkt;
        if (this.ztmap && this.ztmap[mkt]) {
            ztUrl += '&date=' + this.ztmap[mkt][this.ztmap[mkt].length - 1].date;
        }
        utils.get(ztUrl, null, zt => {
            if (!this.ztmap) {
                this.ztmap = {};
            }
            if (!this.ztmap[mkt]) {
                this.ztmap[mkt] = this.checkZtLeads(JSON.parse(zt));
            } else {
                var ztmap = this.checkZtLeads(JSON.parse(zt));
                for(const ztm of ztmap) {
                    if (ztm.date >= this.ztmap[mkt][this.ztmap[mkt].length - 1].date) {
                        continue;
                    }
                    this.ztmap[mkt].push(ztm);
                }
            }
            this.hideZ1 = this.ztmap[mkt].length > 30;
            if (mkt != 'A') {
                this.hideZ1 = false;
            }
            this.showZtMapTable();
        });
    }

    ztAnchor(zm, hideTail=false) {
        var code = zm.code.substring(2);
        var days = zm.days;
        var lbc = zm.lbc;
        var anchor = emjyBack.stockAnchor(code);
        anchor.style.textWrap = 'nowrap';
        var njm = '';
        if (days == lbc) {
            njm = hideTail ? '' : '(' + lbc + '连板)';
        } else {
            njm = '(' + days + '天' + lbc + '板)';
        }
        anchor.textContent = anchor.textContent + njm;
        anchor.title = code;
        anchor.onmouseenter = e => {
            this.setAnchorBkColor(e.target.title, true);
        }
        anchor.onmouseleave = e => {
            this.setAnchorBkColor(e.target.title, false);
        }
        return anchor;
    }

    addZtAnchors(zt, ztm, hideTail=false) {
        ztm.forEach(mi => zt.appendChild(this.ztAnchor(mi, hideTail)));
    }

    setAnchorBkColor(code, show=true) {
        var anchors = this.contentPanel.querySelectorAll('a[title="' + code + '"]');
        for(var ach of anchors) {
            ach.style.backgroundColor = show ? 'lightskyblue' : 'transparent';
        }
    }

    showZtMapTable() {
        var mkt = this.container.querySelector('input[name="mktradio"]:checked').value
        if (!this.ztmap || !this.ztmap[mkt]) {
            this.getZTMap(mkt);
            return;
        }
        if (!this.ztMapTable) {
            return;
        }

        this.ztMapTable.reset();

        if (this.hideZ1) {
            this.ztMapTable.setClickableHeader('日期', '龙头', '高标', '三板', '二板');
        } else {
            this.ztMapTable.setClickableHeader('日期', '龙头', '高标', '三板', '二板', '首板');
        }

        for (const ztmp of this.ztmap[mkt]) {
            var date = ztmp.date;
            var ztlead = '';
            if (ztmp.lead.length == 1) {
                ztlead = document.createElement('div');
                var ld = this.ztAnchor(ztmp.lead[0]);
                ld.style.color = 'red';
                ztlead.appendChild(ld);
            }
            var candidates = '';
            if (ztmp.candidates.length > 0) {
                candidates = document.createElement('div');
                for (const zm of ztmp.candidates) {
                    var cdt = this.ztAnchor(zm);
                    cdt.style.color = 'lightcoral';
                    candidates.appendChild(cdt);
                    candidates.appendChild(document.createElement('br'));
                }
            }
            var highZts = document.createElement('div');
            highZts.style.maxWidth = 130;
            highZts.style.display = 'flex';
            highZts.style.flexWrap = 'wrap';
            var z3 = document.createElement('div');
            z3.style.maxWidth = 130;
            z3.style.display = 'flex';
            z3.style.flexWrap = 'wrap';
            var z2 = document.createElement('div');
            z2.style.maxWidth = this.hideZ1 ? 400 : 320;
            var z1 = document.createElement('div');
            z1.style.maxWidth = 480;
            var hct = 0; // 高标数量
            for (const k in ztmp) {
                if (k == 'lead' || k == 'candidates' || k == 'date') {
                    continue;
                }
                if (k == '3') {
                    continue;
                }
                if (k == '2') {
                    this.addZtAnchors(z2, ztmp[k], true);
                } else if (k == '1') {
                    if (this.hideZ1) {
                        continue;
                    }
                    this.addZtAnchors(z1, ztmp[k], true);
                } else {
                    hct += ztmp[k].length;
                    for (const zm of ztmp[k]) {
                        highZts.appendChild(this.ztAnchor(zm));
                    }
                }
            }

            if (ztmp['3']) {
                this.addZtAnchors(hct == 0 ? highZts : z3, ztmp['3'], hct != 0);
            }
            if (hct == 0) {
                z3 = '';
            }
            if (hct == 0 && !ztmp['3']) {
                highZts = '';
                z3 = '';
            }
            if (this.hideZ1) {
                this.ztMapTable.addRow(
                    date,
                    ztlead == '' ? candidates : ztlead,
                    highZts,
                    z3,
                    z2
                );
            } else {
                this.ztMapTable.addRow(
                    date,
                    ztlead == '' ? candidates : ztlead,
                    highZts,
                    z3,
                    z2,
                    z1
                );
            }
        }
    }
}
