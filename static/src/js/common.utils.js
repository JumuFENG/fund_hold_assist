class RadioAnchorBar {
    constructor(text = '') {
        this.container = document.createElement('div');
        this.container.className = 'radio_anchor_div';
        if (text.length > 0) {
            this.container.appendChild(document.createTextNode(text));
        };
        this.radioAchors = [];
    }

    addRadio(text, cb, that) {
        var ra = document.createElement('a');
        ra.href = 'javascript:void(0)';
        ra.anchorBar = this;
        ra.textContent = text;
        ra.onclick = function(e) {
            e.target.anchorBar.setHightlight(e.target, cb, that);
        }
        this.container.appendChild(ra);
        this.radioAchors.push(ra);
    }

    setHightlight(r, cb, that) {
        if (!cb) {
            r.className = '';
            r.click();
            return;
        };
        
        for (var i = 0; i < this.radioAchors.length; i++) {
            if (this.radioAchors[i] == r) {
                if (this.radioAchors[i].className == 'highlight') {
                    return;
                };
                this.radioAchors[i].className = 'highlight';
                if (typeof(cb) === 'function') {
                    cb(that);
                };
            } else {
                this.radioAchors[i].className = '';
            }
        };
    }

    selectDefault() {
        var defaultItem = this.radioAchors[this.getHighlighted()];
        this.setHightlight(defaultItem);
    }

    getHighlighted() {
        for (var i = 0; i < this.radioAchors.length; i++) {
            if (this.radioAchors[i].className == 'highlight') {
                return i;
            }
        };
        return 0;
    }
}

class SortableTable {
    constructor(hrows = 1, erows = 0) {
        this.container = document.createElement('div');
        this.headRows = hrows;
        this.endRows = erows;
        this.colOffset = 0;
        this.table = null;
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
            th.onclick = function(e) {
                e.target.bindTable.sortTable(e.target.idx);
            }
            th.appendChild(document.createTextNode(hs[i]));
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
        if (n < 1) {
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

class EditableCell {
    constructor(text) {
        this.otext = text;
        this.container = document.createElement('div');
        this.container.style.display = 'inline';
        this.lblText = document.createTextNode(text);
        this.container.appendChild(this.lblText);
        this.inputBox = document.createElement('input');
        this.inputBox.style.maxWidth = '80px';
        this.inputBox.style.display = 'none';
        this.inputBox.value = text;
        this.container.appendChild(this.inputBox);
        this.editable = false;
    }

    edit() {
        this.lblText.textContent = '';
        this.inputBox.style.display = 'inline';
        this.editable = true;
    }

    readonly() {
        this.lblText.textContent = this.inputBox.value;
        this.inputBox.style.display = 'none';
        this.editable = false;
    }

    textChanged() {
        return this.otext != this.inputBox.value;
    }

    update(text) {
        this.otext = text;
        this.inputBox.value = text;
        this.readonly();
    }

    text() {
        return this.inputBox.value;
    }
}

class Utils {
    logInfo(...args) {
        //console.log(args);
    }

    isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            };
        };
        return true;
    }

    getTodayDate() {
        var dt = new Date();
        return dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

    days_since_2000(date) {
        var d = new Date("2000-01-01");
        var dt = new Date(date);
        return (dt - d) / (24 * 60 * 60 * 1000);
    }

    date_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        return dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

    ym_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        return dt.getFullYear() + "-" + ('' + (dt.getMonth() + 1)).padStart(2, '0');
    }

    get(path, queries, cb, that) {
        var httpRequest = new XMLHttpRequest();
        var lnk = '../../' + path;
        if (queries && queries.length > 0) {
            lnk += '?' + queries;
        };
        httpRequest.open('GET', lnk, true);
        httpRequest.send();

        httpRequest.onreadystatechange = function() {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                if (typeof(cb === 'function')) {
                    if (that) {
                        cb(that, httpRequest.responseText);
                    } else {
                        cb(httpRequest.responseText);
                    }
                };
            };
        }
    }

    post(querystr, form, cb, that) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('POST', '../../' + querystr);
        httpRequest.send(form);

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                if (typeof(cb) === 'function') {
                    cb(that);
                };
            };
        }
    }

    incdec_lbl_classname(val) {
        if (!val) {
            return "keepsame";
        };
        var lbl_class = "keepsame";
        if (val < 0) {
            lbl_class = "decrease";
        } else if (val > 0) {
            lbl_class = "increase";
        };
        return lbl_class;
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

    removeAllChild(ele) {
        while(ele.hasChildNodes()) {
            ele.removeChild(ele.lastChild);
        }
    }
}
