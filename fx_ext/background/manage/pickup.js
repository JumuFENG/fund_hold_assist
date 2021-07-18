let futuStockUrl = 'https://www.futunn.com/stock/';

class ZtPool {
    constructor(sendMsg) {
        this.sendExtensionMessage = sendMsg;
        this.root = document.createElement('div');
        this.ztListDiv = null;
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + '-' + ('' + (now.getMonth()+1)).padStart(2, '0') + '-' + ('' + now.getDate()).padStart(2, '0');
    }

    createZtArea() {
        var getZtBtn = document.createElement('button');
        getZtBtn.textContent = '获取涨停股池';
        getZtBtn.sendMsg = this.sendExtensionMessage;
        getZtBtn.onclick = function(e) {
            var now = new Date();
            var dateVal = now.getDate();
            if (now.getDay() == 0) {
                dateVal -= 2;
            } else if (now.getDay() == 6 || now.getHours() < 10) {
                dateVal -= 1;
            };
            var date = now.getFullYear() + ('' + (now.getMonth() + 1)).padStart(2, '0') + ('' + dateVal).padStart(2, '0');;
            e.target.sendMsg({command:'mngr.getZTPool', date});
        }
        this.root.appendChild(getZtBtn);
    }

    onZTPoolback(ztpool) {
        var ztStocks = [];
        if (!ztpool || !ztpool.data) {
            console.log('onZTPoolback', ztpool);
            return;
        };
        for (var i = 0; i < ztpool.data.pool.length; ++i) {
            var stock = ztpool.data.pool[i];
            if (stock.c.startsWith('68') || stock.c.startsWith('30')) {
                continue;
            }
            if (stock.n.includes("ST")) {
                continue;
            }
            if (stock.n.endsWith('退')) {
                continue;
            }
            if (stock.n.startsWith('退市')) {
                continue;
            }
            if (stock.lbc > 1) {
                continue;
            }
            if (stock.zttj.days != stock.zttj.ct) {
                continue;
            }
            var name = stock.n;
            var code = stock.c;
            var url = futuStockUrl + code + (stock.m == '0' ? '-SZ' : '-SH');
            var ltsz = stock.ltsz / 100000000; // 流通市值
            var zsz = stock.tshare / 100000000; // 总市值
            var hsl = stock.hs;  // 换手率 %
            var zbc = stock.zbc; // 炸板次数
            var price = stock.p / 1000; // 最新价
            ztStocks.push({name, code, url, ltsz, zsz, hsl, zbc, price});
        }

        this.refreshZtPool(ztStocks);
    }

    refreshZtPool(stocks) {
        if (!this.ztListDiv) {
            this.ztTable = new SortableTable();
            this.ztListDiv = this.ztTable.container;
            this.root.appendChild(this.ztListDiv);
        }
        this.ztTable.reset();
        this.ztTable.setClickableHeader('序号', '名称(代码)', '总市值', '流通市值', '炸板次数', '换手率(%)', '首板价格', '首板日期');
        var today = this.getTodayDate();
        for (var i = 0; i < stocks.length; i++) {
            var anchor = document.createElement('a');
            anchor.textContent = stocks[i].name + '(' + stocks[i].code + ')';
            anchor.href = stocks[i].url;
            anchor.target = '_blank';
            this.ztTable.addRow(
                i + 1, anchor,
                parseFloat(stocks[i].zsz.toFixed(4)),
                parseFloat(stocks[i].ltsz.toFixed(4)),
                stocks[i].zbc,
                parseFloat(stocks[i].hsl.toFixed(2)),
                stocks[i].price,
                today
                );
        };
    }
};

