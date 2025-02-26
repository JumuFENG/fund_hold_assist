class Utils {
    isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            };
        };
        return true;
    }

    dateToString(dt, sep = '') {
        return dt.toLocaleString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, sep);
    }

    getTodayDate(sep = '-') {
        return this.dateToString(new Date(), sep);
    }

    days_since_2000(date) {
        var d = new Date("2000-01-01");
        var dt = new Date(date);
        return (dt - d) / (24 * 60 * 60 * 1000);
    }

    date_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        return dt.getFullYear() + "-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

    ym_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        return dt.getFullYear() + "-" + ('' + (dt.getMonth() + 1)).padStart(2, '0');
    }

    first_day_of_same_yr_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        var fdt = new Date(dt.getFullYear() + "-01-01");
        return (fdt - new Date("2000-01-01")) / (24 * 60 * 60 * 1000);
    }

    removeAllChild(ele) {
        while(ele.hasChildNodes()) {
            ele.removeChild(ele.lastChild);
        }
    }

    calcBuyCount(amount, price) {
        var ct = (amount / 100) / price;
        if (amount - price * Math.floor(ct) * 100 - (price * Math.ceil(ct) * 100 - amount) > 0) {
            return 100 * Math.ceil(ct);
        }
        return ct > 1 ? 100 * Math.floor(ct) : 100;
    }

    createSingleRow(c, span = 2) {
        var row = document.createElement("tr");
        var col = document.createElement("td");
        col.setAttribute("colspan", span);
        col.appendChild(document.createTextNode(c))
        row.appendChild(col);
        return row;
    }

    createHeaders(...hs) {
        var tr = document.createElement('tr');
        for (var i = 0; i < hs.length; i++) {
            var th = document.createElement('th');
            if ('object' != typeof(hs[i])) {
                th.appendChild(document.createTextNode(hs[i]));
            } else {
                th.appendChild(hs[i]);
            }
            tr.appendChild(th);
        };
        return tr;
    }

    createColsRow(...c){
        var row = document.createElement("tr");
        for (var i = 0; i < c.length; i++) {
            var col = document.createElement("td");
            if ('object' != typeof(c[i]) || !c[i]) {
                col.appendChild(document.createTextNode(c[i]));
            } else {
                col.appendChild(c[i]);
            }
            row.appendChild(col);
        };
        return row;
    }

    deleteAllRows(tbl) {
        for (var idx = tbl.rows.length - 1; idx >= 0; idx--) {
            tbl.deleteRow(idx);
        }
    }

    createSelector(opts, opt0 = null) {
        var selector = document.createElement('select');
        if (opt0) {
            var opt = document.createElement('option');
            opt.textContent = opt0;
            opt.selected = true;
            opt.disabled = true;
            selector.appendChild(opt)
        };
        for (var i in opts) {
            var opt = document.createElement('option');
            opt.value = i;
            opt.textContent = opts[i];
            selector.appendChild(opt);
        };
        return selector;
    }
}

class RadioAnchorPage {
    constructor(text) {
        this.container = document.createElement('div');
        this.anchorBar = document.createElement('a');
        this.anchorBar.href = '#';
        this.anchorBar.textContent = text;
        this.anchorBar.onclick = () => {
            if (this.onAnchorClicked) {
                this.onAnchorClicked(this.idx);
            }
        }
        this.selected = false;
        this.container.style.display = 'none';
    }

    show() {
        this.selected = true;
        this.anchorBar.className = 'highlight';
        this.container.style.display = 'block';
    }

    hide() {
        this.selected = false;
        this.anchorBar.className = '';
        this.container.style.display = 'none';
    }
}

class RadioAnchorBar {
    constructor(text = '') {
        this.container = document.createElement('div');
        this.container.className = 'radio_anchor_div';
        if (text.length > 0) {
            this.container.appendChild(document.createTextNode(text));
        };
        this.radioAchors = [];
    }

    clearAllAnchors() {
        if (this.radioAchors.length > 0) {
            this.radioAchors.forEach(a => {
                utils.removeAllChild(a.container);
            });
            utils.removeAllChild(this.container);
            this.radioAchors = [];
        }
    }

    addRadio(anpg) {
        this.container.appendChild(anpg.anchorBar);
        anpg.idx = this.radioAchors.length;
        anpg.onAnchorClicked = obj => {
            this.setHightlight(obj);
        }
        this.radioAchors.push(anpg);
    }

    setHightlight(i) {
        var h = this.getHighlighted();
        if (h == i) {
            return;
        }
        this.radioAchors[h].hide();
        this.radioAchors[i].show();
    }

    selectDefault() {
        var defaultItem = this.radioAchors[this.getHighlighted()];
        if (!defaultItem.selected) {
            defaultItem.show();
        }
    }

    getHighlighted() {
        for (var i = 0; i < this.radioAchors.length; i++) {
            if (this.radioAchors[i].selected) {
                return i;
            }
        };
        return 0;
    }
}

class SortableTable {
    constructor(hrows = 1, erows = 0, sortable = true) {
        this.container = document.createElement('div');
        this.headRows = hrows;
        this.endRows = erows;
        this.colOffset = 0;
        this.table = null;
        this.sortable = sortable;
    }

    reset() {
        if (!this.table) {
            this.table = document.createElement('table');
            this.table.className = 'sortableTable';
            this.container.appendChild(this.table);
        };
        utils.deleteAllRows(this.table);
    }

    createSpanHeaders(...hs) {
        var tr = document.createElement('tr');
        for (var i = 0; i < hs.length; i++) {
            var th = document.createElement('th');
            if (hs[i].col && hs[i].col > 1) {
                th.setAttribute('colspan', hs[i].col);
            };
            if (hs[i].row && hs[i].row > 1) {
                th.setAttribute('rowspan', hs[i].row);
            };
            th.appendChild(document.createTextNode(hs[i].name));
            tr.appendChild(th);
        };
        return tr;
    }

    setColOffset(x) {
        this.colOffset = x;
    }

    createHeaders(...hs) {
        var tr = document.createElement('tr');
        for (var i = 0; i < hs.length; i++) {
            var th = document.createElement('th');
            th.idx = i + this.colOffset;
            th.bindTable = this;
            if ('object' != typeof(hs[i])) {
                th.onclick = function(e) {
                    e.target.bindTable.sortTable(e.target.idx);
                }
                th.appendChild(document.createTextNode(hs[i]));
            } else {
                th.appendChild(hs[i]);
            }
            tr.appendChild(th);
        };
        return tr;
    }

    setClickableHeader(...hds) {
        this.table.appendChild(this.createHeaders(...hds));
    }

    setSpanHeader(...hds) {
        this.table.appendChild(this.createSpanHeaders(...hds));
    }

    addRow(...rs) {
        this.table.appendChild(utils.createColsRow(...rs));
    }

    convertNumber(a) {
        var numA = Number(a);
        return Number.isNaN(numA) ? a: numA;
    }

    checkRowsDecreasing(ar, n, s = 0, aend = 0) {
        var e = aend == 0 ? ar.length - 1 - this.endRows : aend;
        if (s > e) {
            return false;
        };

        for (var i = s; i < e; i++) {
            if (this.convertNumber(ar[i].getElementsByTagName("TD")[n].innerText) < this.convertNumber(ar[i+1].getElementsByTagName("TD")[n].innerText)) {
                return false;
            };
        }
        return true;
    }

    sortTable(n) {
        if (n < 1 || !this.sortable) {
            return;
        };

        var table = this.table;
        var decsort = true;
        if (this.checkRowsDecreasing(table.rows, n, this.headRows, table.rows.length - 1 - this.endRows)) {
            decsort = false;
        }

        for (var i = this.headRows + 1; i < table.rows.length - this.endRows; i++) {
            var numX = this.convertNumber(table.rows[i].getElementsByTagName("TD")[n].innerText);
            var shouldSwitch = false;
            var j = this.headRows;
            for (; j < i; j++) {
                var numY = this.convertNumber(table.rows[j].getElementsByTagName("TD")[n].innerText);
                if (decsort) {
                    if (numX >= numY) {
                        shouldSwitch = true;
                        break;
                    };
                } else {
                    if (numX <= numY) {
                        shouldSwitch = true;
                        break;
                    };
                }
            }

            if (shouldSwitch) {
                table.rows[i].parentNode.insertBefore(table.rows[i], table.rows[j]);
            };
        }
    }
}


let utils = new Utils();