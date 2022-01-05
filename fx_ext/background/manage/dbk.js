class DbkParser {
    onZdtfxBack() {
        var el = document.createElement('html');
        el.innerHTML = dbkhtml;
        var tbls = el.querySelectorAll('table.table.table-bordered.text-center');
        var rows = tbls[0].querySelectorAll('tbody>tr');
        var zts0 = [];
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            var stkstr = cels[2].innerText.trim();
            var reg = new RegExp(/(.*?)\(.*?\)\s+\((.*?)\)/, 'g');
            var stks = stkstr.matchAll(reg);
            for (var m of stks) {
                zts0.push({bk:m[2].trim(), n:m[1].trim()});
            }
        }
        console.log(zts0);

        var zts1 = [];
        rows = tbls[1].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            var stks = cels[2].innerText.trim().split(' ');
            var stkstr = cels[2].innerText.trim();
            var reg = new RegExp(/(.*?)\(.*?\)\s+\((.*?)\)/, 'g');
            var stks = stkstr.matchAll(reg);
            for (var m of stks) {
                zts1.push({bk:m[2].trim(), n:m[1].trim()});
            }
        }
        console.log(zts1);

        var zt = [];
        rows = tbls[2].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            zt.push({c:cels[0].innerText.trim(), n:cels[1].innerText, lbc:cels[6].innerText});
        }
        console.log(zt);

        var dt = [];
        rows = tbls[3].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            dt.push({c:cels[0].innerText.trim(), n:cels[1].innerText, lbc:cels[6].innerText});
        }
        console.log(dt);

        var cards = el.querySelectorAll('div.card>div.card-body');
        var bks = cards[1].querySelectorAll('div.row>div');
        for (var i = 0; i < bks.length; i++) {
            var bkn = bks[i].innerText.split(':');
            console.log(bkn[0].trim(), bkn[1].trim());
        }
    }

    processAmount(amount) {
        if (amount == '-') {
            return 0;
        }

        if (amount.includes('万')) {
            return amount.split('万')[0];
        }

        if (amount.includes('亿')) {
            return (amount.split('亿')[0] * 10000).toFixed();
        }

        return 0;
    }


    onYzdtBack() {
        var el = document.createElement('html');
        el.innerHTML = yzdthtml;
        var tbls = el.querySelectorAll('table');
        var jgtbl = tbls[0];
        if (jgtbl.querySelectorAll('thead>tr>th')[0].innerText != '机构专用') {
            for (var i = 0; i < tbls.length; i++) {
                if (tbls[i].querySelectorAll('thead>tr>th')[0].innerText == '机构专用') {
                    jgtbl = tbls[i];
                    break;
                }
            }
        }
        var rows = jgtbl.querySelectorAll('tbody>tr');
        var jgrank = [];
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            var n = cels[1].innerText.trim();
            var b = this.processAmount(cels[3].innerText.trim());
            var s = this.processAmount(cels[4].innerText.trim());
            jgrank.push({n, b, s, p:b-s});
        }
        jgrank.sort((a, b) => {
            return a.p - b.p > 0;
        });
        console.log(jgrank);
    }
}
