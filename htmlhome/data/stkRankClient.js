'use strict';

class StockRankClient {
    constructor(limit = 100) {
        this.limit = limit;
    }

    getRanks() {
        this.GetFromDabanke();
        //this.GetFromWencai();
    }

    GetFromDabanke() {
        dbkCommon.getRanks(r => {
            this.mergeRanks(r);
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

    GetFromWencai() {
        wencaiCommon.getWencaiRank100(datas => {
            this.onWencaiRankBack(datas);
        });
    }

    onWencaiRankBack(datas) {
        if (!datas || datas.length == 0) {
            return;
        }

        var rank = [];
        for (let i = 0; i < datas.length; i++) {
            const d = datas[i];
            for (const key in d) {
                if (key.includes('个股热度排名')) {
                    rank.push({code: d.code, rank: d[key].split('/')[0]});
                    break;
                }
            }
        }
        this.mergeRanks(rank);
    }
}
