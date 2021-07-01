'use strict';

class StrategyManager {
    constructor() {
        this.buystrategies = [{key: 'StrategyBuy', name: '反弹买入'}, {key: 'StrategyBuyR', name: '反弹(重复)买入'}, {key: 'StrategyBuyIPO', name: '开板反弹买入'}];
        this.sellstrategies = [{key: 'StrategySell', name: '反弹卖出'}, {key: 'StrategySellR', name: '反弹(重复)卖出'}, {key: 'StrategySellIPO', name: '开板卖出'}];
    }

    createStrategy(key, log) {
        if (key == 'StrategyBuy') {
            return new StrategyBuy(key, log);
        }
        if (key == 'StrategySell') {
            return new StrategySell(key, log);
        }
        if (key == 'StrategyBuyIPO') {
            return new StrategyBuyIPO(key, log);
        }
        if (key == 'StrategySellIPO') {
            return new StrategySellIPO(key, log);
        }
        if (key == 'StrategyBuyR') {
            return new StrategyBuyRepeat(key, log);
        };
        if (key == 'StrategySellR') {
            return new StrategySellRepeat(key, log);
        };
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

    buyMatch(peek) {
        this.enabled = false;
        this.inCritical = false;
    }

    sellMatch(peek) {
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

    toDataObj() {
        var str = {};
        str.key = this.key;
        str.enabled = this.enabled;
        str.guardPrice = this.guardPrice;
        str.backRate = this.backRate;
        str.count = this.count;
        str.account = this.account;
        str.prePeekPrice = this.prePeekPrice;
        str.inCritical = this.inCritical;
        return str;
    }

    tostring() {
        var str = this.toDataObj();
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

    createReferedInput(text) {
        var refDiv = document.createElement('div');
        refDiv.appendChild(document.createTextNode(text));
        this.inputRefer = document.createElement('input');
        refDiv.appendChild(this.inputRefer);
        return refDiv;
    }

    createStepsInput(text, step = 6) {
        var stepDiv = document.createElement('div');
        stepDiv.appendChild(document.createTextNode(text));
        this.inputStep = document.createElement('input');
        if (this.stepRate) {
            this.inputStep.value = 100 * this.stepRate;
        } else {
            this.inputStep.value = step;
        }
        stepDiv.appendChild(this.inputStep);
        stepDiv.appendChild(document.createTextNode('%'));
        return stepDiv;
    }

    createPopbackInput(text, rate = 1) {
        var popDiv = document.createElement('div');
        popDiv.appendChild(document.createTextNode(text));
        this.inputPop = document.createElement('input');
        if (this.backRate) {
            this.inputPop.value = 100 * this.backRate;
        } else {
            this.inputPop.value = rate;
        }
        popDiv.appendChild(this.inputPop);
        popDiv.appendChild(document.createTextNode('%'));
        return popDiv;
    }

    createCountDiv(text, cnt = 0) {
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode(text));
        this.inputCount = document.createElement('input');
        if (this.count) {
            this.inputCount.value = this.count;
        } else {
            this.inputCount.value = '0';
        }
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
        var result = {match: false};
        var price = rtInfo.latestPrice;
        if (!this.inCritical) {
            if (price <= this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return result;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            result.match = true;
            result.price = rtInfo.sellPrices[0];
            result.account = this.account;
            if (!this.count || this.count == 0) {
                count = 100 * Math.ceil(400 / result.price);
            } else {
                result.count = this.count;
            };
            return result;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return result;
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
        var result = {match: false};
        if (!this.inCritical) {
            if (price > this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return result;
        }
        if (price <= this.prePeekPrice * (1 - this.backRate)) {
            result.match = true;
            result.price = rtInfo.buyPrices[0];
            result.account = this.account;
            if (!this.count || this.count == 0) {
                count = 100 * Math.ceil(400 / result.price);
            } else {
                result.count = this.count;
            };
            return result;
        }
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return result;
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

class StrategyBuyRepeat extends StrategyBuy {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createReferedInput('参考价(前高) '));
        view.appendChild(this.createStepsInput('波段振幅 '));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }

    isChanged() {
        var changed = super.isChanged();
        if (this.inputRefer && this.inputRefer.value && this.inputStep) {
            var guard = this.inputRefer.value * (100 - this.inputStep.value) / 100;
            if (this.guardPrice != guard) {
                this.guardPrice = guard;
                changed = true;
            };
        };
        if (this.inputStep) {
            var stepRate = parseFloat(this.inputStep.value) / 100;
            if (!this.stepRate || this.stepRate != stepRate) {
                this.stepRate = stepRate;
                changed = true;
            };
        };
        return changed;
    }

    buyMatch(refer) {
        this.inCritical = false;
        this.guardPrice = refer * (1 - this.stepRate);
    }

    sellMatch(refer) {
        this.inCritical = false;
        this.guardPrice = refer * (1 - this.stepRate);
    }

    parse(str) {
        super.parse(str);
        this.stepRate = str.stepRate;
    }

    toDataObj() {
        var str = super.toDataObj();
        str.stepRate = this.stepRate;
        return str;
    }
}

class StrategySellRepeat extends StrategySell {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createReferedInput('参考价(前低) '));
        view.appendChild(this.createStepsInput('波段振幅 ', 8));
        view.appendChild(this.createPopbackInput('回撤幅度 '));
        return view;
    }

    isChanged() {
        var changed = super.isChanged();
        if (this.inputRefer && this.inputRefer.value && this.inputStep) {
            var guard = this.inputRefer.value * (100 + parseInt(this.inputStep.value)) / 100;
            if (this.guardPrice != guard) {
                this.guardPrice = guard;
                changed = true;
            };
        };
        if (this.inputStep) {
            var stepRate = parseFloat(this.inputStep.value) / 100;
            if (!this.stepRate || this.stepRate != stepRate) {
                this.stepRate = stepRate;
                changed = true;
            };
        };
        return changed;
    }

    buyMatch(refer) {
        this.inCritical = false;
        this.guardPrice = refer * (1 + this.stepRate);
    }

    sellMatch(refer) {
        this.inCritical = false;
        this.guardPrice = refer * (1 + this.stepRate);
    }

    parse(str) {
        super.parse(str);
        this.stepRate = str.stepRate;
    }

    toDataObj() {
        var str = super.toDataObj();
        str.stepRate = this.stepRate;
        return str;
    }
}

class StrategyBuyIPO extends StrategyBuy {
    check(rtInfo) {
        var result = {match: false};
        var price = rtInfo.latestPrice;
        var topprice = rtInfo.topprice;
        var bottomprice = rtInfo.bottomprice;
        if (!this.inCritical) {
            if (price < topprice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return result;
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            result.match = true;
            result.price = rtInfo.sellPrices[0];
            result.account = this.account;
            if (!this.count || this.count == 0) {
                count = 100 * Math.ceil(400 / result.price);
            } else {
                result.count = this.count;
            };
            return result;
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return result;
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
        var result = {match: false};
        if (rtInfo.openPrice == rtInfo.topprice) {
            result.match = rtInfo.latestPrice < rtInfo.topprice;
            return result;
        };
        
        if (!this.inCritical) {
            this.guardPrice = rtInfo.latestPrice;
            this.inCritical = true;
            strategyManager.flushStrategy(this);
            return result;
        };

        if (rtInfo.latestPrice <= this.prePeekPrice * 0.99) {
            result.match = true;
            result.price = rtInfo.buyPrices[0];
            result.account = this.account;
            if (!this.count || this.count == 0) {
                count = 100 * Math.ceil(400 / result.price);
            } else {
                result.count = this.count;
            };
            return result;
        }

        if (rtInfo.latestPrice > this.prePeekPrice) {
            this.prePeekPrice = rtInfo.latestPrice;
            strategyManager.flushStrategy(this);
        }
        return result;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('涨停板打开直接卖出,开盘不涨停则从高点反弹1%时卖出'));
        view.appendChild(this.createCountDiv('卖出数量 '));
        return view;
    }
}

let strategyManager = new StrategyManager();
