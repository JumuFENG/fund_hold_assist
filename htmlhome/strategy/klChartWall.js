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
            var cw = document.createElement('div');
            cw.style.width = '900px';
            cw.style.height = '300px';
            this.container.appendChild(cw);
            var chart = new KlChartSimple(cw, emjyBack.stockName(skli.code) + '(' + skli.code + ')');
            chart.drawKlines(emjyBack.getKlData(skli.code, skli.kltype, skli.start, skli.end));
        }
    }
}
