let ExtensionLoadedEvent = "ExtensionLoaded";
let CodeToFetchEvent = 'FundCodeToFetch';
let RealtimeInfoFetchedEvent = "FundGzReturned";
let extensionLoaded = false;

window.onload = function() {
    if (!fundSummary) {
        fundSummary = new FundSummary();
        fundSummary.createSummaryFramework();
        ftjson['sz000001'] = {
            name: "上证指数",
            hideTrade: true
        };
    };

    fundSummary.showAllFundList();
}

document.addEventListener(ExtensionLoadedEvent, e => {
    utils.logInfo("Extension loaded");
    extensionLoaded = true;
});

document.addEventListener(RealtimeInfoFetchedEvent, e => {
    utils.logInfo(e.detail);
    eval(e.detail);
});

function ForceFetchAll() {
    for (var fcode in ftjson){
        sendFetchEventActually(fcode);
    }
}

function sendFetchEventActually(fundcode) {
    if (extensionLoaded) {
        let selectedCodeEvt = new CustomEvent(CodeToFetchEvent, {
            detail: {
                code: fundcode
            }
        });
        document.dispatchEvent(selectedCodeEvt);
    }
    else {
        var req = encodeURIComponent('http://fundgz.1234567.com.cn/js/' + fundcode + '.js?rt=' + (new Date()).getTime());
        utils.get('api/get', 'url=' + req, function(rsp){
            eval(rsp);
        });
    }
}

function sendFetchEvent(fundcode) {
    var nowDate=new Date();
    var day_of_week = nowDate.getDay();
    if (day_of_week < 1 || day_of_week > 5) {
        return;
    };
    var hour_of_day = nowDate.getHours();
    if (hour_of_day < 9 || hour_of_day > 16) {
        return;
    };
    sendFetchEventActually(fundcode);
}

class TradeOption {
    constructor(tdiv) {
        this.tradeDiv = tdiv;
        this.tradeOptBar = null;
        this.tradeType = null;
        this.datePicker = null;
        this.costInput = null;
        this.submitBtn = null;
    }

    show() {
        this.tradeDiv.style.display = 'block';
    }

    hide() {
        this.tradeDiv.style.display = 'none';
    }

    createTradeOptions() {
        this.tradeOptBar = new RadioAnchorBar();
        this.tradeOptBar.addRadio('买入', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Buy);
        });
        this.tradeOptBar.addRadio('卖出', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Sell);
        });
        this.tradeOptBar.addRadio('加预算', function(){
            fundSummary.chartWrapper.tradeOption.setTradeOption(TradeType.Budget);
        });
        this.tradeDiv.appendChild(this.tradeOptBar.container);

        var tradePanel = document.createElement('div');
        this.tradeDiv.appendChild(tradePanel);
        this.datePicker = document.createElement('input');
        this.datePicker.type = 'date';
        this.datePicker.value = utils.getTodayDate();
        tradePanel.appendChild(this.datePicker);
        this.costInput = document.createElement('input');
        this.costInput.placeholder = '金额';
        tradePanel.appendChild(this.costInput);
        this.submitBtn = document.createElement('button');
        this.submitBtn.textContent = '确定';
        this.submitBtn.onclick = function(e) {
            fundSummary.chartWrapper.tradeOption.onSubmitClicked();
        }
        tradePanel.appendChild(this.submitBtn);


        this.tradeOptBar.selectDefault();
    }

    setTradeOption(tradeTp) {
        this.tradeType = tradeTp;
        this.changeTradePanel(tradeTp == TradeType.Sell);
    }

    changeTradePanel(bSell) {
        if (bSell) {
            this.costInput.style.display = "none";
            this.submitBtn.textContent = "卖出";
        } else {
            this.costInput.style.display = "inline";
            this.submitBtn.textContent = "确定";
        }
    }

    onSubmitClicked() {
        var code = fundSummary.chartWrapper.code;
        var date = this.datePicker.value;
        var cost = parseFloat(this.costInput.value);
        if (this.tradeType == TradeType.Budget) {
            request.addBudget(code, date, cost);
        } else if (this.tradeType == TradeType.Sell) {
            var sellRadios = document.getElementsByName("sell_row_" + code);
            var strbuydates = "";
            for (var i = 0; i < sellRadios.length; i++) {
                if (sellRadios[i].checked) {
                    strbuydates = sellRadios[i].value;
                    break;
                }
            };

            if (strbuydates == "") {
                alert("No sell dates selected.");
                return;
            };
            
            request.sellFund(code, date, strbuydates);
        } else {
            var budget_dates = [];
            var budgetRadios = document.getElementsByName("budget_row_" + code);
            for (var i = 0; i < budgetRadios.length; i++) {
                if (budgetRadios[i].checked) {
                    budget_dates.push(budgetRadios[i].value);
                }
            };

            var rollin_date = null;
            var rollinRadios = document.getElementsByName("rollin_row_" + code);
            for (var i = 0; i < rollinRadios.length; i++) {
                if (rollinRadios[i].checked) {
                    rollin_date = rollinRadios[i].value;
                    break;
                }
            };
            request.buyFund(code, date, cost, budget_dates, rollin_date);
        }
    }
}

class ChartWrapper {
    constructor() {
        this.code = null;
        this.chartDiv = null;
        this.daysOpt = null;
        this.tradeOption = null;
    }

    createChartsDiv(parentDiv) {
        if (!parentDiv) {
            return;
        };

        this.chartDiv = document.createElement('div');
        parentDiv.appendChild(this.chartDiv);
        var chartInteraction = document.createElement('div');
        chartInteraction.id = 'chart_interaction';
        var chartSelection = document.createElement('div');
        chartSelection.id = 'chart_selected_data';
        chartInteraction.appendChild(chartSelection);
        this.chartDiv.appendChild(chartInteraction);

        this.daysOpt = new RadioAnchorBar();
        this.chartDiv.appendChild(this.daysOpt.container);
        this.daysOpt.addRadio('默认', function(){
            fundSummary.redrawHistoryGraphs(0);
        });
        this.daysOpt.addRadio('30', function(){
            fundSummary.redrawHistoryGraphs(30);
        });
        this.daysOpt.addRadio('60', function(){
            fundSummary.redrawHistoryGraphs(60);
        });
        this.daysOpt.addRadio('100', function(){
            fundSummary.redrawHistoryGraphs(100);
        });
        this.daysOpt.addRadio('300', function(){
            fundSummary.redrawHistoryGraphs(300);
        });
        this.daysOpt.addRadio('1000', function(){
            fundSummary.redrawHistoryGraphs(1000);
        });
        this.daysOpt.addRadio('最大', function(){
            fundSummary.redrawHistoryGraphs(-1);
        });

        var leftArrowBtn = document.createElement('button');
        leftArrowBtn.id = 'chart_left_arrow';
        leftArrowBtn.textContent = '<-';
        this.daysOpt.container.appendChild(leftArrowBtn);
        var rightArrowBtn = document.createElement('button');
        rightArrowBtn.id = 'chart_right_arrow';
        rightArrowBtn.textContent = '->'
        this.daysOpt.container.appendChild(rightArrowBtn);
        leftArrowBtn.onclick = function(e) {
            LeftShiftGraph(leftArrowBtn, rightArrowBtn);
        }
        rightArrowBtn.onclick = function(e) {
            RightShiftGraph(leftArrowBtn, rightArrowBtn);
        }
        var fundChartDiv = document.createElement('div');
        fundChartDiv.id = 'fund_chart_div';
        this.chartDiv.appendChild(fundChartDiv);

        this.tradeOption = new TradeOption(document.createElement('div'));
        this.tradeOption.createTradeOptions();
        this.chartDiv.appendChild(this.tradeOption.tradeDiv);
    }

    setParent(p) {
        this.chartDiv.parentElement.removeChild(this.chartDiv);
        p.appendChild(this.chartDiv);
    }

    hide() {
        this.chartDiv.style.display = 'none';
    }

    show() {
        this.chartDiv.style.display = 'block';
    }
}

class FundSummary {
    constructor() {
        this.container = null;
        this.fundListTable = null;
        this.summaryHeader = null;
        this.chartWrapper = null;
    }

    updateSummaryHeader(earned, total_earned, cost) {
        if (!this.summaryHeader) {
            return;
        };

        utils.removeAllChild(this.summaryHeader);
        if (earned != 0) {
            this.summaryHeader.appendChild(document.createTextNode('上日总计:'));
            var lastEarned = document.createElement('label');
            lastEarned.textContent = earned.toFixed(2);
            var lbl_class = utils.incdec_lbl_classname(earned);
            lastEarned.className = lbl_class;
            this.summaryHeader.appendChild(lastEarned);

            var lastPercent = document.createElement('label');
            lastPercent.textContent = (100 * earned/cost).toFixed(2) + "%";
            lastPercent.className = lbl_class;
            this.summaryHeader.appendChild(lastPercent);

            this.summaryHeader.appendChild(document.createElement('br'));

            this.summaryHeader.appendChild(document.createTextNode('持有总成本:'));
            var totalCost = document.createElement('label');
            totalCost.textContent = cost;
            this.summaryHeader.appendChild(totalCost);
            
            this.summaryHeader.appendChild(document.createTextNode('收益:'));
            var totalEarned = document.createElement('label');
            totalEarned.textContent = total_earned.toFixed(2);
            var lbl_total_class = utils.incdec_lbl_classname(total_earned);
            totalEarned.className = lbl_total_class;
            this.summaryHeader.appendChild(totalEarned);

            var totalPercent = document.createElement("label");
            totalPercent.textContent = (100 * total_earned / cost).toFixed(2) + "%";
            totalPercent.className = lbl_total_class;
            this.summaryHeader.appendChild(totalPercent);
        };

        var aStats = document.createElement('a');
        aStats.textContent = '详细统计表';
        aStats.href = 'javascript:showFundStats()';
        this.summaryHeader.appendChild(aStats);
    }

    createBuyNewArea(buyNewArea) {
        buyNewArea.appendChild(document.createTextNode('新买基金: '));
        buyNewArea.appendChild(document.createElement('br'));

        var buyNewDate = document.createElement('input');
        buyNewDate.type = 'date';
        buyNewDate.value = utils.getTodayDate();
        buyNewArea.appendChild(buyNewDate);

        var buyNewCode = document.createElement('input');
        buyNewCode.placeholder = '基金代码';
        buyNewArea.appendChild(buyNewCode);

        var buyNewCost = document.createElement('input');
        buyNewCost.placeholder = '金额';
        buyNewArea.appendChild(buyNewCost);

        var buyNewBtn = document.createElement('button');
        buyNewBtn.textContent = '确定';
        buyNewBtn.onclick = function(e) {
            request.buyFund(buyNewCode.value, buyNewDate.value, parseFloat(buyNewCost.value), null, null);
            buyNewCode.value = '';
            buyNewCost.value = '';
        }
        buyNewArea.appendChild(buyNewBtn);
    }

    createSummaryFramework() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        this.summaryHeader = document.createElement('div');
        this.summaryHeader.className = 'total_earned';
        this.container.appendChild(this.summaryHeader);

        this.fundListTable = document.createElement('table');
        var fundlistDiv = document.createElement('div');
        fundlistDiv.appendChild(this.fundListTable);
        this.chartWrapper = new ChartWrapper();
        this.chartWrapper.createChartsDiv(this.fundListTable.parentElement);
        this.chartWrapper.hide();
        this.container.appendChild(fundlistDiv);
        var buyNewArea = document.createElement('div');
        this.createBuyNewArea(buyNewArea);
        this.container.appendChild(buyNewArea);
    }

    hide() {
        this.summaryHeader.style.display = 'none';
        this.fundListTable.style.display = 'none';
    }

    show() {
        this.summaryHeader.style.display = 'block';
        this.fundListTable.style.display = 'block';
    }

    showAllFundList() {
        var earned = 0;
        var total_earned = 0;
        var cost = 0;
        var code_cost = [];
        for (var fcode in ftjson){
            var funddata = ftjson[fcode];
            if (funddata.hideTrade) {
                continue;
            };
            sendFetchEvent(fcode);

            earned += funddata.lde;
            total_earned += funddata.ewh;        
            cost += funddata.cost;
            code_cost.push([fcode, funddata.cost]);
            if (ftjson[fcode].buy_table) {
                ftjson[fcode].holding_aver_cost = utils.getHoldingAverageCost(ftjson[fcode].buy_table);
            };
        }

        this.updateSummaryHeader(earned, total_earned, cost);

        code_cost.sort(function(f, s) {
            return s[1] - f[1];
        });

        if (ftjson['sz000001']) {
            code_cost.push(['sz000001', 0]);
        };

        this.chartWrapper.setParent(this.fundListTable.parentElement);
        utils.deleteAllRows(this.fundListTable);
        for (var i in code_cost) {
            var row = this.createGeneralInfoInSingleRow(code_cost[i][0]);
            this.fundListTable.appendChild(row)
        }
        this.fundListTable.appendChild(utils.createSplitLine());
    }

    createGeneralInfoInSingleRow(code) {
        var funddata = ftjson[code];
        var general_root = document.createElement("div");
        general_root.className = "general_root";
        var fundHeader = document.createElement('div');
        fundHeader.className = 'fund_header';
        fundHeader.id = 'fund_header_' + code;
        fundHeader.onclick = function(e) {
            fundSummary.toggleFundDetails(code);
        }
        general_root.appendChild(fundHeader);
        fundHeader.appendChild(document.createElement('hr'));
        fundHeader.appendChild(document.createTextNode(funddata.name));
        if (!funddata.hideTrade) {
            var ldeLabel = document.createElement('label');
            ldeLabel.className = utils.incdec_lbl_classname(funddata.lde);
            ldeLabel.textContent = funddata.lde;
            fundHeader.appendChild(ldeLabel);
            fundHeader.appendChild(createGuzhiInfo(code));
            fundHeader.appendChild(createEarnedInfo(funddata));
        };
        var hold_detail = document.createElement("div");
        hold_detail.className = "hold_detail";
        hold_detail.id = "hold_detail_" + code;
        hold_detail.style = "display:none;";

        if (!funddata.hideTrade) {
            var detailLnk = document.createElement('a');
            detailLnk.textContent = '详情';
            detailLnk.href = 'javascript:showFundDetailPage("' + code + '")'
            hold_detail.appendChild(detailLnk);
            hold_detail.appendChild(createBudgetsTable(code));
            hold_detail.appendChild(createRollinsTable(code));
            hold_detail.appendChild(createSellInfoTable(code));
        };
        if (funddata.avp == 0 && funddata.cost == 0) {
            var forgetBtn = document.createElement("button");
            forgetBtn.textContent = "不再关注";
            forgetBtn.onclick = function(e) {
                var code = e.target.parentElement.id.split('_').pop();
                request.forget(code);
            }
            hold_detail.appendChild(forgetBtn);
        }

        general_root.appendChild(hold_detail);

        var col = document.createElement("td");
        col.appendChild(general_root)
        var row = document.createElement("tr");
        row.appendChild(col);
        return row;
    }

    toggleFundDetails(code) {
        var divDetail = document.getElementById("hold_detail_" + code);
        if (divDetail.style.display == "none") {
            var code = divDetail.id.split('_').pop();
            if (!ftjson[code].hideTrade) {
                sendFetchEvent(code);
            };
            divDetail.style.display = "block";
            divDetail.parentElement.scrollIntoView();

            var sibling = this.fundListTable.firstChild;
            while (sibling != null) {
                var nextDetail = sibling.firstChild.firstChild;
                if (nextDetail.childNodes.length != 0 && nextDetail.lastChild != divDetail) {
                    nextDetail.lastChild.style.display = "none";
                };
                sibling = sibling.nextElementSibling;
            }

            if (!ftjson[code].hideTrade) {
                refreshHoldDetail(code);
            };

            this.chartWrapper.setParent(divDetail);
            this.chartWrapper.show();
            this.chartWrapper.code = code;
            if (!ftjson[code].hideTrade) {
                this.chartWrapper.tradeOption.show();
            } else {
                this.chartWrapper.tradeOption.hide();
            };
            this.drawFundHistory(this.chartWrapper.code);
        } else {
            divDetail.style.display = "none";
        }
    }

    drawFundHistory(code) {
        document.getElementById("chart_interaction").style.display = "none";
        if (!chart.chartDiv) {
            chart.setChartDiv(document.getElementById('fund_chart_div'));
        };
        chart.fund = new FundLine(code, ftjson[code].name, ftjson[code].ic, ftjson[code].in);

        if (chart.fund.indexCode && ( all_hist_data.length < 1 || all_hist_data[0].indexOf(chart.fund.indexCode) < 0)) {
            request.getHistoryData(chart.fund.indexCode, 'index', function(){
                fundSummary.chartWrapper.daysOpt.selectDefault();
            });
        }
        
        if (all_hist_data.length == 0 || all_hist_data[0].indexOf(code) < 0) {
            request.getHistoryData(code, ftjson[code].hideTrade? 'index': 'fund', function(){
                fundSummary.chartWrapper.daysOpt.selectDefault();
            });
            return;
        };
        this.chartWrapper.daysOpt.selectDefault();
    }

    redrawHistoryGraphs(days) {
        if (chart) {
            chart.drawChart(days);
            document.getElementById("chart_left_arrow").disabled = false;
            document.getElementById("chart_right_arrow").disabled = true;
        }
    }
}

var fundSummary = null;

function fillUpBudgetData(budgetTable, code) {
    var budgets = ftjson[code].budget;
    if (!budgets || budgets.length < 1) {
        return;
    };

    budgetTable.appendChild(utils.createSingleRow("budget"));
    for (var i = 0; i < budgets.length; i++) {
        var strDate = utils.date_by_delta(budgets[i].date);
        var row = utils.createCheckboxRow("budget_row_" + code, strDate, strDate, budgets[i].bdt + "<" + budgets[i].mptb + ">");
        budgetTable.appendChild(row);
    };
}

function updateBudgetsTable(code) {
    var budgetTable = document.getElementById("budget_table_" + code);
    if (budgetTable.rows.length > 0) {
        utils.deleteAllRows(budgetTable);
    };
    
    fillUpBudgetData(budgetTable, code);
}

function createBudgetsTable(code) {
    var budgetTable = document.createElement("table");
    budgetTable.id = "budget_table_" + code;
    if (ftjson[code].budget == undefined) {
        return budgetTable;
    };

    fillUpBudgetData(budgetTable, code);
    return budgetTable;
}

function fillUpRollinsData(rollinTable, code) {
    var rollins = ftjson[code].sell_table;
    if (!rollins || rollins.length < 1) {
        return;
    }

    rollinTable.appendChild(utils.createSingleRow("roll in"));
    var jsonp = ftjson[code].rtgz;
    var gz = jsonp ? jsonp.gsz : ftjson[code].lnv;
    var max_value = gz;
    for (var i = 0; i < rollins.length; i++) {
        if (rollins[i].tri > 0 && rollins[i].mptb * 1.1 > max_value) {
            var strDate = utils.date_by_delta(rollins[i].date);
            var row = utils.createRadioRow("rollin_row_" + code, strDate, strDate, rollins[i].tri + "<" + rollins[i].mptb + ">");
            rollinTable.appendChild(row);
        }
    };

    if (rollinTable.rows.length == 1) {
        utils.deleteAllRows(rollinTable);
    };
}

function updateRollinsTable(code) {
    var rollinTable = document.getElementById("rollin_table_" + code);
    if (rollinTable.rows.length > 0) {
        utils.deleteAllRows(rollinTable);
    };
    fillUpRollinsData(rollinTable, code);
}

function createRollinsTable(code) {
    var rollinTable = document.createElement("table");
    rollinTable.id = "rollin_table_" + code;
    if (ftjson[code].sell_table === undefined) {
        return rollinTable;
    };

    fillUpRollinsData(rollinTable, code);
    return rollinTable;
}

function getLatestRetracement(code, latest_netvalue) {
    var averprice = parseFloat(ftjson[code].avp);
    if (averprice >= latest_netvalue) {
        return 0;
    };

    var buytable = ftjson[code].buy_table;
    if (buytable === undefined) {
        return 0;
    };

    if (all_hist_data.length < 1) {
        return 0;
    };

    var fundDateIdx = 0;
    var fundValIdx = all_hist_data[0].indexOf(code) * 2 - 1;
    if (fundValIdx < 0) {
        return 0;
    };

    var startDateArr = all_hist_data.find(function(curVal) {
        return curVal[fundDateIdx] == buytable[0].date;
    });

    var maxEarnedSinceBuy = 0;
    var total_portion = 0;
    var total_cost = 0;
    for (var i = all_hist_data.indexOf(startDateArr); i < all_hist_data.length; i++) {
        var date = all_hist_data[i][fundDateIdx];
        var value = all_hist_data[i][fundValIdx];
        var buyrec = buytable.find(function(curVal) {
            return curVal.date == date;
        });

        if (buyrec) {
            total_portion += buyrec.ptn;
            total_cost += buyrec.cost;
        };

        var earned = total_portion * value - total_cost;
        if (earned > maxEarnedSinceBuy) {
            maxEarnedSinceBuy = earned;
        };
    };

    var latest_earned = total_portion * latest_netvalue - total_cost;
    return ((maxEarnedSinceBuy - latest_earned) * 100 / maxEarnedSinceBuy).toFixed(2);
} 

function jsonpgz(fundgz) {
    utils.logInfo(fundgz);
    var code = fundgz.fundcode;
    ftjson[code].rtgz = fundgz;
    updateGuzhiInfo(code);
    var hold_detail = document.getElementById("hold_detail_" + code);
    if (hold_detail.style.display != "none") {
        updateLatestSellInfo(code);
        if (fundSummary) {
            fundSummary.drawFundHistory(code);
        };
    };
}

function fillUpSellTableData(sellTable, code) {
    var buytable = ftjson[code].buy_table;
    if (buytable === undefined) {
        return;
    };

    var all_dp = utils.getTotalDatesPortion(buytable);
    var portion = all_dp.portion;
    var ppg = parseFloat(ftjson[code].ppg);

    sellTable.appendChild(utils.createRadioRow("sell_row_" + code, all_dp.dates, "全部", utils.convertPortionToGram(portion, ppg).toFixed(4)));
    portion = utils.getPortionMoreThan(buytable, 31);
    sellTable.appendChild(utils.createColsRow(">31天", utils.convertPortionToGram(portion, ppg).toFixed(4)));
    var portion_7day = utils.getPortionMoreThan(buytable, 7);

    var short_term_rate = ftjson[code].str;
    var jsonp = ftjson[code].rtgz;
    var gz = jsonp ? jsonp.gsz : ftjson[code].lnv;
    var short_dp = utils.getShortTermDatesPortion(buytable, gz, short_term_rate);
    var short_portion = short_dp.portion;

    if (short_portion <= 0 || portion_7day >= short_portion) {
        sellTable.appendChild(utils.createColsRow(">7天", utils.convertPortionToGram(portion_7day, ppg).toFixed(4)));
    };

    if (short_portion > 0 ) {
        if (portion_7day < short_portion) {
            var short_7d_dp = utils.getShortTermDatesPortionMoreThan7Day(buytable, gz, short_term_rate, portion_7day);
            sellTable.appendChild(utils.createRadioRow("sell_row_" + code, short_7d_dp.dates, ">7天", utils.convertPortionToGram(short_7d_dp.portion, ppg).toFixed(4), true));
        };
        sellTable.appendChild(utils.createRadioRow("sell_row_" + code, short_dp.dates, ">"+ (parseFloat(short_term_rate) * 100).toFixed(2) + "%", utils.convertPortionToGram(short_portion, ppg).toFixed(4), short_portion < portion_7day));
    } 
}

function updateLatestSellInfo(code) {
    var sellTable = document.getElementById("tbl_sell_" + code);
    for (var i = sellTable.rows.length - 1; i >= 1; i--) {
        sellTable.deleteRow(i);
    };

    fillUpSellTableData(sellTable, code);
}

function createSellInfoTable(code) {
    var sellTable = document.createElement("table");
    sellTable.id = "tbl_sell_" + code;
    sellTable.appendChild(utils.createSingleRow("sell"));

    if (ftjson[code].buy_table === undefined) {
        return sellTable;
    };

    fillUpSellTableData(sellTable, code);
    return sellTable;
}

function createGuzhiInfo(code) {
    var funddata = ftjson[code];
    var jsonp = funddata.rtgz;
    var lbl_class = utils.incdec_lbl_classname(jsonp ? jsonp.gszzl : funddata.lde);

    var guzhiDiv = document.createElement('div');
    guzhiDiv.appendChild(document.createTextNode('估值: '));
    var lblGzLgz = document.createElement('label');
    lblGzLgz.id = 'guzhi_lgz_' + code;
    if (lbl_class) {
        lblGzLgz.className = lbl_class;
    };
    lblGzLgz.textContent = jsonp ? jsonp.gsz : funddata.lnv;
    guzhiDiv.appendChild(lblGzLgz);
    guzhiDiv.appendChild(document.createTextNode(funddata.lnv))
    // 估值涨幅
    guzhiDiv.appendChild(document.createTextNode(' 涨幅: '));
    var lblGzZl = document.createElement('label');
    lblGzZl.id = 'guzhi_zl_' + code;
    if (lbl_class) {
        lblGzZl.className = lbl_class;
    };
    lblGzZl.textContent = jsonp ? jsonp.gszzl + "%" : "-";
    guzhiDiv.appendChild(lblGzZl);

    // 总收益率
    guzhiDiv.appendChild(document.createTextNode('总: '));
    var lblGzTotalZl = document.createElement('label');
    lblGzTotalZl.id = 'guzhi_total_zl_' + code;
    var netvalue = parseFloat(funddata.avp);
    lbl_class = utils.incdec_lbl_classname((jsonp ? jsonp.gsz : funddata.lnv) - netvalue);
    lblGzTotalZl.className = lbl_class;
    var latest_netvalue = jsonp ? jsonp.gsz : funddata.lnv;
    lblGzTotalZl.textContent = ((latest_netvalue - netvalue) * 100 / netvalue).toFixed(2) + "%";
    guzhiDiv.appendChild(lblGzTotalZl);

    // 回撤
    var lblRetrace = document.createElement('label');
    lblRetrace.id = 'retrace_' + code;
    var retrace = getLatestRetracement(code, latest_netvalue);
    lblRetrace.style.visibility = retrace > 0 ? "visible" : "hidden";
    lblRetrace.textContent = '| ' + retrace + '%';
    guzhiDiv.appendChild(lblRetrace);

    return guzhiDiv;
}

function updateGuzhiInfo(code) {
    var jsonp = ftjson[code].rtgz;
    var funddata = ftjson[code];

    var lbl_class = utils.incdec_lbl_classname( jsonp ? jsonp.gszzl : funddata.lde);
    var lbl_guzhi_lgz = document.getElementById("guzhi_lgz_" + code);
    if (lbl_guzhi_lgz) {
        lbl_guzhi_lgz.innerText = jsonp ? jsonp.gsz : funddata.lnv;
        lbl_guzhi_lgz.className = lbl_class;
    };
    var lbl_guzhi_zl = document.getElementById("guzhi_zl_" + code);
    if (lbl_guzhi_zl) {
        lbl_guzhi_zl.innerText = jsonp ? jsonp.gszzl + "%" : "-";
        lbl_guzhi_zl.className = lbl_class;
    };

    var latest_netvalue = jsonp ? jsonp.gsz : funddata.lnv;

    var lbl_guzhi_total_percent = document.getElementById("guzhi_total_zl_" + code);
    if (lbl_guzhi_total_percent) {
        var netvalue = parseFloat(funddata.avp);
        lbl_guzhi_total_percent.className = utils.incdec_lbl_classname((jsonp ? jsonp.gsz : funddata.lnv) - netvalue);

        var total_percent = ((latest_netvalue - netvalue) * 100 / netvalue).toFixed(2) + "%";

        lbl_guzhi_total_percent.innerText = total_percent;
    };

    var lbl_guzhi_retrace = document.getElementById("retrace_" + code);
    if (lbl_guzhi_retrace) {
        var retrace = getLatestRetracement(code, latest_netvalue);
        lbl_guzhi_retrace.innerText = "| " + retrace + "%";
        lbl_guzhi_retrace.style.visibility = retrace > 0 ? "visible" : "hidden";
    };
}

function createEarnedInfo(funddata) {
    var earnedDiv = document.createElement('div');
    earnedDiv.className = 'general_earned';
    earnedDiv.appendChild(document.createTextNode('持有: ' + funddata.cost + ' <' + funddata.avp+ '> '));

    var earned_lbl_class = utils.incdec_lbl_classname(funddata.ewh);
    var lblEwh = document.createElement('label');
    lblEwh.className = earned_lbl_class;
    lblEwh.textContent = funddata.ewh;
    earnedDiv.appendChild(lblEwh);
    var lblEarnedPercent = document.createElement('label');
    lblEarnedPercent.className = earned_lbl_class;
    lblEarnedPercent.textContent = (100 * funddata.ewh / funddata.cost).toFixed(2) + '%';
    earnedDiv.appendChild(lblEarnedPercent);
    return earnedDiv;
}

class RequestUtils {
    getHistoryData(code, type, cb) {
        utils.get('fundhist', 'code=' + code + '&type=' + type, function(rsp){
            var hist_data = JSON.parse(rsp);
            if (!hist_data) {
                return;
            };
            
            var updatingcode = hist_data[0][1];
            if (all_hist_data.length < 1) {
                all_hist_data = hist_data;
            } else {
                all_hist_data = utils.mergeHistData(all_hist_data, hist_data);
            }

            if (typeof(cb) == 'function') {
                cb();
            };
        });
    }

    fetchFundSummary(code, cb) {
        utils.get('fundsummary', 'code=' + code, function(rsp){
            ftjson[code] = JSON.parse(rsp);
            if (typeof(cb) === 'function') {
                cb();
            } else {
                fundSummary.showAllFundList();
                fundSummary.toggleFundDetails(code);
            }
        });
    }

    fetchBuyData(code, cb) {
        utils.get('fundbuy', 'code=' + code, function(rsp){
            var buytable = JSON.parse(rsp);
            ftjson[code].buy_table = buytable;
            ftjson[code].holding_aver_cost = utils.getHoldingAverageCost(buytable);
            updateGuzhiInfo(code);
            updateLatestSellInfo(code);
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    fetchBudgetData(code) {
        utils.get('fundbudget', 'code=' + code, function(rsp) {
            ftjson[code].budget = JSON.parse(rsp);
            updateBudgetsTable(code);
        });
    }
    
    fetchSellData(code, cb) {
        utils.get('fundsell', 'code=' + code, function(rsp){
            ftjson[code].sell_table = JSON.parse(rsp);
            updateRollinsTable(code);
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    addBudget(code, date, cost) {
        if (Number.isNaN(cost) || cost <= 0) {
            alert("Wrong input data.");
            return;
        }

        var queries = new FormData();
        queries.append("code", code);
        queries.append("date", date);
        queries.append("budget", cost);

        utils.post(fundbudget, queries, function(){
            request.fetchFundSummary(code);
        });
    }

    buyFund(code, date, cost, budget_dates, rollin_date, cb) {
        if (Number.isNaN(cost) || cost <= 0) {
            alert("Wrong input data.");
            return;
        }

        var queries = new FormData();
        queries.append("code", code);
        queries.append("date", date);
        queries.append("cost", cost);
        if (budget_dates && budget_dates.length > 0) {
            var budgetdates = "";
            for (var i = 0; i < budget_dates.length; i++) {
                budgetdates += budget_dates[i]
            };
            if (budgetdates.length > 0) {
                queries.append("budget_dates", budgetdates);
            };
        };

        if (rollin_date && rollin_date.length > 0) {
            queries.append("rollin_date", rollin_date)
        };

        utils.post('fundbuy', queries, function(){
            if (detailpage && detailpage.buydetail) {
                detailpage.buydetail.code = null;
            };
            request.fetchFundSummary(code, cb);
        });
    }

    sellFund(code, date, strbuydates, cb) {
        var queries = new FormData();
        queries.append("code", code);
        queries.append("date", date);
        queries.append("buydates", strbuydates);

        utils.post('fundsell', queries, function(){
            if (detailpage && detailpage.selldetail) {
                detailpage.selldetail.code = null;
            };
            request.fetchFundSummary(code, cb);
        });
    }

    forget(code) {
        var queries = new FormData();
        queries.append("code", code);
        queries.append("action", "forget");
        this.queries('fundmisc', queries, function(){
            location.reload();
        });
    }
}

var request = new RequestUtils();

function refreshHoldDetail(code) {
    if (ftjson[code].buy_table === undefined) {
        request.fetchBuyData(code);
    } else {
        updateGuzhiInfo(code);
        updateLatestSellInfo(code);        
    }

    if (ftjson[code].budget === undefined) {
        request.fetchBudgetData(code);
    } else {
        updateBudgetsTable(code);        
    }

    if (ftjson[code].sell_table === undefined) {
        request.fetchSellData(code);
    } else {
        updateRollinsTable(code);        
    }
}
