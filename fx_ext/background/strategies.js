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

    initStrategy(str, log) {
        var strategy = this.createStrategy(str.key, log);
        strategy.parse(str);
        return strategy;
    }
}

class Strategy {
    constructor(k, log) {
        this.log = log;
        this.key = k;
        this.enabled = true;
        this.guardPrice = null;
        this.backRate = null;
        this.count = null;
        this.account = null;
        this.prePeekPrice = null;
        this.inCritical = false;
    }

    check(price) {
        this.log('check Strategy');
    }

    createView() {
        this.log('createView');
    }

    isChanged() {
        var changed = false;
        if (this.enabledCheck.checked != this.enabled) {
            changed = true;
            this.enabled = this.enabledCheck.checked;
        }
        var guardPrice = parseFloat(this.inputGuard.value);
        if (!this.guardPrice || this.guardPrice != guardPrice) {
            changed = true;
            this.guardPrice = guardPrice;
        }
        var backRate = parseFloat(this.inputPop.value) / 100;
        if (!this.backRate || this.backRate != backRate) {
            changed = true;
            this.backRate = backRate;
        };
        var count = parseInt(this.inputCount.value);
        if (!this.count || this.count != count) {
            changed = true;
            this.count = count;
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
}

class StrategyBuy extends Strategy {
    check(price) {
        if (!this.inCritical) {
            if (price <= this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
            }
            return false;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return true;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
        }
        return false;
    }

    createView() {
        var view = document.createElement('div');
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '启用';
        this.enabledCheck = document.createElement('input');
        this.enabledCheck.type = 'checkbox';
        this.enabledCheck.checked = this.enabled;
        checkLbl.appendChild(this.enabledCheck);
        view.appendChild(checkLbl);
        var guardDiv = document.createElement('div');
        guardDiv.appendChild(document.createTextNode('监控价格 <= '));
        this.inputGuard = document.createElement('input');
        if (this.guardPrice) {
            this.inputGuard.value = this.guardPrice;
        }
        guardDiv.appendChild(this.inputGuard);
        view.appendChild(guardDiv);
        var popDiv = document.createElement('div');
        popDiv.appendChild(document.createTextNode('反弹幅度 '));
        this.inputPop = document.createElement('input');
        if (this.backRate) {
            this.inputPop.value = 100 * this.backRate;
        }
        popDiv.appendChild(this.inputPop);
        popDiv.appendChild(document.createTextNode('%'));
        view.appendChild(popDiv);
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode('买入数量 '));
        this.inputCount = document.createElement('input');
        if (this.count) {
            this.inputCount.value = this.count;
        };
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode('股'));
        view.appendChild(ctDiv);
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
        view.appendChild(acctDiv);
        return view;
    }
}

class StrategySell extends Strategy {
    check(price) {
        if (!this.inCritical) {
            if (price > this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
            }
            return false;
        }
        if (price <= this.prePeekPrice * (1 - this.backRate)) {
            return true;
        }
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
        }
        return false;
    }

    createView() {
        var view = document.createElement('div');
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '启用';
        this.enabledCheck = document.createElement('input');
        this.enabledCheck.type = 'checkbox';
        this.enabledCheck.checked = this.enabled;
        checkLbl.appendChild(this.enabledCheck);
        view.appendChild(checkLbl);
        var guardDiv = document.createElement('div');
        guardDiv.appendChild(document.createTextNode('监控价格 >= '));
        this.inputGuard = document.createElement('input');
        if (this.guardPrice) {
            this.inputGuard.value = this.guardPrice;
        }
        guardDiv.appendChild(this.inputGuard);
        view.appendChild(guardDiv);
        var popDiv = document.createElement('div');
        popDiv.appendChild(document.createTextNode('回撤幅度 '));
        this.inputPop = document.createElement('input');
        if (this.backRate) {
            this.inputPop.value = 100 * this.backRate;
        }
        popDiv.appendChild(this.inputPop);
        popDiv.appendChild(document.createTextNode('%'));
        view.appendChild(popDiv);
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode('卖出数量 '));
        this.inputCount = document.createElement('input');
        if (this.count) {
            this.inputCount.value = this.count;
        };
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode('股'));
        view.appendChild(ctDiv);
        return view;
    }
}

class StrategyBuyIPO extends StrategyBuy {

}

class StrategySellIPO extends StrategySell {

}