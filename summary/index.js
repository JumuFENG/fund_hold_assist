window.onload = function() {
    var fundlistObj = document.getElementById("fundlist");
    for (var fcode in ftjson){
        var objOption = document.createElement("OPTION");
        objOption.value = fcode;
        objOption.text = ftjson[fcode]["name"];
        fundlistObj.options.add(objOption);
    }  
    FundSelectChanged();
}

function FundSelectChanged() {
    var fundlistObj = document.getElementById("fundlist");
    var index = fundlistObj.selectedIndex;
    var fundcode = fundlistObj.options[index].value;
    showFundGeneralInfo(fundcode);

    var gzInput = document.getElementById("guzhi_lgz");
    gzInput.value = "";
}

function showFundGeneralInfo(fundcode){
    var funddata = ftjson[fundcode];
    var fundHdr = document.getElementById("tbl_hdr_fund_info");
    fundHdr.href = "http://fund.eastmoney.com/" + fundcode + ".html";
    var fundcostaver = document.getElementById("fund_cost_aver");
    fundcostaver.innerHTML = funddata["cost"] +"&lt;"+ funddata["averprice"] + "&gt;";
    loadBudgets(funddata["budget"]);
    loadRollins(funddata["rollin"]);
    loadSellInfo(funddata["morethan7day"]);
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

function loadBudgets(budgets) {
    var budgetTable = document.getElementById("tbl_budget");
    deleteAllRows(budgetTable);
    if (!budgets || budgets.length < 1) {
        return;
    };

    var row0 = document.createElement("tr");
    row0.appendChild(document.createTextNode("budget"));
    budgetTable.appendChild(row0);
    for (var i = 0; i < budgets.length; i++) {
        var row = creatBuyRow(budgets[i]["date"], budgets[i]["max_price_to_buy"], budgets[i]["budget"]);
        budgetTable.appendChild(row);
    };
}

function creatBuyRow(date, maxprice, cost) {
    return create2ColRow(date + "<" + maxprice + ">", cost);
}

function loadRollins(rollins) {
    var rollinTable = document.getElementById("tbl_rollin");
    deleteAllRows(rollinTable);
    if (!rollins || rollins.length < 1) {
        return;
    }

    var row0 = document.createElement("tr");
    row0.appendChild(document.createTextNode("roll in"));
    rollinTable.appendChild(row0);
    for (var i = 0; i < rollins.length; i++) {
        var row = creatBuyRow(rollins[i]["date"], rollins[i]["max_price_to_buy"], rollins[i]["to_rollin"]);
        rollinTable.appendChild(row);
    };
}

function loadSellInfo(portion_mt7d) {
    var sellTable = document.getElementById("tbl_sell");
    deleteAllRows(sellTable);
    var row0 = document.createElement("tr");
    row0.appendChild(document.createTextNode("sell"));
    sellTable.appendChild(row0);
    var row = create2ColRow(">7天", portion_mt7d);
    sellTable.appendChild(row);
}

function GetLatestSellInfo() {
    var gzInput = document.getElementById("guzhi_lgz");
    var gz = gzInput.value.trim();
    if (gz == "") {
        alert("请输入最新净值");
    }
    var sellTable = document.getElementById("tbl_sell");
    var row = create2ColRow(">1.5%", "80.1155");
    sellTable.appendChild(row);
}
