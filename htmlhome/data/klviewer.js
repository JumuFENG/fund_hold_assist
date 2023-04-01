'use strict';

class KlViewerPanelPage extends RadioAnchorPage {
    constructor() {
        super('K线图集');
        this.stkAll = {};
        this.showingDate = null;
        this.showingStock = null;
    }

    fetchStockData(skey) {
        var url = emjyBack.fha.server + 'stock?act=pickupdone&key=' + skey;
        utils.get(url, null, stks => {
            this.stkAll[skey] = JSON.parse(stks);
            this.showNextStockKline();
        });
    }

    fetchStockKline() {
        var mktCode = emjyBack.getLongStockCode(this.showingStock);
        var url = emjyBack.fha.server + 'api/stockhist?fqt=1&code=' + mktCode + '&kltype=101';
        var zdate = new Date(this.showingDate);
        zdate.setMonth(zdate.getMonth() - 1);
        url += '&start=' + utils.dateToString(zdate);
        utils.get(url, null, ksdata => {
            var kdata = JSON.parse(ksdata);
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', this.showingStock);
                return;
            }

            var klmessage = {kltype:'101', kline:{data:{klines:[]}}};
            kdata.forEach(kl => {
                klmessage.kline.data.klines.push(kl[1] + ',' + kl[5] + ',' + kl[2] + ',' + kl[3] + ',' + kl[4] + ',' +kl[8]);
            });
            this.stockKlines = new KLine(this.showingStock);
            this.stockKlines.updateRtKline(klmessage);
            this.drawStockKline();
        });
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.initView();
        }
    }

    initView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
        var topControl = document.createElement('div');
        topControl.style.display = 'flex';
        this.topPanel.appendChild(topControl);

        this.stkKeySelector = document.createElement('select');
        for (var k in strategyOptions) {
            this.stkKeySelector.options.add(new Option(strategyOptions[k].name, strategyOptions[k].val));
        }
        this.stkKeySelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.stkKeySelector);

        this.mktSelector = document.createElement('select');
        for (var k in mktOptions) {
            this.mktSelector.options.add(new Option(mktOptions[k].name, mktOptions[k].val));
        }
        this.mktSelector.onchange = e => {
            this.onStkKeySelected();
        }
        topControl.appendChild(this.mktSelector);

        var btnPrev = document.createElement('button');
        btnPrev.textContent = '上一个';
        btnPrev.onclick = _ => {
            this.showPrevStockKline();
        }
        topControl.appendChild(btnPrev);

        var btnNext = document.createElement('button');
        btnNext.textContent = '下一个';
        btnNext.onclick = _ => {
            this.showNextStockKline();
        }
        topControl.appendChild(btnNext);

        this.contentPanel = document.createElement('div');
        this.container.appendChild(this.contentPanel);

        this.viewTable = new SortableTable();
        this.contentPanel.appendChild(this.viewTable.container);
        this.onStkKeySelected();
    }

    onStkKeySelected() {
        var skey = this.stkKeySelector.value;
        this.showingStock = null;
        this.showingDate = null;
        if (!this.stkAll[skey]) {
            this.fetchStockData(skey);
            return;
        }
        this.showNextStockKline();
    }

    mktMatch(code, mkt) {
        if (mkt == 0 || mkt > 2) {
            return true;
        }

        if (code.startsWith('30') || code.startsWith('68')) {
            return mkt == 2
        }
        return mkt == 1;
    }

    showNextStockKline() {
        var skey = this.stkKeySelector.value;
        if (!this.stkAll[skey]) {
            console.error('no stocks for', strategyOptions[skey].name);
            return;
        }
        var mkt = this.mktSelector.value;
        var showIdx = 0;
        if (this.showingDate && this.showingStock) {
            var showingIdx = this.stkAll[skey].findIndex(x => x[1] == this.showingDate && x[0].substring(2) == this.showingStock);
            showIdx = showingIdx + 1;
            if (showIdx >= this.stkAll[skey].length) {
                showIdx = 0;
            }
        }
        while (showIdx < this.stkAll[skey].length && this.stkAll[skey].length > 0) {
            var x = this.stkAll[skey][showIdx];
            var code = x[0].substring(2);
            var date = x[1];
            if (code == this.showingStock && date == this.showingDate) {
                break;
            }

            if (!this.mktMatch(code, mkt)) {
                showIdx++;
                if (showIdx >= this.stkAll[skey].length) {
                    showIdx = 0;
                }
                continue;
            }

            this.showingStock = code;
            this.showingDate = x[1];
            this.fetchStockKline();
            break;
        }
    }

    showPrevStockKline() {
        var skey = this.stkKeySelector.value;
        if (!this.stkAll[skey]) {
            console.error('no stocks for', strategyOptions[skey].name);
            return;
        }
        var mkt = this.mktSelector.value;
        var showIdx = this.stkAll[skey].length - 1;
        if (this.showingDate && this.showingStock) {
            var showingIdx = this.stkAll[skey].findIndex(x => x[1] == this.showingDate && x[0].substring(2) == this.showingStock);
            showIdx = showingIdx - 1;
            if (showIdx < 0) {
                showIdx = this.stkAll[skey].length - 1;
            }
        }

        while(showIdx >= 0 && this.stkAll[skey].length > 0) {
            var x = this.stkAll[skey][showIdx];
            var code = x[0].substring(2);
            var date = x[1];
            if (code == this.showingStock && date == this.showingDate) {
                break;
            }

            if (!this.mktMatch(code, mkt)) {
                showIdx--;
                if (showIdx < 0) {
                    showIdx = this.stkAll[skey].length - 1;
                }
                continue;
            }

            this.showingStock = code;
            this.showingDate = x[1];
            this.fetchStockKline();
            break;
        }
    }

    drawStockKline() {
        if (!this.stockKlines) {
            console.error('no kline data', this.showingStock);
            return;
        }

        if (!this.klineChart) {
            this.klineChart = document.createElement('div');
            this.klineChart.style.width = '100%';
            this.klineChart.style.height = 500;
            this.contentPanel.appendChild(this.klineChart);
        }
        var chart = new KlChart(this.klineChart, emjyBack.stockName(this.showingStock) + '(' + this.showingStock + ')', emjyBack.stockEmLink(this.showingStock));
        var klines = this.stockKlines.klines['101'];
        chart.drawKlines(klines);
    }
}
