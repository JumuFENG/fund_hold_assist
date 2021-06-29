'use strict';

class StrategyManager {
    constructor() {
        this.buystrategies = [{key: 'StrategyBuy', name: '反弹买入'}, {key: 'StrategyBuyIPO', name: '开板反弹买入'}];
        this.sellstrategies = [{key: 'StrategySell', name: '反弹卖出'}, {key: 'StrategySellIPO', name: '开板卖出'}];
    }

    createStrategy(key, log) {
        if (key == 'StrategyBuy') {
            return new StrategyBuy(key, log);
        }
        if (key == 'StrategyBuyIPO') {
            return new StrategyBuyIPO(key, log);
        }
        if (key == 'StrategySell') {
            return new StrategySell(key, log);
        }
        if (key == 'StrategySellIPO') {
            return new StrategySellIPO(key, log);
        }
    }

    initStrategy(storekey, str, log) {
        var strategy = this.createStrategy(str.key, log);
        strategy.storeKey = storekey;
        strategy.parse(str);
        return strategy;
    }

    flushStrategy(strategy) {
        var storageData = {};
        storageData[strategy.storeKey] = strategy.tostring();
        chrome.storage.local.set(storageData);
    }
}

class Strategy {
    constructor(k, log) {
        this.log = log;
        this.storeKey = null;
        this.key = k;
        this.enabled = true;
        this.guardPrice = null;
        this.backRate = null;
        this.count = null;
        this.account = null;
        this.prePeekPrice = null;
        this.inCritical = false;
    }

    check(rtInfo) {
        this.log('check Strategy');
    }

    buyMatch() {
        this.enabled = false;
        this.inCritical = false;
    }

    sellMatch() {
        this.enabled = false;
        this.inCritical = false;
    }

    createView() {
        this.log('createView');
    }

    isChanged() {
        var changed = false;
        if (this.enabledCheck) {
            if (this.enabledCheck.checked != this.enabled) {
                changed = true;
                this.enabled = this.enabledCheck.checked;
            }
        };

        if (this.inputGuard) {
            var guardPrice = parseFloat(this.inputGuard.value);
            if (!this.guardPrice || this.guardPrice != guardPrice) {
                changed = true;
                this.guardPrice = guardPrice;
            }
        };

        if (this.inputPop) {
            var backRate = parseFloat(this.inputPop.value) / 100;
            if (!this.backRate || this.backRate != backRate) {
                changed = true;
                this.backRate = backRate;
            };
        };

        if (this.inputCount) {
            var count = parseInt(this.inputCount.value);
            if (!this.count || this.count != count) {
                changed = true;
                this.count = count;
            };
        };

        if (this.accountSelector) {
            var account = this.accountSelector.value;
            if (account != this.account) {
                changed = true;
                this.account = account;
            };
        };

        return changed;
    }

    parse(str) {
        this.enabled = str.enabled;
        this.guardPrice = str.guardPrice;
        this.backRate = str.backRate;
        this.count = str.count;
        this.account = str.account;
        this.prePeekPrice = str.prePeekPrice;
        this.inCritical = str.inCritical;
    }

    tostring() {
        var str = {};
        str.key = this.key;
        str.enabled = this.enabled;
        str.guardPrice = this.guardPrice;
        str.backRate = this.backRate;
        str.count = this.count;
        str.account = this.account;
        str.prePeekPrice = this.prePeekPrice;
        str.inCritical = this.inCritical;
        return JSON.stringify(str);
    }

    createEnabledCheckbox() {
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '启用';
        this.enabledCheck = document.createElement('input');
        this.enabledCheck.type = 'checkbox';
        this.enabledCheck.checked = this.enabled;
        checkLbl.appendChild(this.enabledCheck);
        return checkLbl;
    }

    createGuardInput(text) {
        var guardDiv = document.createElement('div');
        guardDiv.appendChild(document.createTextNode(text));
        this.inputGuard = document.createElement('input');
        if (this.guardPrice) {
            this.inputGuard.value = this.guardPrice;
        }
        guardDiv.appendChild(this.inputGuard);
        return guardDiv;
    }

    createPopbackInput(text) {
        var popDiv = document.createElement('div');
        popDiv.appendChild(document.createTextNode(text));
        this.inputPop = document.createElement('input');
        if (this.backRate) {
            this.inputPop.value = 100 * this.backRate;
        }
        popDiv.appendChild(this.inputPop);
        popDiv.appendChild(document.createTextNode('%'));
        return popDiv;
    }

    createCountDiv(text) {
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode(text));
        this.inputCount = document.createElement('input');
        if (this.count) {
            this.inputCount.value = this.count;
        };
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode('股'));
        return ctDiv;
    }

    createBuyAccountSelector() {
        var acctDiv = document.createElement('div');
        acctDiv.appendChild(document.createTextNode('买入账户 '));
        this.accountSelector = document.createElement('select');
        for (var acc in emjyManager.accountNames) {
            var opt = document.createElement('option');
            opt.value = acc;
            opt.textContent = emjyManager.accountNames[acc];
            this.accountSelector.appendChild(opt);
        }
        acctDiv.appendChild(this.accountSelector);
        this.accountSelector.value = this.account;
        return acctDiv;
    }
}

class StrategyBuy extends Strategy {
    check(rtInfo) {
        var price = rtInfo.latestPrice;
        if (!this.inCritical) {
            if (price <= this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return false;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return true;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return false;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 <= '));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createCountDiv('买入数量 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySell extends Strategy {
    check(rtInfo) {
        var price = rtInfo.latestPrice;
        if (!this.inCritical) {
            if (price > this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return false;
        }
        if (price <= this.prePeekPrice * (1 - this.backRate)) {
            return true;
        }
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return false;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 >= '));
        view.appendChild(this.createPopbackInput('回撤幅度 '));
        view.appendChild(this.createCountDiv('卖出数量 '));
        return view;
    }
}

class StrategyBuyIPO extends StrategyBuy {
    check(rtInfo) {
        var price = rtInfo.latestPrice;
        var topprice = rtInfo.topprice;
        var bottomprice = rtInfo.bottomprice;
        var dirty = false;
        if (!this.inCritical) {
            if (price < topprice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return false;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return true;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return false;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createCountDiv('买入数量 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellIPO extends StrategySell {
    check(rtInfo) {
        return rtInfo.latestPrice < rtInfo.topprice;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('涨停板打开直接卖出'));
        view.appendChild(this.createCountDiv('卖出数量 '));
        return view;
    }
}

let strategyManager = new StrategyManager();
