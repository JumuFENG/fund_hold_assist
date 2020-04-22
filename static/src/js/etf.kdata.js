class EtfFilter {
    constructor(f, b, m, s) {
        this.minFluct = f;
        this.minBack = b;
        this.minMonths = m;
        this.minScale = s;
    }
}

class ETF_Frame {
    constructor() {
        this.etfFilter = new EtfFilter(0, 0, 0, 0);
        this.stocks_array = null;
    }

    createPage(showBacklnk = true) {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
        if (showBacklnk) {
            var backLink = document.createElement('a');
            backLink.textContent = '返回';
            backLink.href = 'javascript:void(0)';
            backLink.that = this;
            backLink.onclick = function (e) {
                e.target.that.backToList();
            }
            this.container.appendChild(backLink);
        };

        var addInterestsArea = document.createElement('div');
        this.container.appendChild(addInterestsArea);
        addInterestsArea.appendChild(document.createTextNode('添加自选:'));
        var interestInput = document.createElement('input');
        interestInput.placeholder = '股票代码';
        addInterestsArea.appendChild(interestInput);
        var btnOK = document.createElement('button');
        btnOK.textContent = 'OK';
        btnOK.bindInput = interestInput;
        btnOK.that = this;
        btnOK.onclick = function(e) {
            e.target.that.addInterested(e.target.bindInput.value);
            e.target.bindInput.value = '';
        }
        addInterestsArea.appendChild(btnOK);

        this.filterArea = document.createElement('div');
        this.container.appendChild(this.filterArea);
        this.createFilterArea();

        this.allEtfTable = new SortableTable();
        this.container.appendChild(this.allEtfTable.container);
    }

    backToList() {
        this.container.style.display = 'none';
        stockHub.show();
    }

    getAllCandidateStocks() {
        if (typeof(all_candidate_stocks) !== 'undefined') {
            this.stocks_array = all_candidate_stocks;
            this.showAllEtfTable();
            return;
        };

        utils.get('stock', 'act=allstks', function(rsp) {
            var stocks_array = JSON.parse(rsp);
            stockHub.stkCandidatePage.stocks_array = stocks_array;
            if (typeof(rtHelper) !== 'undefined') {
                for (var i in stocks_array) {
                    rtHelper.pushStockCode(i);
                };
                rtHelper.fetchStockRtDataActually(function() {
                    stockHub.stkCandidatePage.showAllEtfTable();
                });
            } else {
                stockHub.stkCandidatePage.showAllEtfTable();
            }
        });
    }

    createNameCell(name, code) {
        var cell = document.createElement('div');
        cell.appendChild(document.createTextNode(name));
        var addLink = document.createElement('a');
        addLink.className = 'rectBtnAnchor';
        addLink.textContent = '+';
        addLink.that = this;
        addLink.onclick = function (e) {
            e.target.that.addInterested(code);
        }
        cell.appendChild(addLink);
        return cell;
    }

    showAllEtfTable() {
        for (var i in this.stocks_array) {
            var di = this.stocks_array[i];
            var latestPrice = di.last_close;
            if (typeof(stockRtData) !== 'undefined' && !stockRtData[i].rtprice) {
                latestPrice = stockRtData[i].rtprice;
            };
            di.last_close = latestPrice;
            di.mback = parseFloat((100 * (di.mlasthigh - latestPrice) / di.mlasthigh).toFixed(2));
            di.mperBack = parseFloat((100 * di.mback / di.mfluct_down).toFixed(2));
            this.stocks_array[i] = di;
        };
        this.allEtfTable.reset();
        this.allEtfTable.setClickableHeader('名称', '类型', '跌幅(%)', '涨幅(%)', '月数', '最新值', '最新回撤(%)', '回撤比例(%)', '规模(亿)');
        for (var i in this.stocks_array) {
            var di = this.stocks_array[i];
            if (this.checkEtfData(di)) {
                var nameCell = this.createNameCell(di.name, i);
                this.allEtfTable.addRow(nameCell, di.type, di.mfluct_down, di.mfluct_up, di.mlen, di.last_close, di.mback, di.mperBack, di.sc);
            };
        };
    }

    createFilterRow(conds, symbol, val, that,cb) {
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
                cb(that, parseFloat(e.target.value))
            };
        }
        d.appendChild(ec);
        check.bindInput = ec;
        check.onclick = function(e) {
            e.target.bindInput.disabled = !e.target.checked;
            if (typeof(cb) === 'function') {
                cb(that, e.target.checked ? parseFloat(e.target.bindInput.value) : 0);
            };
        }
        return d;
    }

    createFilterArea() {
        var table = document.createElement('ul');
        table.className = 'ulTable';
        this.filterArea.appendChild(document.createTextNode('过滤条件'));
        this.filterArea.appendChild(table);
        table.appendChild(this.createFilterRow('平均波动幅度(%)', '>', 10, this, function(that, f) {
            that.etfFilter.minFluct = f;
            that.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('当前回撤(%)', '>', 10, this, function(that, f) {
            that.etfFilter.minBack = f;
            that.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('资金规模(亿元)', '>', 1, this, function(that, f) {
            that.etfFilter.minScale = f;
            that.showAllEtfTable();
        }));
        table.appendChild(this.createFilterRow('月K期数', '>', 20, this, function(that, f) {
            that.etfFilter.minMonths = f;
            that.showAllEtfTable();
        }));
    }

    getInterestedStocks() {

    }

    addInterested(code) {
        alert('');
    }

    showInterestedStocksPage() {

    }

    checkEtfData(e) {
        if (!this.etfFilter) {
            return true;
        };

        return e.mfluct_down >= this.etfFilter.minFluct && e.mlen >= this.etfFilter.minMonths && e.mback >= this.etfFilter.minBack && e.sc >= this.etfFilter.minScale;
    }
};
