'use strict';

class RandomColor {
    next() {
        const arr = [];
        for (var i = 0; i < 3; i++) {
            arr.push(Math.floor(Math.random() * 128 + 128));
        }
        const [r,g,b] = arr;
        const rgbClr = `#${
            r.toString(16).length > 1 ? r.toString(16) : "0" + r.toString(16)
        }${g.toString(16).length > 1 ? g.toString(16) : "0" + g.toString(16)}${
            b.toString(16).length > 1 ? b.toString(16) : "0" + b.toString(16)
        }`;
        if (this.exists && this.exists.has(rgbClr)) {
            return this.next();
        }
        if (!this.exists) {
            this.exists = new Set();
        }
        this.exists.add(rgbClr);
        return rgbClr;
    }
}

class ZtConceptsPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨停热度');
        this.conceptBk = {};
        this.dailyZtStocks = {};
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.colorGenerator = new RandomColor();
            this.conceptBk['border'] = 'red';
            var title = document.createElement('h1');
            title.textContent = '涨停分布';
            title.style.textAlign = 'center';
            title.style.color = this.colorGenerator.next();
            this.container.appendChild(title);
            this.topPanel = document.createElement('div');
            this.topPanel.style.overflowY = 'scroll';
            this.topPanel.style.maxHeight = 600;
            this.container.appendChild(this.topPanel);
            this.getZtConcepts();

            this.ztConceptPanel = document.createElement('div');
            this.container.appendChild(this.ztConceptPanel);
            this.ztConceptTable = new SortableTable();
            this.ztConceptPanel.appendChild(this.ztConceptTable.container);
        }
    }

    getZtConcepts() {
        var ztUrl = emjyBack.fha.server + 'stock?act=ztconcept&days=250';
        utils.get(ztUrl, null, cdata => {
            this.ztconcepts = JSON.parse(cdata);
            this.showZtConcepts();
        });
    }

    getDailyZt(date, concept, cb) {
        var ztUrl = emjyBack.fha.server + 'api/stockzthist?date=' + date + '&concept=' + concept;
        utils.get(ztUrl, null, zdata => {
            if (!this.dailyZtStocks[date]) {
                this.dailyZtStocks[date] = {};
            }
            this.dailyZtStocks[date][concept] = JSON.parse(zdata);
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    showZtConcepts() {
        if (!this.ztconcepts) {
            return;
        }
        var concpetdict = {};
        this.ztconcepts.forEach(ac => {
            if (!concpetdict[ac[0]]) {
                concpetdict[ac[0]] = [[ac[1], ac[2]]];
            } else {
                concpetdict[ac[0]].push([ac[1], ac[2]]);
            }
        });

        var conceptsBand = document.createElement('div');
        this.topPanel.appendChild(conceptsBand);
        for (var d in concpetdict) {
            conceptsBand.appendChild(this.createConceptsRow(d, concpetdict[d]));
        }
        conceptsBand.lastElementChild.scrollIntoView();
    }

    createConceptsCol(date, concepts) {
        var col = document.createElement('div');
        col.style.width = 20;
        col.style.margin = 0;
        var lbl = document.createElement('div');
        lbl.style.writingMode = 'tb';
        lbl.style.margin = 0;
        lbl.appendChild(document.createTextNode(date.substring(5)));
        col.appendChild(lbl);

        concepts = concepts.sort((a,b) => {return a[1] < b[1]});
        var n5 = concepts[4][1];
        var bars = [];
        var sum = 0;
        concepts.forEach(x => {
            if (x[1] < n5 || x[0] == 'ST股' || x[0] == '公告') {
                return;
            }
            sum += x[1];
            bars.push(x);
        });
        bars.forEach(x => {
            var con = document.createElement('div');
            con.style.writingMode = 'tb';
            con.style.textAlign = 'center';
            con.style.margin = 0;
            if (!this.conceptBk[x[0]]) {
                this.conceptBk[x[0]] = this.colorGenerator.next();
            }
            con.style.background = this.conceptBk[x[0]];
            con.appendChild(document.createTextNode(x[0] + ' ' + x[1]));
            con.style.height = x[1] * 700 / sum;
            col.appendChild(con);
        });
        return col;
    }

    createConceptsRow(date, concepts) {
        var row = document.createElement('div');
        row.style.display = 'flex';
        row.style.height = 25;
        row.style.margin = 0;
        var lbl = document.createElement('div');
        lbl.style.margin = 0;
        lbl.appendChild(document.createTextNode(date));
        row.appendChild(lbl);

        concepts = concepts.sort((a,b) => {return a[1] < b[1]});
        var n5 = concepts[5][1];
        var bars = [];
        var sum = 0;
        concepts.forEach(x => {
            if (x[1] < n5 || x[0] == 'ST股' || x[0] == '公告') {
                return;
            }
            sum += x[1];
            bars.push(x);
        });

        bars.forEach(x => {
            var con = document.createElement('div');
            con.style.textAlign = 'center';
            con.style.margin = 0;
            if (!this.conceptBk[x[0]]) {
                this.conceptBk[x[0]] = this.colorGenerator.next();
            }
            con.style.background = this.conceptBk[x[0]];
            con.appendChild(document.createTextNode(x[0] + ' (' + x[1] + ')'));
            con.style.width = x[1] * this.topPanel.clientWidth / sum;
            con.style.border = '3px solid';
            con.style.borderColor = con.style.backgroundColor;
            con.concept = x[0];
            con.date = date;
            con.onmouseenter = e => {
                this.setBorderColorFor(e.target.concept, this.conceptBk['border']);
            }
            con.onmouseleave = e => {
                this.setBorderColorFor(e.target.concept, e.target.style.backgroundColor);
            }
            con.onclick = e => {
                this.onConceptClicked(e.target.concept, e.target.date);
            }
            row.appendChild(con);
        });

        var lbl2 = document.createElement('div');
        lbl2.style.margin = 0;
        lbl2.appendChild(document.createTextNode(date));
        row.appendChild(lbl2);
        return row;
    }

    setBorderColorFor(concept, clr) {
        var ele = this.topPanel.firstElementChild.firstElementChild;
        while(ele) {
            var bele = ele.firstElementChild;
            while(bele) {
                if (bele.concept == concept) {
                    bele.style.borderColor = clr;
                }
                bele = bele.nextElementSibling;
            }
            ele = ele.nextElementSibling;
        }
    }

    onConceptClicked(concept, date) {
        if (!this.dailyZtStocks[date] || !this.dailyZtStocks[date][concept]) {
            this.getDailyZt(date, concept, _ => {
                this.showDailyZtStocks(date, concept);
            });
            return;
        }
        this.showDailyZtStocks(date, concept);
    }

    showDailyZtStocks(date, concept) {
        if (!this.dailyZtStocks[date] || !this.dailyZtStocks[date][concept]) {
            return;
        }

        this.ztConceptTable.reset();
        this.ztConceptTable.setClickableHeader('序号', '日期', '名称(代码)', '涨停概念', '连板数', '')
        var n = 1;
        for (var i = 0; i < this.dailyZtStocks[date][concept].length; i++) {
            var stocki = this.dailyZtStocks[date][concept][i];
            var anchor = emjyBack.stockAnchor(stocki[0].substring(2));
            this.ztConceptTable.addRow(
                n++,
                date,
                anchor,
                stocki[2],
                stocki[1],
                ''
            );
        }
    }
}
