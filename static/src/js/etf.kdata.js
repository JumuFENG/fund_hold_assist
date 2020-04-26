class EtfFilter {
    constructor(df, uf, b, m, s) {
        this.nameKey = null;
        this.minDownFluct = df;
        this.minUpFluct = uf;
        this.minBack = b;
        this.minMonths = m;
        this.minScale = s;
    }
}

class ETF_Frame {
    constructor() {
        this.etfFilter = new EtfFilter(4, 4, 0, 0, 0);
        this.stocks_array = null;
        this.interested_array = null;
        this.showOnlyInterested = false;
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
        var chartdiv = document.createElement('div');
        this.gridChart = new PlanChart(chartdiv);
        this.container.appendChild(chartdiv);
    }

    backToList() {
        this.container.style.display = 'none';
        stockHub.show();
    }

    getAllCandidateStocks() {
        if (typeof(all_candidate_stocks) !== 'undefined') {
            this.stocks_array = all_candidate_stocks;
            this.showOnlyInterested = false;
            this.reloadStocksTable();
            return;
        };

        if (this.showOnlyInterested && this.stocks_array && this.interested_array.length == Object.keys(this.stocks_array).length) {
            this.reloadStocksTable();
            return;
        };

        var queryStr = 'act=allstks';
        if (this.showOnlyInterested) {
            queryStr += '&interested=1';
        };

        utils.get('stock', queryStr, function(that, rsp) {
            var stocks_array = JSON.parse(rsp);
            that.stocks_array = stocks_array;
            if (typeof(rtHelper) !== 'undefined') {
                for (var i in stocks_array) {
                    rtHelper.pushStockCode(i);
                };
                rtHelper.fetchStockRtDataActually(function() {
                    that.reloadStocksTable();
                });
            } else {
                that.reloadStocksTable();
            }
        }, this);
    }

    createNameCell(name, code) {
        var cell = document.createElement('div');
        var nameLnk = document.createElement('a');
        nameLnk.textContent = name;
        cell.appendChild(nameLnk);
        nameLnk.href = 'javascript:void(0);';
        nameLnk.that = this;
        nameLnk.onclick = function (e) {
            e.target.that.showGridChart(code);
        }
        cell.title = code;
        var addLink = document.createElement('a');
        addLink.className = 'rectBtnAnchor';
        addLink.textContent = this.isInterested(code) ? '-' : '+';
        addLink.that = this;
        addLink.onclick = function (e) {
            if (!e.target.that.isInterested(code)) {
                e.target.that.addInterested(code);
            } else {
                e.target.that.removeInterested(code);
            }
        }
        cell.appendChild(addLink);
        return cell;
    }

    reloadStocksTable() {
        if (!this.stocks_array || Object.keys(this.stocks_array).length == 0) {
            this.getAllCandidateStocks();
            return;
        };
        for (var i in this.stocks_array) {
            var di = this.stocks_array[i];
            var latestPrice = di.last_close;
            if (typeof(stockRtData) !== 'undefined' && !stockRtData[i].rtprice) {
                latestPrice = stockRtData[i].rtprice;
            };
            di.last_close = latestPrice;
            di.mback = parseFloat((100 * (di.mlasthigh - latestPrice) / di.mlasthigh).toFixed(2));
            di.mperBack = parseFloat((100 * di.mback / di.mfluct_down).toFixed(2));
            di.mpop = parseFloat((100 * (latestPrice - di.mlastlow) / di.mlastlow).toFixed(2));
            di.mperPop = parseFloat((100 * di.mpop / di.mfluct_up).toFixed(2));
            this.stocks_array[i] = di;
        };
        this.allEtfTable.reset();
        this.allEtfTable.setClickableHeader('名称', '类型', '跌幅(%)', '涨幅(%)', '月数', '最新值', '最新回撤(%)', '回撤比例(%)', '反弹(%)', '反弹比例(%)', '规模(亿)');
        for (var i in this.stocks_array) {
            if (this.showOnlyInterested) {
                if (!this.isInterested(i)) {
                    continue;
                };
            };
            var di = this.stocks_array[i];
            if (this.checkEtfData(di)) {
                var nameCell = this.createNameCell(di.name, i);
                this.allEtfTable.addRow(nameCell, di.type, di.mfluct_down, di.mfluct_up, di.mlen, di.last_close, di.mback, di.mperBack, di.mpop, di.mperPop, di.sc);
            };
        };
    }

    createFilterRow(conds, symbol, val, that, cb) {
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
                cb(that, e.target.value, false)
            };
        }
        d.appendChild(ec);
        check.bindInput = ec;
        check.onclick = function(e) {
            e.target.bindInput.disabled = !e.target.checked;
            if (typeof(cb) === 'function') {
                cb(that, e.target.bindInput.value, !e.target.checked);
            };
        }
        return d;
    }

    createFilterArea() {
        var table = document.createElement('ul');
        table.className = 'ulTable';
        this.filterArea.appendChild(document.createTextNode('过滤条件'));
        this.filterArea.appendChild(table);
        table.appendChild(this.createFilterRow('关键词包含', '：', '', this, function(that, f, ud) {
            that.etfFilter.nameKey = ud ? null : f;
            that.reloadStocksTable();
        }));
        table.appendChild(this.createFilterRow('平均跌幅(%)', '>', 10, this, function(that, f, ud) {
            that.etfFilter.minDownFluct = ud ? 0 : f;
            that.reloadStocksTable();
        }));
        table.appendChild(this.createFilterRow('平均涨幅(%)', '>', 10, this, function(that, f, ud) {
            that.etfFilter.minUpFluct = ud ? 0 : f;
            that.reloadStocksTable();
        }));
        table.appendChild(this.createFilterRow('当前回撤(%)', '>', 10, this, function(that, f, ud) {
            that.etfFilter.minBack = ud ? 0 : f;
            that.reloadStocksTable();
        }));
        table.appendChild(this.createFilterRow('资金规模(亿元)', '>', 1, this, function(that, f, ud) {
            that.etfFilter.minScale = ud ? 0 : f;
            that.reloadStocksTable();
        }));
        table.appendChild(this.createFilterRow('月K期数', '>', 20, this, function(that, f, ud) {
            that.etfFilter.minMonths = ud ? 0 : f;
            that.reloadStocksTable();
        }));
    }

    isInterested(code) {
        return this.interested_array && this.interested_array.includes(code);
    }

    getInterestedStocks() {
        if (typeof(all_candidate_stocks) !== 'undefined') {
            this.stocks_array = all_candidate_stocks;
            this.showOnlyInterested = false;
            this.reloadStocksTable();
            return;
        };

        if (this.interested_array && this.interested_array.length > 0) {
            this.getAllCandidateStocks();
            return;
        };

        utils.get('stock', 'act=interstedstks', function(that, rsp) {
            that.interested_array = JSON.parse(rsp);
            that.getAllCandidateStocks();
        }, this);
    }

    addInterested(code) {
        trade.interest(code, function(that) {
            that.interested_array.push(code);
            that.reloadStocksTable();
        }, this);
    }

    removeInterested(code) {
        trade.forget(code, function(that) {
            var idx = that.interested_array.indexOf(code);
            if (idx >= 0) {
                that.interested_array.splice(idx, 1);
            };
            that.reloadStocksTable();
        }, this);
    }

    checkEtfData(e) {
        if (!this.etfFilter) {
            return true;
        };

        var flt = this.etfFilter;
        var nameMatch = true;
        if (flt.nameKey) {
            nameMatch = e.name.includes(flt.nameKey);
        };
        var condMatch = e.mfluct_down >= flt.minDownFluct && e.mfluct_up >= flt.minUpFluct && e.mlen >= flt.minMonths && e.mback >= flt.minBack && e.sc >= flt.minScale;

        return nameMatch && condMatch;
    }

    showGridChart(code) {
        if (!this.gridChart) {
            return;
        };
        if (!all_stocks[code] || !all_stocks[code].khl_m_his) {
            if (typeof(trade) !== 'undefined') {
                trade.fetchKhlData(code, function(c, that) {
                    that.gridChart.setCode(c);
                    that.gridChart.drawChart();
                }, this);
            };
        } else {
            this.gridChart.setCode(code);
            this.gridChart.drawChart();
        }
    }
};
