'use strict';

class KlChartWall {
    constructor() {
        this.container = document.createElement('div');
        this.allstocks = [];
    }

    reset() {
        this.allstocks = [];
        utils.removeAllChild(this.container);
    }

    addStock(code, kltype, start, end) {
        if (!kltype) {
            kltype = '101';
        }
        this.allstocks.push({code, kltype, start, end});
    }

    drawCharts() {
        utils.removeAllChild(this.container);
        for (var i = 0; i < this.allstocks.length; ++i) {
            var skli = this.allstocks[i];
            var chart = new KlChartSvg(emjyBack.stockName(skli.code) + '(' + skli.code + ')');
            var cw = document.createElement('div');
            cw.style.width = 900;
            cw.style.height = 300;
            cw.appendChild(chart.container);
            this.container.appendChild(cw);
            chart.drawKlines(emjyBack.getKlData(skli.code, skli.kltype, skli.start, skli.end));
        }
    }
}