'use strict';

class KlViewerPanelPage extends RadioAnchorPage {
    constructor() {
        super('K线图集');
        this.stkAll = {};
        this.showingInfo = null;
        this.showingCode = null;
    }

    fetchStockData(skey) {
        var url = emjyBack.fha.server + 'stock?act=pickupdone&key=' + skey;
        fetch(url).then(r=>r.json()).then(stks => {
            this.stkAll[skey] = stks;
            this.totalLabel.textContent = this.stkAll[skey].length;
            this.showNextStockKline();
        });
    }

    fetchStockKline() {
        var mktCode = emjyBack.getLongStockCode(this.showingCode);
        var fqt = strategyOptions[this.showingKey].fqt === undefined ? '1' : strategyOptions[this.showingKey].fqt;
        var url = emjyBack.fha.server + 'api/stockhist?fqt=' + fqt + '&code=' + mktCode + '&kltype=101';
        var zdate = new Date(this.showingInfo[1]);
        zdate.setMonth(zdate.getMonth() - 1);
        url += '&start=' + guang.dateToString(zdate, '-');
        fetch(url).then(r=>r.json()).then(kdata => {
            if (!kdata || kdata.length == 0) {
                console.error('no kline data for', this.showingCode);
                return;
            }

            var klmessage = {kltype:'101', kline:{data:{klines:[]}}};
            kdata.forEach(kl => {
                klmessage.kline.data.klines.push(kl[1] + ',' + kl[5] + ',' + kl[2] + ',' + kl[3] + ',' + kl[4] + ',' +kl[8]);
            });
            this.stockKlines = new KLine(this.showingCode);
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

        this.showingLabel = document.createElement('label');
        this.totalLabel = document.createElement('label');
        topControl.appendChild(this.showingLabel);
        topControl.appendChild(document.createTextNode('/'));
        topControl.appendChild(this.totalLabel);
        this.showingDateLabel = document.createElement('label');
        this.showingDateLabel.style.borderStyle = 'double';
        topControl.appendChild(this.showingDateLabel);

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
        this.showingCode = null;
        this.showingInfo = null;
        this.showingKey = skey
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
        if (this.showingInfo) {
            var showingIdx = this.stkAll[skey].findIndex(x => x[1] == this.showingInfo[1] && x[0].substring(2) == this.showingCode);
            showIdx = showingIdx + 1;
            if (showIdx >= this.stkAll[skey].length) {
                showIdx = 0;
            }
        }
        while (showIdx < this.stkAll[skey].length && this.stkAll[skey].length > 0) {
            var x = this.stkAll[skey][showIdx];
            var code = x[0].substring(2);
            var date = x[1];
            if (code == this.showingCode && date == this.showingInfo[1]) {
                break;
            }

            if (!this.mktMatch(code, mkt)) {
                showIdx++;
                if (showIdx >= this.stkAll[skey].length) {
                    showIdx = 0;
                }
                continue;
            }

            this.showingInfo = x;
            this.showingCode = code;
            this.fetchStockKline();
            this.showingLabel.textContent = showIdx;
            this.showingDateLabel.textContent = this.showingInfo[1];
            if (this.showingKey == 'cents') {
                this.showingDateLabel.textContent = this.showingInfo[1] + '~' + this.showingInfo[2];
            }
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
        if (this.showingInfo) {
            var showingIdx = this.stkAll[skey].findIndex(x => x[1] == this.showingInfo[1] && x[0].substring(2) == this.showingCode);
            showIdx = showingIdx - 1;
            if (showIdx < 0) {
                showIdx = this.stkAll[skey].length - 1;
            }
        }

        while(showIdx >= 0 && this.stkAll[skey].length > 0) {
            var x = this.stkAll[skey][showIdx];
            var code = x[0].substring(2);
            var date = x[1];
            if (code == this.showingCode && date == this.showingInfo[1]) {
                break;
            }

            if (!this.mktMatch(code, mkt)) {
                showIdx--;
                if (showIdx < 0) {
                    showIdx = this.stkAll[skey].length - 1;
                }
                continue;
            }

            this.showingInfo = x;
            this.showingCode = code;
            this.fetchStockKline();
            this.showingLabel.textContent = showIdx;
            this.showingDateLabel.textContent = this.showingInfo[1];
            if (this.showingKey == 'cents') {
                this.showingDateLabel.textContent = this.showingInfo[1] + '~' + this.showingInfo[2];
            }
            break;
        }
    }

    drawStockKline() {
        if (!this.stockKlines) {
            console.error('no kline data', this.showingCode);
            return;
        }

        if (!this.klineChart) {
            this.klineChart = document.createElement('div');
            this.klineChart.style.width = '100%';
            this.klineChart.style.height = 500;
            this.contentPanel.appendChild(this.klineChart);
        }
        var chart = new KlChart(this.klineChart, emjyBack.stockName(this.showingCode) + '(' + this.showingCode + ')', emjyBack.stockEmLink(this.showingCode));
        var klines = this.stockKlines.klines['101'];
        if (this.showingKey == 'cents') {
            klines = [];
            var edate = new Date(this.showingInfo[2]);
            edate.setMonth(edate.getMonth() + 1);
            edate = guang.dateToString(edate, '-');
            for (var i = 0; i < this.stockKlines.klines['101'].length; ++i) {
                if (this.stockKlines.klines['101'][i].time > edate) {
                    break;
                }
                klines.push(this.stockKlines.klines['101'][i]);
            }
        }
        chart.drawKlines(klines);
    }
}
