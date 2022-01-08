class DbkQuestClient {
    constructor() {
        this.rankUrl = 'https://www.dabanke.com/gupiaorenqipaihangbang.html';
        this.ztUrl = 'https://www.dabanke.com/zdtfx.html';
        this.yzUrl = 'https://www.dabanke.com/yzdt.html';
    }

    getRanks(cb) {
        utils.get(this.rankUrl, response => {
            this.onRankBack(response, cb);
        })
    }

    onRankBack(rankhtml, cb) {
        var ele = document.createElement('html');
        ele.innerHTML = rankhtml;
        var rows = ele.querySelectorAll('table>tbody>tr');
        var ranks = [];
        for (let i = 0; i < rows.length && i < 100; i++) {
            const row = rows[i];
            var cels = row.querySelectorAll('td');
            ranks.push({code: cels[0].innerText, rank: cels[2].innerText});
        }

        if (typeof(cb) === 'function') {
            cb(ranks);
        }
    }

    getZdt(cb) {
        utils.get(this.ztUrl, response => {
            this.onZdtfxBack(response, cb);
        });
    }

    onZdtfxBack(zdthtml, cb) {
        var ele = document.createElement('html');
        ele.innerHTML = zdthtml;

        var cards = ele.querySelectorAll('div.card>div.card-body');
        var bks = cards[1].querySelectorAll('div.row>div');
        var bkful = [];
        for (var i = 0; i < bks.length; i++) {
            var bkn = bks[i].innerText.split(':');
            bkful.push(bkn[0].trim());
        }

        var getFulBk = function(bk) {
            for (let i = 0; i < bkful.length; i++) {
                if (bkful[i].startsWith(bk)) {
                    return bkful[i];
                }
            }
        }
        var tbls = ele.querySelectorAll('table.table.table-bordered.text-center');
        var zt = [];
        rows = tbls[2].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            zt.push({c:cels[0].innerText.trim(), n:cels[1].innerText.trim(), lbc:cels[6].innerText.trim()});
        }

        var dt = [];
        rows = tbls[3].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            dt.push({c:cels[0].innerText.trim(), n:cels[1].innerText.trim(), lbc:cels[6].innerText.trim()});
        }
        var getCode = function(name, bk) {
            for (let i = 0; i < zt.length; i++) {
                if (zt[i].n == name) {
                    zt[i].bk = bk;
                    return zt[i].c;
                }
            }
            for (let j = 0; j < dt.length; j++) {
                if (dt[j].n == name) {
                    dt[j].bk = bk;
                    return dt[j].c;
                }
            }
        }

        var rows = tbls[0].querySelectorAll('tbody>tr');
        var zts0 = [];
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            var stkstr = cels[2].innerText.trim();
            var reg = new RegExp(/(.*?)\((.*?)\)\s+\((.*?)\)/, 'g');
            var stks = stkstr.matchAll(reg);
            for (var m of stks) {
                zts0.push({bk:m[3].trim(), r:m[2].trim(), n:m[1].trim()});
            }
        }
        for (let i = 0; i < zts0.length; i++) {
            zts0[i].bk = getFulBk(zts0[i].bk);
            zts0[i].c = getCode(zts0[i].n, zts0[i].bk);
        }

        var zts1 = [];
        rows = tbls[1].querySelectorAll('tbody>tr');
        for (var i = 0; i < rows.length; i++) {
            var cels = rows[i].querySelectorAll('td');
            var stks = cels[2].innerText.trim().split(' ');
            var stkstr = cels[2].innerText.trim();
            var reg = new RegExp(/(.*?)\((.*?)\)\s+\((.*?)\)/, 'g');
            var stks = stkstr.matchAll(reg);
            for (var m of stks) {
                zts1.push({bk:m[3].trim(), r:m[2].trim(), n:m[1].trim()});
            }
        }
        for (let i = 0; i < zts1.length; i++) {
            zts1[i].bk = getFulBk(zts1[i].bk);
            zts1[i].c = getCode(zts1[i].n, zts1[i].bk);
        }

        if (typeof(cb) === 'function') {
            cb(zt, dt, zts0, zts1, bkful);
        }
    }

    getYzdt(cb) {
        utils.get(this.yzUrl, response => {
            this.onYzdtBack(response, cb);
        });
    }

    onYzdtBack(yzdthtml, cb) {
        var processAmount = function(amount) {
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

        var getYzBuy = function(jgtbl) {
            var rows = jgtbl.querySelectorAll('tbody>tr');
            var jgrank = [];
            for (var i = 0; i < rows.length; i++) {
                var cels = rows[i].querySelectorAll('td');
                var des = cels[0].innerText.trim();
                var n = cels[1].innerText.trim();
                var b = processAmount(cels[3].innerText.trim());
                var s = processAmount(cels[4].innerText.trim());
                var days = 1;
                if (des.includes('(三日榜单)')) {
                    days = 3;
                }
                jgrank.push({n, p:b-s, days});
            }
            return jgrank.sort((a, b) => {
                return a.p - b.p < 0;
            });
        }

        var ele = document.createElement('html');
        ele.innerHTML = yzdthtml;
        var tbls = ele.querySelectorAll('table');
        var netbuy = [];
        for (var i = 0; i < tbls.length; i++) {
            var name = tbls[i].querySelectorAll('thead>tr>th')[0].innerText.trim();
            var ranks = getYzBuy(tbls[i]);
            netbuy.push({name, ranks});
        }
        if (typeof(cb) === 'function') {
            cb(netbuy);
        }
    }
}

var dbkCommon = new DbkQuestClient();
