'use strict';


class TransferSelector {
    constructor(transfer) {
        this.transfer = transfer;
        this.root = document.createElement('div');
        this.root.className = 'strategy_transfer_box';
        this.root.appendChild(document.createTextNode('递补策略'));
    }

    resetView() {
        if (this.selectors) {
            this.transfer = this.selectors.value;
            utils.removeAllChild(this.selectors);
        };

        if (!this.selectors) {
            this.selectors = document.createElement('select');
            this.root.appendChild(this.selectors);
        };
    }

    updateSelectors(ids) {
        this.resetView();
        var exists = false;
        ids.forEach(i => {
            var opt = document.createElement('option');
            opt.value = i.id;
            if (i.id == this.transfer) {
                exists = true;
            };
            opt.textContent = i.val;
            this.selectors.appendChild(opt);
        });
        this.selectors.value = exists ? this.transfer : ids[0].id;
    }

    selectedId() {
        return this.selectors.value;
    }
}

class StrategySelectorView {
    constructor(account, id, strategy, transfer) {
        this.root = document.createElement('div');
        this.root.className = 'strategy_border_div';
        this.account = account;
        this.id = id;
        this.transfer = transfer;
        this.strategy = strategy;
    }

    setAvailableTransfers(ids) {
        this.availableIds = [];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i].id;
            var val = ids[i].val;
            if (id == this.id) {
                val += ' (自循环)';
            };
            this.availableIds.push({id, val});
        };
        if (this.transferView) {
            this.transferView.updateSelectors(this.availableIds);
        };
    }

    createSelector() {
        var strategySelector = document.createElement('select');
        var opt0 = document.createElement('option');
        opt0.textContent = '--选择--';
        opt0.selected = true;
        opt0.disabled = true;
        strategySelector.appendChild(opt0);
        for (const k in ses.ComplexStrategyKeyNames) {
            strategySelector.appendChild(new Option(ses.ComplexStrategyKeyNames[k], k));
        }
        var opt1 = new Option('==========');
        opt1.disabled = true;
        strategySelector.appendChild(opt1);
        for (const k in ses.BuyStrategyKeyNames) {
            strategySelector.appendChild(new Option(ses.BuyStrategyKeyNames[k], k));
        }
        var opt2 = new Option('==========');
        opt2.disabled = true;
        strategySelector.appendChild(opt2);
        for (const k in ses.SellStrategyKeyNames) {
            strategySelector.appendChild(new Option(ses.SellStrategyKeyNames[k], k));
        }
        var strategyName = '添加新策略';
        if (this.strategy) {
            strategySelector.value = this.strategy.key;
            strategyName = '策略' + this.id + ' ';
        };
        strategySelector.onchange = e => {
            if (this.strategy) {
                this.onStrategyChanged(e.target.value);
            } else if (this.strGroupView) {
                this.strGroupView.onStrategyAdded(this.id, e.target.value);
                this.id ++;
                e.target.selectedIndex = 0;
            };
        };
        this.root.appendChild(document.createTextNode(strategyName));
        this.root.appendChild(strategySelector);
        if (this.strategy) {
            var deleteStrategyBtn = document.createElement('button');
            deleteStrategyBtn.textContent = 'X';
            deleteStrategyBtn.onclick = (e) => {
                if (this.strGroupView) {
                    this.strGroupView.onStrategyRemoved(this.id);
                };
            };
            this.root.appendChild(deleteStrategyBtn);
        };
    }

    createStrategyView() {
        if (this.strateyContainer) {
            utils.removeAllChild(this.strateyContainer);
        };
        if (!this.strateyContainer) {
            this.strateyContainer = document.createElement('div');
            this.root.appendChild(this.strateyContainer);
        };
        if (this.strategy) {
            this.strategyView = strategyViewManager.viewer(this.strategy);
            this.strategyView.ownerAccount = this.account;
            this.strateyContainer.appendChild(this.strategyView.createView());
        };
    }

    createTransferView() {
        if (this.transferView) {
            this.transferView.resetView();
        };
        if (this.strategy) {
            if (!this.transferView) {
                this.transferView = new TransferSelector(this.transfer);
                this.root.appendChild(this.transferView.root);
            };
            if (this.availableIds) {
                this.transferView.updateSelectors(this.availableIds);
            };
        };
    }

    createView() {
        this.createSelector();
        this.createStrategyView();
        this.createTransferView();
    }

    onStrategyChanged(key) {
        this.strategy = {key};
        this.createStrategyView();
        this.createTransferView();
    }

    isChanged() {
        var changed = false;
        if (this.strategyView) {
            changed |= this.strategyView.isChanged();
        };
        if (this.transferView) {
            changed |= (this.transferView.selectedId() != this.transfer);
        };
        return changed;
    }
}


class EditableCell {
    constructor(text, width) {
        this.otext = text;
        this.container = document.createElement('div');
        this.container.style.display = 'inline';
        this.lblText = document.createTextNode(text);
        this.container.appendChild(this.lblText);
        this.inputBox = document.createElement('input');
        this.inputBox.style.maxWidth = '80px';
        this.inputBox.style.display = 'none';
        this.inputBox.value = text;
        this.container.appendChild(this.inputBox);
        this.editable = false;
        if (width) {
            if (width > 80) {
                this.inputBox.style.maxWidth = width + 'px';
            }
            this.inputBox.style.width = width + 'px';
            this.container.style.width = width+'px';
        }
        this.container.ondblclick = () => {
            this.edit();
        }
        this.inputBox.onblur = () => {
            this.readonly();
        }
    }

    edit() {
        this.lblText.textContent = '';
        this.inputBox.style.display = 'inline';
        this.inputBox.focus();
        this.inputBox.setSelectionRange(0, this.inputBox.value.length);
        this.editable = true;
    }

    readonly() {
        this.lblText.textContent = this.inputBox.value;
        this.inputBox.style.display = 'none';
        this.editable = false;
    }

    textChanged() {
        return this.otext != this.inputBox.value;
    }

    update(text) {
        this.otext = text;
        this.inputBox.value = text;
        this.readonly();
    }

    text() {
        return this.inputBox.value;
    }
}

class RecordRow {
    createCell(t, w) {
        var c = document.createElement('div');
        c.textContent = t;
        if (w) {
            c.style.minWidth = w+'px';
        }
        c.style.textAlign = 'center';
        c.style.borderLeft = 'solid 1px';
        return c;
    }

    constructor(deal) {
        this.deal = deal;
        this.root = document.createElement('div');
        this.root.style.display = 'flex';
        this.showDealInfo();
    }

    showDealInfo() {
        utils.removeAllChild(this.root);
        this.countCell = new EditableCell(this.deal.count, 50);
        this.root.appendChild(this.countCell.container);
        this.dateCell = new EditableCell(this.deal.date, 150);
        this.root.appendChild(this.dateCell.container);

        this.root.appendChild(this.createCell(this.deal.type, 30));
        this.root.appendChild(this.createCell((this.deal.price * this.deal.count).toFixed(2), 70));

        this.priceCell = new EditableCell(this.deal.price, 70);
        this.root.appendChild(this.priceCell.container);
        this.sidCell = new EditableCell(this.deal.sid, 70);
        this.root.appendChild(this.sidCell.container);
        this.xBtn = document.createElement('span');
        this.xBtn.textContent = 'X';
        this.xBtn.style.color = 'blue';
        this.xBtn.style.visibility = 'hidden';
        this.xBtn.style.textDecoration = 'underline';
        this.xBtn.onclick = () => {
            this.root.style.display = 'none';
            this.deal = null;
        };
        this.root.appendChild(this.xBtn);
        this.root.onmouseenter = () => {
            this.xBtn.style.visibility = 'visible';
        }
        this.root.onmouseleave = () => {
            this.xBtn.style.visibility = 'hidden';
        }
    }

    isChanged() {
        if (!this.deal) {
            return true;
        }
        var changed = false;
        if (this.countCell.textChanged()) {
            this.deal.count = this.countCell.text();
            changed = true;
        }
        if (this.dateCell.textChanged()) {
            this.deal.date = this.dateCell.text();
            changed = true;
        }
        if (!this.deal.time) {
            this.deal.time = this.deal.date;
        }
        if (this.priceCell.textChanged()) {
            this.deal.price = this.priceCell.text();
            changed = true;
        }
        if (this.sidCell.textChanged()) {
            this.deal.sid = this.sidCell.text();
            changed = true;
        }
        return changed;
    }
}

class RecordsTable {
    constructor(deals) {
        this.deals = deals;
        this.root = document.createElement('div');
        this.root.style.maxHeight = '100px';
        this.root.style.maxWidth = '500px';
        this.root.style.overflowY = 'auto';
        this.root.style.position = 'relative';
        this.rows = [];
        if (this.deals) {
            this.deals.slice().reverse().forEach(d => {
                var r = new RecordRow(d);
                this.root.appendChild(r.root);
                this.rows.push(r);
            });
        }
        this.addDiv = document.createElement('div');
        this.addDiv.style.display = 'flex';
        this.addDiv.style.justifyContent = 'center';
        this.addDiv.style.alignItems = 'center';
        this.root.appendChild(this.addDiv);
        const addBtn = (type) => {
            const btn = document.createElement('span');
            btn.textContent = `+${type}`;
            btn.style.color = 'blue';
            btn.style.margin = '0 10px';
            btn.style.textDecoration = 'underline';
            btn.onclick = () => {
                const newDeal = {
                    count: 0,
                    date: guang.getTodayDate('-'),
                    type,
                    tradeType: type,
                    price: 0,
                    sid: '000000',
                };
                const r = new RecordRow(newDeal);
                this.root.insertBefore(r.root, this.addDiv);
                this.rows.push(r);
            };
            this.addDiv.appendChild(btn);
        };
        addBtn('B');
        addBtn('S');
    }

    isChanged() {
        var changed = false;
        this.rows.forEach(r => {
            changed |= r.isChanged();
        });
        if (changed) {
            this.deals = this.rows.map(r => r.deal).filter(d => d);
        }
        return changed;
    }
}


class StrategyGroupView {
    constructor() {
        this.root = document.createElement('div');
        this.strategyInfoContainer = document.createElement('div');
        this.strategySelectorContainer = document.createElement('div');
        this.newStrategyContainer = document.createElement('div');
        this.root.appendChild(this.strategyInfoContainer);
        this.root.appendChild(this.strategySelectorContainer);
        this.root.appendChild(this.newStrategyContainer);
        this.newStrategyView = null;
        this.strategySelectors = [];
        this.changed = false;
    }

    initUi(account, code, strGrp, deals) {
        utils.removeAllChild(this.strategyInfoContainer);
        utils.removeAllChild(this.strategySelectorContainer);
        utils.removeAllChild(this.newStrategyContainer);
        this.strategySelectors = [];
        this.changed = false;
        this.code = code;
        this.account = account;
        this.strGrp = strGrp ? strGrp : {grptype: 'GroupStandard'};
        this.deals = deals;
        if (!this.strGrp.transfers) {
            this.strGrp.transfers = {};
        };
        this.createGroupInfoView();
        var nextId = 0;
        if (this.strGrp.strategies) {
            for (var id in this.strGrp.strategies) {
                if (!this.strGrp.transfers[id]) {
                    this.strGrp.transfers[id] = {transfer: -1};
                };
                this.insertSelectorView(id, this.strGrp.strategies[id], this.strGrp.transfers[id].transfer);
                while (id - nextId >= 0) {
                    nextId++;
                };
            };
            this.onAvailableTransferIdChanged();
        };
        this.newStrategyView = new StrategySelectorView(this.account, nextId);
        this.newStrategyView.createView();
        this.newStrategyView.strGroupView = this;
        this.newStrategyContainer.appendChild(this.newStrategyView.root);
    }

    createGroupInfoView() {
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode('满仓数量 '));
        this.inputCount = document.createElement('input');
        this.inputCount.style.maxWidth = '60px';
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode(' 金额 '));
        this.inputAmount = document.createElement('input');
        this.inputAmount.style.maxWidth = '80px';
        ctDiv.appendChild(this.inputAmount);
        this.inputAmount.onchange = e => {
            this.inputCount.value = guang.calcBuyCount(this.inputAmount.value, this.latestPrice);
        }

        if (!this.strGrp || !this.strGrp.count0) {
            var amount = 10000;
            if (this.strGrp && this.strGrp.amount) {
                amount = this.strGrp.amount;
            }
            this.inputAmount.value = amount;
            this.inputCount.value = guang.calcBuyCount(amount, this.latestPrice);
        } else {
            this.inputCount.value = this.strGrp.count0;
            if (this.strGrp.amount) {
                this.inputAmount.value = this.strGrp.amount;
            }
        }

        this.cdSelector = document.createElement("select");
        ctDiv.appendChild(this.cdSelector);
        this.cdSelector.options.add(new Option('无成本方案', ''));
        for (const c in emjyBack.costDog) {
            this.cdSelector.options.add(new Option('方案: ' + c, c));
        }
        if (!this.strGrp.uramount) {
            this.cdSelector.value = '';
        } else {
            this.cdSelector.value = this.strGrp.uramount.key;
        }
        if (this.strGrp.uramount && this.strGrp.uramount.id) {
            this.cdSelector.disabled = true;
        }

        this.strategyInfoContainer.appendChild(ctDiv);

        this.detailRecords = new RecordsTable(this.strGrp.buydetail);
        this.strategyInfoContainer.appendChild(this.detailRecords.root);
        this.dealsRecords = new RecordsTable(this.deals);
        this.dealsRecords.root.style.backgroundColor = 'lightgray';
        this.strategyInfoContainer.appendChild(this.dealsRecords.root);
    }

    insertSelectorView(id, strategy, transId) {
        var strategySelView = new StrategySelectorView(this.account, id, strategy, transId);
        if (!this.strGrp.strategies[id]) {
            this.strGrp.strategies[id] = strategy;
        }
        strategySelView.strGroupView = this;
        strategySelView.createView();
        this.strategySelectorContainer.appendChild(strategySelView.root);
        this.strategySelectors.push(strategySelView);
    }

    onAvailableTransferIdChanged() {
        var ids = [];
        ids.push({id: -1, val: '无'});
        for (var i = 0; i < this.strategySelectors.length; i++) {
            var id = this.strategySelectors[i].id;
            var idObj = {id};
            idObj.val = '策略 ' + id + ': ' + strategyViewManager.getStrategyName(this.strategySelectors[i].strategy.key);
            ids.push(idObj);
        };
        this.strategySelectors.forEach(s => {s.setAvailableTransfers(ids);});
    }

    onStrategyAdded(id, key) {
        this.insertSelectorView(id, {key});
        this.onAvailableTransferIdChanged();
        this.changed = true;
    }

    onStrategyRemoved(id) {
        var sel = this.strategySelectors.findIndex(s=>{return s.id == id;});
        if (sel != -1) {
            this.strategySelectorContainer.removeChild(this.strategySelectors[sel].root);
            this.strategySelectors.splice(sel, 1);
            this.changed = true;
        };
    }

    updateAccountDeals(dealsRecords) {
        if (dealsRecords.isChanged()) {
            const deals = dealsRecords.deals;
            const url = emjyBack.fha.server + '/stock';
            const fd = new FormData();
            fd.append('act', 'fixdeals');
            fd.append('acc', this.account);
            fd.append('code', emjyBack.getLongStockCode(this.code));
            fd.append('data', JSON.stringify(deals));
            var headers = emjyBack.headers.headers;
            fetch(url, {method: 'POST', headers, body: fd});
        }
    }

    checkChanged() {
        for (var i = 0; i < this.strategySelectors.length; i++) {
            this.changed |= this.strategySelectors[i].isChanged();
        };
        if (this.changed || this.strategySelectors.length > 0) {
            if (this.inputCount) {
                // var count = parseInt(this.inputCount.value);
                // if (!Number.isNaN(count)) {
                //     if (!this.strGrp.count0 || count != this.strGrp.count0) {
                //         this.strGrp.count0 = count;
                //         this.changed = true;
                //     }
                // }
            }
            if (this.inputAmount) {
                var amount = parseInt(this.inputAmount.value);
                if (!this.strGrp.amount || amount != this.strGrp.amount) {
                    this.strGrp.amount = amount;
                    this.changed = true;
                }
            }
        }
        if (this.cdSelector) {
            if (this.strGrp.uramount && this.strGrp.uramount.key != this.cdSelector.value) {
                if (this.cdSelector.value === '') {
                    delete(this.strGrp.uramount);
                } else {
                    this.strGrp.uramount = {key: this.cdSelector.value};
                }
                this.changed = true;
            } else if (!this.strGrp.uramount && this.cdSelector.value !== '') {
                this.strGrp.uramount = {key: this.cdSelector.value};
                this.changed = true;
            }
        }
        if (this.detailRecords) {
            this.changed |= this.detailRecords.isChanged();
        }
        if (this.dealsRecords) {
            this.updateAccountDeals(this.dealsRecords);
        }
        return this.changed;
    }

    saveStrategy() {
        this.checkChanged();
        if (!this.changed && (!this.strGrp || !this.strGrp.infixing)) {
            return;
        };

        const { strategies, transfers } = this.strategySelectors.reduce((acc, selector) => {
            acc.strategies[selector.id] = selector.strategyView.strategy;
            acc.transfers[selector.id] = { transfer: selector.transferView.selectedId() };
            return acc;
        }, { strategies: {}, transfers: {} });
        this.strGrp.strategies = strategies;
        if (this.detailRecords) {
            this.strGrp.buydetail = this.detailRecords.deals;
        }
        this.strGrp.transfers = transfers;
        delete(this.strGrp.infixing);
        console.log('send save strategy POST', JSON.stringify(this.strGrp));

        const fd = new FormData();
        fd.append('act', 'strategy');
        fd.append('acc', this.account);
        fd.append('code', emjyBack.getLongStockCode(this.code));
        fd.append('data', JSON.stringify(this.strGrp));
        var headers = emjyBack.headers.headers
        const url = emjyBack.fha.server + '/stock';
        fetch(url, {method: 'POST', headers, body: fd});
    }
}
