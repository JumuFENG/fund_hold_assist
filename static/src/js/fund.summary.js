let ExtensionLoadedEvent = "ExtensionLoaded";
let UrlToGetEvent = 'UrlToGet';
let RealtimeInfoFetchedEvent = "RealtimeInfoReturned";
let extensionLoaded = false;

window.onload = function() {
    if (!fundSummary) {
        fundSummary = new FundSummary();
        fundSummary.createSummaryFramework();
        ftjson['sz000001'] = {
            name: "上证指数",
            isIndex: true
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

var irjson = {};

function jsonpgz(fundgz) {
    utils.logInfo(fundgz);
    var code = fundgz.fundcode;
    ftjson[code].rtgz = fundgz;
    updateGuzhiInfo(code);
    var hold_detail = document.getElementById("hold_detail_" + code);
    if (hold_detail.style.display != "none") {
        updateLatestSellInfo(code);
        if (fundSummary && fundSummary.chartWrapper.code && fundSummary.chartWrapper.code == code) {
            fundSummary.chartWrapper.drawFundHistory();
        };
    };
}

function _ir_cb(irtdata) {
    for (var code in irtdata) {
        var idata = irtdata[code];
        var icode = 'sz' + idata.symbol;
        irjson[icode] = {
            rtgz: idata.price,
            percent: idata.percent,
            date: utils.date_by_delta(utils.days_since_2000(idata.time))
        };
        utils.logInfo(irjson);
    }
}

class RealTimeHelper {
    timeFitToFetch() {
        var nowDate=new Date();
        var day_of_week = nowDate.getDay();
        if (day_of_week < 1 || day_of_week > 5) {
            return false;
        };
        var hour_of_day = nowDate.getHours();
        if (hour_of_day < 9 || hour_of_day > 16) {
            return false;
        }
        return true;
    }

    dispatchUrlToGet(url) {
        let urlEvt = new CustomEvent(UrlToGetEvent, {
            detail: {
                url: url
            }
        });
        document.dispatchEvent(urlEvt);
    }

    fetchFundRtDataActually(fundcode) {
        var url = 'http://fundgz.1234567.com.cn/js/' + fundcode + '.js?rt=' + (new Date()).getTime();
        if (extensionLoaded) {
            this.dispatchUrlToGet(url);
        } else {
            request.getRealTimeData(url, function(rsp){
                eval(rsp);
            });
        }
    }

    fetchFundRtData(fundcode) {
        if (this.timeFitToFetch()) {
            this.fetchFundRtDataActually(fundcode);
        };
    }

    pushIndexCode(szcode) {
        if (!irjson[szcode]) {
            irjson[szcode] = {};
        };
    }

    get126IndexUrl() {
        var i126codes = '';
        for (var c in irjson) {
            if (c.startsWith('sz')) {
                i126codes += c.replace('sz', c[2] == '0' ? '0' : '1') + ',';
            } else {
                utils.logInfo('index code not start with sz', c);
                i126codes += c + ',';
            }
        };

        if (i126codes.length > 0) {
            return 'http://api.money.126.net/data/feed/' + i126codes + 'money.api?callback=_ir_cb';
        };
    }

    fetchIndexRtDataActually() {
        var url = this.get126IndexUrl();
        if (!url) {
            return;
        };

        if (extensionLoaded) {
            this.dispatchUrlToGet(url);
        } else {
            request.getRealTimeData(url, function(rsp){
                eval(rsp);
            });
        }
    }

    fetchIndexRtData() {
        if (this.timeFitToFetch()) {
            this.fetchIndexRtDataActually();
        };
    }

    forceFetchAll() {
        for (var fcode in ftjson){
            if (ftjson[fcode].isIndex) {
                this.pushIndexCode(fcode);
            } else {
                this.fetchFundRtDataActually(fcode);
            }
            if (ftjson[fcode].ic) {
                this.pushIndexCode(ftjson[fcode].ic);
            };
        }
        this.fetchIndexRtDataActually();
    }
}

var rtHelper = new RealTimeHelper();

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
        aStats.href = 'javascript:fundSummary.showFundStats()';
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
            if (funddata.isIndex) {
                rtHelper.pushIndexCode(fcode);
                continue;
            };
            rtHelper.fetchFundRtData(fcode);

            earned += funddata.lde;
            total_earned += funddata.ewh;        
            cost += funddata.cost;
            code_cost.push([fcode, funddata.cost]);
            if (ftjson[fcode].buy_table) {
                ftjson[fcode].holding_aver_cost = utils.getHoldingAverageCost(ftjson[fcode].buy_table);
            };
            if (ftjson[fcode].ic) {
                rtHelper.pushIndexCode(ftjson[fcode].ic);
            };
        }

        rtHelper.fetchIndexRtData();

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
        if (!funddata.isIndex) {
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

        if (!funddata.isIndex) {
            var detailLnk = document.createElement('a');
            detailLnk.textContent = '详情';
            detailLnk.href = 'javascript:fundSummary.showFundDetailPage("' + code + '")'
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

    refreshHoldDetail(code) {
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

        if (!ftjson[code].khl_m_his) {
            request.fetchIndexKhlData(code);
        };
    }

    toggleFundDetails(code) {
        var divDetail = document.getElementById("hold_detail_" + code);
        if (divDetail.style.display == "none") {
            var code = divDetail.id.split('_').pop();
            if (!ftjson[code].isIndex) {
                rtHelper.fetchFundRtData(code);
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

            if (!ftjson[code].isIndex) {
                this.refreshHoldDetail(code);
            };

            this.chartWrapper.setParent(divDetail);
            this.chartWrapper.show();
            this.chartWrapper.code = code;
            if (!ftjson[code].isIndex) {
                this.chartWrapper.tradeOption.show();
            } else {
                this.chartWrapper.tradeOption.hide();
            };
            this.chartWrapper.drawFundHistory();
        } else {
            divDetail.style.display = "none";
        }
    }

    showFundDetailPage(code) {
        if (!code) {
            return;
        };

        if (!detailpage) {
            detailpage = new FundDetail();
            detailpage.createFundDetailFramework();
        };
        this.hide();
        detailpage.container.style.display = 'block';
        detailpage.container.scrollIntoView();
        detailpage.code = code;
        detailpage.setDetailPageFundName();
        detailpage.navUl.firstChild.click();
    }

    showFundStats() {
        if (!fundstats) {
            fundstats = new FundStats();
            fundstats.createStatsPage();
            fundstats.getFundStats();
        };

        this.hide();
        fundstats.container.style.display = 'block';
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
    getRealTimeData(url, cb) {
        var enUrl = encodeURIComponent(url);
        utils.get('api/get', 'url=' + enUrl, cb);
    }

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
        utils.post('fundmisc', queries, function(){
            location.reload();
        });
    }

    fetchIndexKhlData(code) {
        var icode = ftjson[code].isIndex ? code : ftjson[code].ic;
        icode = icode.replace('sz', '');
        utils.get('fundmisc', 'action=khl_m&code=' + icode, function(rsp) {
            var khl_m_his = JSON.parse(rsp);
            var down_all = [];
            var up_all = [];
            for (var i = 0; i < khl_m_his.length - 1; i++) {
                down_all.push(1 - parseFloat(khl_m_his[i+1][2]) / parseFloat(khl_m_his[i][1]));
                up_all.push(parseFloat(khl_m_his[i+1][1]) / parseFloat(khl_m_his[i][2]) - 1);
            };
            var downFluct = down_all.reduce((acc, c) => acc + c, 0);
            downFluct = parseFloat((downFluct / down_all.length).toFixed(4));
            var upFluct = up_all.reduce((acc, c) => acc + c, 0);
            upFluct = parseFloat((upFluct / up_all.length).toFixed(4));
            ftjson[code].khl_m_his = khl_m_his;
            ftjson[code].downFluct = parseFloat((downFluct * 0.2).toFixed(4));
            ftjson[code].upFluct = upFluct;
        });
    }
}

var request = new RequestUtils();
