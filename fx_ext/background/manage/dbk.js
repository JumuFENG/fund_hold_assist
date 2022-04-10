class DbkQuestClient {
    constructor() {
        this.rankUrl = 'https://www.dabanke.com/gupiaorenqipaihangbang.html';
        this.ztUrl = 'https://www.dabanke.com/zdtfx.html';
        this.yzUrl = 'https://www.dabanke.com/yzdt.html';
    }

    getRanks(cb) {
        utils.get(this.rankUrl, null, response => {
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
        utils.get(this.ztUrl, null, response => {
            this.onZdtfxBack(response, cb);
        });
    }

    parseTodayDate(ele) {
        var datecels = ele.querySelectorAll('div.card-body>div.row')[0].querySelectorAll('div');
        var date = '';
        for (let i = 0; i < datecels.length; i++) {
            if (datecels[i].children.length == 0) {
                date = datecels[i].innerText.substring(0, 10);
                break;
            }
        }
        return date;
    }

    onZdtfxBack(zdthtml, cb) {
        var ele = document.createElement('html');
        ele.innerHTML = zdthtml;

        var cards = ele.querySelectorAll('div.card>div.card-body');
        var bks = cards[1].querySelectorAll('div.row>div');
        var bkful = [];
        for (var i = 0; i < bks.length; i++) {
            var bkn = bks[i].innerText.split(':');
            bkful.push({bk:bkn[0].trim(), num:0});
        }

        var getFulBk = function(bk) {
            for (let i = 0; i < bkful.length; i++) {
                if (bkful[i].bk.startsWith(bk)) {
                    return bkful[i].bk;
                }
            }
        }
        var tbls = ele.querySelectorAll('table.table.table-bordered.text-center');
        var parseZdt = function(tbl) {
            var zdt = [];
            var rows = tbl.querySelectorAll('tbody>tr');
            for (var i = 0; i < rows.length; i++) {
                var cels = rows[i].querySelectorAll('td');
                zdt.push({c:cels[0].innerText.trim(), n:cels[1].innerText.trim(), lbc:cels[6].innerText.trim()});
            }
            return zdt
        }

        var zt = parseZdt(tbls[2]);
        var dt = parseZdt(tbls[3]);
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

        var parseZtProgress = function(tbl) {
            var pgs = [];
            var rows = tbl.querySelectorAll('tbody>tr');
            for (var i = 0; i < rows.length; i++) {
                var cels = rows[i].querySelectorAll('td');
                var stkstr = cels[2].innerText.trim();
                var reg = new RegExp(/(.*?)\((.*?)\)\s+\((.*?)\)/, 'g');
                var stks = stkstr.matchAll(reg);
                for (var m of stks) {
                    pgs.push({bk:m[3].trim(), r:m[2].trim(), n:m[1].trim()});
                }
            }
            return pgs;
        }

        var zts0 = parseZtProgress(tbls[0]);
        for (let i = 0; i < zts0.length; i++) {
            zts0[i].bk = getFulBk(zts0[i].bk);
            zts0[i].c = getCode(zts0[i].n, zts0[i].bk);
        }

        var zts1 = parseZtProgress(tbls[1]);
        for (let i = 0; i < zts1.length; i++) {
            zts1[i].bk = getFulBk(zts1[i].bk);
            zts1[i].c = getCode(zts1[i].n, zts1[i].bk);
        }

        var addBkFullNum = function(bk) {
            for (let i = 0; i < bkful.length; i++) {
                if (bkful[i].bk.startsWith(bk)) {
                    bkful[i].num ++;
                }
            }
        }

        for (let i = 0; i < zt.length; i++) {
            addBkFullNum(zt[i].bk);
        }

        var date = this.parseTodayDate(ele);
        if (typeof(cb) === 'function') {
            cb(date, zt, dt, zts0, zts1, bkful);
        }
    }

    getYzdt(cb) {
        utils.get(this.yzUrl, null, response => {
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
            var jgrank3 = [];
            for (var i = 0; i < rows.length; i++) {
                var cels = rows[i].querySelectorAll('td');
                var des = cels[0].innerText.trim();
                var n = cels[1].innerText.trim();
                var c = emjyManager.getStockCode(n);
                var b = processAmount(cels[3].innerText.trim());
                var s = processAmount(cels[4].innerText.trim());
                if (des.includes('(三日榜单)')) {
                    jgrank3.push({n, c, p:b-s, b, s});
                } else {
                    jgrank.push({n, c, p:b-s, b, s});
                }
            }

            jgrank.sort((a, b) => {
                return a.p - b.p < 0;
            });
            jgrank3.sort((a, b) => {
                return a.p - b.p < 0;
            });
            return [jgrank, jgrank3];
        }

        var ele = document.createElement('html');
        ele.innerHTML = yzdthtml;
        var tbls = ele.querySelectorAll('table');
        var netbuy = [];
        var date = this.parseTodayDate(ele);
        for (var i = 0; i < tbls.length; i++) {
            var name = tbls[i].querySelectorAll('thead>tr>th')[0].innerText.trim();
            var ranks = getYzBuy(tbls[i]);
            netbuy.push({name, date, r1: ranks[0], r2: ranks[1]});
        }
        if (typeof(cb) === 'function') {
            cb(netbuy);
        }
    }
}

var dbkCommon = new DbkQuestClient();
