'use strict';


class StockZdfRankPanelPage extends RadioAnchorPage {
    constructor() {
        super('涨幅榜');
        this.rk_arr = [5, 10, 20, 30, 60, 120, 250];
        this.maxRanksPerPage = 3;
        this.allRanksCode = [];
        this.ranksIdx = 0;
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.topPanel = document.createElement('div');
            this.container.appendChild(this.topPanel);
            this.overallRanksDiv = document.createElement('div');
            this.container.appendChild(this.overallRanksDiv);
            for(const n of this.rk_arr) {
                var rark = document.createElement('input');
                rark.type = 'radio';
                rark.value = n;
                rark.name = 'rankradio';
                rark.id = 'rankradio'+n;
                if (n == 10) {
                    rark.checked = true;
                }
                rark.onchange = e => {
                    if (e.target.checked) {
                        if (!this.dayRanks) {
                            this.showStockRanks();
                            return;
                        }
                        this.setCandidateStocks(e.target.value);
                        this.ranksIdx = 0;
                        if (this.checkStockRanks()) {
                            this.showStockRanks();
                        }
                    }
                }
                this.overallRanksDiv.appendChild(rark);
                var rlbl = document.createElement('label');
                rlbl.textContent = n + '日涨幅';
                rlbl.setAttribute('for', 'rankradio'+n);
                this.overallRanksDiv.appendChild(rlbl);
            }
            var navPrev = document.createElement('button');
            navPrev.textContent = '< <';
            navPrev.onclick = e => {
                    this.ranksIdx -= this.maxRanksPerPage;
                if (this.ranksIdx < 0) {
                    this.ranksIdx += this.allRanksCode.length;
                }
                if (this.checkStockRanks()) {
                    this.showStockRanks();
                }
            }
            var navNext = document.createElement('button');
            navNext.textContent = '> >';
            navNext.onclick = e => {
                this.ranksIdx += this.maxRanksPerPage;
                if (this.ranksIdx >= this.allRanksCode.length) {
                    this.ranksIdx -= this.allRanksCode.length;
                }
                if (this.checkStockRanks()) {
                    this.showStockRanks();
                }
            }
            this.showingStocks = document.createElement('div');
            this.showingStocks.style.display = 'inline';
            var navDiv = document.createElement('div');
            navDiv.appendChild(navPrev);
            navDiv.appendChild(this.showingStocks);
            navDiv.appendChild(navNext);
            this.overallRanksDiv.appendChild(navDiv);
            this.overallRanksChart = document.createElement('div');
            this.overallRanksDiv.appendChild(this.overallRanksChart);
            this.singleRanksDiv = document.createElement('div');
            this.container.appendChild(this.singleRanksDiv);
            this.showStockRanks();
        }
    }

    checkStockRanks() {
        var exists = true;
        for (var i = 0; i < this.maxRanksPerPage; i++) {
            var idx = this.ranksIdx + i;
            if (this.ranksIdx + i >= this.allRanksCode.length) {
                idx -= this.allRanksCode.length;
            }
            if (this.stockRanks && this.stockRanks[this.allRanksCode[idx]]) {
                continue;
            }
            this.fetchStockRanks(this.allRanksCode[idx], null, (c, rks) => {
                this.mergeRank2Ranks(c, rks);
                this.showStockRanks();
            });
            exists = false;
        }
        return exists;
    }

    fetchDefaultRanks(date) {
        var url = emjyBack.fha.server + 'stock?act=rank&start=' + date;
        utils.get(url, null, rdata => {
            this.dayRanks = JSON.parse(rdata);
            this.setCandidateStocks(this.container.querySelector('input[name="rankradio"]:checked').value);
            if (this.checkStockRanks()) {
                this.showStockRanks();
            }
        });
    }

    setCandidateStocks(rkn) {
        var rk3068 = [];
        var rk0060 = [];
        var rkidx = this.rk_arr.indexOf(Number(rkn));
        this.dayRanks.sort((a,b) => a[rkidx + rkidx + 2] - b[rkidx + rkidx + 2]);
        for (const dr of this.dayRanks) {
            if (dr[0].startsWith('SH60') || dr[0].startsWith('SZ00')) {
                if (rk0060.length < 35) {
                    rk0060.push(dr[0]);
                }
            } else if (dr[0].startsWith('SH68') || dr[0].startsWith('SZ30')) {
                if (rk3068.length < 10) {
                    rk3068.push(dr[0]);
                }
            }
        }
        this.allRanksCode = []
        rk3068.forEach(c => {this.allRanksCode.push(c)});
        rk0060.forEach(c => {this.allRanksCode.push(c)});
    }

    showStockRanks() {
        if (!this.stockRanks || !this.dayRanks) {
            this.stockRanks = {};
            this.fetchDefaultRanks(utils.getTodayDate());
            return;
        }

        var rkedCode = [];
        for (var i = 0; i < this.maxRanksPerPage; i++) {
            var idx = this.ranksIdx + i;
            if (idx >= this.allRanksCode.length) {
                idx -= this.allRanksCode.length;
            }
            if (this.stockRanks[this.allRanksCode[idx]]) {
                rkedCode.push(this.allRanksCode[idx]);
            }
        }
        if (rkedCode.length < this.maxRanksPerPage) {
            return;
        }

        this.singleRanksDiv.style.display = 'none';
        this.overallRanksDiv.style.display = 'block';
        utils.removeAllChild(this.showingStocks);
        rkedCode.forEach(c => {
            var astock = emjyBack.stockAnchor(c);
            astock.code = c;
            var scode = c;
            if (c.length == 8) {
                scode = c.substring(2);
            }
            astock.textContent = astock.textContent == scode ? scode : astock.textContent + '(' + scode + ')';
            astock.href = 'javascript:void(0)';
            astock.onclick = e => {
                this.showSingleKlRank(e.target.code, this.getStartDate(e.target.code));
                return false;
            }
            this.showingStocks.appendChild(astock);
        });

        var ranks = this.getRankDataByDates(rkedCode, this.getContinouseDates(rkedCode));
        utils.removeAllChild(this.overallRanksChart);
        var allRanksChart = document.createElement('div');
        allRanksChart.style.width = '100%';
        allRanksChart.style.height = 800;
        this.overallRanksChart.appendChild(allRanksChart);
        var chart = new RanksChart(allRanksChart);
        chart.draw(ranks);
    }

    fetchStockRanks(code, start, cb) {
        var url = emjyBack.fha.server + 'stock?act=rank&code=' + code;
        if (start) {
            url += '&start=' + start;
        }
        utils.get(url, null, rdata => {
            var rankdata = JSON.parse(rdata);
            if (typeof(cb) === 'function') {
                cb(code, rankdata);
            }
        });
    }

    mergeRank2Ranks(code, rankdata) {
        this.stockRanks[code] = [];
        for (var j = 0; j < rankdata.length; j++) {
            var rk = {'time': rankdata[j][0]};
            for (var k = 0; k < this.rk_arr.length; k++) {
                rk['zdf'+this.rk_arr[k]] = rankdata[j][k+k+1];
                if (rankdata[j][k+k+2] <= 50) {
                    rk['rk'+this.rk_arr[k]] = rankdata[j][k+k+2];
                }
            }
            this.stockRanks[code].push(rk);
        }
    }

    mergeRank2Kl(code, rankdata) {
        var kldata = emjyBack.klines[code].klines['101'];
        var j = 0;
        for (var i = 0; i < kldata.length; i ++) {
            if (j >= rankdata.length) {
                break;
            }
            if (kldata[i].time < rankdata[j][0]) {
                for (var k = 0; k < this.rk_arr.length; k++) {
                    kldata[i]['zdf'+this.rk_arr[k]] = '';
                    kldata[i]['rk'+this.rk_arr[k]] = '';
                }
                continue;
            }
            while (kldata[i].time > rankdata[j][0]) {
                j ++;
            }
            if (kldata[i].time == rankdata[j][0]) {
                for (var k = 0; k < this.rk_arr.length; k++) {
                    kldata[i]['zdf'+this.rk_arr[k]] = rankdata[j][k+k+1];
                    if (rankdata[j][k+k+2] <= 50) {
                        kldata[i]['rk'+this.rk_arr[k]] = rankdata[j][k+k+2];
                    }
                }
                j ++;
            }
        }
    }

    getStartDate(c) {
        var startdate = utils.getTodayDate();
        for (var i = this.stockRanks[c].length - 1; i > 0; i--) {
            if (new Date(this.stockRanks[c][i].time) - new Date(this.stockRanks[c][i-1].time) > 10 * 24 * 60 * 60 * 1000) {
                if (this.stockRanks[c][i].time < startdate) {
                    startdate = this.stockRanks[c][i].time;
                }
                break;
            }
        }
        return startdate;
    }

    getContinouseDates(rkedCode) {
        var startdate = utils.getTodayDate();
        for (const c of rkedCode) {
            if (!this.stockRanks[c]) {
                continue;
            }
            var cstartdate = this.getStartDate(c);
            if (cstartdate < startdate) {
                startdate = cstartdate;
            }
        }
        var allDates = [];
        for (const c of rkedCode) {
            if (!this.stockRanks[c]) {
                continue;
            }
            for (var i = 0; i < this.stockRanks[c].length; i++) {
                if (this.stockRanks[c][i].time < startdate) {
                    continue;
                }
                if (!allDates.includes(this.stockRanks[c][i].time)) {
                    allDates.push(this.stockRanks[c][i].time);
                }
            }
        }
        allDates.sort();
        return allDates;
    }

    getRankDataByDates(rkedCode, dates) {
        var rkdata = {};
        for (const c of rkedCode) {
            if (!this.stockRanks[c]) {
                continue;
            }
            rkdata[c] = [];
            var j = 0;
            for (var i = 0; i < this.stockRanks[c].length; i++) {
                if (this.stockRanks[c][i].time < dates[0]) {
                    continue;
                }
                while (this.stockRanks[c][i].time > dates[j]) {
                    rkdata[c].push({time: dates[j]});
                    j ++;
                }
                rkdata[c].push(this.stockRanks[c][i]);
                j ++;
            }
        }
        return rkdata;
    }

    showSingleKlRank(code, start) {
        if (!emjyBack.klines[code]) {
            emjyBack.fetchStockKline(code, '101', start);
            this.fetchStockRanks(code, start, (c, rks) => {
                this.mergeRank2Kl(c, rks);
                this.showSingleKlRank(c, start);
            });
            return;
        }

        this.singleRanksDiv.style.display = 'block';
        this.overallRanksDiv.style.display = 'none';
        utils.removeAllChild(this.singleRanksDiv);
        var btnShowAll = document.createElement('button');
        btnShowAll.textContent = '<<返回';
        btnShowAll.onclick = e => {
            this.singleRanksDiv.style.display = 'none';
            this.overallRanksDiv.style.display = 'block';
        }
        this.singleRanksDiv.appendChild(btnShowAll);
        var singleRkChart = document.createElement('div');
        singleRkChart.style.width = '100%';
        singleRkChart.style.height = 600;
        this.singleRanksDiv.appendChild(singleRkChart);
        var chart = new KlChartWithRanks(singleRkChart, '', '');
        chart.draw(emjyBack.klines[code].klines['101']);
    }
}
