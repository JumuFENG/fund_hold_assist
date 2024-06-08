'use strict';

class StockView {
    constructor(stock, click) {
        this.container = document.createElement('div');
        this.container.appendChild(document.createElement('hr'));
        this.stock = stock;
        this.onStockClicked = click;
        this.container.acccode = stock.acccode;
        this.container.onclick = e => {
            this.onStockClicked(e.currentTarget, this.stock);
        };
        this.divTitle = document.createElement('div');
        var titleText = stock.name + '(' + stock.code + ') '+ emjyBack.accountNames[stock.account];
        this.divTitle.appendChild(document.createTextNode(titleText));
        var anchor = emjyBack.stockAnchor(stock.code, '行情');
        this.divTitle.appendChild(anchor);
        
        if (stock.holdCount == 0) {
            this.deleteBtn = document.createElement('button');
            this.deleteBtn.textContent = 'Delete';
            this.deleteBtn.code = stock.code;
            this.deleteBtn.account = stock.account;
            this.deleteBtn.onclick = e => {
                emjyBack.sendExtensionMessage({command:'mngr.rmwatch', code: e.target.code, account: e.target.account});
                emjyBack.deleteStockFromList(e.target.account, e.target.code);
            }
            this.divTitle.appendChild(this.deleteBtn);
        };
        this.container.appendChild(this.divTitle);
        var divDetails = document.createElement('div');
        if (!this.stock.latestPrice && emjyBack.klines[stock.code]) {
            var lkl = emjyBack.klines[stock.code].getLatestKline('101');
            if (lkl) {
                this.stock.latestPrice = lkl.c;
            }
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
            emjyBack.getTotalEarned(this.stock.code, e => {
                this.stock.earned = e;
                this.refreshDetailView();
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

        if (emjyBack.klines[this.stock.code]) {
            var klineCheckDiv = document.createElement('div');
            this.detailView.appendChild(klineCheckDiv);
            var klLatestTime = emjyBack.getKlinesLatestTime();
            for (var klt of ['1', '15', '101']) {
                var kl = emjyBack.klines[this.stock.code].getLatestKline(klt);
                if (kl && kl.time < klLatestTime[klt]) {
                    klineCheckDiv.appendChild(document.createTextNode(kl.time));
                    var btnUpdate = document.createElement('a');
                    btnUpdate.textContent = '更新k线' + klt;
                    btnUpdate.href = 'javascript:void(0)';
                    btnUpdate.fetchCmd = {command:'mngr.fetchkline', code: this.stock.code, kltype: klt, start: kl.time.split(' ')[0]};
                    btnUpdate.onclick = e => {
                        if (e.target.fetchCmd) {
                            emjyBack.sendExtensionMessage(e.target.fetchCmd);
                        }
                    }
                    klineCheckDiv.appendChild(btnUpdate);
                }
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
}

class StockListPanelPage extends RadioAnchorPage {
    constructor(name='自选管理') {
        super(name);
        this.stocks = [];
        this.initStockList();
        this.addWatchArea();
        this.strategyGroupView = new StrategyGroupView();
        this.currentCode = null;
        this.defaultFilter = 0;
    }

    initUi(stocks) {
        emjyBack.log('init StockList');
        if (this.strategyGroupView.root.parentElement) {
            this.strategyGroupView.root.parentElement.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(this.listContainer);
        for (var i = 0; i < stocks.length; i++) {
            stocks[i].strategies = JSON.parse(stocks[i].strategies);
            this.addStock(stocks[i]);
        };
        this.onFiltered(this.defaultFilter);
        this.listContainer.lastElementChild.click();
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
            '全部'
        ];
    }

    getCostDogFilterItems() {
        return emjyBack.costDogView ? emjyBack.costDogView.cikeys : new Set();
    }

    isBuystrJson(str) {
        var cskid = ComplexStrategyKeyNames.findIndex(x => x.key == str.key);
        return str.key.includes('Buy') || cskid != -1;
    }

    isSellstrJson(str) {
        var cskid = ComplexStrategyKeyNames.findIndex(x => x.key == str.key);
        return str.key.includes('Sell') || cskid != -1;
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
                        if (this.isSellstrJson(str)) {
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
                if (stocki.holdCount > 0 && emjyBack.klines[stocki.code].continuouslyZtDays() > 1) {
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
            } else if (typeof(fid) === 'string') {
                if (!stocki.strategies) {
                    continue;
                }
                if (this.getCostDogFilterItems().has(fid)) {
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
            if (this.getCostDogFilterItems().has(fid)) {
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

    stockExist(code, account) {
        return this.accStockExists(account + '_' + code);
    }

    accStockExists(code) {
        return this.stocks.find( s => {
            return s.stock.acccode == code;
        });
    }

    updateStockPrice(code) {
        for (var i = 0; i < this.stocks.length; i++) {
            if (this.stocks[i].stock.code == code && emjyBack.klines[code]) {
                var lkl = emjyBack.klines[code].getLatestKline('101');
                if (lkl) {
                    this.stocks[i].stock.latestPrice = lkl.c;
                }
                this.stocks[i].refresh();
            }
        }
    }

    addStock(stock) {
        if (this.accStockExists(stock.acccode)) {
            emjyBack.log(stock.acccode, 'already exists');
            return;
        };
        
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
                this.strategyGroupView.initUi(stk.account, stk.code, stk.strategies);
            };
        });
        this.listContainer.appendChild(divContainer.container);
        this.stocks.push(divContainer);
    }

    deleteStock(account, code) {
        var stocki = this.stocks.find(s => s.stock.acccode == account + '_' + code);
        if (!stocki) {
            return;
        }
        if (this.strategyGroupView.root.parentElement == stocki.container) {
            stocki.container.removeChild(this.strategyGroupView.root);
        }
        utils.removeAllChild(stocki.container);
        this.stocks = this.stocks.filter(s => s.stock.acccode != account + '_' + code);
    }

    updateStocksDailyKline() {
        emjyBack.updateShownStocksDailyKline();
    }

    initStockList() {
        var updateBtn = document.createElement('button');
        updateBtn.textContent = '更新数据';
        updateBtn.onclick = e => {
            this.updateStocksDailyKline();
        }
        this.container.appendChild(updateBtn);

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
        ComplexStrategyKeyNames.forEach(s=>{
            this.strategyFilter.options.add(new Option(s.name, s.key));
        });
        var sepOpt = new Option('------------');
        sepOpt.disabled = true;
        this.strategyFilter.options.add(sepOpt);
        BuyStrategyKeyNames.forEach(s=>{
            this.strategyFilter.options.add(new Option(s.name, s.key));
        });
        var sepOpt1 = new Option('------------');
        sepOpt1.disabled = true;
        this.strategyFilter.options.add(sepOpt1);
        SellStrategyKeyNames.forEach(s=>{
            this.strategyFilter.options.add(new Option(s.name, s.key));
        });
        this.strategyFilter.onchange = e => {
            this.onFiltered(e.target.value);
        }
        this.container.appendChild(this.strategyFilter);

        this.costDogFilter = document.createElement('select');
        this.addCostDogFilterOptions();
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
        this.inputWatchList.style.height = 150;
        this.inputWatchList.style.width = 200;
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
        var candidatesObj = JSON.parse(this.inputWatchList.value);
        for(var c in candidatesObj) {
            emjyBack.addWatchingStock(c, this.getWatchListAccount(), candidatesObj[c]);
        }
        this.inputWatchList.value = '';
    }
}
