function showFundDetailPage (code) {
    if (!code) {
        return;
    };

    if (!detailpage) {
        detailpage = new FundDetail();
        detailpage.createFundDetailFramework();
    };
    fundSummary.hide();
    detailpage.container.style.display = 'block';
    detailpage.container.scrollIntoView();
    detailpage.code = code;
    detailpage.setDetailPageFundName();
    detailpage.navUl.firstChild.click();
}

class FundDetail {
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
            detailpage.switchContentTo(e.target);
            if (typeof(cb) === 'function') {
                cb(e.target.bindContent);
            };
        }
        this.navUl.appendChild(navBtn);
        var cDiv = document.createElement("div");
        navBtn.bindContent = cDiv;
        this.contentDiv.appendChild(cDiv);
    }

    createFundDetailFramework() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:detailpage.backToList()';
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
        
        this.addNav('概况', function(c) {
            detailpage.showBasicInfo(c);
        });
    
        this.addNav('买入记录', function(c){
            if (!detailpage.buydetail) {
                detailpage.buydetail = new FundBuyDetail(c);
            };
            detailpage.buydetail.showSingleBuyTable();
        });

        this.addNav('卖出记录', function(c){
            if (!detailpage.selldetail) {
                detailpage.selldetail = new FundSellDetail(c);
            };
            detailpage.selldetail.showSingleSellDetails();
        });

        this.addNav('累计收益', function(c){
            detailpage.showSingleTotalEarned(c);
        });
    }

    backToList() {
        detailpage.container.style.display = 'none';
        fundSummary.show();
        document.getElementById('fund_header_' + this.code).scrollIntoView();
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

    setDetailPageFundName() {
        this.nameDiv.innerText = ftjson[this.code].name;
    }
    
    setTrackingIndex(trackDiv) {
        var queries = new FormData();
        queries.append("code", this.code);
        queries.append("action", "trackindex");
        var trackInput = trackDiv.getElementsByTagName('input')[0];
        queries.append("trackcode", trackInput.value);

        utils.post('fundmisc', queries, function(){
            request.fetchFundSummary(detailpage.code, function(){
                detailpage.showTrackingInfo(trackDiv);
            });
        });
    }
    
    enableEditTrackingIndex(trackDiv) {
        utils.removeAllChild(trackDiv);
        trackDiv.appendChild(document.createTextNode('请输入指数代码：'));
        var trackInput = document.createElement('input');
        var setTrackBtn = document.createElement('button');
        setTrackBtn.textContent = '确定';
        setTrackBtn.onclick = function(e) {
            detailpage.setTrackingIndex(e.target.parentElement);
        }
        trackDiv.appendChild(trackInput);
        trackDiv.appendChild(setTrackBtn);
    }
    
    showTrackingInfo(trackDiv) {
        utils.removeAllChild(trackDiv);
        trackDiv.appendChild(document.createTextNode('跟踪指数: '));
        trackDiv.fundcode = this.code;
        if (ftjson[this.code].ic) {
            trackDiv.appendChild(document.createTextNode(ftjson[this.code].in));
        }
        var trackEdit = document.createElement('button');
        trackEdit.textContent = ftjson[this.code].ic ? '更改' : '设置';
        trackEdit.onclick = function(e) {
            utils.get('fundmisc', 'action=trackindex&code=' + e.target.parentElement.fundcode, function(rsp){
                detailpage.enableEditTrackingIndex(e.target.parentElement);
            });
        }
        trackDiv.appendChild(trackEdit);
    }
    
    showBasicInfo(basicDiv) {
        if (this.basic_code == null && this.code == null) {
            return;
        };

        if (this.basic_code == this.code) {
            return;
        };

        if (!ftjson || !all_hist_data || all_hist_data.length == 0) {
            return;
        };
        
        this.basic_code = this.code;
        if (this.code && ftjson[this.code]) {
            if (!this.trackDiv) {
                this.trackDiv = document.createElement('div');
                basicDiv.appendChild(this.trackDiv);
            };
            this.showTrackingInfo(this.trackDiv);

            if (this.historyChart) {
                if (this.historyChart.code == this.code) {
                    return;
                }
                this.historyChart.clearChart();
            }
        };
        
        if (this.code && all_hist_data[0].indexOf(this.code) != -1) {
            if (this.historyChart) {
                this.historyChart.code = this.code;
            } else {
                var chart_div = document.createElement('div');
                basicDiv.appendChild(chart_div);
                this.historyChart = new HistoryStatisticChart(this.code, chart_div);
            }
            this.historyChart.drawChart();
        }
    }

    showSingleTotalEarned(totalChart) {
        if (this.chart == null && this.code == null) {
            return;
        };

        if (this.chart != null) {
            if (this.chart.code == this.code) {
                return;
            }
            this.chart.clearChart();
        };

        if (this.code == null || ftjson[this.code].buy_table === undefined) {
            return;
        };

        if (this.chart) {
            this.chart.code = this.code;
        } else {
            var chart_div = document.createElement('div');
            chart_div.style.marginTop = '5px';
            totalChart.appendChild(chart_div);
            var chart_cost_div = document.createElement('div');
            chart_cost_div.style.marginTop = '5px';
            totalChart.appendChild(chart_cost_div);
            this.chart = new EarnedChart(this.code, chart_div, chart_cost_div);
        }
        this.chart.drawChart();
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
        
        portion = utils.convertPortionToGram(portion, ftjson[this.code].ppg);
        
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
            request.sellFund(this.code, sellDatePicker.value, sellContent.value, function(){
                request.fetchBuyData(detailpage.code, function(){
                    detailpage.buydetail.updateSingleBuyTable();                    
                });
            });
        }
    }

    updateSingleBuyTable() {
        utils.removeAllChild(this.container);
        this.code = detailpage.code;
        if (!detailpage.code || ftjson[detailpage.code].buy_table === undefined) {
            return;
        };
        
        this.radioBar = new RadioAnchorBar('卖出');
        this.radioBar.addRadio('按日期', function(){
            detailpage.buydetail.sortBuyTable(true);
        });
        this.radioBar.addRadio('按净值', function(){
            detailpage.buydetail.sortBuyTable(false);
        });

        this.container.appendChild(this.radioBar.container);
        
        var checkAll = document.createElement('input');
        checkAll.type = 'checkbox';
        checkAll.value = 'detail_buy_row_' + this.code;
        checkAll.onclick = function(e) {
            document.getElementsByName(e.target.value).forEach(function(c){
                c.checked = e.target.checked;
            });
            detailpage.buydetail.buyDateCheckClicked(e.target.value);
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
 
        var buyrecs = ftjson[detailpage.code].buy_table;
        var sum_cost = 0;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                var checkDate = document.createElement('input');
                checkDate.type = 'checkbox';
                checkDate.name = 'detail_buy_row_' + this.code;
                checkDate.value = buyrecs[i].ptn;
                checkDate.checked = false;
                checkDate.onclick = function(e) {
                    detailpage.buydetail.buyDateCheckClicked(e.target.name);
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
        sellContent.id = 'detail_sell_div_' + detailpage.code;
        sellPanel.appendChild(sellContent);
        var sellDatepicker = document.createElement('input');
        sellDatepicker.type = 'date';
        sellDatepicker.id = 'detail_sell_datepick_' + detailpage.code;
        sellDatepicker.value = utils.getTodayDate();
        sellPanel.appendChild(sellDatepicker);
        var sellBtn = document.createElement('button');
        sellBtn.textContent = '卖出';
        sellBtn.id = 'detail_sell_btn_' + detailpage.code;
        sellBtn.onclick = function(e) {
            detailpage.buydetail.onSellBtnClicked();
        }
        sellPanel.appendChild(sellBtn);
        
        this.container.appendChild(sellPanel);
    }

    showSingleBuyTable() {
        if (this.code == null && detailpage.code == null) {
            return;
        };
        if (this.code == detailpage.code) {
            return;
        };
        
        this.updateSingleBuyTable();
    }
}

class FundSellDetail {
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
                var sell_table = ftjson[fundcode].sell_table;
                if (sell_table) {
                    var daysince2000 = utils.days_since_2000(date);
                    var sellrec = sell_table.find(function(curVal){
                        return curVal.date == daysince2000;
                    });
                    if (sellrec) {
                        sellrec.acs = acs;
                    };
                    detailpage.selldetail.reloadSingleSellTable();
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
            edit_btn.href = 'javascript:detailpage.selldetail.editActualSold("' + editId + '")';
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
            var sell_table = ftjson[detailpage.selldetail.code].sell_table;
            if (sell_table) {
                var daysince2000 = utils.days_since_2000(date);
                var sellrec = sell_table.find(function(curVal){
                    return curVal.date == daysince2000;
                });
                if (sellrec) {
                    sellrec.tri = 0;
                };
                detailpage.selldetail.reloadSingleSellTable();
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
        deleteBtn.href = 'javascript:detailpage.selldetail.deleteRollin("' + deleteId + '")';
        
        rollinBox.id = deleteId;
        rollinBox.setAttribute('date', selldate);
        rollinBox.setAttribute('cost', cost);
        rollinBox.appendChild(document.createTextNode(to_rollin));
        rollinBox.appendChild(deleteBtn);
        return rollinBox;
    }

    reloadSingleSellTable() {
        if (!detailpage.code) {
            return;
        };

        if (!ftjson[detailpage.code].sell_table) {
            request.fetchSellData(detailpage.code, function(){
                detailpage.selldetail.reloadSingleSellTable();
            });
            return;
        };

        this.code = detailpage.code;
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
        var sellrecs = ftjson[this.code].sell_table;
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
                detailpage.selldetail.showBonusArea();
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
                detailpage.selldetail.onAddBonusClicked(bonusDatepicker, bonusInput);
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
                detailpage.selldetail.updateSingleSellDetails();
            });
        });
    }

    updateSingleSellDetails() {
        utils.removeAllChild(this.container);
        if (!detailpage.code) {
            return;
        };

        this.reloadSingleSellTable();
        this.reloadBonusArea();
    }

    showSingleSellDetails() {
        if (this.code == null && detailpage.code == null) {
            return;
        };
        if (this.code == detailpage.code) {
            return;
        };

        this.updateSingleSellDetails();
    }
}

class EarnedChart {
    constructor(code, chart_div, chart_cost_div) {
        this.code = code;
        this.chart = new google.visualization.LineChart(chart_div);
        this.chart_cost = new google.visualization.LineChart(chart_cost_div);
    }

    createChartOption() {
        this.options = {
            title: ftjson[this.code].name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                },
                1: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    targetAxisIndex: 1
                }
            }
        };
    }

    createDataTable() {
        if (all_hist_data.length < 1) {
            return;
        };

        var buytable = ftjson[this.code]? ftjson[this.code].buy_table : null;
        if (!buytable) {
            return;
        };

        var minDate = buytable[0].date;
        for (var i = 1; i < buytable.length; i++) {
            if (buytable[i].date < minDate) {
                minDate = buytable[i].date;
            }
        };

        var fundDateIdx = 0;
        var startDateIdx = all_hist_data.findIndex(function(curVal) {
            return curVal[fundDateIdx] == minDate;
        });

        var data = new google.visualization.DataTable();
        data.addColumn('string', '日期');
        data.addColumn('number', '累计收益');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addColumn('number', '理论收益率');
        data.addColumn({type: 'string', role: 'tooltip'});
        
        var data_cost = new google.visualization.DataTable();
        data_cost.addColumn('string', '日期');
        data_cost.addColumn('number', '持有成本');

        var rows = [];
        var rows_cost = [];
        var len = all_hist_data.length;
        var valIdx = all_hist_data[0].indexOf(this.code) * 2 - 1;
        var grIdx = valIdx + 1;
        var fixedMoney = 0;
        var earned = 0;
        var portion = 0;
        var fixedVal = 0;
        var cost = 0;
        var days = 0;
        var costAll = 0;
        for (var i = startDateIdx; i < len; i++) {
            var date = all_hist_data[i][0];
            var strDate = utils.date_by_delta(date)
            var r = [strDate];
            var r2 = [strDate];

            earned += fixedMoney * (parseFloat(all_hist_data[i][grIdx]))/100;
            fixedMoney = fixedMoney * (100 + parseFloat(all_hist_data[i][grIdx]))/100;
            var buyrec = buytable.find(function(curVal){
                return curVal.date == date;
            });
            if (buyrec) {
                portion += buyrec.ptn;
                cost += buyrec.cost;
                var buyFee = buyrec.cost - buyrec.ptn * all_hist_data[i][valIdx];
                fixedMoney += buyrec.cost - buyFee;
                earned -= buyFee;
            };
            r.push(earned);

            var selltable = ftjson[this.code]? ftjson[this.code].sell_table : null;
            if (selltable) {
                var sellrec = selltable.find(function(curVal){
                    return curVal.date == date;
                });
                if (sellrec) {
                    portion -= sellrec.ptn;
                    cost -= sellrec.cost;
                    fixedMoney -= sellrec.ptn * all_hist_data[i][valIdx];
                };
            };
            r2.push(cost);
            rows_cost.push(r2);
            
            days++;
            costAll += cost;
            var tooltip = strDate + "\n累计收益: " + earned.toFixed(2);
            tooltip += "\n平均成本: " + (costAll / days).toFixed(2);
            tooltip += "\n平均收益率: " + (100 * earned * days / costAll).toFixed(2) + "%";
            r.push(tooltip);

            var newVal = fixedVal * (100 + parseFloat(all_hist_data[i][grIdx]))/100;
            if (fixedVal == 0) {
                fixedVal = all_hist_data[startDateIdx][valIdx];
                newVal = fixedVal;
            };

            r.push(newVal);
            r.push(strDate + ":" + (100* (newVal - all_hist_data[startDateIdx][valIdx]) /all_hist_data[startDateIdx][valIdx]).toFixed(2) + "%");
            fixedVal = newVal;

            rows.push(r);
        };

        data.addRows(rows);
        this.data = data;
        data_cost.addRows(rows_cost);
        this.data_cost = data_cost;
    }

    drawChart() {
        this.createDataTable();
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
        if (this.data_cost) {
            this.chart_cost.draw(this.data_cost, this.options);
        }
    }

    clearChart() {
        if (this.chart) {
            this.chart.draw(null, null);
        }
        if (this.chart_cost) {
            this.chart_cost.draw(null, null);
        }
    }
};

class HistoryStatisticChart {
    constructor(code, chart_div) {
        this.code = code;
        var nv_div = document.createElement('div');
        chart_div.appendChild(nv_div);
        var gr_div = document.createElement('div');
        this.grTable = document.createElement('table');
        var gr_chart = document.createElement('div');
        this.strDiv = document.createElement('div');
        gr_div.appendChild(this.grTable);
        gr_div.appendChild(gr_chart);
        gr_div.appendChild(this.strDiv);
        chart_div.appendChild(gr_div);
        this.nvChart = new google.visualization.Histogram(nv_div);
        this.grChart = new google.visualization.Histogram(gr_chart);
    }

    createDataTable() {
        var valIdx = all_hist_data[0].indexOf(this.code) * 2 - 1;
        var startIdx = 1;
        for (var i = 1; i < all_hist_data.length; ++i) {
            var val = all_hist_data[i][valIdx];
            if (val != '') {
                startIdx = i;
                break;
            }
        }
        var vals = [];
        var grs = [];
        for (var i = startIdx; i <  all_hist_data.length; ++i) {
            var val = parseFloat(all_hist_data[i][valIdx]);
            if (!Number.isNaN(val)) {
                vals.push(val);
            }
            var gr = parseFloat(all_hist_data[i][valIdx + 1]);
            if (Number.isNaN(gr)) {
                gr = 0;
            }
            grs.push(gr);
        }
        vals.sort(function(l,g) {
            return l - g;
        });
        grs.sort(function(l,g) {
            return l - g;
        });

        this.grTable.appendChild(utils.createColsRow('', grs[0] + '%', grs[grs.length - 1] + '%'));
        var min1Val = grs[Math.round(grs.length*0.005)];
        var max1Val = grs[grs.length - 1 - Math.round(grs.length*0.005)];
        this.grTable.appendChild(utils.createColsRow('99%', ' (' + min1Val + '%, ', max1Val + '%)'));
        var min5Val = grs[Math.round(grs.length*0.025)];
        var max5Val = grs[grs.length - 1 - Math.round(grs.length*0.025)];
        this.grTable.appendChild(utils.createColsRow('95%', ' (' + min5Val + '%, ', max5Val + '%)'));
        var min10Val = grs[Math.round(grs.length*0.05)];
        var max10Val = grs[grs.length - 1 - Math.round(grs.length*0.05)];
        this.grTable.appendChild(utils.createColsRow('90%', ' (' + min10Val + '%, ', max10Val + '%)'));
        var min20Val = grs[Math.round(grs.length*0.1)];
        var max20Val = grs[grs.length - 1 - Math.round(grs.length*0.1)];
        this.grTable.appendChild(utils.createColsRow('80%', ' (' + min20Val + '%, ', max20Val + '%)'));
        var min40Val = grs[Math.round(grs.length*0.2)];
        var max40Val = grs[grs.length - 1 - Math.round(grs.length*0.2)];
        this.grTable.appendChild(utils.createColsRow('60%', ' (' + min40Val + '%, ', max40Val + '%)'));

        this.showShortTermRateInfo(grs[grs.length - 1] - grs[0] >= 10 ? max10Val: max5Val);
        this.nvData = this.createSingleDataTable(vals);
        this.grData = this.createSingleDataTable(grs);
    }
    
    createSingleDataTable(vals) {
        var data = new google.visualization.DataTable();
        data.addColumn('number');

        var rows = [];
        for (var i = 0; i < vals.length; i++) {
            rows.push( [vals[i]]);
        };
        data.addRows(rows);
        return data;
    }
    
    showShortTermRateInfo(srate) {
        utils.removeAllChild(this.strDiv);
        this.strDiv.appendChild(document.createTextNode('预期收益率: '));
        var strInput = document.createElement('input');
        strInput.style.maxWidth = '55px';
        strInput.value = srate;
        this.strDiv.appendChild(strInput);
        this.strDiv.appendChild(document.createTextNode('%.'));
        var strBtn = document.createElement('button');
        strBtn.textContent = '确认修改';
        this.strDiv.appendChild(strBtn);
    }

    createChartOption(charName, bsize) {
        return {
            title: charName,
            legend: { position: 'none' },
            histogram: {
                bucketSize: bsize,
                maxNumBuckets: 200,
                hideBucketItems: true,
                lastBucketPercentile: 2
            },
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            width: '100%'
        };
    }
    
    drawChart() {
        this.createDataTable();

        if (this.nvData) {
            this.nvChart.draw(this.nvData, this.createChartOption('净值分布', 0.01));
        };
        if (this.grData) {
            this.grChart.draw(this.grData, this.createChartOption('日涨幅分布(%)',0.1));
        };
    }
    
    clearChart() {
        if (this.nvChart) {
            this.nvChart.draw(null, null);
        };
        if (this.grChart) {
            this.grChart.draw(null, null);
        };
        if (this.grTable) {
            utils.deleteAllRows(this.grTable);
        };
    }
};

var detailpage = null;
