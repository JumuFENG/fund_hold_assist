class EtfFilter {
    constructor(f, b, m, s) {
        this.minFluct = f;
        this.minBack = b;
        this.minMonths = m;
        this.minScale = s;
    }
}

class ETF_Frame {
    constructor(container) {
        this.container = container;
        this.etfFilter = new EtfFilter(0, 0, 0, 0);
    }

    initialize() {
        this.filterArea = document.createElement('div');
        this.container.appendChild(this.filterArea);
        this.allEtfTable = new SortableTable();
        this.container.appendChild(this.allEtfTable.container);
        this.showAllEtfTable();
        if (Object.keys(all_candidate_stocks).length > 0) {
            this.showFilterArea();
        };
    }

    showAllEtfTable() {
        this.allEtfTable.reset();
        this.allEtfTable.setClickableHeader('名称', '代码', '类型', '波动(%)', '月数', '最新值', '最新回撤(%)', '规模(亿)');
        for (var i in all_candidate_stocks) {
            var di = all_candidate_stocks[i];
            if (this.checkEtfData(di)) {
                this.allEtfTable.addRow(di.name, i, di.type, di.maver_fluct, di.mlen, di.last_close, di.mback, di.sc);
            };
        };
    }

    createFilterRow(conds, symbol, val, cb) {
        var d = document.createElement('li');

        var check = document.createElement('input');
        check.type = 'checkbox';
        d.appendChild(check);

        var text = document.createElement('div');
        text.textContent = conds + ' ' + symbol + ' ';
        text.style.display = 'inline';
        d.appendChild(text);

        var ec = document.createElement('input');
        ec.style.maxWidth = '80px';
        ec.style.display = 'inline';
        ec.disabled = true;
        ec.value = val;
        ec.onchange = function(e) {
            if (typeof(cb) === 'function') {
                cb(parseFloat(e.target.value))
            };
        }
        d.appendChild(ec);
        check.bindInput = ec;
        check.onclick = function(e) {
            e.target.bindInput.disabled = !e.target.checked;
            if (typeof(cb) === 'function') {
                cb(e.target.checked ? parseFloat(e.target.bindInput.value) : 0);
            };
        }
        return d;
    }

    showFilterArea() {
        var table = document.createElement('ul');
        table.className = 'ulTable';
        this.filterArea.appendChild(document.createTextNode('过滤条件'));
        this.filterArea.appendChild(table);
        table.appendChild(this.createFilterRow('平均波动幅度(%)', '>', 10, function(f) {
            etfFrm.etfFilter.minFluct = f;
            etfFrm.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('当前回撤(%)', '>', 10, function(f) {
            etfFrm.etfFilter.minBack = f;
            etfFrm.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('资金规模(亿元)', '>', 1, function(f) {
            etfFrm.etfFilter.minScale = f;
            etfFrm.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('月K期数', '>', 20, function(f) {
            etfFrm.etfFilter.minMonths = f;
            etfFrm.showAllEtfTable();
        }));
    }

    checkEtfData(e) {
        if (!this.etfFilter) {
            return true;
        };

        return e.maver_fluct >= this.etfFilter.minFluct && e.mlen >= this.etfFilter.minMonths && e.mback >= this.etfFilter.minBack && e.sc >= this.etfFilter.minScale;
    }
};
