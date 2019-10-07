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

function getBudgetRows(budgets) {
    var rows = []
    if (!budgets || budgets.length < 1) {
        return rows;
    };

    var row0 = utils.createSingleRow("budget");
    rows.push(row0);
    for (var i = 0; i < budgets.length; i++) {
        var row = creatBuyRow(budgets[i]["date"], budgets[i]["max_price_to_buy"], budgets[i]["budget"]);
        rows.push(row);
    };

    return rows;
}

function updateBudgetsTable(code) {
    var budgetTable = document.getElementById("budget_table_" + code);
    if (budgetTable.rows.length > 0) {
        utils.deleteAllRows(budgetTable);
    };
    
    var rows = getBudgetRows(ftjson[code]["budget"]);
    for (var i = 0; i < rows.length; i++) {
        budgetTable.appendChild(rows[i]);
    };
}

function createBudgetsTable(code) {
    var budgetTable = document.createElement("table");
    budgetTable.id = "budget_table_" + code;
    var rows = getBudgetRows(ftjson[code]["budget"]);
    for (var i = 0; i < rows.length; i++) {
        budgetTable.appendChild(rows[i]);
    };
    return budgetTable;
}

function creatBuyRow(date, maxprice, cost) {
    return utils.create2ColRow(date, cost + "<" + maxprice + ">");
}

function getRollinRows(rollins) {
    var rows = [];
    if (!rollins || rollins.length < 1) {
        return rows;
    }

    var row0 = utils.createSingleRow("roll in");
    rows.push(row0);

    for (var i = 0; i < rollins.length; i++) {
        if (rollins[i]["to_rollin"] > 0) {
            var row = creatBuyRow(rollins[i]["date"], rollins[i]["max_price_to_buy"], rollins[i]["to_rollin"]);
            rows.push(row);
        }
    };
    return rows;
}

function updateRollinsTable(code) {
    var rollinTable = document.getElementById("rollin_table_" + code);
    if (rollinTable.rows.length > 0) {
        utils.deleteAllRows(rollinTable);
    };
    
    var rows = getRollinRows(ftjson[code]["sell_table"]);
    for (var i = 0; i < rows.length; i++) {
        rollinTable.appendChild(rows[i]);
    };
}

function createRollinsTable(code) {
    var rollinTable = document.createElement("table");
    rollinTable.id = "rollin_table_" + code;
    var rows = getRollinRows(ftjson[code]["sell_table"]);
    for (var i = 0; i < rows.length; i++) {
        rollinTable.appendChild(rows[i]);
    };
    return rollinTable;
}

function getMaxSellPortionDates(netvalue, short_term_rate, buytable, ppg, code) {
    if (buytable === undefined) {
        return [];
    };

    var portion_can_sell = 0.0;
    var max_value_to_sell = parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate));
    var dates = [];
    for (var i = 0; i < buytable.length; i++) {
        if (buytable[i].sold == 1) {
            continue;
        };

        if(parseFloat(buytable[i].netvalue) < max_value_to_sell){
            portion_can_sell += parseFloat(buytable[i].portion)
            dates.push(buytable[i].date);
        }
    };

    if (portion_can_sell > 0) {
        if (ppg != 1 && ppg != 0) {
            portion_can_sell /= ppg;
        };
        portion_can_sell = portion_can_sell.toFixed(4);

        var row1 = utils.create2ColRow(">"+ (parseFloat(short_term_rate) * 100).toFixed(2) +"%", portion_can_sell);
        row1.id = "shorterm_sell_" + code;
        row1.setAttribute("dates", dates.join(''));
        return [row1];
    };

    return [];
}

function getLatestRetracement(fundcode, latest_netvalue) {
    var averprice = parseFloat(ftjson[fundcode]["averprice"]);
    if (averprice >= latest_netvalue) {
        return 0;
    };
    if (ftjson[fundcode]["ppg"] != 1) {
        averprice /= ftjson[fundcode]["ppg"];
        averprice = averprice.toFixed(4);
    };

    var buytable = ftjson[fundcode]["buy_table"];
    if (buytable === undefined) {
        return 0;
    };

    if (all_hist_data.length < 1) {
        return 0;
    };

    var fundDateIdx = 0;
    var fundValIdx = all_hist_data[0].indexOf(fundcode) * 2 - 1;
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
            total_portion += buyrec.portion;
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
    ftjson[fundgz.fundcode].rtgz = fundgz;
    updateGuzhiInfo(fundgz.fundcode);
    updateLatestSellInfo(fundgz.fundcode);
}

function updateLatestSellInfo(fundcode) {
    var jsonp = ftjson[fundcode].rtgz;
    var gz = jsonp ? jsonp.gsz : ftjson[fundcode]["latest_netvalue"];

    var sellTable = document.getElementById("tbl_sell_" + fundcode);

    var short_term_rate = ftjson[fundcode]["short_term_rate"];
    var buytable = ftjson[fundcode]["buy_table"];
    var ppg = parseFloat(ftjson[fundcode]["ppg"]);
    var sell_rows = getMaxSellPortionDates(gz, short_term_rate, buytable, ppg, fundcode);

    for (var i = sellTable.rows.length - 1; i >= 2; i--) {
        sellTable.deleteRow(i);
    };

    sell_rows.forEach(function(row, i){
        sellTable.appendChild(row);
    });
}

function createSellInfoTable(fundcode) {
    var funddata = ftjson[fundcode];
    var sellTable = document.createElement("table");
    sellTable.id = "tbl_sell_" + fundcode;
    sellTable.appendChild(utils.createSingleRow("sell"));
    sellTable.appendChild(utils.create2ColRow(">7天", funddata["morethan7day"]));

    var short_term_rate = funddata["short_term_rate"];
    var buytable = funddata["buy_table"];
    var ppg = parseFloat(funddata["ppg"]);
    var netvalue = parseFloat(funddata["latest_netvalue"]);
    var sell_rows = getMaxSellPortionDates(netvalue, short_term_rate, buytable, ppg, fundcode);
    sell_rows.forEach(function(row, i){
        sellTable.appendChild(row);
    });

    return sellTable;
}

function ToggleFundDetails(divDetail, fund_list_table) {
    if (divDetail.style.display == "none") {
        var fundcode = divDetail.id.split('_').pop();
        sendFetchEvent(fundcode);
        divDetail.style.display = "block";

        var sibling = fund_list_table.firstChild;
        while (sibling != null) {
            var nextDetail = sibling.firstChild.firstChild;
            if (nextDetail.childNodes.length != 0 && nextDetail.lastChild != divDetail) {
                nextDetail.lastChild.style.display = "none";
            };
            sibling = sibling.nextElementSibling;
        }

        refreshHoldDetail(fundcode);
        DrawFundHistory(fundcode);

        var charts_div = document.getElementById("charts_div");
        charts_div.parentElement.removeChild(charts_div);
        divDetail.appendChild(charts_div);

        var tradepanel = document.getElementById("trade_panel");
        tradepanel.setAttribute("code", fundcode);
        var datepicker = document.getElementById("trade_panel_date");
        datepicker.value = utils.getTodayDate();
        document.getElementById('tradeoptions').style.display = 'block';
        document.getElementById('trade_panel').style.display = 'block';
    } else {
        divDetail.style.display = "none";
    }
}

function createGuzhiInfo(fundcode) {
    var funddata = ftjson[fundcode];
    var jsonp = funddata.rtgz;
    var lbl_class = utils.incdec_lbl_classname(jsonp ? jsonp.gszzl : funddata["last_day_earned"]);

    var html = "<div class='guzhi'>估值: <label id='guzhi_lgz_" + fundcode + "'";
    if (lbl_class) {
        html += " class='" + lbl_class + "'";
    };
    html +=">"; 
    html += jsonp ? jsonp.gsz : funddata["latest_netvalue"];
    html += "</label>";
    html += funddata["latest_netvalue"];
    // 估值涨幅
    html += " 涨幅: <label id='guzhi_zl_" + fundcode + "'"
    if (lbl_class) {
        html += " class='" + lbl_class + "'";
    };
    html +=">";
    html += jsonp ? jsonp.gszzl + "%" : "-";
    // 总收益率
    html += "</label>总: <label id='guzhi_total_zl_" + fundcode + "'";
    var netvalue = parseFloat(funddata["averprice"]);
    if (funddata["ppg"] != 1) {
        netvalue /= funddata["ppg"];
        netvalue = netvalue.toFixed(4);
    };
    lbl_class = utils.incdec_lbl_classname((jsonp ? jsonp.gsz : funddata["latest_netvalue"]) - netvalue)
    html += " class='" + lbl_class + "' >";
    var latest_netvalue = jsonp ? jsonp.gsz : funddata["latest_netvalue"];
    var total_percent = ((latest_netvalue - netvalue) * 100 / netvalue).toFixed(2) + "%";
    html += total_percent;
    html += "</label><label id = 'retrace_" + fundcode + "' style = 'visibility:";
    // 回撤
    var retrace = getLatestRetracement(fundcode, latest_netvalue);
    html += retrace > 0 ? "visible" : "hidden";
    html += ";' >| " + retrace + "%";
    html += "</label></div>";
    return html;
}

function updateGuzhiInfo(fundcode) {
    var jsonp = ftjson[fundcode].rtgz;
    var funddata = ftjson[fundcode];

    var lbl_class = utils.incdec_lbl_classname( jsonp ? jsonp.gszzl : funddata["last_day_earned"]);
    var lbl_guzhi_lgz = document.getElementById("guzhi_lgz_" + fundcode);
    if (lbl_guzhi_lgz) {
        lbl_guzhi_lgz.innerText = jsonp ? jsonp.gsz : funddata["latest_netvalue"];
        lbl_guzhi_lgz.className = lbl_class;
    };
    var lbl_guzhi_zl = document.getElementById("guzhi_zl_" + fundcode);
    if (lbl_guzhi_zl) {
        lbl_guzhi_zl.innerText = jsonp ? jsonp.gszzl + "%" : "-";
        lbl_guzhi_zl.className = lbl_class;
    };

    var latest_netvalue = jsonp ? jsonp.gsz : funddata["latest_netvalue"];

    var lbl_guzhi_total_percent = document.getElementById("guzhi_total_zl_" + fundcode);
    if (lbl_guzhi_total_percent) {
        var netvalue = parseFloat(funddata["averprice"]);
        if (funddata["ppg"] != 1) {
            netvalue /= funddata["ppg"];
            netvalue = netvalue.toFixed(4);
        };
        lbl_guzhi_total_percent.className = utils.incdec_lbl_classname((jsonp ? jsonp.gsz : funddata["latest_netvalue"]) - netvalue);

        var total_percent = ((latest_netvalue - netvalue) * 100 / netvalue).toFixed(2) + "%";

        lbl_guzhi_total_percent.innerText = total_percent;
    };

    var lbl_guzhi_retrace = document.getElementById("retrace_" + fundcode);
    if (lbl_guzhi_retrace) {
        var retrace = getLatestRetracement(fundcode, latest_netvalue);
        lbl_guzhi_retrace.innerText = "| " + retrace + "%";
        lbl_guzhi_retrace.style.visibility = retrace > 0 ? "visible" : "hidden";
    };
}

function createGeneralInnerHtmlWithoutName(funddata) {
    var html = "<div class='general_earned'>"
    html += "持有: " + funddata["cost"] + " &lt;" + funddata["averprice"]+ "&gt; ";

    var earned_lbl_class = utils.incdec_lbl_classname(funddata["earned_while_holding"]);
    html += "<label class='" + earned_lbl_class + "'>" + funddata["earned_while_holding"] + "</label>";
    html += "<label class='" + earned_lbl_class + "'>" + (100 * funddata["earned_while_holding"] / funddata["cost"]).toFixed(2) + "%</label>";
    html += "</div>";
    return html;
}

function createGeneralInfoInSingleRow(fundcode) {
    var funddata = ftjson[fundcode];
    var html = "<div class='fund_header' onclick='ToggleFundDetails(hold_detail_" + fundcode + ", fund_list_table)' id='fund_header_" + fundcode + "'>" + funddata["name"] + "<label class = '" + utils.incdec_lbl_classname(funddata["last_day_earned"]) + "'>" + funddata["last_day_earned"] + "</label>";
    html += createGuzhiInfo(fundcode);
    html += createGeneralInnerHtmlWithoutName(funddata);
    html += "</div>";
    var general_root = document.createElement("div");
    general_root.className = "general_root";
    general_root.innerHTML = html;

    var hold_detail = document.createElement("div");
    hold_detail.className = "hold_detail";
    hold_detail.id = "hold_detail_" + fundcode;
    hold_detail.style = "display:none;";

    hold_detail.appendChild(createBudgetsTable(fundcode));
    hold_detail.appendChild(createRollinsTable(fundcode));
    hold_detail.appendChild(createSellInfoTable(fundcode));

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
            refreshHoldDetail(code);
        }
    }
}

function fetchBuyData(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundbuy?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            ftjson[code]["buy_table"] = JSON.parse(httpRequest.responseText);
            refreshBuyData(code)
        }
    }
}

function refreshBuyData(code) {
    if (ftjson[code]["buy_table"] === undefined) {
        fetchBuyData(code)
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
            ftjson[code]["budget"] = JSON.parse(httpRequest.responseText);
            refreshBudgetData(code);
        }
    }
}

function refreshBudgetData(code) {
    if (ftjson[code]["budget"] === undefined) {
        fetchBudgetData(code);
        return;
    };

    updateBudgetsTable(code)
}

function fetchSellData(code) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', '../../fundsell?code=' + code, true);
    httpRequest.send();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            ftjson[code]["sell_table"] = JSON.parse(httpRequest.responseText);
            refreshSellData(code);
        }
    }
}

function refreshSellData(code) {
    if (ftjson[code]["sell_table"] === undefined) {
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

function redrawSzzsChart() {
    ResetHistoryGraph();

    var charts_div = document.getElementById("charts_div");
    charts_div.parentElement.removeChild(charts_div);
    document.getElementById('funds_list_container').appendChild(charts_div);    
    document.getElementById('tradeoptions').style.display = 'none';
    document.getElementById('trade_panel').style.display = 'none';
}

function showAllFundList() {
    redrawSzzsChart();

    var earned = 0;
    var total_earned = 0;
    var cost = 0;
    var code_cost = [];
    for (var fcode in ftjson){
        sendFetchEvent(fcode);

        var funddata = ftjson[fcode];
        earned += funddata["last_day_earned"];
        total_earned += funddata["earned_while_holding"];        
        cost += funddata["cost"];
        code_cost.push([fcode, funddata["cost"]]);
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
    } else if (t.id = "tradeoption_budget") {
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
        alert("not implemented yet.");
    } else if (option == "sell") {
        var short_term_td = document.getElementById("shorterm_sell_" + code);
        var strbuydates = short_term_td.getAttribute('dates');
        sellFund(code, date, strbuydates);
    } else {
        var budget_dates = null;
        var rollin_date = null;
        buyFund(code, date, cost, budget_dates, rollin_date);
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
        request.append("budget_dates", budgetdates);
    };

    if (rollin_date) {
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
