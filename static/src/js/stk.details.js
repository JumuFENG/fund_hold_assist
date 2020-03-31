class StockDetail {
    constructor() {
        this.container = null;
        this.code = null;
        this.navUl = null;
        this.contentDiv = null;
        this.basic_code = null;
    }

    addNav(text, cb) {
        var navBtn = document.createElement("li");
        navBtn.textContent = text;
        navBtn.onclick = function(e) {
            stockHub.detailPage.switchContentTo(e.target);
            if (typeof(cb) === 'function') {
                cb(e.target.bindContent);
            };
        }
        this.navUl.appendChild(navBtn);
        var cDiv = document.createElement("div");
        navBtn.bindContent = cDiv;
        this.contentDiv.appendChild(cDiv);
    }

    createStockDetailFramework() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:stockHub.detailPage.backToList()';
        this.container.appendChild(backLink);
        
        this.nameDiv = document.createElement('div');
        this.navUl = document.createElement("ul");
        this.navUl.id = 'detailnav';
        var navDiv = document.createElement('div');
        navDiv.appendChild(this.navUl);
        this.contentDiv = document.createElement("div");
        this.container.appendChild(this.nameDiv);
        this.container.appendChild(navDiv);
        this.container.appendChild(document.createElement("br"));
        this.container.appendChild(document.createElement("hr"));
        this.container.appendChild(this.contentDiv);
        
        this.addNav('买入记录', function(c){
            if (!stockHub.detailPage.buydetail) {
                stockHub.detailPage.buydetail = new StockBuyDetail(c);
            };
            stockHub.detailPage.buydetail.showSingleBuyTable();
        });

        this.addNav('卖出记录', function(c){
            if (!stockHub.detailPage.selldetail) {
                stockHub.detailPage.selldetail = new StockSellDetail(c);
            };
            stockHub.detailPage.selldetail.showSingleSellDetails();
        });
    }

    backToList() {
        this.container.style.display = 'none';
        stockHub.show();
    }

    switchContentTo(t) {
        var sibling = t.parentElement.firstChild;
        t.className = 'highlight';
        while (sibling != null) {
            if (sibling != t) {
                sibling.bindContent.style.display = "none";
                sibling.className = '';
            };
            sibling = sibling.nextElementSibling;
        }
        t.bindContent.style.display = "block";
    }

    setDetailPageName() {
        this.nameDiv.innerText = all_stocks[this.code].name;
    }
};

class StockBuyDetail {
    constructor(buy_detail_div) {
        this.container = buy_detail_div;
        this.code = null;
        this.radioBar = null;
        this.buyTable = null;
    }

    checkRowsIncreasing(ar, n, s = 0, aend = 0) {
        var e = aend == 0 ? ar.length - 1 : aend;
        if (s > e) {
            return false;
        };

        for (var i = s; i < e; i++) {
            var txtn = ar[i].getElementsByTagName("TD")[n].innerText;
            var txtn1 = ar[i+1].getElementsByTagName("TD")[n].innerText;
            if (n == 0) {
                if (txtn > txtn1) {
                    return false;
                };
            } else {
                if (Number(txtn) > Number(txtn1)) {
                    return false;
                };                
            }
        }
        return true;
    }

    sortBuyTable(colId) {
        if (this.buyTable.sortById === undefined) {
            this.buyTable.sortById = 0;
        };

        if (this.buyTable.sortById == colId) {
            return;
        };

        this.buyTable.sortById = colId;

        var n = colId;
        var table = this.buyTable;
        var decsort = false;
        if (this.checkRowsIncreasing(table.rows, n, 1, table.rows.length - 2)) {
            return;
        }

        for (var i = 2; i < table.rows.length - 1; i++) {
            var txtX = table.rows[i].getElementsByTagName("TD")[n].innerText
            var numX = n == 0 ? txtX : Number(txtX);
            var shouldSwitch = false;
            var j = 1;
            for (; j < i; j++) {
                var txtY = table.rows[j].getElementsByTagName("TD")[n].innerText
                var numY = n == 0 ? txtY : Number(txtY);
                if (numX <= numY) {
                    shouldSwitch = true;
                    break;
                };
            }

            if (shouldSwitch) {
                table.rows[i].parentNode.insertBefore(table.rows[i], table.rows[j]);
            };
        }
    }
    
    buyDateCheckClicked(checkname) {
        var checkedboxes = document.getElementsByName(checkname);
        var portion = 0;
        var cost = 0;
        var ids = [];
        var days = 0;
        checkedboxes.forEach(function(d){
            if (d.checked) {
                portion += parseFloat(d.value);
                cost += parseFloat(d.cost);
                ids.push(d.index);
                days ++;
            }
        });

        var sellBtn = document.getElementById('detail_sell_btn_' + this.code);
        sellBtn.style.display = Number.isNaN(portion) ? 'none' : 'inline';
        var sellInfo = '' + days + '项, 共：' + portion + '份';
        var aver = portion > 0 ? cost / portion : 0;
        if (aver > 0) {
            sellInfo += '均价:' + parseFloat(aver.toFixed(4));
        };
        var suggestPrice = 0;
        if (aver > 0) {
            suggestPrice = aver * (1 + all_stocks[this.code].str);
            sellInfo += '建议售出价:' + parseFloat(suggestPrice.toFixed(4));
        };

        var sellContent = document.getElementById('detail_sell_div_' + this.code);
        sellContent.textContent = sellInfo;
        sellContent.value = ids.join('_');
    }
    
    onSellBtnClicked() {
        var sellContent = document.getElementById('detail_sell_div_' + this.code);
        var sellDatePicker = document.getElementById('detail_sell_datepick_' + this.code);
        var sellPrice = document.getElementById('detail_sell_price_' + this.code);
        var price = parseFloat(sellPrice.value);
        if (sellContent.value != '' && price > 0) {
            trade.sellStock(sellDatePicker.value, this.code, price, sellContent.value, function(){
                trade.fetchStockSummary(stockHub.detailPage.code, function() {
                    trade.fetchBuyData(stockHub.detailPage.code, function(c) {
                        stockHub.updateStockSummary(c);
                        stockHub.detailPage.buydetail.updateSingleBuyTable();
                    });
                    trade.fetchSellData(stockHub.detailPage.code);
                });
            });
        }
    }

    updateSingleBuyTable() {
        utils.removeAllChild(this.container);
        this.code = stockHub.detailPage.code;
        if (!stockHub.detailPage.code || all_stocks[stockHub.detailPage.code].buy_table === undefined) {
            return;
        };
        
        this.radioBar = new RadioAnchorBar('卖出');
        this.radioBar.addRadio('按日期', function(){
            stockHub.detailPage.buydetail.sortBuyTable(0);
        });
        this.radioBar.addRadio('按顺序', function(){
            stockHub.detailPage.buydetail.sortBuyTable(1);
        });
        this.radioBar.addRadio('按份额', function(){
            stockHub.detailPage.buydetail.sortBuyTable(2);
        });
        this.radioBar.addRadio('按成交价', function(){
            stockHub.detailPage.buydetail.sortBuyTable(4);
        });

        this.container.appendChild(this.radioBar.container);
        
        var checkAll = document.createElement('input');
        checkAll.type = 'checkbox';
        checkAll.value = 'detail_buy_row_' + this.code;
        checkAll.onclick = function(e) {
            document.getElementsByName(e.target.value).forEach(function(c){
                c.checked = e.target.checked;
            });
            stockHub.detailPage.buydetail.buyDateCheckClicked(e.target.value);
        }
        var checkAllDiv = document.createElement('div');
        checkAllDiv.appendChild(checkAll);
        checkAllDiv.appendChild(document.createTextNode('全选'));

        if (this.buyTable) {
            utils.deleteAllRows(this.buyTable);
        } else {
            this.buyTable = document.createElement('table');
        }

        this.container.appendChild(this.buyTable);
        this.buyTable.appendChild(utils.createHeaders(checkAllDiv, '序号', '份额', '金额', '成交价', ''));
 
        var buyrecs = all_stocks[stockHub.detailPage.code].buy_table;
        var sum_cost = 0;
        var sum_portion = 0;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                var checkDate = document.createElement('input');
                checkDate.type = 'checkbox';
                checkDate.name = 'detail_buy_row_' + this.code;
                checkDate.value = buyrecs[i].ptn;
                checkDate.index = buyrecs[i].id;
                checkDate.cost = buyrecs[i].cost;
                checkDate.checked = false;
                checkDate.onclick = function(e) {
                    stockHub.detailPage.buydetail.buyDateCheckClicked(e.target.name);
                }
                var checkDiv = document.createElement('div');
                checkDiv.appendChild(checkDate);
                checkDiv.appendChild(document.createTextNode(utils.date_by_delta(buyrecs[i].date)));

                var portion_cell = new EditableCell(buyrecs[i].ptn);
                var price_cell = new EditableCell(buyrecs[i].price);
                var op_cell = document.createElement('button');
                op_cell.textContent = '修改';
                op_cell.bindPortion = portion_cell;
                op_cell.bindPrice = price_cell;
                op_cell.bindId = buyrecs[i].id;
                op_cell.onclick = function(e) {
                    if (e.target.textContent == '修改') {
                        e.target.bindPortion.edit();
                        e.target.bindPrice.edit();
                        e.target.textContent = '确定';
                    } else {
                        e.target.bindPortion.readonly();
                        e.target.bindPrice.readonly();
                        if (e.target.bindPortion.textChanged() || e.target.bindPrice.textChanged()) {
                            trade.fixBuyRec(stockHub.detailPage.buydetail.code, e.target.bindId, e.target.bindPortion.text(), e.target.bindPrice.text(), function() {
                                stockHub.detailPage.buydetail.updateSingleBuyTable();
                            });
                        };
                        e.target.textContent = '修改';
                    }
                }
                this.buyTable.appendChild(utils.createColsRow(checkDiv, buyrecs[i].id, portion_cell.container, buyrecs[i].cost, buyrecs[i].price ? price_cell.container : 'null', op_cell));
                sum_cost += buyrecs[i].cost;
                sum_portion += buyrecs[i].ptn;
            };
        };

        if (buyrecs.length > 0) {
            this.buyTable.appendChild(utils.createColsRow('总计', '', sum_portion, sum_cost, parseFloat((sum_cost/sum_portion).toFixed(4))));
        };
        this.radioBar.selectDefault();
        
        var sellPanel = document.createElement('div');
        var sellContent = document.createElement('div');
        sellContent.id = 'detail_sell_div_' + stockHub.detailPage.code;
        sellPanel.appendChild(sellContent);
        var sellDatepicker = document.createElement('input');
        sellDatepicker.type = 'date';
        sellDatepicker.id = 'detail_sell_datepick_' + stockHub.detailPage.code;
        sellDatepicker.value = utils.getTodayDate();
        sellPanel.appendChild(sellDatepicker);
        var sellPrice = document.createElement('input');
        sellPrice.id = 'detail_sell_price_' + this.code;
        sellPrice.placeholder = '成交价';
        sellPrice.onchange = function(e) {
            var btn = document.getElementById('detail_sell_btn_' + stockHub.detailPage.buydetail.code);
            btn.disabled = !(parseFloat(e.target.value) > 0);
        }
        sellPanel.appendChild(sellPrice);
        var sellBtn = document.createElement('button');
        sellBtn.textContent = '卖出';
        sellBtn.id = 'detail_sell_btn_' + this.code;
        sellBtn.disabled = true;
        sellBtn.onclick = function(e) {
            stockHub.detailPage.buydetail.onSellBtnClicked();
        }
        sellPanel.appendChild(sellBtn);
        
        this.container.appendChild(sellPanel);
    }

    showSingleBuyTable() {
        if (this.code == null && stockHub.detailPage.code == null) {
            return;
        };
        if (this.code == stockHub.detailPage.code) {
            return;
        };
        
        this.updateSingleBuyTable();
    }
}

class StockSellDetail {
    constructor(sell_detail_div) {
        this.container = sell_detail_div;
        this.code = null;
        this.sellTable = null;
        this.bonusContainer = null;
        this.bonusArea = null;
    }

    deleteRollin(deleteId) {
        var rollinBox = document.getElementById(deleteId);
        var queries = new FormData();
        var index = rollinBox.getAttribute('index');
        queries.append("code", this.code);
        queries.append("id", index);
        queries.append("act", 'fixrollin');
        queries.append('rolledin', rollinBox.getAttribute('total'));
        utils.post('stock', queries, function(){
            trade.fetchSellData(stockHub.detailPage.selldetail.code, function(){
                stockHub.updateStockSummary();
                stockHub.detailPage.selldetail.updateSingleSellDetails();
            });
        });
    }
    
    createRollinCell(to_rollin, total, val) {
        if (to_rollin == 0) {
            return 0;
        }
        
        var rollinBox = document.createElement('div');
        var deleteBtn = document.createElement("a");
        deleteBtn.textContent = '删除';
        var deleteId = 'delete_rollin_' + this.code + '_' + val;
        deleteBtn.href = 'javascript:stockHub.detailPage.selldetail.deleteRollin("' + deleteId + '")';
        
        rollinBox.id = deleteId;
        rollinBox.setAttribute('index', val);
        rollinBox.setAttribute('total', total);
        rollinBox.appendChild(document.createTextNode(to_rollin));
        rollinBox.appendChild(deleteBtn);
        return rollinBox;
    }

    reloadSingleSellTable() {
        if (!stockHub.detailPage.code) {
            return;
        };

        if (!all_stocks[stockHub.detailPage.code].sell_table) {
            request.fetchSellData(stockHub.detailPage.code, function(){
                stockHub.detailPage.selldetail.reloadSingleSellTable();
            });
            return;
        };

        this.code = stockHub.detailPage.code;
        if (this.sellTable) {
            utils.deleteAllRows(this.sellTable);
        } else {
            this.sellTable = document.createElement('table');
        };
        this.container.appendChild(this.sellTable);
        if (this.bonusContainer) {
            this.container.appendChild(this.bonusContainer);
        };
        
        this.sellTable.appendChild(utils.createHeaders('卖出日期', '序号', '成本', '份额', '成交价', '收益', '剩余份额', ''));
        var sellrecs = all_stocks[this.code].sell_table;
        var sum_cost = 0, sum_portion = 0, sum_earned = 0;
        for (var i = 0; i < sellrecs.length; i++) {
            sum_cost += sellrecs[i].cost;
            sum_portion += sellrecs[i].ptn;
            var earned = parseFloat((sellrecs[i].ptn * sellrecs[i].price - sellrecs[i].cost).toFixed(3));
            sum_earned += earned;
            var selldate = utils.date_by_delta(sellrecs[i].date);
            var portion_cell = new EditableCell(sellrecs[i].ptn);
            var price_cell = new EditableCell(sellrecs[i].price);
            var rollin_cell = this.createRollinCell(sellrecs[i].tri, sellrecs[i].ptn, sellrecs[i].id);
            var op_cell = document.createElement('button');
            op_cell.textContent = '修改';
            op_cell.bindPortion = portion_cell;
            op_cell.bindPrice = price_cell;
            op_cell.bindId = sellrecs[i].id;
            op_cell.onclick = function(e) {
                if (e.target.textContent == '修改') {
                    e.target.bindPortion.edit();
                    e.target.bindPrice.edit();
                    e.target.textContent = '确定';
                } else {
                    e.target.bindPortion.readonly();
                    e.target.bindPrice.readonly();
                    if (e.target.bindPortion.textChanged() || e.target.bindPrice.textChanged()) {
                        trade.fixSellRec(stockHub.detailPage.selldetail.code, e.target.bindId, e.target.bindPortion.text(), e.target.bindPrice.text(), function() {
                            stockHub.detailPage.selldetail.updateSingleSellDetails();
                        });
                    };
                    e.target.textContent = '修改';
                }
            }
            this.sellTable.appendChild(utils.createColsRow(utils.date_by_delta(sellrecs[i].date), sellrecs[i].id, sellrecs[i].cost, sellrecs[i].ptn == 0 ? '分红' : portion_cell.container, price_cell.container, earned, rollin_cell, op_cell));
        };
        if (sellrecs.length > 0) {
            this.sellTable.appendChild(utils.createColsRow('总计', '', sum_cost, sum_portion, parseFloat((sum_cost/sum_portion).toFixed(4)), sum_earned, '', ''));
        };
    }

    reloadBonusArea() {
        if (!this.bonusContainer) {
            var addBonusBtn = document.createElement('button');
            addBonusBtn.textContent = '添加分红';
            addBonusBtn.onclick = function(e) {
                stockHub.detailPage.selldetail.showBonusArea();
            }
            this.bonusContainer = document.createElement('div');
            this.bonusContainer.appendChild(addBonusBtn);

            var bonusDatepicker = document.createElement('input');
            bonusDatepicker.type = 'date';
            bonusDatepicker.value = utils.getTodayDate();
            var bonusInput = document.createElement('input');
            bonusInput.style.maxWidth = '80px';
            var confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'OK';
            confirmBtn.onclick = function(e) {
                stockHub.detailPage.selldetail.onAddBonusClicked(bonusDatepicker, bonusInput);
            }

            this.bonusArea = document.createElement('div');
            this.bonusArea.appendChild(bonusDatepicker);
            this.bonusArea.appendChild(bonusInput);
            this.bonusArea.appendChild(confirmBtn);
            this.bonusContainer.appendChild(this.bonusArea);
        };

        this.bonusArea.style.display = 'none';
        this.container.appendChild(this.bonusContainer);
    }

    showBonusArea() {
        if (this.bonusArea) {
            this.bonusArea.style.display = 'block';
        };
    }

    onAddBonusClicked(dpicker, bonusInput) {
        var queries = new FormData();
        var fundcode = this.code;
        queries.append("code", fundcode);
        queries.append("date", dpicker.value);
        queries.append("action", 'divident');
        queries.append('bonus', bonusInput.value);
        alert('not implemented!');
        return;
        utils.post('fundsell', queries, function(){
            request.fetchSellData(fundcode, function(){
                stockHub.detailPage.selldetail.updateSingleSellDetails();
            });
        });
    }

    updateSingleSellDetails() {
        utils.removeAllChild(this.container);
        if (!stockHub.detailPage.code) {
            return;
        };

        this.reloadSingleSellTable();
        this.reloadBonusArea();
    }

    showSingleSellDetails() {
        if (this.code == null && stockHub.detailPage.code == null) {
            return;
        };
        if (this.code == stockHub.detailPage.code) {
            return;
        };

        this.updateSingleSellDetails();
    }
}
