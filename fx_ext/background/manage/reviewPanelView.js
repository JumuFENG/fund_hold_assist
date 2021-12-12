'use strict';

class ReviewPanelPage extends RadioAnchorPage {
    constructor() {
        super('复盘');
        this.stocksTable = new SortableTable();
        this.container.appendChild(this.stocksTable.container);
        if (emjyManager.delstocks && emjyManager.delstocks.length > 0) {
            this.showStockTable();
        }
    }

    show() {
        super.show();
        if (!this.stocksTable.table) {
            this.showStockTable();
        }
    }

    showStockTable() {
        if (!emjyManager.delstocks || emjyManager.delstocks.length == 0) {
            return;
        }

        this.stocksTable.reset();
        this.stocksTable.setClickableHeader('', '代码', '名称', '日期', '放量程度', '删除日', '走势');
        for (let i = 0; i < emjyManager.delstocks.length; i++) {
            var stocki = emjyManager.delstocks[i];
            var anchor = document.createElement('a');
            anchor.textContent = stocki.name;
            if (stocki.m !== undefined) {
                anchor.href = emStockUrl + (stocki.m == '0' ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            } else {
                anchor.href = emStockUrl + (stocki.code.startsWith('00') ? 'sz' : 'sh') + stocki.code + emStockUrlTail;
            }
            anchor.target = '_blank';

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
}