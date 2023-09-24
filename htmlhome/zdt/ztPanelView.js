'use strict';

class ZtPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停复盘');
        this.hideZ1 = false;
        this.markets = {'A': '主板', 'K': '双创', 'S': 'ST股'};
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

    getZTMap(mkt='A') {
        var ztUrl = emjyBack.fha.server + 'stock?act=ztmap&days=10&mkt=' + mkt;
        if (this.ztmap && this.ztmap[mkt]) {
            ztUrl += '&date=' + this.ztmap[mkt][this.ztmap[mkt].length - 1].date;
        }
        utils.get(ztUrl, null, zt => {
            if (!this.ztmap) {
                this.ztmap = {};
            }
            if (!this.ztmap[mkt]) {
                this.ztmap[mkt] = JSON.parse(zt);
            } else {
                var ztmap = JSON.parse(zt);
                for(const ztm of ztmap) {
                    if (ztm.date >= this.ztmap[mkt][this.ztmap[mkt].length - 1].date) {
                        continue;
                    }
                    this.ztmap[mkt].push(ztm);
                }
            }
            this.hideZ1 = this.ztmap[mkt].length > 10;
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
        var n = ztm.length;
        var rlen = 0;
        if (n < 5) {
            rlen = 1;
        } else if (n < 9) {
            rlen = 2;
        } else {
            rlen = Math.ceil(n/4);
            if (rlen > 6) {
                rlen = 6;
            }
            if (n % rlen + Math.floor(n / rlen) < rlen) {
                rlen--;
            }
        }
        n = 0;
        for (var i = 0; i < ztm.length;) {
            zt.appendChild(this.ztAnchor(ztm[i], hideTail));
            i++;
            if (rlen == 0) {
                continue;
            }
            if (i % rlen == 0) {
                zt.appendChild(document.createElement('br'));
            }
        }
    }

    setAnchorBkColor(code, show=true) {
        var anchors = this.ztMapTable.container.querySelectorAll('a[title="' + code + '"]');
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
            this.ztMapTable.setClickableHeader('日期', '龙头', '准龙', '高标', '三板', '二板');
        } else {
            this.ztMapTable.setClickableHeader('日期', '龙头', '准龙', '高标', '三板', '二板', '首板');
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
            var z3 = document.createElement('div');
            z3.style.maxWidth = 320;
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
                        highZts.appendChild(document.createElement('br'));
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
                    ztlead,
                    candidates,
                    highZts,
                    z3,
                    z2
                );
            } else {
                this.ztMapTable.addRow(
                    date,
                    ztlead,
                    candidates,
                    highZts,
                    z3,
                    z2,
                    z1
                );
            }
        }
    }

    createStrategyFor(code, skey) {
        var date = this.candidatesArea.date;
        var strategy = undefined;
        if (skey == 'dzt') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyBuy","enabled":true, 'bway':'lg', 'rate0':0.03, 'rate1':-0.05}).data;
        } else if (skey == 'zt1_1') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyZt1","enabled":false,'kltype':'101',zt0date:date}).data;
        } else if (skey == 'maconv') {
            strategy = emjyBack.strategyManager.create({"key":"StrategyBuyMA","enabled":false,'kltype':'101'}).data;
        }

        if (strategy === undefined) {
            return
        }

        var strategies = {"0":strategy}
        var transfers = {"0":{"transfer":"-1"}};
        var gmeta = {};
        if (skey == 'dzt') {
            strategies['1'] = {"key":"StrategySellELS","enabled":false,"cutselltype":"single"};
            transfers = {"0":{"transfer":"-1"}, "1":{"transfer":"-1"}};
            gmeta = {"setguard": true, "guardid": "1", "settop": true};
        } else if (skey == 'maconv') {
            strategies['1'] = {"key":"StrategySellMA","enabled":false,"cutselltype":"single"};
            strategies['2'] = {"key":"StrategySellELTop","enabled":false,"cutselltype":"single"};
            transfers = {"0":{"transfer":"1"}, "1":{"transfer":"-1"}, "2":{"transfer":"-1"}};
        }

        var strgrp = {"grptype":"GroupStandard", strategies, transfers, gmeta, "amount":10000};
        if (emjyBack.klines[code]) {
            var kl = emjyBack.klines[c].getLatestKline('101');
            if (kl) {
                strgrp['count0'] = Math.ceil(100/kl.c) * 100;
            }
        }
        return strgrp;
    }

    setStrategyForSelected() {
        this.candidatesArea.textContent = '';
        var skey = this.zt1Selector.value;
        if (skey == 'zt1' || !this.candidatesArea.filteredStks || this.candidatesArea.filteredStks.size == 0) {
            return;
        }
        var candidatesObj = {};
        this.candidatesArea.filteredStks.forEach(c => {
            candidatesObj[c] = this.createStrategyFor(c, skey);
        })
        this.candidatesArea.textContent = JSON.stringify(candidatesObj, null, 1);
    }
}
