let futuStockUrl = 'https://www.futunn.com/stock/';
var startDate = new Date('2021-07-23');
var endDate = new Date('2021-07-23');

class ZtPool {
    constructor(sendMsg) {
        this.sendExtensionMessage = sendMsg;
        this.root = document.createElement('div');
        this.ztListDiv = null;
        this.ztpool = [];
        this.ztData = [{ztcount: 1, ztStocks: []}, {ztcount: 2, ztStocks:[]}, {ztcount: 3, ztStocks:[]}];
        this.gettingDate = null;
        this.gettingKline = new Set();
    }

    dateToString(dt, sep = '') {
        return dt.getFullYear() + sep + ('' + (dt.getMonth() + 1)).padStart(2, '0') + sep + ('' + dt.getDate()).padStart(2, '0');
    }

    getLastTradingDate(sep = '') {
        var now = new Date();
        var dateVal = now.getDate();
        if (now.getDay() == 0) {
            dateVal -= 2;
        } else if (now.getDay() == 6 || now.getHours() < 10) {
            dateVal -= 1;
        };
        now.setDate(dateVal);
        this.gettingDate = now;
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
        inputFile.multiple = true;
        inputFile.owner = this;
        inputFile.addEventListener('change', (e) => {
            if (e.target.files.length > 1) {
                e.target.owner.onMergeZTPools(e.target.files);
                return;
            };
            e.target.files[0].text().then(text => {
                e.target.owner.onSavedZTPoolLoaded(JSON.parse(text));
            });
        });
        fileIptDiv.appendChild(document.createTextNode('涨停板文件 '));
        fileIptDiv.appendChild(inputFile);
        fileIptDiv.appendChild(document.createElement('br'));
        this.root.appendChild(fileIptDiv);
        var getZtBtn = document.createElement('button');
        getZtBtn.textContent = '获取最新涨停股池';
        getZtBtn.owner = this;
        getZtBtn.onclick = function(e) {
            e.target.owner.getZTPool(owner.getLastTradingDate());
            // e.target.owner.getHistZTPool();
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

    getHistZTPool() {
        this.getZTPool(this.dateToString(startDate));
        this.gettingDate = startDate;
    }

    getZTPool(date) {
        this.sendExtensionMessage({command:'mngr.getZTPool', date});
    }

    onZTPoolback(ztpool) {
        var ztdate = this.dateToString(this.gettingDate, '-');
        this.gettingDate.setDate(this.gettingDate.getDate() + 1);
        if (this.gettingDate < endDate) {
            this.getZTPool(this.dateToString(this.gettingDate));
        };
        if (!ztpool || !ztpool.data) {
            console.log('onZTPoolback', ztpool);
            return;
        };

        this.ztpool.push({ztdate, pool: ztpool.data.pool});
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
            var m = stock.m;
            var ltsz = stock.ltsz / 100000000; // 流通市值
            var zsz = stock.tshare / 100000000; // 总市值
            var hsl = stock.hs;  // 换手率 %
            var zbc = stock.zbc; // 炸板次数
            var price = stock.p / 1000; // 最新价
            for (var j = 0; j < this.ztData.length; j++) {
                if (this.ztData[j].ztcount == stock.lbc) {
                    var stk = this.ztData[j].ztStocks.find(s => {return s.code == stock.c && s.ztdate == ztdate;});
                    if (!stk) {
                        this.ztData[j].ztStocks.push({name, code, m, ltsz, zsz, hsl, zbc, price, ztdate});
                    };
                };
            };
        }

        this.refreshZtPool();
    }

    onSavedZTPoolLoaded(ztpool) {
        this.ztData = ztpool;
        for (var i = 0; i < this.ztData.length; i++) {
            for (var j = 0; j < this.ztData[i].ztStocks.length; j++) {
                var stocki = this.ztData[i].ztStocks[j];
                var code = stocki.code;
                var date = this.getNextDate(stocki.ztdate);
                if (stocki.kline && stocki.kline.length > 0) {
                    var len = stocki.kline.length;
                    if (len >= 20) {
                        continue;
                    };
                    date = this.getNextDate(stocki.kline[len - 1].date);
                };
                if (date <= this.getLastTradingDate() && !this.gettingKline.has(code)) {
                    this.sendExtensionMessage({command:'mngr.getkline', code, date, len: 20});
                    this.gettingKline.add(code);
                };
            };
        };
        this.refreshZtPool();
    }

    onMergeZTPools(files) {
        var ztpool = [];
        var flen = files.length;
        for (var i = 0; i < files.length; i++) {
            files[i].text().then(text => {
                (JSON.parse(text)).forEach(z => {
                    if (!ztpool.find(d => {return d.ztdate == z.ztdate;})) {
                        ztpool.push(z);
                    };
                });
                flen--;
                if (flen == 0 && ztpool.length > 0) {
                    ztpool.sort((a, b) => {return a.ztdate > b .ztdate; });
                    var blob = new Blob([JSON.stringify(ztpool)], {type: 'application/json'});
                    var filename = 'StockDailyPrices/首板统计/ztdaily/' + ztpool[0].ztdate + '-' + ztpool[ztpool.length - 1].ztdate + '.json';
                    this.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
                };
            });
        };
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
        for (var i = 0; i < this.ztData.length; i++) {
            this.ztData[i].ztStocks.forEach(s => {
                if (s.code == kline.data.code) {
                    if (!s.kline || s.kline.length < 20) {
                        this.updateKlineTo(s, klines);
                    };
                };
            });
        };
        
        if (this.gettingKline.has(kline.data.code)) {
            this.gettingKline.delete(kline.data.code);
        };

        if (this.gettingKline.size == 0) {
            this.refreshZtPool();
        };
    }

    updateKlineTo(stock, klines) {
        if (!stock) {
            return;
        };
        if (!stock.name) {
            stock.name = kline.data.name;
        };

        if (!stock.kline) {
            stock.kline = [];
        };
        var len = stock.kline.length;
        var lastDate = (len == 0 ? stock.ztdate : stock.kline[len-1].date);
        for (var i = 0; i < klines.length; i++) {
            if (klines[i].date > lastDate) {
                stock.kline.push(klines[i]);
            };
        };
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
        for (var i = 0; i < this.ztData.length; i++) {
            if (this.ztData[i].ztcount == 1) {
                this.refreshZtTable(this.ztTable, this.ztData[i].ztStocks);
            } else if (this.ztData[i].ztcount == 2) {
                this.refreshZtTable(this.zt2Table, this.ztData[i].ztStocks);
            } else if (this.ztData[i].ztcount == 3) {
                this.refreshZtTable(this.zt3Table, this.ztData[i].ztStocks);
            };
        };
    }

    refreshZtTable(ztTable, ztStocks) {
        ztTable.reset();
        ztTable.setClickableHeader('序号', '名称(代码)', '总市值', '流通市值', '炸板次数', '换手率(%)', '首板价格', '首板日期', '次开', '次高', '次低', '次收', '3开', '3高', '3低', '3收');
        for (var i = 0; i < ztStocks.length; i++) {
            var anchor = document.createElement('a');
            var stocki = ztStocks[i];
            anchor.textContent = stocki.name + '(' + stocki.code + ')';
            if (stocki.url !== undefined) {
                anchor.href = stocki.url;
            } else if (stocki.m !== undefined) {
                anchor.href = futuStockUrl + stocki.code + (stocki.m == '0' ? '-SZ' : '-SH');
            };
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

    saveZtPool() {
        var date = this.dateToString(new Date());
        if (this.ztData[0].ztStocks.length > 0) {
            var blob = new Blob([JSON.stringify(this.ztData)], {type: 'application/json'});
            var filename = 'StockDailyPrices/首板统计/ztpool' + date + '.json';
            this.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
        };
        if (this.ztpool.length > 0) {
            var blob = new Blob([JSON.stringify(this.ztpool)], {type: 'application/json'});
            var filename = 'StockDailyPrices/首板统计/ztdaily/' + this.ztpool[0].ztdate + '.json';
            this.sendExtensionMessage({command:'mngr.saveFile', blob, filename});
        };
    }
};

