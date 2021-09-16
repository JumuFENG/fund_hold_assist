'use strict';

class StrategySelectorView {
    constructor(account, id, strategy) {
        this.root = document.createElement('div');
        this.root.className = 'strategy_border_div';
        this.account = account;
        this.id = id;
        this.strategy = strategy;
    }

    createSelector() {
        var strategySelector = document.createElement('select');
        var opt0 = document.createElement('option');
        opt0.textContent = '--选择--';
        opt0.selected = true;
        opt0.disabled = true;
        strategySelector.appendChild(opt0);
        for (var i = 0; i < BuyStrategyKeyNames.length; i++) {
            var opt = document.createElement('option');
            opt.value = BuyStrategyKeyNames[i].key;
            opt.textContent = BuyStrategyKeyNames[i].name;
            strategySelector.appendChild(opt);
        };
        var opt1 = document.createElement('option');
        opt1.textContent = '==========';
        opt1.disabled = true;
        strategySelector.appendChild(opt1);
        for (var i = 0; i < SellStrategyKeyNames.length; i++) {
            var opt = document.createElement('option');
            opt.value = SellStrategyKeyNames[i].key;
            opt.textContent = SellStrategyKeyNames[i].name;
            strategySelector.appendChild(opt);
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
            var strategyView = strategyViewManager.viewer(this.strategy);
            strategyView.ownerAccount = this.account;
            this.strateyContainer.appendChild(strategyView.createView());
        };
    }

    createView() {
        this.createSelector();
        this.createStrategyView();
    }

    onStrategyChanged(key) {
        this.strategy = {key};
        this.createStrategyView();
    }
}

class StrategyGroupView {
    constructor() {
        this.root = document.createElement('div');
        this.strategySelectorContainer = document.createElement('div');
        this.newStrategyContainer = document.createElement('div');
        this.root.appendChild(this.strategySelectorContainer);
        this.root.appendChild(this.newStrategyContainer);
        this.newStrategyView = null;
        this.strategySelectors = [];
        this.changed = false;
    }

    initUi(strGrp) {
        utils.removeAllChild(this.strategySelectorContainer);
        utils.removeAllChild(this.newStrategyContainer);
        var nextId = 0;
        this.strGrp = strGrp
        if (this.strGrp.strategies) {
            for (var id in this.strGrp.strategies) {
                this.insertSelectorView(id, this.strGrp.strategies[id]);
                if (id >= nextId) {
                    nextId = id + 1;
                };
            };
        };
        this.newStrategyView = new StrategySelectorView(this.strGrp.account, nextId);
        this.newStrategyView.createView();
        this.newStrategyView.strGroupView = this;
        this.newStrategyContainer.appendChild(this.newStrategyView.root);
    }

    insertSelectorView(id, strategy) {
        var strategySelView = new StrategySelectorView(this.strGrp.account, id, strategy);
        strategySelView.strGroupView = this;
        strategySelView.createView();
        this.strategySelectorContainer.appendChild(strategySelView.root);
        this.strategySelectors.push(strategySelView);
    }

    onStrategyAdded(id, key) {
        this.insertSelectorView(id, {key});
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

    isChanged() {
        if (this.changed) {
            return true;
        };

        for (var i = 0; i < this.strategySelectors.length; i++) {
            if (this.strategySelectors[i].isChanged()) {
                return true;
            }
        };
        return false;
    }

    saveStrategy() {
        if (!this.isChanged()) {
            
        };
    }
}
