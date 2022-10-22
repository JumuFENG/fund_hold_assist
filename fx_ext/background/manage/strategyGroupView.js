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
        for (var i = 0; i < ComplexStrategyKeyNames.length; i++) {
            strategySelector.appendChild(new Option(ComplexStrategyKeyNames[i].name, ComplexStrategyKeyNames[i].key));
        }
        var opt1 = new Option('==========');
        opt1.disabled = true;
        strategySelector.appendChild(opt1);
        for (var i = 0; i < BuyStrategyKeyNames.length; i++) {
            strategySelector.appendChild(new Option(BuyStrategyKeyNames[i].name, BuyStrategyKeyNames[i].key));
        };
        var opt2 = new Option('==========');
        opt2.disabled = true;
        strategySelector.appendChild(opt2);
        for (var i = 0; i < SellStrategyKeyNames.length; i++) {
            strategySelector.appendChild(new Option(SellStrategyKeyNames[i].name, SellStrategyKeyNames[i].key));
        };
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

    initUi(account, code, strGrp) {
        utils.removeAllChild(this.strategyInfoContainer);
        utils.removeAllChild(this.strategySelectorContainer);
        utils.removeAllChild(this.newStrategyContainer);
        this.strategySelectors = [];
        this.changed = false;
        this.code = code;
        this.account = account;
        this.strGrp = strGrp ? strGrp : {grptype: 'GroupStandard'};
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
        this.inputCount.style.maxWidth = 60;
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode(' 金额 '));
        this.inputAmount = document.createElement('input');
        this.inputAmount.style.maxWidth = 80;
        ctDiv.appendChild(this.inputAmount);
        this.inputAmount.onchange = e => {
            this.inputCount.value = utils.calcBuyCount(this.inputAmount.value, this.latestPrice);
        }

        if (!this.strGrp || !this.strGrp.count0) {
            var amount = 10000;
            if (this.strGrp && this.strGrp.amount) {
                amount = this.strGrp.amount;
            }
            this.inputAmount.value = amount;
            this.inputCount.value = utils.calcBuyCount(amount, this.latestPrice);
        } else {
            this.inputCount.value = this.strGrp.count0;
            if (this.strGrp.amount) {
                this.inputAmount.value = this.strGrp.amount;
            }
        }
        this.strategyInfoContainer.appendChild(ctDiv);

        if (this.strGrp.buydetail && this.strGrp.buydetail.length > 0) {
            var detailDiv = document.createElement('div');
            detailDiv.style.maxHeight = 100;
            detailDiv.style.maxWidth = 350;
            detailDiv.style.overflowY = 'auto';
            var createCell = function(t, w) {
                var c = document.createElement('div');
                c.textContent = t;
                if (w) {
                    c.style.minWidth = w;
                }
                c.style.textAlign = 'center';
                c.style.borderLeft = 'solid 1px';
                return c;
            }
            this.strGrp.buydetail.slice().reverse().forEach(d => {
                var r = document.createElement('div');
                r.style.display = 'flex';
                r.appendChild(createCell(d.count, 50));
                r.appendChild(createCell(d.date, 80));
                r.appendChild(createCell(d.type, 30));
                r.appendChild(createCell((d.price * d.count).toFixed(2), 70));
                r.appendChild(createCell(parseFloat(d.price), 70));
                detailDiv.appendChild(r);
            });
            this.strategyInfoContainer.appendChild(detailDiv);
        }
    }

    insertSelectorView(id, strategy, transId) {
        var strategySelView = new StrategySelectorView(this.account, id, strategy, transId);
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

    checkChanged() {
        for (var i = 0; i < this.strategySelectors.length; i++) {
            this.changed |= this.strategySelectors[i].isChanged();
        };
        if (this.changed || this.strategySelectors.length > 0) {
            if (this.inputCount) {
                var count = parseInt(this.inputCount.value);
                if (!Number.isNaN(count)) {
                    if (!this.strGrp.count0 || count != this.strGrp.count0) {
                        this.strGrp.count0 = count;
                        this.changed = true;
                    }
                }
            }
            if (this.inputAmount) {
                var amount = parseInt(this.inputAmount.value);
                if (!this.strGrp.amount || amount != this.strGrp.amount) {
                    this.strGrp.amount = amount;
                    this.changed = true;
                }
            }
        }
        return this.changed;
    }

    saveStrategy() {
        this.checkChanged();
        if (!this.changed) {
            return;
        };
        var message = {command:'mngr.strategy', code: this.code, account: this.account};
        var strategies = {};
        var transfers = {};
        for (var i = 0; i < this.strategySelectors.length; i++) {
            strategies[this.strategySelectors[i].id] = this.strategySelectors[i].strategyView.strategy;
            transfers[this.strategySelectors[i].id] = {transfer: this.strategySelectors[i].transferView.selectedId()};
        };
        this.strGrp.strategies = strategies;
        this.strGrp.transfers = transfers;
        message.strategies = this.strGrp;
        emjyManager.sendExtensionMessage(message);
    }
}
