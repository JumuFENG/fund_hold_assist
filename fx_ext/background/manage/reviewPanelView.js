'use strict';

class ReviewPanelPage extends RadioAnchorPage {
    constructor() {
        super('复盘');
        this.stocksTable = new SortableTable();
        this.container.appendChild(this.stocksTable.container);
        if (emjyManager.delstocks && emjyManager.delstocks.length > 0) {
            this.showStockTable();
        }
        this.scatterDiv = document.createElement('div');
        this.scatterDiv.style.width = '300';
        this.scatterDiv.style.height = '400';
        this.container.appendChild(this.scatterDiv);
    }

    show() {
        super.show();
        this.showScatterChart();
        // if (!this.stocksTable.table) {
        //     this.showStockTable();
        // }
    }

    showStockTable() {
        if (!emjyManager.delstocks || emjyManager.delstocks.length == 0) {
            return;
        }

        this.stocksTable.reset();
        this.stocksTable.setClickableHeader('', '代码', '名称', '日期', '上板强度', '放量程度', '删除日', '走势');
        for (let i = 0; i < emjyManager.delstocks.length; i++) {
            var stocki = emjyManager.delstocks[i];
            var anchor = emjyManager.stockAnchor(stocki.code);
            var chartDiv = document.createElement('div');
            chartDiv.code = stocki.code;
            chartDiv.ztdate = stocki.ztdate;
            chartDiv.style.width = '400';
            chartDiv.style.height = '230';
            chartDiv.onclick = (e) => {
                this.showKlChart(e.target);
            }

            this.stocksTable.addRow(
                i,
                stocki.code,
                anchor,
                stocki.ztdate,
                stocki.zstrength,
                stockVolScales[stocki.vscale],
                stocki.rmvdate,
                chartDiv
                );
        }
    }

    showKlChart(chart) {
        if (chart.childElementCount > 0) {
            console.log(chart);
            return;
        }

        if (emjyManager.klines[chart.code] && emjyManager.klines[chart.code].klines) {
            var idx = emjyManager.klines[chart.code].klines['101'].findIndex(kl => kl.time == chart.ztdate);
            if (idx == -1) {
                emjyManager.klines[chart.code].klines['101'] = [];
                emjyManager.getDailyKlineSinceMonthAgo(chart.code, chart.ztdate);
                return;
            }

            if (idx > 0) {
                idx --;
            }
            var klCht = new KlChartSvg(chart.code);//new KlChartCanvas(chart.code); //
            chart.appendChild(klCht.container);

            klCht.drawKlines(emjyManager.klines[chart.code].klines['101'].slice(idx));
        } else {
            emjyManager.getDailyKlineSinceMonthAgo(chart.code, chart.ztdate);
        }
    }

    getCutEarnRate(code, time) {
        var kline = emjyManager.klines[code].klines['101'];
        var tidx = kline.findIndex(kl => kl.time == time);
        if (tidx < 0) {
            console.log('error: no kline data to check cut price', this.code, time);
            return;
        }
        var price = kline[tidx + 1].o;
        if (price == kline[tidx + 1].l && price == kline[tidx + 1].h) {
            return;
        }
        var c = kline[tidx].c * 0.9;
        var cut = c - kline[tidx].l > 0 ? kline[tidx].l : c.toFixed(2);
        var x = 100 * (kline[tidx + 1].o - cut) / kline[tidx + 1].o;
        var y = price;
        for (let i = tidx + 2; i < kline.length; i++) {
            const kl = kline[i];
            if (kl.o - cut < 0) {
                y = kl.o;
                break;
            }
            if (kl.l - cut < 0) {
                y = kl.l;
                break;
            }
            if (i < tidx + 3) {
                continue;
            }
            if (kl.h - kline[i - 1].h < 0) {
                y = kl.c;
                break;
            }
        }
        y = 100 * (y - price) / price;
        return [x, y];
    }

    showScatterChart() {
        if (!emjyManager.delstocks || emjyManager.delstocks.length == 0) {
            return;
        }

        var chart = new ScatterChart();
        this.scatterDiv.appendChild(chart.container);
        var data = [];
        for (let i = 0; i < emjyManager.delstocks.length; i++) {
            var stocki = emjyManager.delstocks[i];
            var d = this.getCutEarnRate(stocki.code, stocki.ztdate);
            if (d && d.length == 2) {
                data.push(d);
            }
        }
        console.log(data.length);
        console.log(data);
        chart.drawPoints(data);
    }
}
