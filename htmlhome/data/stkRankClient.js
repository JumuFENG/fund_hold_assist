'use strict';

class StockRankClient {
    constructor(limit = 100) {
        this.limit = limit;
    }

    getRanks() {
        var rkurl = emjyBack.fha.server + 'stock?act=hotrank';
        fetch(rkurl).then(r=>r.json()).then(rk => {
            var ranks = [];
            for (var r of rk) {
                var ri = {};
                for (var k in r) {
                    if (k == 'code') {
                        ri[k] = r[k].substring(2);
                    } else {
                        ri[k] = r[k];
                    }
                }
                ranks.push(ri);
            }
            this.mergeRanks(ranks);
        });
    }

    mergeRanks(rank) {
        if (!rank || rank.length == 0) {
            return;
        }

        if (!this.ranks || this.ranks.length == 0) {
            this.ranks = rank;
            return;
        }

        for (let i = 0; i < this.ranks.length; i++) {
            var code = this.ranks[i].code;
            if (!rank.find(r => r.code == code)) {
                this.ranks.splice(i, 1);
                i--;
            }
        }
    }
}
