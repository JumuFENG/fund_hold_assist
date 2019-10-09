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

    loadJsonData() {
        var newscript = document.createElement('script');
        newscript.setAttribute('type','text/javascript');
        newscript.setAttribute('src','json/history_data.json');
        var head = document.getElementsByTagName('head')[0];
        head.appendChild(newscript);
        //head.insertBefore(newscript, head.firstChild);
        //document.write("<script type='text/javascript' src='fund.json'></script>");
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
                dates += buytable[i].date;
                portion += buytable[i].portion;
            };
        };
        return {dates:dates, portion: portion};
    }

    getShortTermDatesPortion(buytable, netvalue, short_term_rate) {
        var dates = "";
        var portion = 0;
        var max_value = (parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate)));

        for (var i = 0; i < buytable.length; i++) {
            if(buytable[i].sold == 0 && buytable[i].netvalue < max_value) {
                portion += buytable[i].portion;
                dates += buytable[i].date;
            }
        };

        return {dates:dates, portion:portion};
    }

    getPortionMoreThan(buytable, days) {
        var totalPortion = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].sold == 0) {
                totalPortion += buytable[i].portion;
            };
        };

        var date = new Date();
        var dt = new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);
        var strDate = dt.getFullYear()+"-" + ('' + (dt.getMonth()+1)).padStart(2, '0') + "-" + ('' + dt.getDate()).padStart(2, '0');
        var portionInDays = 0;
        for (var i = 0; i < buytable.length; i++) {
            if (buytable[i].date > strDate) {
                portionInDays += buytable[i].portion;
            }
        };
        return totalPortion - portionInDays;
    }

    getShortTermDatesPortionMoreThan7Day(buytable, netvalue, short_term_rate, portion_7day) {
        var buyrecs = [];
        var portion = 0;
        var max_value = (parseFloat(netvalue) * (1.0 - parseFloat(short_term_rate)));
        for (var i = 0; i < buytable.length; i++) {
            if(buytable[i].sold == 0 && buytable[i].netvalue < max_value) {
                buyrecs.push(buytable[i]);
                portion += buytable[i].portion;
            }
        };

        for (var i = buyrecs.length - 1; i >= 0; i--) {
            portion -= buyrecs[i].portion;
            if (portion <= portion_7day) {
                break;
            }
            buyrecs.pop();
        };

        var dates = "";
        for (var i = 0; i < buyrecs.length; i++) {
            dates += buyrecs[i].date;
        };
        
        return {dates:dates, portion:portion};
    }
}

var utils = new Utils();