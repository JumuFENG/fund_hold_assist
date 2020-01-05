function showFundDetailPage (detailparent) {
    if (detailparent.className != "hold_detail") {
        return;
    };

    if (!detailpage) {
        detailpage = new FundDetail(document.getElementById('fund_single_detail_container'));
        detailpage.createFundDetailFramework();
    };
    document.getElementById('funds_list_container').style.display = 'none';
    detailpage.container.style.display = 'block';
    detailpage.code = detailparent.id.split("_").pop();
    detailpage.navUl.firstChild.click();
}

function BackToList() {
    detailpage.container.style.display = 'none';
    document.getElementById('funds_list_container').style.display = 'block';
}

class FundDetail {
    constructor(container) {
        this.container = container;
        this.code = null;
        this.navUl = null;
        this.contentDiv = null;
        this.basic_code = null;
        this.buytable_code = null;
        this.selltable_code = null;
    }

    createFundDetailFramework() {
        this.navUl = document.createElement("ul");
        this.navUl.id = 'detailnav';
        var navDiv = document.createElement('div');
        navDiv.appendChild(this.navUl);
        this.contentDiv = document.createElement("div");
        this.container.appendChild(navDiv);
        this.container.appendChild(document.createElement("br"));
        this.container.appendChild(document.createElement("hr"));
        this.container.appendChild(this.contentDiv);
        
        var fundbasicBtn = document.createElement("li");
        fundbasicBtn.textContent = "概况";
        fundbasicBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showBasicInfo(e.target.bindContent);
        }
        this.navUl.appendChild(fundbasicBtn);
        var basicDiv = document.createElement("div");
        fundbasicBtn.bindContent = basicDiv;
        this.contentDiv.appendChild(basicDiv);
    
        var showBuyTableBtn = document.createElement("li");
        showBuyTableBtn.textContent = "买入记录";
        showBuyTableBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleBuyTable(e.target.bindContent);
        }
        this.navUl.appendChild(showBuyTableBtn);
        var buyDiv = document.createElement("div");
        showBuyTableBtn.bindContent = buyDiv;
        this.contentDiv.appendChild(buyDiv);

        var showSellTableBtn = document.createElement("li");
        showSellTableBtn.textContent = "卖出记录";
        showSellTableBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleSellTable(e.target.bindContent);
        }
        this.navUl.appendChild(showSellTableBtn);
        var sellTable = document.createElement("table");
        showSellTableBtn.bindContent = sellTable;
        this.contentDiv.appendChild(sellTable);

        var showTotalChartBtn = document.createElement("li");
        showTotalChartBtn.textContent = "累计收益";
        showTotalChartBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleTotalEarned(e.target.bindContent);
        }
        this.navUl.appendChild(showTotalChartBtn);
    
        var totalEarnedChart = document.createElement("div");
        showTotalChartBtn.bindContent = totalEarnedChart;
        this.contentDiv.appendChild(totalEarnedChart);
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
    
    setTrackingIndex(trackDiv) {
        var trackInput = trackDiv.getElementsByTagName('input')[0];

        var httpRequest = new XMLHttpRequest();
        httpRequest.open('POST', '../../fundmisc', true);
        var request = new FormData();
        request.append("code", this.code);
        request.append("action", "trackindex");
        request.append("trackcode", trackInput.value);
        httpRequest.send(request);

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                detailpage.showTrackingInfo(trackDiv);
            }
        }
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
        trackDiv.appendChild(document.createTextNode(ftjson[this.code].name ));
        trackDiv.appendChild(document.createElement('br'));
        trackDiv.appendChild(document.createTextNode('跟踪指数: '));
        trackDiv.fundcode = this.code;
        if (ftjson[this.code].ic) {
            trackDiv.appendChild(document.createTextNode(ftjson[this.code].in));
        }
        var trackEdit = document.createElement('button');
        trackEdit.textContent = ftjson[this.code].ic ? '更改' : '设置';
        trackEdit.onclick = function(e) {
            var httpRequest = new XMLHttpRequest();
            httpRequest.open('GET', '../../fundmisc?action=trackindex&code=' + e.target.parentElement.fundcode, true);
            httpRequest.send();

            httpRequest.onreadystatechange = function () {
                if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                    detailpage.enableEditTrackingIndex(e.target.parentElement);
                }
            }
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
    
    sellByDateClicked(buyTable) {
        utils.deleteAllRows(buyTable);
        var checkAll = document.createElement('input');
        checkAll.type = 'checkbox';
        checkAll.value = 'detail_buy_row_' + this.code;
        checkAll.onclick = function(e) {
            document.getElementsByName(e.target.value).forEach(function(c){
                c.checked = e.target.checked;
            });
            detailpage.buyDateCheckClicked(e.target.value);
        }
        var checkAllDiv = document.createElement('div');
        checkAllDiv.appendChild(checkAll);
        checkAllDiv.appendChild(document.createTextNode('全选'));
        buyTable.appendChild(utils.createHeaders(checkAllDiv, '金额', '净值'));
        var buyrecs = ftjson[this.code].buy_table;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                var checkDate = document.createElement('input');
                checkDate.type = 'checkbox';
                checkDate.name = 'detail_buy_row_' + this.code;
                checkDate.value = buyrecs[i].ptn;
                checkDate.checked = false;
                checkDate.onclick = function(e) {
                    detailpage.buyDateCheckClicked(e.target.name);
                }
                var checkDiv = document.createElement('div');
                checkDiv.appendChild(checkDate);
                checkDiv.appendChild(document.createTextNode(utils.date_by_delta(buyrecs[i].date)));
                
                buyTable.appendChild(utils.createColsRow(checkDiv, buyrecs[i].cost, buyrecs[i].nv ? buyrecs[i].nv : 'null'));
            };
        };
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
            sellFund(this.code, sellDatePicker.value, sellContent.value);
        }
    }

    showSingleBuyTable(buyDiv) {
        if (this.buytable_code == null && this.code == null) {
            return;
        };
        if (this.buytable_code == this.code) {
            return;
        };
        
        utils.removeAllChild(buyDiv);
        this.buytable_code = this.code;
        if (!this.code || ftjson[this.code].buy_table === undefined) {
            return;
        };
        
        var sellByDateBtn = document.createElement('button');
        sellByDateBtn.textContent = '按日期卖出';
        sellByDateBtn.onclick = function(e) {
            var buyTable = e.target.parentElement.getElementsByTagName('table')[0];
            detailpage.sellByDateClicked(buyTable);
        }
        
        buyDiv.appendChild(sellByDateBtn);
        
        var buyTable = document.createElement('table');
        buyTable.appendChild(utils.createHeaders('买入日期', '金额', '净值'));
        var buyrecs = ftjson[this.code].buy_table;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                buyTable.appendChild(utils.createColsRow(utils.date_by_delta(buyrecs[i].date), buyrecs[i].cost, buyrecs[i].nv));
            };
        };
        
        buyDiv.appendChild(buyTable);
        
        var sellPanel = document.createElement('div');
        var sellContent = document.createElement('div');
        sellContent.id = 'detail_sell_div_' + this.code;
        sellPanel.appendChild(sellContent);
        var sellDatepicker = document.createElement('input');
        sellDatepicker.type = 'date';
        sellDatepicker.id = 'detail_sell_datepick_' + this.code;
        sellDatepicker.value = utils.getTodayDate();
        sellPanel.appendChild(sellDatepicker);
        var sellBtn = document.createElement('button');
        sellBtn.textContent = '卖出';
        sellBtn.id = 'detail_sell_btn_' + this.code;
        sellBtn.onclick = function(e) {
            detailpage.onSellBtnClicked();
        }
        sellPanel.appendChild(sellBtn);
        
        buyDiv.appendChild(sellPanel);
    }

    editActualSold(actualBox) {
        var textNode = actualBox.firstChild;
        var editBox = actualBox.getElementsByTagName('input')[0];
        var editBtn = actualBox.getElementsByTagName('button')[0];
        if (editBox.style.display == 'none') {
            editBox.value = textNode.textContent;
            editBox.style.display = 'inline';
            textNode.textContent = '';
            editBtn.textContent = '确定';
        } else {
            editBox.style.display = 'none';
            textNode.textContent = editBox.value;
            editBtn.textContent = '修改';
            var httpRequest = new XMLHttpRequest();
            httpRequest.open('POST', '../../fundsell', true);
            var request = new FormData();
            request.append("code", this.code);
            request.append("date", actualBox.getAttribute('date'));
            request.append("action", 'setsold');
            request.append('actual_sold', editBox.value)
            httpRequest.send(request);
        }
    }
    
    createActualSoldCell(acs, selldate) {
        var actual_sold_cell = document.createElement('div');
        var acsNode = document.createTextNode(acs);
        actual_sold_cell.appendChild(acsNode);
        if (acs == 0) {
            var edit_btn = document.createElement("button");
            edit_btn.textContent = '修改';
            var edit_box = document.createElement('input');
            edit_box.style.maxWidth = '80px';
            edit_box.style.display = 'none';
            edit_btn.onclick = function(e) {
                detailpage.editActualSold(e.target.parentElement);
            }
            actual_sold_cell.appendChild(edit_box);
            actual_sold_cell.appendChild(edit_btn);
        }
        actual_sold_cell.setAttribute('date', selldate);
        return actual_sold_cell
    }
    
    deleteRollin(rollinBox) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('POST', '../../fundsell', true);
        var request = new FormData();
        request.append("code", this.code);
        request.append("date", rollinBox.getAttribute('date'));
        request.append("action", 'fixrollin');
        request.append('rolledin', rollinBox.getAttribute('cost'))
        httpRequest.send(request);
        rollinBox.innerText = 0;
    }
    
    createRollinCell(to_rollin, cost, selldate) {
        if (to_rollin == 0) {
            return 0;
        }
        
        var rollinBox = document.createElement('div');
        var deleteBtn = document.createElement("button");
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = function(e) {
            detailpage.deleteRollin(e.target.parentElement);
        }
        
        rollinBox.setAttribute('date', selldate);
        rollinBox.setAttribute('cost', cost);
        rollinBox.appendChild(document.createTextNode(to_rollin));
        rollinBox.appendChild(deleteBtn);
        return rollinBox;
    }
    
    showSingleSellTable(sellTable) {
        if (this.selltable_code == null && this.code == null) {
            return;
        };
        if (this.selltable_code == this.code) {
            return;
        };
        utils.deleteAllRows(sellTable);
        this.selltable_code = this.code;
        if (!this.code || !ftjson[this.code].sell_table) {
            return;
        };
        
        sellTable.appendChild(utils.createHeaders('卖出日期','成本', '金额', '实收', '剩余成本'));
        var sellrecs = ftjson[this.code].sell_table;
        for (var i = 0; i < sellrecs.length; i++) {
            var selldate = utils.date_by_delta(sellrecs[i].date);
            var actual_sold_cell = this.createActualSoldCell(sellrecs[i].acs, selldate);
            var rollin_cell = this.createRollinCell(sellrecs[i].tri, sellrecs[i].cost, selldate);
            sellTable.appendChild(utils.createColsRow(utils.date_by_delta(sellrecs[i].date), sellrecs[i].cost, sellrecs[i].ms, actual_sold_cell, rollin_cell));
        };
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
        chart_div.appendChild(gr_div);
        this.nvChart = new google.visualization.Histogram(nv_div); //new google.charts.Bar(nv_div);
        this.grChart = new google.visualization.Histogram(gr_div);
    }

    createChartOption(charName, bsize) {
        return {
            title: charName,
            legend: { position: 'none' },
            histogram: {
                bucketSize: bsize,
                maxNumBuckets: 200,
                lastBucketPercentile: 2
            },
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            width: '100%'
        };
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
    }
};

var detailpage = null;
