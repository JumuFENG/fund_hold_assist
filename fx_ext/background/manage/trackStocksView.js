'use strict';

class TrackStockListPanelPage extends StockListPanelPage {
    constructor(key='track', name='模拟账户') {
        super(key, name);
        this.defaultFilter = 7;
    }

    initUi(stocks) {
        super.initUi(stocks);
        this.showTrackingCompletedDeals();
    }

    updateStocksDailyKline() {
        var today = guang.getTodayDate('-');
        for (var i = 0; i < this.stocks.length; i++) {
            var code = this.stocks[i].stock.code;
            if (emjyBack.klines[code] === undefined || emjyBack.klines[code].klines === undefined) {
                emjyBack.getDailyKlineSinceMonthAgo(code, today);
                continue;
            }
            if (!emjyBack.updateKlineDaily(code)) {
                this.updateStockPrice(code);
            }
        }
    }

    checkStockKlExpired() {
        alert('not implemented for tracking stocks!');
    }

    createWatchCodeAccountSelector() {

    }

    getWatchCodeAccount() {
        return this.keyword;
    }

    createWatchListAccountSelector() {

    }

    getWatchListAccount() {
        return this.keyword;
    }

    showTrackingCompletedDeals() {
        if (!this.trackingDealsTable) {
            this.trackingDealsTable = new SortableTable();
            this.container.appendChild(this.trackingDealsTable.container);
            this.archiveNameSelector = document.createElement('select');
            this.container.appendChild(this.archiveNameSelector);
            emjyBack.getFromLocal('track_strategy_name').then(x => {
                if (x) {
                    this.archivedTrackingName = x;
                    this.archivedTrackingName.forEach(t => {
                        this.archiveNameSelector.options.add(new Option(t));
                    });
                }
            });
            this.archiveNameInput = document.createElement('input');
            this.archiveNameInput.placeholder = '策略存储名';
            this.container.appendChild(this.archiveNameInput);
            this.archiveDealsBtn = document.createElement('button');
            this.archiveDealsBtn.textContent = '保存选中记录';
            this.container.appendChild(this.archiveDealsBtn);
            this.archiveDealsBtn.onclick = e => {
                this.archieveTrackDeals();
            }
            this.archiveDealsBtn.selectedStks = new Set();
        }

        this.trackingDealsTable.reset();
        this.trackingDealsTable.setClickableHeader('', '名称', '交易记录', '成本', '收益', '收益率%', '');
        var i = 1;
        this.stocks.forEach(sv => {
            var stocki = sv.stock;
            if (stocki.holdCount != 0 || stocki.strategies.buydetail === undefined || stocki.strategies.buydetail.length == 0) {
                return;
            }
            this.archiveDealsBtn.selectedStks.add(stocki.code);
            var anchor = emjyBack.stockAnchor(stocki.code);
            var deals = stocki.strategies.buydetail;
            var bs = deals.filter(x => x.type == 'B');
            var cost = 0;
            bs.forEach(x => {
                cost += x.price * x.count;
            });
            var ss = deals.filter(x => x.type == 'S');
            var sold = 0;
            ss.forEach(x => {
                sold += x.price * x.count;
            });
            var dealstr = '';
            deals.forEach(x => {
                dealstr += JSON.stringify(x) + '\n';
            });

            var sel = document.createElement('input');
            sel.type = 'checkbox';
            sel.code = stocki.code;
            sel.checked = true;
            sel.onchange = e => {
                if (e.target.checked) {
                    if (!this.archiveDealsBtn.selectedStks) {
                        this.archiveDealsBtn.selectedStks = new Set();
                    }
                    this.archiveDealsBtn.selectedStks.add(e.target.code);
                } else {
                    if (this.archiveDealsBtn.selectedStks) {
                        this.archiveDealsBtn.selectedStks.delete(e.target.code);
                    }
                }
            }

            this.trackingDealsTable.addRow(
                i++,
                anchor,
                dealstr,
                parseFloat(cost.toFixed(2)),
                parseFloat((sold - cost).toFixed(2)),
                parseFloat(((sold - cost) * 100 / cost).toFixed(2)),
                sel
            );
        });
    }

    archieveTrackDeals() {
        if (!this.archiveNameInput.value && this.archivedTrackingName.length == 0) {
            alert('请输入策略存储名称!');
            return;
        }
        var track_name = this.archiveNameSelector.value;
        if (this.archiveNameInput.value) {
            if (!this.archivedTrackingName) {
                this.archivedTrackingName = new Set();
            }
            track_name = this.archiveNameInput.value;
            this.archivedTrackingName.add(this.archiveNameInput.value);
            var track_strategy_name = this.archivedTrackingName;
            emjyBack.saveToLocal({track_strategy_name});
        }
        var ardeals = [];
        this.stocks.forEach(sv => {
            var stocki = sv.stock;
            var code = stocki.code;
            if (this.archiveDealsBtn.selectedStks.has(code)) {
                var deals = stocki.strategies.buydetail;
                deals.forEach(d => {
                    ardeals.push({code, time: d.date, count: d.count, price: d.price, sid:d.sid, tradeType: d.type});
                });
            }
        });
        var dlUrl = emjyBack.fha.server + 'stock';
        var fd = new FormData();
        fd.append('act', 'trackdeals');
        fd.append('name', track_name);
        fd.append('data', JSON.stringify(ardeals));
        fetch(dlUrl, {
            method: 'POST',
            body: fd
        }).then(r => r.text()).then(dl => {
            if (dl != 'OK') {
                console.error('archive track deals failed!');
                return;
            }
            this.archiveDealsBtn.selectedStks.forEach(c => {
                emjyBack.sendExtensionMessage({command:'mngr.rmwatch', code: c, account: this.keyword});
                this.deleteStock(c);
            });
            this.archiveDealsBtn.selectedStks.clear();
            this.showTrackingCompletedDeals();
        });
    }
}
