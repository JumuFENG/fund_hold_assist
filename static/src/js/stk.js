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
    }

    toggleDetails() {
        if (this.detail.style.display == "none") {
            this.detail.style.display = 'block';
            this.refreshHoldDetail();
            stockHub.chartWrapper.setParent(this.detail, this.dtrtable, this.dtbtable);
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

        this.updateRollinTable();
        this.updateBuyTable();
        stockHub.chartWrapper.tradeOption.updateTradePanel();
    }

    updateRollinTable() {
        if (!this.dtrtable) {
            return;
        };

        utils.deleteAllRows(this.dtrtable);
        var sell_table = all_stocks[this.code].sell_table;
        if (sell_table && sell_table.length > 0) {
            this.dtrtable.appendChild(utils.createHeaders('roll in', '份额', '最高成交价'));
            for (var i = 0; i < sell_table.length; i++) {
                var checkDate = document.createElement('input');
                checkDate.type = 'checkbox';
                checkDate.name = 'to_rollin_check_' + this.code;
                checkDate.value = sell_table[i].id;
                checkDate.checked = false;
                var checkDiv = document.createElement('div');
                checkDiv.appendChild(checkDate);
                checkDiv.appendChild(document.createTextNode(utils.date_by_delta(sell_table[i].date)));
                this.dtrtable.appendChild(utils.createColsRow(checkDiv, sell_table[i].ptn, sell_table[i].price));
            };
        };
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
            this.dtbtable.appendChild(utils.createHeaders('sell', '份额', '最低成交价'));
            var dpall = utils.getIdsPortionMoreThan(buy_table, all_stocks[this.code].str, 0);
            this.dtbtable.appendChild(this.createBuyRow('全部', dpall, false));
            var dp1 = utils.getIdsPortionMoreThan(buy_table, all_stocks[this.code].str, 1);
            this.dtbtable.appendChild(this.createBuyRow('>1天', dp1, false));
            var latestVal = null;
            if (stockRtData[this.code] && stockRtData[this.code].rtprice) {
                latestVal = stockRtData[this.code].rtprice;
            };
            if (latestVal) {
                var dp_short = utils.getShortTermIdsPortionMoreThan(buy_table, latestVal, all_stocks[this.code].str);
                if (dp_short.portion <= dp1.portion && dp_short.portion > 0) {
                    this.dtbtable.appendChild(this.createBuyRow('>' + all_stocks[this.code].str * 100 + '%', dp_short, true));
                };
            };
        };
        stockHub.chartWrapper.show();
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
        this.stockListTable = document.createElement('table');
        this.stockListTable.appendChild(document.createElement('hr'));
        this.container.appendChild(this.stockListTable);
        trade.fetchStockSummary(null, function(c) {
            rtHelper.fetchStockRtDataActually(function() {
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
    }

    reloadAllStocks() {
        for(var c in all_stocks) {
            this.updateStockSummary(c);
        }
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
}

var stockHub = new StockHub();