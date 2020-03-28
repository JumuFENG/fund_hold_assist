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

class FundBuyDetail {
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

    sortBuyTable(byDate) {
        if (this.buyTable.sortByDate === undefined) {
            this.buyTable.sortByDate = false;
        };

        if (this.buyTable.sortByDate == byDate) {
            return;
        };

        this.buyTable.sortByDate = !this.buyTable.sortByDate;

        var n = 0;
        if (!byDate) {
            n = 2;
        };

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
        var dates = '';
        var days = 0;
        checkedboxes.forEach(function(d){
            if (d.checked) {
                portion += parseFloat(d.value);
                dates += d.nextSibling.data;
                days ++;
            }
        });

        var sellBtn = document.getElementById('detail_sell_btn_' + this.code);
        sellBtn.style.display = Number.isNaN(portion) ? 'none' : 'inline';
        var sellContent = document.getElementById('detail_sell_div_' + this.code);
        sellContent.textContent = '' + days + '天, 共：' + portion.toFixed(4);
        sellContent.value = dates;
    }
    
    onSellBtnClicked() {
        var sellContent = document.getElementById('detail_sell_div_' + this.code);
        var sellDatePicker = document.getElementById('detail_sell_datepick_' + this.code);
        if (sellContent.value != '') {
            trade.sellStock(this.code, sellDatePicker.value, sellContent.value, function(){
                trade.fetchBuyData(stockHub.detailPage.code, function(){
                    stockHub.detailPage.buydetail.updateSingleBuyTable();                    
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
            stockHub.detailPage.buydetail.sortBuyTable(true);
        });
        this.radioBar.addRadio('按净值', function(){
            stockHub.detailPage.buydetail.sortBuyTable(false);
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
        this.buyTable.appendChild(utils.createHeaders(checkAllDiv, '金额', '净值'));
 
        var buyrecs = all_stocks[stockHub.detailPage.code].buy_table;
        var sum_cost = 0;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                var checkDate = document.createElement('input');
                checkDate.type = 'checkbox';
                checkDate.name = 'detail_buy_row_' + this.code;
                checkDate.value = buyrecs[i].ptn;
                checkDate.checked = false;
                checkDate.onclick = function(e) {
                    stockHub.detailPage.buydetail.buyDateCheckClicked(e.target.name);
                }
                var checkDiv = document.createElement('div');
                checkDiv.appendChild(checkDate);
                checkDiv.appendChild(document.createTextNode(utils.date_by_delta(buyrecs[i].date)));

                this.buyTable.appendChild(utils.createColsRow(checkDiv, buyrecs[i].cost, buyrecs[i].nv ? buyrecs[i].nv : 'null'));
                sum_cost += buyrecs[i].cost;
            };
        };

        this.buyTable.appendChild(utils.createColsRow('总计', sum_cost, ''));
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
        var sellBtn = document.createElement('button');
        sellBtn.textContent = '卖出';
        sellBtn.id = 'detail_sell_btn_' + stockHub.detailPage.code;
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

    editActualSold(editId) {
        var actualBox = document.getElementById(editId);
        var textNode = actualBox.firstChild;
        var editBox = actualBox.getElementsByTagName('input')[0];
        var editBtn = actualBox.getElementsByTagName('a')[0];
        if (editBox.style.display == 'none') {
            editBox.value = textNode.textContent;
            editBox.style.display = 'inline';
            textNode.textContent = '';
            editBtn.textContent = '确定';
        } else {
            editBox.style.display = 'none';
            textNode.textContent = editBox.value;
            editBtn.textContent = '修改';
            var queries = new FormData();
            var fundcode = this.code;
            var date = actualBox.getAttribute('date');
            var acs = editBox.value;
            queries.append("code", fundcode);
            queries.append("date", date);
            queries.append("action", 'setsold');
            queries.append('actual_sold', acs);
            utils.post('fundsell', queries, function(){
                var sell_table = all_stocks[fundcode].sell_table;
                if (sell_table) {
                    var daysince2000 = utils.days_since_2000(date);
                    var sellrec = sell_table.find(function(curVal){
                        return curVal.date == daysince2000;
                    });
                    if (sellrec) {
                        sellrec.acs = acs;
                    };
                    stockHub.detailPage.selldetail.reloadSingleSellTable();
                };
            });
        }
    }
    
    createActualSoldCell(acs, selldate) {
        var actual_sold_cell = document.createElement('div');
        var acsNode = document.createTextNode(acs);
        actual_sold_cell.appendChild(acsNode);
        if (acs == 0) {
            var edit_btn = document.createElement("a");
            edit_btn.textContent = '修改';
            var editId = 'actual_sold_' + this.code + '_' + selldate;
            edit_btn.href = 'javascript:stockHub.detailPage.selldetail.editActualSold("' + editId + '")';
            var edit_box = document.createElement('input');
            edit_box.style.maxWidth = '80px';
            edit_box.style.display = 'none';
            actual_sold_cell.id = editId;
            actual_sold_cell.appendChild(edit_box);
            actual_sold_cell.appendChild(edit_btn);
        }
        actual_sold_cell.setAttribute('date', selldate);
        return actual_sold_cell
    }
    
    deleteRollin(deleteId) {
        var rollinBox = document.getElementById(deleteId);
        var queries = new FormData();
        var date = rollinBox.getAttribute('date');
        queries.append("code", this.code);
        queries.append("date", date);
        queries.append("action", 'fixrollin');
        queries.append('rolledin', rollinBox.getAttribute('cost'));
        utils.post('fundsell', queries, function(){
            var sell_table = all_stocks[stockHub.detailPage.selldetail.code].sell_table;
            if (sell_table) {
                var daysince2000 = utils.days_since_2000(date);
                var sellrec = sell_table.find(function(curVal){
                    return curVal.date == daysince2000;
                });
                if (sellrec) {
                    sellrec.tri = 0;
                };
                stockHub.detailPage.selldetail.reloadSingleSellTable();
            };
        });

        rollinBox.innerText = 0;
    }
    
    createRollinCell(to_rollin, cost, selldate) {
        if (to_rollin == 0) {
            return 0;
        }
        
        var rollinBox = document.createElement('div');
        var deleteBtn = document.createElement("a");
        deleteBtn.textContent = '删除';
        var deleteId = 'delete_rollin_' + this.code + '_' + selldate;
        deleteBtn.href = 'javascript:stockHub.detailPage.selldetail.deleteRollin("' + deleteId + '")';
        
        rollinBox.id = deleteId;
        rollinBox.setAttribute('date', selldate);
        rollinBox.setAttribute('cost', cost);
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
        
        this.sellTable.appendChild(utils.createHeaders('卖出日期','成本', '金额', '实收', '剩余成本'));
        var sellrecs = all_stocks[this.code].sell_table;
        var sum_cost = 0, sum_ms = 0, sum_acs = 0;
        for (var i = 0; i < sellrecs.length; i++) {
            sum_cost += sellrecs[i].cost;
            sum_ms += sellrecs[i].ms;
            sum_acs += parseFloat(sellrecs[i].acs);
            var selldate = utils.date_by_delta(sellrecs[i].date);
            var actual_sold_cell = this.createActualSoldCell(sellrecs[i].acs, selldate);
            var rollin_cell = this.createRollinCell(sellrecs[i].tri, sellrecs[i].cost, selldate);
            this.sellTable.appendChild(utils.createColsRow(utils.date_by_delta(sellrecs[i].date), sellrecs[i].cost == 0 ? '分红' : sellrecs[i].cost, sellrecs[i].ms, actual_sold_cell, rollin_cell));
        };
        this.sellTable.appendChild(utils.createColsRow('总计', sum_cost, sum_ms.toFixed(2), sum_acs.toFixed(2), '实收' + (sum_acs - sum_cost).toFixed(2)));
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
