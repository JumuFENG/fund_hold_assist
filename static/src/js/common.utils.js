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

class KmhlChart {
    constructor(chartDiv) {
        this.container = chartDiv;
        this.chartOptions = new RadioAnchorBar();
        this.chartLen = -1;
        this.container.appendChild(this.chartOptions.container);
        this.chart_container = document.createElement('div');
        this.container.appendChild(this.chart_container);
        this.chart = new google.visualization.LineChart(this.chart_container);
        var that = this;
        google.visualization.events.addListener(this.chart, 'ready', function() {
            that.drawVticks();
        });
    }

    initOptions() {
        if (this.chartOptions.radioAchors.length == 0) {
            this.chartOptions.addRadio('5', function(that) {
                that.chartLen = 5;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('10', function(that) {
                that.chartLen = 10;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('20', function(that) {
                that.chartLen = 20;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('30', function(that) {
                that.chartLen = 30;
                that.drawChart();
            }, this);
            this.chartOptions.addRadio('全部', function(that) {
                that.chartLen = 0;
                that.drawChart();
            }, this);
        };
    }

    initTicks(maxValue, minValue) {
        var minTick = Math.round(minValue * 100 - 1) / 100;
        var maxTick = Math.round(maxValue * 100 + 1) / 100;
        var delta = (maxTick - minTick) / 6;

        var ticks = [maxTick];
        for (var i = 1; ; i++) {
            var nextVal = parseFloat((ticks[i - 1] - delta).toFixed(3));
            if (this.latestPrice < ticks[i - 1] && this.latestPrice > nextVal) {
                if (ticks[i - 1] - this.latestPrice < 0.2 * delta) {
                    ticks.splice(i - 1,10, this.latestPrice);
                    ticks.push(nextVal);
                } else if (this.latestPrice - nextVal < 0.2 * delta) {
                    ticks.push(this.latestPrice);
                } else {
                    ticks.push(this.latestPrice);
                    ticks.push(nextVal);
                    i++;
                };
            } else {
                ticks.push(nextVal);
            };

            if (ticks[ticks.length - 1] <= minTick) {
                break;
            };
        };

        this.ticks = ticks;
    }

    drawVticks() {
        if (this.latestPrice != null) {
            var tRects = this.chart_container.getElementsByTagName('rect');
            var tickRects = [];
            for (var i = 0; i < tRects.length; i++) {
                if (tRects[i].getAttribute('height') === '1') {
                    tickRects.push(tRects[i]);
                };
            };
            var priceIndex = this.ticks.indexOf(this.latestPrice);
            tickRects[tickRects.length - priceIndex - 1].setAttribute('fill', '#ff0000');
        };
    }

    createChartOption() {
        this.options = {
            legend: { position: 'top' },
            width: '100%',
            height: '100%',
            title: this.code,
            vAxes: {
                0: {
                    ticks: this.ticks
                }
            },
            series: {
                0: {
                    pointSize: 0,
                    lineWidth: 1
                },
                1: {
                    pointSize: 0,
                    lineWidth: 1
                },
                2: {
                    pointSize: 2,
                    lineWidth: 0
                },
                3: {
                    pointSize: 1,
                    lineWidth: 0
                },
                4: {
                    pointSize: 2,
                    lineWidth: 0
                }
            }
        };
    }

    get_to_buy_prices() {
        var maxIdx = this.mkhl.length - 1;
        var lastLow = parseFloat(this.mkhl[maxIdx][2]);
        if (lastLow > parseFloat(this.mkhl[maxIdx - 1][2])) {
            lastLow = parseFloat(this.mkhl[maxIdx - 1][2]);
        };
        var topBuy = lastLow;

        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        var delta = parseFloat((lastHigh * this.buy_down_rate).toFixed(3));
        var result = [];
        if (this.buytable && this.buytable.length > 0) {
            var minBuyPrice = this.buytable[0].price;
            var topBuy = lastHigh;
            for (var i = 0; i < this.buytable.length; i++) {
                if (minBuyPrice > this.buytable[i].price) {
                    minBuyPrice = this.buytable[i].price;
                }; 
            };
            while (topBuy - delta > minBuyPrice) {
                topBuy = topBuy - delta;
            };
            result.push({price:parseFloat(topBuy.toFixed(3)),tooltip:topBuy.toFixed(3) + ' 可买'});
            var nextBuy = topBuy - delta;
            result.push({price:nextBuy, tooltip:nextBuy.toFixed(3) + ' 可买'});
            if (minBuyPrice - nextBuy < 0.4 * delta) {
                var nnextBuy = nextBuy - delta;
                result.push({price:parseFloat(nnextBuy.toFixed(3)), tooltip:nnextBuy.toFixed(3) + ' 可买'});
            };
        } else {
            var to_buy = (lastHigh + lastLow) / 2;
            result.push({price:parseFloat(to_buy.toFixed(3)), tooltip: '中值:' + to_buy.toFixed(3)});
            var nextBuy = to_buy - delta;
            result.push({price:nextBuy, tooltip:nextBuy.toFixed(3) + ' 可买'});
        }
        return result;
    }

    get_to_sell_price() {
        if (!this.buytable || this.buytable.length <= 0) {
            return null;
        };
        var minBuyPrice = this.buytable[0].price;
        var minPtn = this.buytable[0].ptn;
        var sumCost = 0;
        var sumPtn = 0;
        for (var i = 0; i < this.buytable.length; i++) {
            sumCost += this.buytable[i].cost;
            sumPtn += this.buytable[i].ptn;
            if (minBuyPrice > this.buytable[i].price) {
                minBuyPrice = this.buytable[i].price;
                minPtn = this.buytable[i].ptn;
            };
        };
        var averPrice = sumCost / sumPtn;
        var sellPrice = parseFloat((minBuyPrice * (1 + this.sell_up_rate)).toFixed(3));
        var sellPtn = minPtn;
        if (this.latestPrice > averPrice) {
            sellPrice = parseFloat((this.latestPrice * (1 + this.sell_up_rate)).toFixed(3));
            sellPtn = sumPtn;
        };
        return {price: sellPrice, tooltip: '卖出点:' + sellPrice + '\n份额:' + minPtn };
    }

    createDataTable() {
        if (!this.mkhl) {
            return;
        };

        this.data = null;

        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', '时间');
        data.addColumn('number', 'High');
        data.addColumn('number', 'Low');
        data.addColumn('number', '已买');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addColumn('number', '可买');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addColumn('number', '卖点');
        data.addColumn({type: 'string', role: 'tooltip'});

        var rows = [];
        var len = this.chartLen;
        if (len > this.mkhl.length || len == 0) {
            len = this.mkhl.length;
        };
        var maxIdx = this.mkhl.length - 1;
        var lastHigh = parseFloat(this.mkhl[maxIdx][1]);
        if (lastHigh < parseFloat(this.mkhl[maxIdx - 1][1])) {
            lastHigh = parseFloat(this.mkhl[maxIdx - 1][1]);
        };
        var lastLow = parseFloat(this.mkhl[maxIdx][2]);
        if (lastLow > parseFloat(this.mkhl[maxIdx - 1][2])) {
            lastLow = parseFloat(this.mkhl[maxIdx - 1][2]);
        };
        var maxTick = lastHigh;
        var minTick = lastLow;
        for (var i = this.mkhl.length - len; i < this.mkhl.length; i++) {
            var h = parseFloat(this.mkhl[i][1]);
            var l = parseFloat(this.mkhl[i][2]);
            rows.push([utils.ym_by_delta(this.mkhl[i][0]), h, l, null, null, null, null, null, null]);
            if (maxTick < h) {
                maxTick = h;
            };
            if (minTick > l) {
                minTick = l;
            };
        };

        var delta = lastHigh - lastLow;
        var topBuy = parseFloat((lastLow + 0.2 * delta).toFixed(3));
        var bottomSell = parseFloat((lastHigh - 0.2 * delta).toFixed(3));
        if (this.buytable) {
            for (var i = 0; i < this.buytable.length; i++) {
                var price = this.buytable[i].price;
                rows.push(['', bottomSell, topBuy, price
                    , '买入价:' + price + '\n份额:' + this.buytable[i].ptn,
                    null, null, null, null]);
                if (maxTick < price) {
                    maxTick = price;
                };
                if (minTick > price) {
                    minTick = price;
                };
            };
        };

        var to_buy = this.get_to_buy_prices();

        for (var i = 0; i < to_buy.length; i++) {
            rows.push(['', bottomSell, topBuy, null, null, to_buy[i].price, to_buy[i].tooltip, null, null]);
            if (minTick > to_buy[i].price) {
                minTick = to_buy[i].price;
            };
        };

        var to_sell = this.get_to_sell_price();
        if (to_sell != null) {
            rows.push(['', bottomSell, topBuy, null, null, null, null, to_sell.price, to_sell.tooltip]);
            if (to_sell.price != null && maxTick < to_sell.price) {
                maxTick = to_sell.price;
            };
        };

        data.addRows(rows);
        this.data = data;
        if (this.latestPrice > maxTick) {
            maxTick = this.latestPrice;
        };
        if (this.latestPrice < minTick) {
            minTick = this.latestPrice;
        };
        this.initTicks(maxTick, minTick);
    }

    drawChart() {
        if (this.chartLen == -1) {
            this.chartOptions.selectDefault();
            return;
        };
        this.createDataTable();
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
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
