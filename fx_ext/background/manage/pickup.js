let futuStockUrl = 'https://www.futunn.com/stock/';
// var startDate = new Date('2021-01-01');
class ZtPool {
    constructor(sendMsg) {
        this.sendExtensionMessage = sendMsg;
        this.root = document.createElement('div');
        this.ztListDiv = null;
        this.ztStocks = [];
        this.zt2Stocks = []; // 连板
        this.zt3Stocks = []; // 3连板
        this.gettingKline = new Set();
    }

    dateToString(dt, sep = '') {
        return dt.getFullYear() + sep + ('' + (dt.getMonth() + 1)).padStart(2, '0') + sep + ('' + dt.getDate()).padStart(2, '0');
    }

    getLastTradingDate(sep = '') {
        // if (sep == '') {
        //     startDate.setDate(startDate.getDate() + 1);
        // };
        // return this.dateToString(startDate, sep);
        var now = new Date();
        var dateVal = now.getDate();
        if (now.getDay() == 0) {
            dateVal -= 2;
        } else if (now.getDay() == 6 || now.getHours() < 10) {
            dateVal -= 1;
        };
        now.setDate(dateVal);
        return this.dateToString(now, sep);
    }

    getNextDate(date, sep = '') {
        var d = new Date(date);
        d.setDate(d.getDate() + 1);
        return this.dateToString(d, sep);
    }

    createZtArea() {
        var fileIptDiv = document.createElement('div');
        var inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.owner = this;
        inputFile.addEventListener('change', (e) => {
            e.target.files[0].text().then(text => {
                e.target.owner.onSavedZTPoolLoaded(JSON.parse(text));
            });
        });
        fileIptDiv.appendChild(document.createTextNode('首 板涨停文件 '));
        fileIptDiv.appendChild(inputFile);
        fileIptDiv.appendChild(document.createElement('br'));
        var inputFile2 = document.createElement('input');
        inputFile2.type = 'file';
        inputFile2.owner = this;
        inputFile2.addEventListener('change', e => {
            e.target.files[0].text().then(text => {
                e.target.owner.onSavedZTPoolLoaded(JSON.parse(text), 2);
            });
        });
        fileIptDiv.appendChild(document.createTextNode('二连板涨停文件 '));
        fileIptDiv.appendChild(inputFile2);
        fileIptDiv.appendChild(document.createElement('br'));
        var inputFile3 = document.createElement('input');
        inputFile3.type = 'file';
        inputFile3.owner = this;
        inputFile3.addEventListener('change', e => {
            e.target.files[0].text().then(text => {
                e.target.owner.onSavedZTPoolLoaded(JSON.parse(text), 3);
            });
        });
        fileIptDiv.appendChild(document.createTextNode('三连板涨停文件 '));
        fileIptDiv.appendChild(inputFile3);
        this.root.appendChild(fileIptDiv);
        var getZtBtn = document.createElement('button');
        getZtBtn.textContent = '获取最新涨停股池';
        getZtBtn.owner = this;
        getZtBtn.onclick = function(e) {
            e.target.owner.sendExtensionMessage({command:'mngr.getZTPool', date: e.target.owner.getLastTradingDate()});
        }
        this.root.appendChild(getZtBtn);
        var saveZtBtn = document.createElement('button');
        saveZtBtn.textContent = '保存';
        saveZtBtn.owner = this;
        saveZtBtn.onclick = function(e) {
            e.target.owner.saveZtPool();
        }
        this.root.appendChild(saveZtBtn);
    }

    onZTPoolback(ztpool) {
        if (!ztpool || !ztpool.data) {
            console.log('onZTPoolback', ztpool);
            return;
        };
        for (var i = 0; i < ztpool.data.pool.length; ++i) {
            var stock = ztpool.data.pool[i];
            if (stock.c.startsWith('68') || stock.c.startsWith('30')) {
                continue;
            }
            if (stock.n.startsWith('N')) {
                continue;
            };
            if (stock.n.includes("ST")) {
                continue;
            }
            if (stock.n.endsWith('退')) {
                continue;
            }
            if (stock.n.startsWith('退市')) {
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
            var ztdate = this.getLastTradingDate('-');
            if (stock.lbc == 1) {
                this.addToZtStocks(this.ztStocks, {name, code, url, ltsz, zsz, hsl, zbc, price, ztdate})
            } else if (stock.lbc == 2) {
                this.addToZtStocks(this.zt2Stocks, {name, code, url, ltsz, zsz, hsl, zbc, price, ztdate});
            } else if (stock.lbc == 3) {
                this.addToZtStocks(this.zt3Stocks, {name, code, url, ltsz, zsz, hsl, zbc, price, ztdate})
            };
        }

        this.refreshZtPool();
    }

    addToZtStocks(ztStocks, stock) {
        var stk = ztStocks.find(s => {return s.code == stock.code && s.ztdate == stock.ztdate;});
        if (!stk) {
            ztStocks.push(stock);
        }
    }

    onSavedZTPoolLoaded(ztpool, zttype = 1) {
        if (zttype == 1) {
            if (this.ztStocks.length == 0) {
                this.ztStocks = ztpool;
            } else {
                for (var i = 0; i < ztpool.length; i++) {
                    this.addToZtStocks(this.ztStocks, ztpool[i]);
                };
            };
        } else if (zttype == 2) {
            if (this.zt2Stocks.length == 0) {
                this.zt2Stocks = ztpool;
            } else {
                for (var i = 0; i < ztpool.length; i++) {
                    this.addToZtStocks(this.zt2Stocks, ztpool[i]);
                };
            };
        } else if (zttype == 3) {
            if (this.zt3Stocks.length == 0) {
                this.zt3Stocks = ztpool;
            } else {
                for (var i = 0; i < ztpool.length; i++) {
                    this.addToZtStocks(this.zt3Stocks, ztpool[i]);
                };
            };
        };

        for (var i = 0; i < ztpool.length; i++) {
            var code = ztpool[i].code;
            var date = this.getNextDate(ztpool[i].ztdate);
            if (ztpool[i].kline && ztpool[i].kline.length > 0) {
                var len = ztpool[i].kline.length;
                date = this.getNextDate(ztpool[i].kline[len - 1].date);
            };
            if (date <= this.dateToString(new Date())) {
                this.sendExtensionMessage({command:'mngr.getkline', code, date, len: 20});
                this.gettingKline.add(code);
            };
        };
        this.refreshZtPool();
    }

    parseKlines(kline) {
        var klines = [];
        for (var i = 0; kline && i < kline.length; i++) {
            var kl = kline[i].split(',');
            var date = kl[0];
            var o = kl[1];
            var c = kl[2];
            var h = kl[3];
            var l = kl[4];
            klines.push({date, o, c, h, l});
        };
        return klines;
    }

    updateKline(kline) {
        var klines = this.parseKlines(kline.data.klines);
        this.updateKlineTo(this.ztStocks.find(s => {return s.code == kline.data.code;}), klines, 1);
        this.updateKlineTo(this.zt2Stocks.find(s => {return s.code == kline.data.code;}), klines, 2);
        this.updateKlineTo(this.zt3Stocks.find(s => {return s.code == kline.data.code;}), klines, 3);
        
        if (this.gettingKline.has(kline.data.code)) {
            this.gettingKline.delete(kline.data.code);
        };

        if (this.gettingKline.size == 0) {
            this.refreshZtPool();
        };
    }

    updateKlineTo(stock, klines, zttype) {
        if (!stock) {
            return;
        };
        if (!stock.name) {
            stock.name = kline.data.name;
        }

        if (!stock.kline || stock.kline.length == 0) {
            stock.kline = klines;
        } else {
            var len = stock.kline.length;
            var lastDate = stock.kline[len-1].date;
            for (var i = 0; i < klines.length; i++) {
                if (klines[i].date > lastDate) {
                    stock.kline.push(klines[i]);
                }
            };
        }
    }

    refreshZtPool() {
        if (!this.ztListDiv) {
            this.ztListDiv = document.createElement('div');
            this.ztTable = new SortableTable();
            this.zt2Table = new SortableTable();
            this.zt3Table = new SortableTable();
            this.ztListDiv.appendChild(this.ztTable.container);
            this.ztListDiv.appendChild(this.zt2Table.container);
            this.ztListDiv.appendChild(this.zt3Table.container);
            this.root.appendChild(this.ztListDiv);
        }
        this.refreshZtTable(this.ztTable, this.ztStocks);
        this.refreshZtTable(this.zt2Table, this.zt2Stocks);
        this.refreshZtTable(this.zt3Table, this.zt3Stocks);
    }

    refreshZtTable(ztTable, ztStocks) {
        ztTable.reset();
        ztTable.setClickableHeader('序号', '名称(代码)', '总市值', '流通市值', '炸板次数', '换手率(%)', '首板价格', '首板日期', '次开', '次高', '次低', '次收', '3开', '3高', '3低', '3收');
        for (var i = 0; i < ztStocks.length; i++) {
            var anchor = document.createElement('a');
            var stocki = ztStocks[i];
            anchor.textContent = stocki.name + '(' + stocki.code + ')';
            anchor.href = stocki.url;
            anchor.target = '_blank';
            ztTable.addRow(
                i + 1, anchor,
                parseFloat(stocki.zsz.toFixed(4)),
                parseFloat(stocki.ltsz.toFixed(4)),
                stocki.zbc,
                parseFloat(stocki.hsl.toFixed(2)),
                stocki.price,
                stocki.ztdate,
                stocki.kline && stocki.kline.length > 0 ? stocki.kline[0].o : '',
                stocki.kline && stocki.kline.length > 0 ? stocki.kline[0].h : '',
                stocki.kline && stocki.kline.length > 0 ? stocki.kline[0].l : '',
                stocki.kline && stocki.kline.length > 0 ? stocki.kline[0].c : '',
                stocki.kline && stocki.kline.length > 1 ? stocki.kline[1].o : '',
                stocki.kline && stocki.kline.length > 1 ? stocki.kline[1].h : '',
                stocki.kline && stocki.kline.length > 1 ? stocki.kline[1].l : '',
                stocki.kline && stocki.kline.length > 1 ? stocki.kline[1].c : '',
                );
        };
    }

    saveZtStocks(ztStocks, filename) {
        var blob = new Blob([JSON.stringify(ztStocks)], {type: 'application/json'});
        this.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
    }

    saveZtPool() {
        var date = this.dateToString(new Date());
        if (this.ztStocks.length > 0) {
            this.saveZtStocks(this.ztStocks, 'StockDailyPrices/首板统计/zt1pool' + date + '.json');
        };
        if (this.zt2Stocks.length > 0) {
            this.saveZtStocks(this.zt2Stocks, 'StockDailyPrices/首板统计/zt2pool' + date + '.json');
        };
        if (this.zt3Stocks.length > 0) {
            this.saveZtStocks(this.zt3Stocks, 'StockDailyPrices/首板统计/zt3pool' + date + '.json');
        };
    }
};

