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
    detailpage.switchContentTo(detailpage.navDiv.firstChild);
    detailpage.showSingleBuyTable(detailpage.navDiv.firstChild.bindContent);
}

function BackToList() {
    detailpage.container.style.display = 'none';
    document.getElementById('funds_list_container').style.display = 'block';
}

class FundDetail {
    constructor(container) {
        this.container = container;
        this.code = null;
        this.navDiv = null;
        this.contentDiv = null;
        this.buytable_code = null;
        this.selltable_code = null;
    }

    createFundDetailFramework() {
        this.navDiv = document.createElement("div");
        this.contentDiv = document.createElement("div");
        this.container.appendChild(this.navDiv);
        this.container.appendChild(this.contentDiv);
    
        var showBuyTableBtn = document.createElement("button");
        showBuyTableBtn.textContent = "买入记录";
        showBuyTableBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleBuyTable(e.target.bindContent);
        }
        this.navDiv.appendChild(showBuyTableBtn);
        var buyTable = document.createElement("table");
        showBuyTableBtn.bindContent = buyTable;
        this.contentDiv.appendChild(buyTable);

        var showBuyTableBtn = document.createElement("button");
        showBuyTableBtn.textContent = "卖出记录";
        showBuyTableBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleSellTable(e.target.bindContent);
        }
        this.navDiv.appendChild(showBuyTableBtn);
        var sellTable = document.createElement("table");
        showBuyTableBtn.bindContent = sellTable;
        this.contentDiv.appendChild(sellTable);

        var showTotalChartBtn = document.createElement("button");
        showTotalChartBtn.textContent = "累计收益";
        showTotalChartBtn.onclick = function(e) {
            detailpage.switchContentTo(e.target);
            detailpage.showSingleTotalEarned(e.target.bindContent);
        }
        this.navDiv.appendChild(showTotalChartBtn);
    
        var totalEarnedChart = document.createElement("div");
        showTotalChartBtn.bindContent = totalEarnedChart;
        this.contentDiv.appendChild(totalEarnedChart);
    }

    switchContentTo(t) {
        var sibling = t.parentElement.firstChild;
        while (sibling != null) {
            if (sibling != t) {
                sibling.bindContent.style.display = "none";
            };
            sibling = sibling.nextElementSibling;
        }
        t.bindContent.style.display = "block";
    }

    showSingleBuyTable(buyTable) {
        if (this.buytable_code == null && this.code == null) {
            return;
        };
        if (this.buytable_code == this.code) {
            return;
        };
        utils.deleteAllRows(buyTable);
        this.buytable_code = this.code;
        if (!this.code || ftjson[this.code].buy_table === undefined) {
            return;
        };
        buyTable.appendChild(utils.createSplitLine(3));
        buyTable.appendChild(utils.createHeaders('买入日期', '金额', '净值'))
        var buyrecs = ftjson[this.code].buy_table;
        for (var i = 0; i < buyrecs.length; i++) {
            if (buyrecs[i].sold == 0) {
                buyTable.appendChild(utils.createColsRow(utils.date_by_delta(buyrecs[i].date), buyrecs[i].cost, buyrecs[i].nv));
            };
        };
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
        }
    }
    
    createActualSoldCell(acs) {
        var actual_sold_cell = document.createElement('div');
        var acsNode = document.createTextNode(acs);
        var edit_btn = document.createElement("button");
        edit_btn.textContent = '修改';
        var edit_box = document.createElement('input');
        edit_box.style.maxWidth = '80px';
        edit_box.style.display = 'none';
        edit_btn.onclick = function(e) {
            detailpage.editActualSold(e.target.parentElement);
        }
        actual_sold_cell.appendChild(acsNode);
        actual_sold_cell.appendChild(edit_box);
        actual_sold_cell.appendChild(edit_btn);
        return actual_sold_cell
    }
    
    createRollinCell(to_rollin) {
        if (to_rollin == 0) {
            return 0;
        }
        
        var rollinBox = document.createElement('div');
        var deleteBtn = document.createElement("button");
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = function(e) {
            e.target.parentElement.innerText = 0;
        }
        
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
        if (!this.code || ftjson[this.code].sell_table === undefined) {
            return;
        };
        
        sellTable.appendChild(utils.createSplitLine(5));
        sellTable.appendChild(utils.createHeaders('卖出日期','成本', '金额', '实收', '剩余成本'));
        var sellrecs = ftjson[this.code].sell_table;
        for (var i = 0; i < sellrecs.length; i++) {
            var actual_sold_cell = this.createActualSoldCell(sellrecs[i].acs);
            var rollin_cell = this.createRollinCell(sellrecs[i].tri);
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
            this.chart = new EarnedChart(this.code, totalChart);
        }
        this.chart.drawChart();
    }
};

class EarnedChart {
    constructor(code, chart_div) {
        this.code = code;
        this.chart = new google.visualization.LineChart(chart_div);
        this.data = null;
    }

    createChartOption() {
        this.options = {
            title: ftjson[this.code].name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
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
                    targetAxisIndex: 0,
                    pointSize: 1
                },
                1: {
                    targetAxisIndex: 1,
                    lineWidth: 1
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

        var rows = [];
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
    }

    drawChart() {
        this.createDataTable();
        this.createChartOption();

        if (this.data) {
            this.chart.draw(this.data, this.options);
        };
    }

    clearChart() {
        this.chart.draw(null, null);
    }
};

var detailpage = null;
