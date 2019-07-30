let CustomEventName = 'SelectedFundCode';
function logInfo(...args) {
    console.log(args);
}

window.onload = function() {
    var fundlistObj = document.getElementById("fundlist");
    for (var fcode in ftjson){
        var objOption = document.createElement("OPTION");
        objOption.value = fcode;
        objOption.text = ftjson[fcode]["name"];
        fundlistObj.options.add(objOption);
    }  
    showAllInOnePage();
}

function SwitchShowAll() {
    if(document.getElementById("funds_all_in_1").style.display == "none"){
        showAllInOnePage();
    }
    else {
        showOneByOneWithList();
    }
}

function showOneByOneWithList() {
    document.getElementById("btn_swith_show_all").innerHTML = "Show All";
    document.getElementById("funds_all_in_1").style.display = "none";
    document.getElementById("funds_1_by_1").style.display = "block";
    FundSelectChanged();
}

function getSelectedFundCode() {
    var fundlistObj = document.getElementById("fundlist");
    var index = fundlistObj.selectedIndex;
    return fundlistObj.options[index].value;
}

function FundSelectChanged() {
    var fundcode = getSelectedFundCode();
    showFundGeneralInfo(fundcode);

    var gzInput = document.getElementById("guzhi_lgz");
    gzInput.value = "";

    var nowDate=new Date();
    var day_of_week = nowDate.getDay();
    if (day_of_week < 1 || day_of_week > 5) {
        return;
    };
    var hour_of_day = nowDate.getHours();
    if (hour_of_day < 9 || hour_of_day > 16) {
        return;
    };

    let selectedCodeEvt = new CustomEvent(CustomEventName, {
        detail: {
            code: fundcode
        }
    });
    document.dispatchEvent(selectedCodeEvt);
}

function showFundGeneralInfo(fundcode){
    var funddata = ftjson[fundcode];
    var fundcostaver = document.getElementById("fund_cost_aver");
    fundcostaver.innerHTML = createGeneralInnerHtmlWithoutName(funddata);
    loadBudgets(funddata["budget"]);
    loadRollins(funddata["rollin"]);
    loadSellInfo(funddata["morethan7day"]);
}

function createSingleRow(c) {
    var row = document.createElement("tr");
    var col = document.createElement("td");
    col.setAttribute("colspan","2");
    col.appendChild(document.createTextNode(c))
    row.appendChild(col);
    return row;
}

function createSplitLine() {
    var row = document.createElement("tr");
    var col = document.createElement("td");
    col.setAttribute("colspan","2");
    col.appendChild(document.createElement("hr"))
    row.appendChild(col);
    return row;
}

function create2ColRow(c1, c2){
    var row = document.createElement("tr");
    var col1 = document.createElement("td");
    col1.appendChild(document.createTextNode(c1));
    var col2 = document.createElement("tr");
    col2.appendChild(document.createTextNode(c2));
    row.appendChild(col1);
    row.appendChild(col2);
    return row;
}

function deleteAllRows(tbl) {
    for (var idx = tbl.rows.length - 1; idx >= 0; idx--) {
        tbl.deleteRow(idx);
    }
}

function getBudgetRows(budgets) {
    var rows = []
    if (!budgets || budgets.length < 1) {
        return rows;
    };

    var row0 = createSingleRow("budget");
    rows.push(row0);
    for (var i = 0; i < budgets.length; i++) {
        var row = creatBuyRow(budgets[i]["date"], budgets[i]["max_price_to_buy"], budgets[i]["budget"]);
        rows.push(row);
    };

    return rows;
}

function loadBudgets(budgets) {
    var budgetTable = document.getElementById("tbl_budget");
    deleteAllRows(budgetTable);

    var rows = getBudgetRows(budgets);
    for (var i = 0; i < rows.length; i++) {
        budgetTable.appendChild(rows[i]);
    };
}

function creatBuyRow(date, maxprice, cost) {
    return create2ColRow(date, cost + "<" + maxprice + ">");
}

function getRollinRows(rollins) {
    var rows = [];
    if (!rollins || rollins.length < 1) {
        return rows;
    }

    var row0 = createSingleRow("roll in");
    rows.push(row0);

    for (var i = 0; i < rollins.length; i++) {
        var row = creatBuyRow(rollins[i]["date"], rollins[i]["max_price_to_buy"], rollins[i]["to_rollin"]);
        rows.push(row);
    };
    return rows;
}

function loadRollins(rollins) {
    var rollinTable = document.getElementById("tbl_rollin");
    deleteAllRows(rollinTable);

    var rows = getRollinRows(rollins);
    for (var i = 0; i < rows.length; i++) {
        rollinTable.appendChild(rows[i]);
    };
}

function loadSellInfo(portion_mt7d) {
    var sellTable = document.getElementById("tbl_sell");
    deleteAllRows(sellTable);
    var row0 = createSingleRow("sell");
    sellTable.appendChild(row0);
    var row = create2ColRow(">7天", portion_mt7d);
    sellTable.appendChild(row);
}

function getMaxSellPortion(netvalue, short_term_rate, buytable, ppg) {
    var portion_can_sell = 0.0;
    var max_value_to_sell = parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate))
    for (var i = 0; i < buytable.length; i++) {
        if(parseFloat(buytable[i]["netvalue"]) < max_value_to_sell){
            portion_can_sell += parseFloat(buytable[i]["portion"])
        }
    };

    if (portion_can_sell > 0) {
        if (ppg != 1 && ppg != 0) {
            portion_can_sell /= ppg;
        };
    };

    return portion_can_sell.toFixed(4);
}

function jsonpgz(fundgz) {
    document.getElementById("guzhi_lgz").innerText = fundgz.gsz;
    document.getElementById("guzhi_dwjz").innerText = fundgz.dwjz;
    document.getElementById("guzhi_zl").innerText = fundgz.gszzl + "%";
}

function setClasses(funddata) {
    var price = parseFloat(funddata["averprice"]);
    var gzlbl = document.getElementById("guzhi_lgz");
    var lgz = parseFloat(gzlbl.innerText.trim());
    if (lgz > price) {
        gzlbl.className = "increase";
    } else if (lgz < price) {
        gzlbl.className = "decrease";
    } else {
        gzlbl.className = "keepsame";
    }

    var gzzllbl = document.getElementById("guzhi_zl");
    var gzzl = parseFloat(gzzllbl.innerText.trim('%'));
    if (gzzl > 0) {
        gzzllbl.className = "increase";
    } else if (gzzl < 0) {
        gzzllbl.className = "decrease";
    } else {
        gzzllbl.className = "keepsame";
    }
}

function GetLatestSellInfo() {
    var jsonp = document.getElementById("btn_ok").value;
    logInfo(jsonp);
    eval(jsonp);

    var gzInput = document.getElementById("guzhi_lgz");
    var gz = gzInput.innerText.trim();
    if (gz == "") {
        logInfo("无法读取有效的最新估值");
        return;
    }

    var sellTable = document.getElementById("tbl_sell");
    var fundcode = getSelectedFundCode();
    setClasses(ftjson[fundcode]);

    var short_term_rate = ftjson[fundcode]["short_term_rate"];
    var buytable = ftjson[fundcode]["buy_table"];
    var ppg = parseFloat(ftjson[fundcode]["ppg"]);
    var portion_can_sell = getMaxSellPortion(gz, short_term_rate, buytable, ppg);

    if (portion_can_sell > 0) {
        if (sellTable.rows.length > 2) {
            sellTable.deleteRow(sellTable.rows.length - 1);
        };
    
        var row = create2ColRow(">"+ (parseFloat(short_term_rate) * 100).toFixed(2) +"%", portion_can_sell);
        sellTable.appendChild(row);
    };
}

function getSellRows(funddata) {
    var rows = [];
    rows.push(createSingleRow("sell"));
    rows.push(create2ColRow(">7天", funddata["morethan7day"]))

    var short_term_rate = funddata["short_term_rate"];
    var buytable = funddata["buy_table"];
    var ppg = parseFloat(funddata["ppg"]);
    var netvalue = parseFloat(funddata["latest_netvalue"]);
    var portion_can_sell = getMaxSellPortion(netvalue, short_term_rate, buytable, ppg);
    if (portion_can_sell > 0) {
        rows.push(create2ColRow(">"+ (parseFloat(short_term_rate) * 100).toFixed(2) +"%", portion_can_sell))
    };
    return rows;
}

function incdec_lbl_classname(val) {
    var lbl_class = "increase";
    if (val < 0) {
        lbl_class = "decrease";
    } else if (val == 0) {
        lbl_class = "keepsame";
    };
    return lbl_class;
}

function createGeneralInnerHtmlWithoutName(funddata) {
    var html = "<div>all: " + funddata["cost"] + "</span> &lt;" +funddata["averprice"]+ "&gt;</div>";

    var earned_lbl_class = incdec_lbl_classname(funddata["last_day_earned"]);
    html += "<div class='general_earned'><span>上日: <label class = '" + earned_lbl_class + "'>" + funddata["last_day_earned"] + "</label></span>";
    
    earned_lbl_class = incdec_lbl_classname(funddata["earned_while_holding"]);
    html += "持有: <label class='" + earned_lbl_class + "'>" + funddata["earned_while_holding"] + "</label>";
    html += "<label class='" + earned_lbl_class + "'>" + (100 * funddata["earned_while_holding"] / funddata["cost"]).toFixed(2) + "%</label></div>";
    return html;
}

function createGeneralInfoInSingleRow(funddata) {
    var html = "<div>" + funddata["name"] + "</div>";
    html += createGeneralInnerHtmlWithoutName(funddata);

    var general_root = document.createElement("div");
    general_root.className = "general_root";
    general_root.innerHTML = html;

    var col = document.createElement("td");
    col.appendChild(general_root)
    col.setAttribute("colspan","2");
    var row = document.createElement("tr");
    row.appendChild(col);
    return row;
}

function showAllInOnePage() {
    document.getElementById("btn_swith_show_all").innerHTML = "Show Single";
    document.getElementById("funds_all_in_1").style.display = "block";
    document.getElementById("funds_1_by_1").style.display = "none";

    var allTable = document.getElementById("tbl_all_in_1");
    deleteAllRows(allTable);

    var earned = 0;
    var total_earned = 0;
    var cost = 0;
    for (var fcode in ftjson){
        allTable.appendChild(createSplitLine());
        var funddata = ftjson[fcode];
        earned += funddata["last_day_earned"];
        total_earned += funddata["earned_while_holding"];
        cost += funddata["cost"];
        var row = createGeneralInfoInSingleRow(funddata);
        allTable.appendChild(row);

        var rows = getBudgetRows(funddata["budget"]);
        for (var i = 0; i < rows.length; i++) {
            allTable.appendChild(rows[i]);
        };

        rows = getRollinRows(funddata["rollin"]);
        for (var i = 0; i < rows.length; i++) {
            allTable.appendChild(rows[i]);
        };

        rows = getSellRows(funddata);
        for (var i = 0; i < rows.length; i++) {
            allTable.appendChild(rows[i]);
        };
    }

    if (earned != 0) {
        var lbl_earned = document.getElementById("last_total_earned");
        lbl_earned.textContent = earned.toFixed(2);
        var lbl_class = incdec_lbl_classname(earned);
        lbl_earned.className = lbl_class;

        var lbl_earn_percent = document.getElementById("last_total_percent");
        lbl_earn_percent.textContent = (100 * earned/cost).toFixed(2) + "%";
        lbl_earn_percent.className = lbl_class;

        document.getElementById("total_cost").textContent = cost;
        
        var lbl_total_earned = document.getElementById("total_earned");
        lbl_total_earned.textContent = total_earned.toFixed(2);
        var lbl_total_class = incdec_lbl_classname(total_earned);
        lbl_total_earned.className = lbl_total_class;

        var lbl_total_percent = document.getElementById("total_percent");
        lbl_total_percent.textContent = (100 * total_earned / cost).toFixed(2) + "%";
        lbl_total_percent.className = lbl_total_class;
    };
}
