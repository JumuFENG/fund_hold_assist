'use strict';

const showname = {'normal': '普通账户', 'collat': '担保品账户'}

class StockView {
    constructor(stock, click) {
        this.container = document.createElement('div');
        this.container.appendChild(document.createElement('hr'));
        this.stock = stock;
        this.onStockClicked = click;
        this.container.acccode = stock.acccode;
        this.container.onclick = e => {
            if (e.target === this.divTitle || e.target === this.detailView) {
                this.onStockClicked(e.currentTarget, this.stock);
            } else {
                e.stopPropagation();
            }
        };
        this.divTitle = document.createElement('div');
        var titleText = stock.name??emjyBack.stockName(stock.code.slice(-6));
        titleText += '(' + stock.code.slice(-6) + ') ';
        titleText += emjyBack.accountNames[stock.account]??stock.account;
        this.divTitle.appendChild(document.createTextNode(titleText));
        var anchor = emjyBack.stockAnchor(stock.code, '行情');
        this.divTitle.appendChild(anchor);

        if (!Object.keys(showname).includes(stock.account)) {
            this.deleteBtn = document.createElement('button');
            this.deleteBtn.textContent = '舍弃';
            this.deleteBtn.title = '错误的记录或者实际无法买入的情况需要舍弃.';
            this.deleteBtn.onclick = e => {
                const rmurl = emjyBack.fha.server + 'stock';
                const fd = new FormData();
                fd.append('act', 'rmwatch');
                fd.append('code', this.stock.code);
                fd.append('acc', this.stock.account);
                fd.append('buysid', this.stock.deals.filter(d=>d.tradeType=='B').map(d=>d.sid).join(','));
                fd.append('sellsid', this.stock.deals.filter(d=>d.tradeType=='S').map(d=>d.sid).join(','));
                fetch(rmurl, {method: 'POST', body: fd, headers: emjyBack.headers});
                if (typeof(this.removeMe) === 'function') {
                    this.removeMe(this.stock.code);
                }
            }
            this.divTitle.appendChild(this.deleteBtn);
        };
        this.container.appendChild(this.divTitle);
        var divDetails = document.createElement('div');
        if (!this.stock.latestPrice && emjyBack.klines[stock.code]) {
            this.stock.latestPrice = emjyBack.klines[stock.code].getLatestPrice();
        }
        this.detailView = document.createElement('div');
        divDetails.appendChild(this.detailView);
        this.refreshDetailView();
        this.container.appendChild(divDetails);
        this.showWarningInTitle();
    }

    refresh() {
        this.refreshDetailView();
        if (this.stock.acccode.startsWith('track')) {
            return;
        }

        if (this.stock.earned === undefined) {
            emjyBack.getTotalEarned(this.stock.code).then(e => {
                this.stock.earned = e;
                this.refreshDetailView();
            }).catch(er => {
                console.log(er);
            });
        }
        if (this.deleteBtn && emjyBack.klines[this.stock.code] && emjyBack.klines[this.stock.code].continuouslyBellowMaDays() >= 5) {
            this.divTitle.style.borderBottom = '2px solid green';
            console.log('remove', this.stock.code);
        }
    }

    refreshDetailView() {
        utils.removeAllChild(this.detailView);
        var detailText = '最新价：' + this.stock.latestPrice + ' 成本价：' + this.stock.holdCost
            + ' 数量：' + this.stock.holdCount  + ' 市值: ' + (this.stock.latestPrice * this.stock.holdCount).toFixed(2);
        if (this.stock.earned) {
            detailText += ' 总收益:' + this.stock.earned;
        }
        this.detailView.appendChild(document.createTextNode(detailText));
        if (emjyBack.plannedDividen) {
            if (emjyBack.plannedDividen[this.stock.code]) {
                var pdiv = emjyBack.plannedDividen[this.stock.code];
                this.detailView.appendChild(document.createElement('br'));
                var divNode = document.createElement('div');
                divNode.innerText = new Date(pdiv.record).toLocaleDateString('zh-cn', {dateStyle:'full'}) + ' ' + pdiv.divdesc;
                divNode.style.color = 'red';
                this.detailView.appendChild(divNode);
            }
        }
    }

    showWarningInTitle() {
        var strGrp = this.stock.strategies;
        var needfix = false;
        if (strGrp && strGrp.strategies) {
            var strategies = strGrp.strategies;
            if (this.stock.holdCount > 0) {
                for (const i in strategies) {
                    const str = strategies[i];
                    if (str.enabled && str.key == 'StrategyMA' && str.guardPrice - this.stock.latestPrice > 0) {
                        needfix = true;
                        break;
                    }
                    if (str.enabled && (str.key.includes('Buy') || (str.kltype !== undefined && str.kltype - 30 < 0))) {
                        needfix =  true;
                        break;
                    }
                }
            }
        }

        if (needfix) {
            this.divTitle.style.borderLeft = '5px solid red';
            this.divTitle.style.paddingLeft = '10px';
        }

        if (emjyBack.klines[this.stock.code]) {
            this.refresh();
        }
    }

    removeMe() {}
}

class StockListPanelPage extends RadioAnchorPage {
    constructor(acc, filt=7) {
        super(showname[acc.name]??acc.name);
        this.acc = acc;
        this.keyword = acc.name;
        this.defaultFilter = filt;
        this.stocks = [];
        this.currentCode = null;
        this.strategyGroupView = new StrategyGroupView();
    }

    show() {
        super.show();
        if (!this.listContainer) {
            this.initAccFrame();
            this.addWatchArea();
        }
        if (this.stocks.length == 0) {
            const url = emjyBack.fha.server + 'stock?act=watchings&acc=' + this.keyword;
            const durl = emjyBack.fha.server + 'stock?act=deals&acc=' + this.keyword;
            Promise.all([fetch(url, emjyBack.headers).then(r => r.json()), fetch(durl, emjyBack.headers).then(r => r.json())])
            .then(([stocks, deals]) => {
                deals = deals.map( d => {d.type = d.tradeType, d.date = d.time; return d;});
                for (const c in stocks) {
                    stocks[c].deals = deals.filter(d => d.code == c);
                }
                this.initUi(stocks);
            });
        }
        if (!emjyBack.costDog) {
            var durl = emjyBack.fha.server + 'stock?act=costdog';
            fetch(durl, emjyBack.headers).then(r => r.json()).then(cdata => emjyBack.costDog = cdata);
        }
    }

    hide() {
        super.hide();
        if (this.strategyGroupView) {
            this.strategyGroupView.saveStrategy();
        }
    }

    initUi(stocks) {
        emjyBack.log('init StockList');
        cloud.getStockBasics(Object.keys(stocks)).then(sbasic => {
            for (const c in sbasic) {
                stocks[c].code = c;
                stocks[c].name = sbasic[c]?.secu_name;
                stocks[c].latestPrice = sbasic[c]?.last_px;
                stocks[c].up_price = sbasic[c]?.up_price;
                stocks[c].down_price = sbasic[c]?.down_price;
                stocks[c].preclose_px = sbasic[c]?.preclose_px;
            }

            if (this.strategyGroupView.root.parentElement) {
                this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
            }
            utils.removeAllChild(this.listContainer);
            this.stocks = [];
            if (this.acc.realcash) {
                stocks = Object.values(stocks).sort((a, b) => b.holdCount * b.latestPrice - a.holdCount * a.latestPrice);
            } else {
                const fs = Object.values(stocks).filter(s => !s.strategies?.buydetail);
                stocks = Object.values(stocks).filter(s => s.strategies?.buydetail).sort((a, b) => {
                    return a.strategies.buydetail.slice(-1)[0].date - b.strategies.buydetail.slice(-1)[0].date;
                });
                stocks = stocks.concat(fs);
            }
            for (const s of stocks) {
                this.addStock(s.code, s);
            }

            this.selectionFilter.selectedIndex = this.defaultFilter;
            this.onFiltered(this.defaultFilter);
            this.listContainer.lastElementChild?.click();
        });
    }

    getFilterItems() {
        return [
            '持仓',
            '<安全线',
            '无/误策略',
            '低位横盘',
            '持仓连板',
            '割肉',
            '盈利清仓',
            '全部',
            '今日买入',
            '持有>1周'
        ];
    }

    getCostDogFilterItems() {
        return Object.keys(emjyBack.costDog??{});
    }

    isBuystrJson(str) {
        return str.key.includes('Buy') || ses.ComplexStrategyKeyNames[str.key];
    }

    isSellstrJson(str) {
        return str.key.includes('Sell') || ses.ComplexStrategyKeyNames[str.key];
    }

    onFiltered(fid) {
        for (var i = 0; i < this.stocks.length; ++i) {
            var stocki = this.stocks[i].stock;
            this.stocks[i].container.style.display = 'none';
            if (fid == 0) { // '持仓'
                if (stocki.holdCount > 0) {
                    this.stocks[i].container.style.display = 'block';
                }
            } else if (fid == 1) { // <安全线
                if (stocki.holdCount > 0) {
                    for (var k in stocki.strategies.strategies) {
                        const str = stocki.strategies.strategies[k];
                        if (str.guardPrice && str.guardPrice - stocki.latestPrice > 0) {
                            this.stocks[i].container.style.display = 'block';
                            break;
                        }
                    }
                }
            } else if (fid == 2) { // 无/误策略
                if (!stocki.strategies || !stocki.strategies.strategies || Object.keys(stocki.strategies.strategies).length == 0 || stocki.strategies.amount - 5000 < 0) {
                    this.stocks[i].container.style.display = 'block';
                    continue;
                }

                var needfix = false;
                if (stocki.holdCount > 0) {
                    var sellstrCount = 0;
                    for (const k in stocki.strategies.strategies) {
                        const str = stocki.strategies.strategies[k];
                        if (this.isSellstrJson(str) && str.enabled) {
                            sellstrCount ++;
                        }
                    }
                    if (sellstrCount == 0) {
                        needfix = true;
                    }
                } else {
                    var buystrCount = 0;
                    for (const k in stocki.strategies.strategies) {
                        const str = stocki.strategies.strategies[k];
                        if (str.enabled && str.key.includes('Sell')) {
                            needfix =  true;
                            break;
                        } else if (str.enabled && this.isBuystrJson(str)) {
                            buystrCount ++;
                        }
                    }
                    if (buystrCount == 0) {
                        needfix = true;
                    }
                }
                if (needfix) {
                    this.stocks[i].container.style.display = 'block';
                    continue;
                }
            } else if (fid == 3) { // 低位横盘, 无持仓
                if (stocki.holdCount == 0) {
                    if (emjyBack.klines[stocki.code] && emjyBack.klines[stocki.code].bottomRegionDays('101') > 15) {
                        if (Object.keys(stocki.strategies.strategies).length > 1) {
                            continue;
                        }
                        if (emjyBack.klines[stocki.code].isWaitingBss('30')) {
                            this.stocks[i].container.style.display = 'block';
                        }
                    }
                }
            } else if (fid == 4) { // 持仓连板
                if (stocki.holdCount > 0 && stocki.latestPrice - stocki.up_price == 0) {
                    this.stocks[i].container.style.display = 'block';
                }
            } else if (fid == 5) { // 无持仓割肉股
                if (stocki.holdCount == 0 && stocki.earned < 0) {
                    this.stocks[i].container.style.display = 'block';
                }
            } else if (fid == 6) { // 盈利清仓股
                if (stocki.holdCount == 0 && stocki.earned > 0) {
                    this.stocks[i].container.style.display = 'block';
                }
            } else if (fid == 7) { // 全部
                this.stocks[i].container.style.display = 'block';
            } else if (fid == 8) { // 今日买入
                if (stocki.strategies && stocki.strategies.buydetail && stocki.strategies.buydetail.length > 0) {
                    var lbd = stocki.strategies.buydetail[0].date;
                    if (stocki.strategies.buydetail.length > 1) {
                        for (const bd of stocki.strategies.buydetail) {
                            if (bd.date > lbd) {
                                lbd = bd.date;
                            }
                        }
                    }
                    if (lbd >= guang.getTodayDate('-')) {
                        this.stocks[i].container.style.display = 'block';
                    }
                }
            } else if (fid == 9) { // 持有时间>1周
                if (stocki.strategies && stocki.strategies.buydetail && stocki.strategies.buydetail.length > 0) {
                    var mbd = stocki.strategies.buydetail[0].date;
                    if (stocki.strategies.buydetail.length > 1) {
                        for (const bd of stocki.strategies.buydetail) {
                            if (bd.date < mbd) {
                                mbd = bd.date;
                            }
                        }
                    }
                    if (new Date(mbd) < new Date(new Date() - 7 * 24 * 60 * 60 * 1000)) {
                        this.stocks[i].container.style.display = 'block';
                    }
                }
            } else if (typeof(fid) === 'string') {
                if (!stocki.strategies) {
                    continue;
                }
                if (this.getCostDogFilterItems().includes(fid)) {
                    if (stocki.strategies.uramount && stocki.strategies.uramount.key == fid) {
                        this.stocks[i].container.style.display = 'block';
                    }
                } else {
                    for (const k in stocki.strategies.strategies) {
                        const str = stocki.strategies.strategies[k];
                        if (str.key == fid) {
                            this.stocks[i].container.style.display = 'block';
                            break;
                        }
                    }
                }
            }
        }
        if (typeof(fid) === 'string') {
            this.selectionFilter.selectedIndex = -1;
            if (this.getCostDogFilterItems().includes(fid)) {
                this.strategyFilter.selectedIndex = -1;
            } else {
                this.costDogFilter.selectedIndex = -1;
            }
        } else {
            this.strategyFilter.selectedIndex = -1;
            this.costDogFilter.selectedIndex = -1;
        }
    }

    onStrategyGroupChanged(code, strGrp) {
        if (!strGrp) {
            return;
        };

        for (var i = 0; i < this.stocks.length; i++) {
            if (this.stocks[i].stock.acccode == code) {
                this.stocks[i].stock.strategies = strGrp;
                break;
            };
        };
    }

    stockExist(code) {
        return this.stocks.find(s => s.stock.code == code);
    }

    addStock(code, stock) {
        if (this.stockExist(code)) {
            emjyBack.log(this.keyword, code, 'already exists');
            return;
        };

        Object.assign(stock, {code, acccode: this.keyword + '_' + code, account: this.keyword})
        var divContainer = new StockView(stock, (target, stk) => {
            if (this.strategyGroupView && (!this.currentCode || this.currentCode != stk.acccode)) {
                if (this.strategyGroupView) {
                    this.strategyGroupView.saveStrategy();
                    this.onStrategyGroupChanged(this.currentCode, this.strategyGroupView.strGrp);
                };
                if (this.strategyGroupView.root.parentElement) {
                    this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
                };
                target.appendChild(this.strategyGroupView.root);
                this.currentCode = stk.acccode;
                this.strategyGroupView.latestPrice = stk.latestPrice;
                this.strategyGroupView.initUi(stk.account, stk.code, stk.strategies, stk.deals);
            };
        });
        divContainer.removeMe = c => {
            this.deleteStock(c);
        }
        this.listContainer.appendChild(divContainer.container);
        this.stocks.push(divContainer);
    }

    deleteStock(code) {
        var stocki = this.stocks.find(s => s.stock.code == code);
        if (!stocki) {
            return;
        }
        if (this.strategyGroupView.root.parentElement == stocki.container) {
            stocki.container.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(stocki.container);
        this.stocks = this.stocks.filter(s => s.stock.code != code);
    }

    initAccFrame() {
        this.selectionFilter = document.createElement('select');
        var fitems = this.getFilterItems();
        fitems.forEach(f => {
            this.selectionFilter.options.add(new Option(f));
        });
        this.selectionFilter.onchange = e => {
            this.onFiltered(e.target.selectedIndex);
        }
        this.container.appendChild(this.selectionFilter);

        this.strategyFilter = document.createElement('select');
        for (const k in ses.ComplexStrategyKeyNames) {
            this.strategyFilter.options.add(new Option(ses.ComplexStrategyKeyNames[k], k));
        }
        var sepOpt = new Option('------------');
        sepOpt.disabled = true;
        this.strategyFilter.options.add(sepOpt);
        for (const k in ses.BuyStrategyKeyNames) {
            this.strategyFilter.options.add(new Option(ses.BuyStrategyKeyNames[k], k));
        }
        var sepOpt1 = new Option('------------');
        sepOpt1.disabled = true;
        this.strategyFilter.options.add(sepOpt1);
        for (const k in ses.SellStrategyKeyNames) {
            this.strategyFilter.options.add(new Option(ses.SellStrategyKeyNames[k], k));
        }
        this.strategyFilter.onchange = e => {
            this.onFiltered(e.target.value);
        }
        this.container.appendChild(this.strategyFilter);

        this.costDogFilter = document.createElement('select');
        if (!emjyBack.costDog) {
            var durl = emjyBack.fha.server + 'stock?act=costdog';
            fetch(durl, emjyBack.headers).then(r => r.json()).then(cdata => {
                emjyBack.costDog = cdata;
            }).then(() => {
                this.addCostDogFilterOptions();
            });
        } else {
            this.addCostDogFilterOptions();
        }
        this.costDogFilter.onchange = e => {
            this.onFiltered(e.target.value);
        }
        this.container.appendChild(this.costDogFilter);

        this.listContainer = document.createElement('div');
        this.container.appendChild(this.listContainer);
        this.container.appendChild(document.createElement('hr'));
    }

    addWatchArea() {
        var watchDiv = document.createElement('div');
        this.inputWatchCode = document.createElement('input');
        watchDiv.appendChild(this.inputWatchCode);

        this.createWatchCodeAccountSelector();
        if (this.watchCodeAccountSelector) {
            watchDiv.appendChild(this.watchCodeAccountSelector);
        }
        var btnAddWatchCode = document.createElement('button');
        btnAddWatchCode.textContent = '新增观察股票';
        btnAddWatchCode.onclick = e => {
            this.addWatchCode();
        };
        watchDiv.appendChild(btnAddWatchCode);

        watchDiv.appendChild(document.createElement('br'));

        this.inputWatchList = document.createElement('textarea');
        this.inputWatchList.style.height = '150px';
        this.inputWatchList.style.width = '200px';
        watchDiv.appendChild(this.inputWatchList);

        this.createWatchListAccountSelector();
        if (this.watchListAccountSelector) {
            watchDiv.appendChild(this.watchListAccountSelector);
        }
        var btnAddWatchList = document.createElement('button');
        btnAddWatchList.textContent = '新增股票策略';
        btnAddWatchList.onclick = e => {
            this.addWatchList();
        }
        watchDiv.appendChild(btnAddWatchList);
        this.container.appendChild(watchDiv);
    }

    addCostDogFilterOptions() {
        var cdItems = this.getCostDogFilterItems();
        for (const ci of cdItems) {
            this.costDogFilter.options.add(new Option(ci));
        }
        this.costDogFilter.selectedIndex = -1;
    }

    createWatchCodeAccountSelector() {
        this.watchCodeAccountSelector = document.createElement('select');
        this.watchCodeAccountSelector.options.add(new Option(emjyBack.accountNames['normal'], 'normal'));
        this.watchCodeAccountSelector.options.add(new Option('自动分配', ''));
    }

    getWatchCodeAccount() {
        return this.watchCodeAccountSelector.value;
    }

    addWatchCode() {
        if (this.inputWatchCode.value.length != 6) {
            alert('Wrong stock code');
            return;
        }
        emjyBack.addWatchingStock(this.inputWatchCode.value, this.getWatchCodeAccount());
        this.inputWatchCode.value = '';
    }

    createWatchListAccountSelector() {
        this.watchListAccountSelector = document.createElement('select');
        this.watchListAccountSelector.options.add(new Option('普通账户', 'normal'));
        this.watchListAccountSelector.options.add(new Option('自动分配', ''));
    }

    getWatchListAccount() {
        return this.watchListAccountSelector.value;
    }

    addWatchList() {
        if (!this.inputWatchList.value) {
            return;
        }
        var candidatesObj = JSON.parse(this.inputWatchList.value);
        for(var c in candidatesObj) {
            emjyBack.addWatchingStock(c, this.getWatchListAccount(), candidatesObj[c]);
        }
        this.inputWatchList.value = '';
    }
}

