let ExtensionLoadedEvent = "ExtensionLoaded";
let CodeToFetchEvent = 'FundCodeToFetch';
let RealtimeInfoFetchedEvent = "FundGzReturned";
let extensionLoaded = false;

window.onload = function() {
    if (!utils.isEmpty(ftjson)) {
        showAllFundList();
    };

    document.getElementById('funds_list_container').style.display = utils.isEmpty(ftjson) ? 'none': 'block';
    document.getElementById('fund_new_date').value = utils.getTodayDate();
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
        var httpRequest = new XMLHttpRequest();
        var request = encodeURIComponent('http://fundgz.1234567.com.cn/js/' + fundcode + '.js?rt=' + (new Date()).getTime());
        httpRequest.open('GET', '../../api/get?url=' + request, true);
        httpRequest.send();

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                eval(httpRequest.responseText);
            }
        }
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
    var max_value = utils.netvalueToPrice(gz, ftjson[code].ppg);
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
        DrawFundHistory(code);
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
    sellTable.appendChild(utils.create2ColRow(">31天", utils.convertPortionToGram(portion, ppg).toFixed(4)));
    var portion_7day = utils.getPortionMoreThan(buytable, 7);

    var short_term_rate = ftjson[code].str;
    var jsonp = ftjson[code].rtgz;
    var gz = jsonp ? jsonp.gsz : ftjson[code].lnv;
    var short_dp = utils.getShortTermDatesPortion(buytable, gz, short_term_rate);
    var short_portion = short_dp.portion;

    if (short_portion <= 0 || portion_7day >= short_portion) {
        sellTable.appendChild(utils.create2ColRow(">7天", utils.convertPortionToGram(portion_7day, ppg).toFixed(4)));
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

function ToggleFundDetails(divDetail, fund_list_table) {
    if (divDetail.style.display == "none") {
        var code = divDetail.id.split('_').pop();
        sendFetchEvent(code);
        divDetail.style.display = "block";

        var sibling = fund_list_table.firstChild;
        while (sibling != null) {
            var nextDetail = sibling.firstChild.firstChild;
            if (nextDetail.childNodes.length != 0 && nextDetail.lastChild != divDetail) {
                nextDetail.lastChild.style.display = "none";
            };
            sibling = sibling.nextElementSibling;
        }

        refreshHoldDetail(code);
        DrawFundHistory(code);

        var charts_div = document.getElementById("charts_div");
        charts_div.parentElement.removeChild(charts_div);
        divDetail.appendChild(charts_div);
        charts_div.style.display = 'block';

        var tradepanel = document.getElementById("trade_panel");
        tradepanel.setAttribute("code", code);
        var datepicker = document.getElementById("trade_panel_date");
        datepicker.value = utils.getTodayDate();
    } else {
        divDetail.style.display = "none";
    }
}

function createGuzhiInfo(code) {
    var funddata = ftjson[code];
    var jsonp = funddata.rtgz;
    var lbl_class = utils.incdec_lbl_classname(jsonp ? jsonp.gszzl : funddata.lde);

    var html = "<div class='guzhi'>估值: <label id='guzhi_lgz_" + code + "'";
    if (lbl_class) {
        html += " class='" + lbl_class + "'";
    };
    html +=">"; 
    html += jsonp ? jsonp.gsz : funddata.lnv;
    html += "</label>";
    html += funddata.lnv;
    // 估值涨幅
    html += " 涨幅: <label id='guzhi_zl_" + code + "'"
    if (lbl_class) {
        html += " class='" + lbl_class + "'";
    };
    html +=">";
    html += jsonp ? jsonp.gszzl + "%" : "-";
    // 总收益率
    html += "</label>总: <label id='guzhi_total_zl_" + code + "'";
    var netvalue = parseFloat(funddata.avp);
    lbl_class = utils.incdec_lbl_classname((jsonp ? jsonp.gsz : funddata.lnv) - netvalue)
    html += " class='" + lbl_class + "' >";
    var latest_netvalue = jsonp ? jsonp.gsz : funddata.lnv;
    var total_percent = ((latest_netvalue - netvalue) * 100 / netvalue).toFixed(2) + "%";
    html += total_percent;
    html += "</label><label id = 'retrace_" + code + "' style = 'visibility:";
    // 回撤
    var retrace = getLatestRetracement(code, latest_netvalue);
    html += retrace > 0 ? "visible" : "hidden";
    html += ";' >| " + retrace + "%";
    html += "</label></div>";
    return html;
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

function createGeneralInnerHtmlWithoutName(funddata) {
    var html = "<div class='general_earned'>"
    html += "持有: " + funddata.cost + " &lt;" + funddata.avp+ "&gt; ";

    var earned_lbl_class = utils.incdec_lbl_classname(funddata.ewh);
    html += "<label class='" + earned_lbl_class + "'>" + funddata.ewh + "</label>";
    html += "<label class='" + earned_lbl_class + "'>" + (100 * funddata.ewh / funddata.cost).toFixed(2) + "%</label>";
    html += "</div>";
    return html;
}

function createGeneralInfoInSingleRow(code) {
    var funddata = ftjson[code];
    var html = "<div class='fund_header' onclick='ToggleFundDetails(hold_detail_" + code + ", fund_list_table)' id='fund_header_" + code + "'>" + funddata.name + "<label class = '" + utils.incdec_lbl_classname(funddata.lde) + "'>" + funddata.lde + "</label>";
    html += createGuzhiInfo(code);
    html += createGeneralInnerHtmlWithoutName(funddata);
    html += "</div>";
    var general_root = document.createElement("div");
    general_root.className = "general_root";
    general_root.innerHTML = html;

    var hold_detail = document.createElement("div");
    hold_detail.className = "hold_detail";
    hold_detail.id = "hold_detail_" + code;
    hold_detail.style = "display:none;";

    hold_detail.appendChild(createBudgetsTable(code));
    hold_detail.appendChild(createRollinsTable(code));
    hold_detail.appendChild(createSellInfoTable(code));

    general_root.appendChild(hold_detail);

    var col = document.createElement("td");
    col.appendChild(general_root)
    var row = document.createElement("tr");
    row.appendChild(col);
    return row;
}

function fetchFundSummary(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundsummary?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            ftjson[code] = JSON.parse(httpRequest.responseText);
            showAllFundList();
            ToggleFundDetails(document.getElementById("hold_detail_" + code), document.getElementById("fund_list_table"));
        }
    }
}

function fetchBuyData(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundbuy?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var buytable = JSON.parse(httpRequest.responseText);
            ftjson[code].buy_table = buytable;
            ftjson[code].holding_aver_cost = utils.getHoldingAverageCost(buytable);
            refreshBuyData(code);
        }
    }
}

function refreshBuyData(code) {
    if (ftjson[code].buy_table === undefined) {
        fetchBuyData(code);
        return;
    };

    updateGuzhiInfo(code);
    updateLatestSellInfo(code);
}

function fetchBudgetData(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundbudget?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            ftjson[code].budget = JSON.parse(httpRequest.responseText);
            refreshBudgetData(code);
        }
    }
}

function refreshBudgetData(code) {
    if (ftjson[code].budget === undefined) {
        fetchBudgetData(code);
        return;
    };

    updateBudgetsTable(code);
}

function fetchSellData(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundsell?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            ftjson[code].sell_table = JSON.parse(httpRequest.responseText);
            refreshSellData(code);
        }
    }
}

function refreshSellData(code) {
    if (ftjson[code].sell_table === undefined) {
        fetchSellData(code);
        return;
    };

    updateRollinsTable(code);
}

function refreshHoldDetail(code) {
    refreshBuyData(code);
    refreshBudgetData(code);
    refreshSellData(code);
}

function updateTotalEarnedInfo(earned, total_earned, cost) {
    if (earned != 0) {
        var lbl_earned = document.getElementById("last_total_earned");
        lbl_earned.textContent = earned.toFixed(2);
        var lbl_class = utils.incdec_lbl_classname(earned);
        lbl_earned.className = lbl_class;

        var lbl_earn_percent = document.getElementById("last_total_percent");
        lbl_earn_percent.textContent = (100 * earned/cost).toFixed(2) + "%";
        lbl_earn_percent.className = lbl_class;

        document.getElementById("total_cost").textContent = cost;
        
        var lbl_total_earned = document.getElementById("total_earned");
        lbl_total_earned.textContent = total_earned.toFixed(2);
        var lbl_total_class = utils.incdec_lbl_classname(total_earned);
        lbl_total_earned.className = lbl_total_class;

        var lbl_total_percent = document.getElementById("total_percent");
        lbl_total_percent.textContent = (100 * total_earned / cost).toFixed(2) + "%";
        lbl_total_percent.className = lbl_total_class;
    };
}

function showAllFundList() {
    var earned = 0;
    var total_earned = 0;
    var cost = 0;
    var code_cost = [];
    for (var fcode in ftjson){
        sendFetchEvent(fcode);

        var funddata = ftjson[fcode];
        earned += funddata.lde;
        total_earned += funddata.ewh;        
        cost += funddata.cost;
        code_cost.push([fcode, funddata.cost]);
        if (ftjson[fcode].buy_table) {
            ftjson[fcode].holding_aver_cost = utils.getHoldingAverageCost(ftjson[fcode].buy_table);
        };
    }

    updateTotalEarnedInfo(earned, total_earned, cost);

    code_cost.sort(function(f, s) {
        return s[1] - f[1];
    });

    var fund_list_tbl = document.getElementById("fund_list_table");
    utils.deleteAllRows(fund_list_table);
    for (var i in code_cost) {
        fund_list_tbl.appendChild(utils.createSplitLine());

        var row = createGeneralInfoInSingleRow(code_cost[i][0]);
        fund_list_tbl.appendChild(row)
    }
}

function SetTradeOption(t, cost, submit) {
    utils.toggelHighlight(t);
    if (t.id == "tradeoption_sell") {
        t.parentElement.setAttribute("trade", "sell");
    } else if (t.id == "tradeoption_budget") {
        t.parentElement.setAttribute("trade", "budget");
    } else {
        t.parentElement.setAttribute("trade", "buy");
    }

    if (t.id == "tradeoption_sell") {
        cost.style.display = "none";
        submit.textContent = "卖出";
    } else {
        cost.style.display = "inline";
        submit.textContent = "确定";
    }
}

function TradeSubmit(tradepanel, tradedate, tradecost, tradeoptions) {
    var code = tradepanel.getAttribute("code");
    if (code == null) {
        alert("please select a fund first.");
        return;
    };

    var date = tradedate.value;
    var cost = parseFloat(tradecost.value);
    var option = tradeoptions.getAttribute("trade");
    if (option == "budget") {
        addBudget(code, date, cost);
    } else if (option == "sell") {
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
        
        sellFund(code, date, strbuydates);
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
        buyFund(code, date, cost, budget_dates, rollin_date);
    }
}

function addBudget(code, date, cost) {
    if (Number.isNaN(cost) || cost <= 0) {
        alert("Wrong input data.");
        return;
    }

    var httpRequest = new XMLHttpRequest();
    httpRequest.open('POST', '../../fundbudget', true);
    var request = new FormData();
    request.append("code", code);
    request.append("date", date);
    request.append("budget", cost);

    httpRequest.send(request);

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            fetchFundSummary(code);
        }
    }
}

function buyFund(code, date, cost, budget_dates, rollin_date) {
    if (Number.isNaN(cost) || cost <= 0) {
        alert("Wrong input data.");
        return;
    }

    var httpRequest = new XMLHttpRequest();
    httpRequest.open('POST', '../../fundbuy', true);
    var request = new FormData();
    request.append("code", code);
    request.append("date", date);
    request.append("cost", cost);
    if (budget_dates) {
        budgetdates = "";
        for (var i = 0; i < budget_dates.length; i++) {
            budgetdates += budget_dates[i]
        };
        if (budgetdates.length > 0) {
            request.append("budget_dates", budgetdates);
        };
    };

    if (rollin_date && rollin_date.length > 0) {
        request.append("rollin_date", rollin_date)
    };

    httpRequest.send(request);

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            fetchFundSummary(code);
        }
    }
}

function sellFund(code, date, strbuydates) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('POST', '../../fundsell', true);
    var request = new FormData();
    request.append("code", code);
    request.append("date", date);
    request.append("buydates", strbuydates);
    httpRequest.send(request);
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            fetchFundSummary(code);
        }
    }
}

function FundNewSubmit(date, code, cost) {
    buyFund(code, date, parseFloat(cost), null, null);
}
