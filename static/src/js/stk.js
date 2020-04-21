window.onload = function () {
    stockHub.initialize();
}

class StockSummay {
    constructor(code) {
        this.code = code;
        this.container = null;
        this.detail = null;
    }

    initialize(hdclick) {
        this.container = document.createElement('div');
        var header = document.createElement('div');
        header.className = 'fund_header';
        header.onclick = function(e) {
            if (typeof(hdclick) === 'function') {
                hdclick();
            };
        }

        this.container.appendChild(header);
        this.hdname = document.createTextNode('');
        header.appendChild(this.hdname);
        this.hdearned = document.createElement('label');
        header.appendChild(this.hdearned);
        var hddiv = document.createElement('div');
        hddiv.className = 'general_earned';
        header.appendChild(hddiv);
        hddiv.appendChild(document.createTextNode('成本:'));
        this.hdcost = document.createTextNode('');
        hddiv.appendChild(this.hdcost);
        hddiv.appendChild(document.createTextNode('<'));
        this.hdaverage = document.createTextNode('');
        hddiv.appendChild(this.hdaverage);
        hddiv.appendChild(document.createTextNode('>  份额: '));
        this.hdportion = document.createTextNode('');
        hddiv.appendChild(this.hdportion);
        hddiv.appendChild(document.createElement('br'));
        hddiv.appendChild(document.createTextNode('市值:'));
        this.hdmoney = document.createTextNode('');
        hddiv.appendChild(this.hdmoney);
        this.hdlatestval = document.createElement('label');
        hddiv.appendChild(this.hdlatestval);
        this.hdpercentage = document.createElement('label');
        hddiv.appendChild(this.hdpercentage);

        this.detail = document.createElement('div');
        this.detail.style.display = 'none';
        this.container.appendChild(this.detail);
        this.container.appendChild(document.createElement('hr'));

        var detailLnk = document.createElement('a');
        detailLnk.textContent = '详情';
        detailLnk.href = 'javascript:stockHub.showStockDetailPage("' + this.code + '")';
        this.detail.appendChild(detailLnk);
        this.dtrtable = document.createElement('table');
        this.detail.appendChild(this.dtrtable);
        this.dtbtable = document.createElement('table');
        this.detail.appendChild(this.dtbtable);

        this.forgetBtn = document.createElement('button');
        this.forgetBtn.textContent = "不再关注";
        this.forgetBtn.style.display = 'none';
        this.forgetBtn.code = this.code;
        this.forgetBtn.onclick = function(e) {
            trade.forget(e.target.code);
        }
        this.detail.appendChild(this.forgetBtn);
    }

    toggleDetails() {
        if (this.detail.style.display == "none") {
            this.detail.style.display = 'block';
            this.refreshHoldDetail();
            stockHub.chartWrapper.setParent(this.detail, this.dtbtable);
            stockHub.chartWrapper.code = this.code;
            stockHub.chartWrapper.show();
        } else {
            this.detail.style.display = 'none';
        }
    }

    collapseDetails() {
        if (this.detail.style.display == 'block') {
            this.detail.style.display = 'none';
        };
    }

    update() {
        var stockData = all_stocks[this.code];
        var latestVal = null;
        if (stockRtData[this.code] && stockRtData[this.code].rtprice) {
            latestVal = stockRtData[this.code].rtprice;
        };
        if (stockData) {
            var earned = latestVal ? parseFloat(((latestVal - stockData.avp) * stockData.ptn).toFixed(2)) : '-';
            var clsnm = utils.incdec_lbl_classname(latestVal ? earned : null);
            this.hdname.textContent = stockData.name? stockData.name: this.code;
            this.hdearned.textContent = earned;
            this.hdearned.className = clsnm;
            this.hdportion.textContent = stockData.ptn;
            this.hdaverage.textContent = stockData.avp;
            this.hdcost.textContent = parseFloat((stockData.ptn * stockData.avp).toFixed(2));
            this.hdmoney.textContent = latestVal ? parseFloat((stockData.ptn * latestVal).toFixed(2)) : '-';
            this.hdlatestval.textContent = latestVal ? latestVal : '-';
            this.hdlatestval.className = clsnm;
            this.hdpercentage.textContent = latestVal ? parseFloat(((latestVal - stockData.avp) * 100 / stockData.avp).toFixed(2)) + '%' : '-';
            this.hdpercentage.className = clsnm;
        };

        this.updateBuyTable();
        stockHub.chartWrapper.tradeOption.updateTradePanel();
    }

    createBuyRow(rText, dp, checked) {
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'to_sell_radio_' + this.code;
        radio.value = dp.ids;
        radio.checked = checked;
        var radioDiv = document.createElement('div');
        radioDiv.appendChild(radio);
        radioDiv.appendChild(document.createTextNode(rText));
        return utils.createColsRow(radioDiv, dp.portion, dp.minSellPrice);
    }

    updateBuyTable() {
        if (!this.dtbtable) {
            return;
        };

        utils.deleteAllRows(this.dtbtable);
        var buy_table = all_stocks[this.code].buy_table;
        if (buy_table && buy_table.length > 0) {
            var sell_rate = all_stocks[this.code].sgr;
            this.dtbtable.appendChild(utils.createHeaders('sell', '份额', '最低成交价'));
            var dpall = utils.getIdsPortionMoreThan(buy_table, sell_rate, 0);
            this.dtbtable.appendChild(this.createBuyRow('全部', dpall, false));
            var dp1 = utils.getIdsPortionMoreThan(buy_table, sell_rate, 1);
            this.dtbtable.appendChild(this.createBuyRow('>1天', dp1, false));
            var latestVal = null;
            if (stockRtData[this.code] && stockRtData[this.code].rtprice) {
                latestVal = stockRtData[this.code].rtprice;
            };
            if (latestVal) {
                var dp_short = utils.getShortTermIdsPortionMoreThan(buy_table, latestVal, sell_rate);
                if (dp_short.portion <= dp1.portion && dp_short.portion > 0) {
                    this.dtbtable.appendChild(this.createBuyRow('>' + sell_rate * 100 + '%', dp_short, true));
                };
            };
        };
        if (buy_table && buy_table.length == 0 && all_stocks[this.code].ptn == 0) {
            this.showForgetButton();
        };

        stockHub.chartWrapper.show();
    }

    showForgetButton() {
        if (this.forgetBtn) {
            this.forgetBtn.style.display = 'block';
        };
    }

    refreshHoldDetail() {
        if (!all_stocks[this.code].buy_table) {
            trade.fetchBuyData(this.code, function(c){
                stockHub.updateStockSummary(c);
            });
        };
        if (!all_stocks[this.code].sell_table) {
            trade.fetchSellData(this.code, function(c){
                stockHub.updateStockSummary(c);
            });
        };
        rtHelper.fetchStockRtData(function() {
            stockHub.refreshEarned();
            stockHub.reloadAllStocks();
        });
    }
}

class StockHub {
    constructor() {
        this.container = null;
        this.topContainer = null;
        this.stockSummaryList = [];
    }

    initialize() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
        this.topContainer = document.getElementById('top_container');
        var aCandidate = document.createElement('a');
        aCandidate.textContent = '查看所有';
        aCandidate.href = 'javascript:stockHub.showCandidateStocksPage()';
        this.topContainer.appendChild(aCandidate);
        var topDiv = document.createElement('div');
        topDiv.appendChild(document.createTextNode('总成本:'));
        this.totalCost = document.createTextNode('');
        topDiv.appendChild(this.totalCost);
        topDiv.appendChild(document.createTextNode('总收益:'));
        this.totalEarned = document.createElement('label');
        topDiv.appendChild(this.totalEarned);
        this.totalPercent = document.createElement('label');
        topDiv.appendChild(this.totalPercent);
        this.container.appendChild(topDiv);

        var aStats = document.createElement('a');
        aStats.textContent = '详细统计表';
        aStats.href = 'javascript:stockHub.showStockStats()';
        this.container.appendChild(aStats);

        this.stockListTable = document.createElement('table');
        this.stockListTable.appendChild(document.createElement('hr'));
        this.container.appendChild(this.stockListTable);
        trade.fetchStockSummary(null, function(c) {
            rtHelper.fetchStockRtDataActually(function() {
                stockHub.refreshEarned();
                stockHub.reloadAllStocks();
            });
        });
        this.chartWrapper = new ChartWrapper(this.container);
        this.chartWrapper.initialize();
        this.chartWrapper.hide();
        this.createBuyNewArea();
    }

    createBuyNewArea() {
        var buyNewArea = document.createElement('div');
        this.container.appendChild(buyNewArea);
        buyNewArea.appendChild(document.createTextNode('新买入'));
        buyNewArea.appendChild(document.createElement('br'));

        var buyNewDate = document.createElement('input');
        buyNewDate.type = 'date';
        buyNewDate.value = utils.getTodayDate();
        buyNewArea.appendChild(buyNewDate);

        var buyNewCode = document.createElement('input');
        buyNewCode.placeholder = '股票代码';
        buyNewArea.appendChild(buyNewCode);

        var buyNewShare = document.createElement('input');
        buyNewShare.placeholder = '买入份额';
        buyNewArea.appendChild(buyNewShare);

        var buyNewPrice = document.createElement('input');
        buyNewPrice.placeholder = '成交价';
        buyNewArea.appendChild(buyNewPrice);

        var buyNewBtn = document.createElement('button');
        buyNewBtn.textContent = '确定';
        buyNewBtn.onclick = function(){
            trade.buyStock(buyNewDate.value, buyNewCode.value, parseFloat(buyNewPrice.value), parseInt(buyNewShare.value), null, function(){
                trade.fetchStockSummary(null, function(c){
                    if (c) {
                        stockHub.updateStockSummary(c);
                    } else {
                        stockHub.reloadAllStocks();
                    }
                });
            });
            buyNewShare.value = '';
            buyNewPrice.value = '';
            buyNewCode.value = '';
        };
        buyNewArea.appendChild(buyNewBtn);
    }

    toggleStockDetails(code) {
        for(var i in this.stockSummaryList) {
            if (this.stockSummaryList[i].code == code) {
                this.stockSummaryList[i].toggleDetails();
            } else {
                this.stockSummaryList[i].collapseDetails();
            }
        }
    }

    updateStockSummary(code) {
        var stockSummary = this.stockSummaryList.find(function(s){
            return s.code == code;
        });
        if (!stockSummary) {
            stockSummary = new StockSummay(code);
            stockSummary.initialize(function(){
                stockHub.toggleStockDetails(code);
            });
            var cell = document.createElement('td');
            cell.appendChild(stockSummary.container);
            var row = document.createElement('tr');
            row.appendChild(cell);
            this.stockListTable.appendChild(row);
            this.stockSummaryList.push(stockSummary);
        };

        stockSummary.update();
        var sum_cost = 0, sum_earned = 0;
        for (var c in all_stocks) {
            sum_cost += all_stocks[c].cost;
            sum_earned += all_stocks[c].earned;
        };

        this.totalCost.textContent = parseFloat(sum_cost.toFixed(2));
        this.totalEarned.textContent = parseFloat(sum_earned.toFixed(2));
        this.totalEarned.className = utils.incdec_lbl_classname(sum_earned);
        this.totalPercent.textContent = parseFloat((100 * sum_earned / sum_cost).toFixed(2)) + '%';
        this.totalPercent.className = utils.incdec_lbl_classname(sum_earned);
    }

    reloadAllStocks() {
        var code_cost = [];
        for(var c in all_stocks) {
            code_cost.push([c, all_stocks[c].cost]);
        }
        code_cost.sort(function(f, s) {
            return s[1] - f[1];
        });
        for (var i in code_cost) {
            this.updateStockSummary(code_cost[i][0]);
        };
    }

    refreshEarned() {
        for (var c in all_stocks) {
            all_stocks[c].earned = (stockRtData[c].rtprice - all_stocks[c].avp) * all_stocks[c].ptn;
        };
    }

    hide() {
        this.container.style.display = 'none';
    }

    show() {
        this.container.style.display = 'block';
    }

    showStockDetailPage(code) {
        if (!code) {
            return;
        };

        if (!this.detailPage) {
            this.detailPage = new StockDetail();
            this.detailPage.createStockDetailFramework();
        };
        this.hide();
        this.detailPage.container.style.display = 'block';
        this.detailPage.container.scrollIntoView();
        this.detailPage.code = code;
        this.detailPage.setDetailPageName();
        this.detailPage.navUl.firstChild.click();
    }

    showStockStats() {
        if (!this.stockStats) {
            this.stockStats = new StockStats();
            this.stockStats.createStatsPage();
            this.stockStats.getStockStats();
        };

        this.hide();
        this.stockStats.container.style.display = 'block';
    }

    showCandidateStocksPage() {
        if (!this.stkCandidatePage) {
            this.stkCandidatePage = new ETF_Frame();
            this.stkCandidatePage.createPage();
            this.stkCandidatePage.getAllCandidateStocks();
        };
        this.hide();
        this.stkCandidatePage.container.style.display = 'block';
    }
}

var stockHub = new StockHub();