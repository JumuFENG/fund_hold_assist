class Utils {
    logInfo(...args) {
        //console.log(args);
    }

    isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            };
        };
        return true;
    }

    getTodayDate() {
        var dt = new Date();
        return dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

    days_since_2000(date) {
        var d = new Date("2000-01-01");
        var dt = new Date(date);
        return (dt - d) / (24 * 60 * 60 * 1000);
    }

    date_by_delta(days) {
        var dt = new Date("2000-01-01");
        dt.setTime(dt.getTime() + days * 24 * 60 * 60 * 1000);
        return dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
    }

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

    createSingleRow(c) {
        var row = document.createElement("tr");
        var col = document.createElement("td");
        col.setAttribute("colspan","2");
        col.appendChild(document.createTextNode(c))
        row.appendChild(col);
        return row;
    }

    createSplitLine() {
        var row = document.createElement("tr");
        var col = document.createElement("td");
        col.appendChild(document.createElement("hr"))
        row.appendChild(col);
        return row;
    }

    create2ColRow(c1, c2){
        var row = document.createElement("tr");
        var col1 = document.createElement("td");
        col1.appendChild(document.createTextNode(c1));
        var col2 = document.createElement("tr");
        col2.appendChild(document.createTextNode(c2));
        row.appendChild(col1);
        row.appendChild(col2);
        return row;
    }

    createRadioRow(name, value, c1, c2, checked = false) {
        var row = document.createElement("tr");
        var col1 = document.createElement("td");
        var radio = document.createElement("input");
        radio.type = "radio";
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

    deleteAllRows(tbl) {
        for (var idx = tbl.rows.length - 1; idx >= 0; idx--) {
            tbl.deleteRow(idx);
        }
    }

    incdec_lbl_classname(val) {
        var lbl_class = "increase";
        if (val < 0) {
            lbl_class = "decrease";
        } else if (val == 0) {
            lbl_class = "keepsame";
        };
        return lbl_class;
    }

    toggelHighlight(t) {
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

    httpRequestGet(path, queries = null, callback = null) {
        var httpRequest = new XMLHttpRequest();
        var lnk = '../../' + path;
        if (queries != null) {
            lnk += '?' + queries;
        };
        httpRequest.open('GET', lnk, true);
        httpRequest.send();

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                callback(httpRequest)
            }
        }
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
            portion -= buyrecs[i].ptn;
            if (portion <= portion_7day) {
                break;
            }
            buyrecs.pop();
        };

        var dates = "";
        for (var i = 0; i < buyrecs.length; i++) {
            dates += this.date_by_delta(buyrecs[i].date);
        };
        
        return {dates:dates, portion:portion};
    }
}

var utils = new Utils();