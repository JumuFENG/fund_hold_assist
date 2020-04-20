class FundUtils extends Utils{
    loadJsonData() {
        var newscript = document.createElement('script');
        newscript.setAttribute('type','text/javascript');
        newscript.setAttribute('src','json/history_data.json');
        var head = document.getElementsByTagName('head')[0];
        head.appendChild(newscript);
        //head.insertBefore(newscript, head.firstChild);
        //document.write("<script type='text/javascript' src='fund.json'></script>");
    }

    mergeHistData(hist_data1, hist_data2) {
        var basic_his_data = hist_data1;
        var extend_his_data = hist_data2;
        if (hist_data1.length < hist_data2.length) {
            basic_his_data = hist_data2;
            extend_his_data = hist_data1;
        };

        var all_dates = [];
        for (var i = 1; i < basic_his_data.length; i++) {
            all_dates.push(basic_his_data[i][0])
        };

        for (var i = 1; i < extend_his_data.length; i++) {
            if (all_dates.includes(extend_his_data[i][0])) {
                continue;
            };
            var d = extend_his_data[i][0];
            for (var j = 0; j < all_dates.length; j++) {
                if (d > all_dates[j]) {
                    if (j == all_dates.length - 1) {
                        all_dates.push(d);
                        break;
                    }
                    if (d < all_dates[j + 1]) {
                        all_dates.splice(j + 1, 0, d);
                        break;
                    };
                } else {
                    all_dates.splice(0, 0, d);
                    break;
                }
            };
        };

        all_dates.splice(0, 0, "date");
        var all_data = [];
        for (var i = 0; i < all_dates.length; i++) {
            all_data.push([all_dates[i]]);
        };
        all_data = this.mergeToBasic(all_data, basic_his_data);
        return this.mergeToBasic(all_data, extend_his_data);
    }

    mergeToBasic(basic_his_data, extend_his_data) {
        var all_data = [];
        var header = basic_his_data[0];
        for (var i = 1; i < extend_his_data[0].length; i++) {
            header.push(extend_his_data[0][i]);
        };
        all_data.push(header);

        for (var i = 1; i < basic_his_data.length; i++) {
            var row = basic_his_data[i];
            var date = row[0];
            var find_same_date = false;
            for (var j = 1; j < extend_his_data.length; j++) {
                var ext_data = extend_his_data[j];
                var fdate = ext_data[0];
                if (fdate < date) {
                    continue;
                } else {
                    if (fdate == date) {
                        for (var k = 1; k < ext_data.length; k++) {
                            row.push(ext_data[k]);
                        };
                        find_same_date = true;
                    }
                    break;
                };
            };
            if (!find_same_date) {
                for (var ii = 0; ii < extend_his_data[1].length - 1; ii++) {
                    row.push('');
                };
            };
            all_data.push(row);
        };

        return all_data;
    }

    createSplitLine(span = 2) {
        var row = document.createElement("tr");
        var col = document.createElement("td");
        if (span > 0) {
            col.setAttribute("colspan",span);
        };
        col.appendChild(document.createElement("hr"))
        row.appendChild(col);
        return row;
    }

    createInputRow(name, inputType, value, c1, c2, checked = false) {
        var row = document.createElement("tr");
        var col1 = document.createElement("td");
        var radio = document.createElement("input");
        radio.type = inputType;
        radio.name = name;
        radio.value = value;
        if (checked) {
            radio.checked = true;
        };
        col1.appendChild(radio);
        col1.appendChild(document.createTextNode(c1));
        var col2 = document.createElement("tr");
        col2.appendChild(document.createTextNode(c2));
        row.appendChild(col1);
        row.appendChild(col2);
        return row;
    }

    createRadioRow(name, value, c1, c2, checked = false) {
        return this.createInputRow(name, "radio", value, c1, c2, checked);
    }

    createCheckboxRow(name, value, c1, c2, checked = false) {
        return this.createInputRow(name, "checkbox", value, c1, c2, checked);
    }

    toggleHighlight(t) {
        t.className = "highlight";
        var sibling = t.parentElement.firstChild;
        while (sibling != null) {
            if (sibling != t) {
                sibling.className = "";
            };
            sibling = sibling.nextElementSibling;
        }
    }

    getHighlightedValue(listId) {
        var days = 0;
        var sibling = document.getElementById(listId).firstElementChild;
        while (sibling != null) {
            if (sibling.className == "highlight") {
                days = sibling.value;
                break;
            };
            sibling = sibling.nextElementSibling;
        }
        return days;
    }

    convertPortionToGram(portion, ppg) {
        if (ppg == 0 || ppg == 1) {
            return portion;
        };
        return portion / ppg;
    }

    convertGramToPortion(gram, ppg) {
        if (ppg == 0 || ppg == 1) {
            return gram;
        };
        return gram * ppg;
    }

    netvalueToPrice(nv, ppg) {
        if (ppg == 0 || ppg == 1) {
            return nv;
        };
        return nv * ppg;
    }

    priceToNetValue(price, ppg) {
        if (ppg == 0 || ppg == 1) {
            return price;
        };
        return price / ppg;
    }

    getTotalDatesPortion(buytable) {
        var dates = "";
        var portion = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].sold == 0) {
                dates += this.date_by_delta(buytable[i].date);
                portion += buytable[i].ptn;
            };
        };
        return {dates:dates, portion: portion};
    }

    getShortTermDatesPortion(buytable, netvalue, short_term_rate) {
        var dates = "";
        var portion = 0;
        var max_value = (parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate)));

        for (var i = 0; i < buytable.length; i++) {
            if(buytable[i].sold == 0 && buytable[i].nv < max_value) {
                portion += buytable[i].ptn;
                dates += this.date_by_delta(buytable[i].date);
            }
        };

        return {dates:dates, portion:portion};
    }

    getPortionMoreThan(buytable, days) {
        var totalPortion = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].sold == 0) {
                totalPortion += buytable[i].ptn;
            };
        };

        var datestart = this.days_since_2000(this.getTodayDate()) - days;
        var portionInDays = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].date > datestart) {
                portionInDays += buytable[i].ptn;
            }
        };
        return totalPortion > portionInDays ? totalPortion - portionInDays: 0;
    }

    getShortTermDatesPortionMoreThan7Day(buytable, netvalue, short_term_rate, portion_7day) {
        var buyrecs = [];
        var portion = 0;
        var max_value = (parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate)));
        for (var i = 0; i < buytable.length; i++) {
            if(buytable[i].sold == 0 && buytable[i].nv < max_value) {
                buyrecs.push(buytable[i]);
                portion += buytable[i].ptn;
            }
        };

        for (var i = buyrecs.length - 1; i >= 0; i--) {
            if (portion <= portion_7day) {
                break;
            }
            portion -= buyrecs[i].ptn;
            buyrecs.pop();
        };

        var dates = "";
        for (var i = 0; i < buyrecs.length; i++) {
            dates += this.date_by_delta(buyrecs[i].date);
        };
        
        return {dates:dates, portion:portion};
    }

    getPuzzledDatePortion(buytable, puzzleDates, netvalue, least_rate, days) {
        var portionMorethanDays = this.getPortionMoreThan(buytable, days);
        var puzzlePortion = 0;
        var puzzleCost = 0;
        var noneSoldRecs = [];
        var max_value = (parseFloat(netvalue) * (1.0 - parseFloat(least_rate)));
        for (var i = 0; i < buytable.length; i++) {
            var datePuzzled = false;
            for (var j = 0; j < puzzleDates.length; j++) {
                if (buytable[i].date == puzzleDates[j]) {
                    puzzlePortion += buytable[i].ptn;
                    puzzleCost += buytable[i].cost;
                    datePuzzled = true;
                    break;
                }
            }

            if (!datePuzzled && buytable[i].sold == 0 && buytable[i].nv <= max_value) {
                noneSoldRecs.push(buytable[i]);
            };
        };

        if (portionMorethanDays <= puzzlePortion || noneSoldRecs.length <= 0) {
            return null;
        };

        noneSoldRecs.sort(function(l, g) {
            return l.nv - g.nv;
        });

        var aver = puzzleCost / puzzlePortion;
        var dates = "";
        for (var i = 0; i < puzzleDates.length; i++) {
            dates += this.date_by_delta(puzzleDates[i]);
        };
        for (var i = 0; i < noneSoldRecs.length; i++) {
            var newAver = (puzzleCost + noneSoldRecs[i].cost) / (puzzlePortion + noneSoldRecs[i].ptn);
            if (newAver <= aver) {
                aver = newAver;
                puzzleCost += noneSoldRecs[i].cost;
                puzzlePortion += noneSoldRecs[i].ptn;
                dates += this.date_by_delta(noneSoldRecs[i].date);
            };
        };

        return aver <= max_value && portionMorethanDays >= puzzlePortion? {
            dates:dates, 
            portion: puzzlePortion, 
            cost: puzzleCost, 
            rate: (parseFloat(netvalue) - aver)/aver
        } : null;
    }

    getHoldingAverageCost(buytable) {
        var total_cost = 0;
        var count = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].sold == 0) {
                total_cost += buytable[i].cost;
                count++;
            }
        };
        return count > 0 ? total_cost/count : 0;
    }
}

var utils = new FundUtils();

var TradeType = {
    Buy:1,
    Sell:2,
    Budget:3
};

