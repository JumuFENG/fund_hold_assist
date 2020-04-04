class StockStats {
    constructor() {
        this.container = null;
        this.statsJson = null;
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:stockHub.stockStats.backToList()';
        this.container.appendChild(backLink);
    }

    backToList() {
        this.container.style.display = 'none';
        stockHub.show();
    }

    createHeaders(...hs) {
        var tr = document.createElement('tr');
        for (var i = 0; i < hs.length; i++) {
            var th = document.createElement('th');
            th.setAttribute('onclick', 'stockHub.stockStats.sortTable(' + (i + 1) + ')');
            th.appendChild(document.createTextNode(hs[i]));
            tr.appendChild(th);
        };
        return tr;
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

    getStockStats() {
        utils.get('stock', 'act=stats', function(rsp){
            stockHub.stockStats.statsJson = JSON.parse(rsp);
            stockHub.stockStats.showStockStats();
        });
    }

    showStockStats() {
        if (!this.statsJson) {
            return;
        };

        var cost = 0, ewh = 0, cs = 0, ms = 0, earned = 0;
        for (var i in this.statsJson) {
            var code = i;
            if (stockRtData[code] && stockRtData[code].rtprice) {
                this.statsJson[i].ewh = parseFloat((all_stocks[code].ptn * (stockRtData[code].rtprice - all_stocks[code].avp)).toFixed(2));
            } else {
                this.statsJson[i].ewh = 0;
            }
            cost += this.statsJson[i].cost;
            ewh += this.statsJson[i].ewh;
            cs += this.statsJson[i].cs;
            ms += this.statsJson[i].ms;
            this.statsJson[i].earned = this.statsJson[i].ms - this.statsJson[i].cs + this.statsJson[i].ewh;
            earned += this.statsJson[i].earned;
            this.statsJson[i].perTimeCostSold = (this.statsJson[i].cost + this.statsJson[i].cs) / this.statsJson[i].srct
            this.statsJson[i].earnedRate = this.statsJson[i].earned / (this.statsJson[i].cost + this.statsJson[i].cs);
        };
        
        if (!this.statsTable) {
            this.statsTable = document.createElement('table');
            this.statsTable.className = 'sortableTable';
            this.container.appendChild(this.statsTable);
        };
        
        utils.deleteAllRows(this.statsTable)

        this.statsTable.appendChild(this.createSpanHeaders({'name':'名称', row:2}, {'name':'持有信息', col:2}, {'name':'售出信息', col:4}, {'name':'收益'}, {'name':'收益率', col:2}));
        this.statsTable.appendChild(this.createHeaders('成本', '收益', '总成本', '总额', '次数', '次均', '总', '次均(%)', '标准(%)'));
        for (var i in this.statsJson) {
            this.statsTable.appendChild(utils.createColsRow(
                this.statsJson[i].name,
                this.statsJson[i].cost,
                this.statsJson[i].ewh,
                this.statsJson[i].cs,
                parseFloat(this.statsJson[i].ms.toFixed(2)),
                this.statsJson[i].srct,
                parseFloat(this.statsJson[i].perTimeCostSold.toFixed(2)),
                parseFloat(this.statsJson[i].earned.toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * 100).toFixed(2)),
                parseFloat((this.statsJson[i].earnedRate * this.statsJson[i].srct * 100).toFixed(2))));
        };
        this.lastRow = utils.createColsRow('总计', cost, ewh.toFixed(2), cs, ms.toFixed(2), '-', '-', earned.toFixed(2), (100 * earned / (cost + cs)).toFixed(2), '-');
        this.statsTable.appendChild(this.lastRow);
    }

    checkRowsDecreasing(ar, n, s = 0, aend = 0) {
        var e = aend == 0 ? ar.length - 1 : aend;
        if (s > e) {
            return false;
        };

        for (var i = s; i < e; i++) {
            if (Number(ar[i].getElementsByTagName("TD")[n].innerText) < Number(ar[i+1].getElementsByTagName("TD")[n].innerText)) {
                return false;
            };
        }
        return true;
    }

    sortTable(n) {
        if (n < 1) {
            return;
        };

        var table = this.statsTable;
        var decsort = true;
        if (this.checkRowsDecreasing(table.rows, n, 2, table.rows.length - 2)) {
            decsort = false;
        }

        for (var i = 3; i < table.rows.length - 1; i++) {
            var numX = Number(table.rows[i].getElementsByTagName("TD")[n].innerText);
            var shouldSwitch = false;
            var j = 2;
            for (; j < i; j++) {
                var numY = Number(table.rows[j].getElementsByTagName("TD")[n].innerText);
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
