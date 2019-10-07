class Utils {
    logInfo(...args) {
        //console.log(args);
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

}

var utils = new Utils();