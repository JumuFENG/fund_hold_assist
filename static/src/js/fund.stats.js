function showFundStats (detailparent) {
    if (!fundstats) {
        fundstats = new FundStats();
        fundstats.createStatsPage();
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('GET', '../../fundmisc?action=fundstats', true);
        httpRequest.send();

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                fundstats.statsJson = JSON.parse(httpRequest.responseText);
                fundstats.showFundStats();
            };
        }
    };

    document.getElementById('funds_list_container').style.display = 'none';
    fundstats.container.style.display = 'block';
}

class FundStats {
    constructor() {
        this.container = null;
        this.statsJson = null;
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:fundstats.backToList()';

        this.container.appendChild(backLink);
    }

    backToList () {
        this.container.style.display = 'none';
        document.getElementById('funds_list_container').style.display = 'block';
    }

    createHeaders(...hs) {
        var tr = document.createElement('tr');
        for (var i = 0; i < hs.length; i++) {
            var th = document.createElement('th');
            th.setAttribute('onclick', 'fundstats.sortTable(' + i + ')');
            th.appendChild(document.createTextNode(hs[i]));
            tr.appendChild(th);
        };
        return tr;
    }

    showFundStats() {
        if (!this.statsJson) {
            return;
        };

        var cost = 0, ewh = 0, cs = 0, acs = 0, earned = 0;
        for (var i in this.statsJson) {
            cost += this.statsJson[i].cost;
            ewh += this.statsJson[i].ewh;
            cs += this.statsJson[i].cs;
            acs += this.statsJson[i].acs;
            this.statsJson[i].earned = this.statsJson[i].acs - this.statsJson[i].cs + this.statsJson[i].ewh;
            earned += this.statsJson[i].earned;
            this.statsJson[i].earnedRate = this.statsJson[i].earned / (this.statsJson[i].cost + this.statsJson[i].cs);
            this.statsJson[i].preDayEarnedRate = this.statsJson[i].earnedRate / this.statsJson[i].hds;
        };
        
        this.statsTable = document.createElement('table');
        this.statsTable.className = 'sortableTable';
        this.container.appendChild(this.statsTable);

        this.statsTable.appendChild(this.createHeaders('基金名称', '持有成本', '持有收益', '售出成本', '售出额', '天数', '总收益', '收益率(%)', '日均收益率(‱)'));
        for (var i in this.statsJson) {
            this.statsTable.appendChild(utils.createColsRow(
                this.statsJson[i].name,
                this.statsJson[i].cost,
                this.statsJson[i].ewh,
                this.statsJson[i].cs,
                this.statsJson[i].acs.toFixed(2),
                this.statsJson[i].hds,
                this.statsJson[i].earned.toFixed(2),
                (this.statsJson[i].earnedRate * 100).toFixed(2),
                (this.statsJson[i].preDayEarnedRate * 10000).toFixed(2)));
        };
        this.lastRow = utils.createColsRow('总计', cost, ewh.toFixed(2), cs, acs.toFixed(2), '-', earned.toFixed(2), (100 * earned / (cost + cs)).toFixed(2), '-');
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
        if (this.checkRowsDecreasing(table.rows, n, 1, table.rows.length - 2)) {
            decsort = false;
        }

        for (var i = 2; i < table.rows.length - 1; i++) {
            var numX = Number(table.rows[i].getElementsByTagName("TD")[n].innerText);
            var shouldSwitch = false;
            var j = 1;
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

var fundstats = null; 