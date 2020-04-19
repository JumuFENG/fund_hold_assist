window.onload = function () {
    etfFrm.initialize();
}

class ETF_Frame {
    constructor() {
        this.container = null;
    }

    initialize() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
        this.allEtfTable = new SortableTable();
        this.container.appendChild(this.allEtfTable.container);
        this.showAllEtfTable();
    }

    showAllEtfTable() {
        this.allEtfTable.reset();
        this.allEtfTable.setClickableHeader('名称', '类型', '平均波动', '最新值', '规模', '成立日期');
        for (var i in all_stocks) {
            this.allEtfTable.addRow(all_stocks[i].name, all_stocks[i].type, all_stocks[i].maver_fluct, all_stocks[i].last_close, all_stocks[i].sc.replace('亿元', ''), all_stocks[i].sd);
        };
    }
};

var etfFrm = new ETF_Frame();