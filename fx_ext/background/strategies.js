'use strict';

class StrategyManager {
    constructor() {
        this.buystrategies = [{key: 'StrategyBuy', name: '反弹买入'}, {key: 'StrategyBuyR', name: '反弹(重复)买入'}, {key: 'StrategyBuyIPO', name: '开板反弹买入'}, {key: 'StrategyBuyZT', name: '开盘买,低位补'}];
        this.sellstrategies = [{key: 'StrategySell', name: '反弹卖出'}, {key: 'StrategySellR', name: '反弹(重复)卖出'}, {key: 'StrategySellIPO', name: '开板卖出'}, {key: 'StrategySellEL', name: '止损止盈'}];
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
        if (key == 'StrategyBuyZT') {
            return new StrategyBuyZT2(key, log);
        };
        if (key == 'StrategySellEL') {
            return new StrategySellEL(key, log);
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
        this.amount = null;
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

        if (this.inputAmount) {
            var amount = parseInt(this.inputAmount.value);
            if (!this.amount || this.amount != amount) {
                changed = true;
                this.amount = amount;
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
        this.amount = str.amount;
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
        str.amount = this.amount;
        str.account = this.account;
        str.prePeekPrice = this.prePeekPrice;
        str.inCritical = this.inCritical;
        return str;
    }

    tostring() {
        var str = this.toDataObj();
        return JSON.stringify(str);
    }

    calcCount(amount, price) {
        var ct = (amount / 100) / price;
        var d = ct - Math.floor(ct);
        if (d <= ct * 0.15) {
            return 100 * Math.floor(ct);
        };
        return 100 * Math.ceil(ct);
    }

    matchResult(match, price) {
        if (!match) {
            return {match};
        };
        var result = {match, price};
        result.account = this.account;
        if (this.count && this.count != 0) {
            result.count = this.count;
        } else if (this.amount && this.amount != 0) {
            result.count = this.calcCount(this.amount, price);
        } else {
            result.count = this.calcCount(40000, price);
        };
        return result;
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

    createCountDiv(text = '卖出数量 ', cnt = 0) {
        var ctDiv = document.createElement('div');
        ctDiv.appendChild(document.createTextNode(text));
        this.inputCount = document.createElement('input');
        if (this.count) {
            this.inputCount.value = this.count;
        } else {
            this.inputCount.value = cnt;
        };
        ctDiv.appendChild(this.inputCount);
        ctDiv.appendChild(document.createTextNode('股'));
        return ctDiv;
    }

    createAmountDiv(text = '买入金额 ', amt = 40000) {
        var amtDiv = document.createElement('div');
        amtDiv.appendChild(document.createTextNode(text));
        this.inputAmount = document.createElement('input');
        if (this.amount) {
            this.inputAmount.value = this.amount;
        } else {
            this.inputAmount.value = amt;
        };
        amtDiv.appendChild(this.inputAmount);
        amtDiv.appendChild(document.createTextNode('元'));
        return amtDiv;
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
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        if (!this.inCritical) {
            if (price <= this.guardPrice) {
                this.inCritical = true;
                stepInCritical = true
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return {match, stepInCritical, account: this.account};
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[0]);
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return {match, stepInCritical, account: this.account};
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 <= '));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createAmountDiv());
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySell extends Strategy {
    check(rtInfo) {
        var price = rtInfo.latestPrice;
        var match = false;
        var stepInCritical = false;
        if (!this.inCritical) {
            if (price > this.guardPrice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                stepInCritical = true;
                strategyManager.flushStrategy(this);
            }
            return {match, stepInCritical, account: this.account};
        }
        if (price <= this.prePeekPrice * (1 - this.backRate)) {
            return this.matchResult(true, rtInfo.buyPrices[0]);
        }
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return {match, stepInCritical, account: this.account};
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 >= '));
        view.appendChild(this.createPopbackInput('回撤幅度 '));
        view.appendChild(this.createCountDiv());
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
        view.appendChild(this.createAmountDiv());
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
        view.appendChild(this.createCountDiv());
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
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        var topprice = rtInfo.topprice;
        var bottomprice = rtInfo.bottomprice;
        if (!this.inCritical) {
            if (price < topprice) {
                this.inCritical = true;
                this.prePeekPrice = price;
                stepInCritical = true;
                strategyManager.flushStrategy(this);
            }
            return {match, stepInCritical, account: this.account};
        }
        if (price >= this.prePeekPrice * (1 + this.backRate)) {
            return this.matchResult(true, rtInfo.sellPrices[0]);
        }
        if (price < this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        }
        return {match, stepInCritical, account: this.account};
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createAmountDiv());
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellIPO extends StrategySell {
    check(rtInfo) {
        var match = false;
        if (rtInfo.openPrice == rtInfo.topprice) {
            if (rtInfo.latestPrice < rtInfo.topprice) {
                return this.matchResult(true, rtInfo.buyPrices[0]);
            };
            return {match};
        };

        if (rtInfo.openPrice == rtInfo.bottomprice) {
            return this.matchResult(true, rtInfo.openPrice);
        };
        
        if (!this.inCritical) {
            this.guardPrice = rtInfo.latestPrice;
            this.inCritical = true;
            strategyManager.flushStrategy(this);
            return {match};
        };

        if (rtInfo.latestPrice <= this.prePeekPrice * 0.99) {
            return this.matchResult(true, rtInfo.buyPrices[0]);
        }

        if (rtInfo.latestPrice > this.prePeekPrice) {
            this.prePeekPrice = rtInfo.latestPrice;
            strategyManager.flushStrategy(this);
        }
        return {match};
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('涨停板打开直接卖出,开盘不涨停则从高点反弹1%时卖出,跌停开盘直接卖出'));
        view.appendChild(this.createCountDiv());
        return view;
    }
}

class StrategyBuyZT2 extends StrategyBuy {
    buyMatch(refer) {
        this.buyRound++;
        this.guardPrice = refer * (1 - this.stepRate);
        if (this.buyRound >= 2) {
            this.enabled = false;
        };
    }

    parse(str) {
        super.parse(str);
        this.buyRound = str.buyRound === undefined ? 0 : str.buyRound;
    }

    toDataObj() {
        var str = super.toDataObj();
        str.buyRound = this.buyRound;
        return str;
    }

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        if (this.buyRound >= 2) {
            return {match, stepInCritical, account: this.account};
        };
        if (this.buyRound == 0) {
            return this.matchResult(true, rtInfo.sellPrices[0]);
        };
        if (this.buyRound == 1) {
            var price = rtInfo.latestPrice;
            var topprice = rtInfo.topprice;
            var bottomprice = rtInfo.bottomprice;
            if (!this.inCritical) {
                if (price < this.guardPrice) {
                    this.inCritical = true;
                    stepInCritical = true;
                    this.prePeekPrice = price;
                    strategyManager.flushStrategy(this);
                };
                return {match, stepInCritical, account: this.account};
            };
            if (price >= this.prePeekPrice * (1 + this.backRate)) {
                return this.matchResult(true, rtInfo.sellPrices[0]);
            }
            if (price < this.prePeekPrice) {
                this.prePeekPrice = price;
                strategyManager.flushStrategy(this);
            }
            return {match, stepInCritical, account: this.account};
        };
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('开盘直接买入'));
        view.appendChild(this.createStepsInput('盘中补仓跌幅 ', 8));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createAmountDiv());
        return view;
    }
}

class StrategySellEL  extends StrategySell {
    buyMatch(refer) {
        if (!this.guardPrice || this.guardPrice == 0) {
            this.guardPrice = refer;
        } else {
            this.guardPrice = (this.guardPrice + refer) / 2;
        };
        this.enabled = true;
    }

    sellMatch(refer) {
        this.enabled = false;
    }

    check(rtInfo) {
        var match = false;
        var stepInCritical = false;
        var price = rtInfo.latestPrice;
        if (this.guardPrice * (1 - this.backRate) >= price) {
            return this.matchResult(true, rtInfo.buyPrices[0]);
        };

        if (!this.inCritical) {
            if (this.guardPrice * (1 + this.stepRate) <= price) {
                this.inCritical = true;
                this.prePeekPrice = price;
                stepInCritical = true;
                strategyManager.flushStrategy(this);
            }
            return {match, stepInCritical, account: this.account};
        };

        var dynPeek = this.prePeekPrice - (this.prePeekPrice - this.guardPrice) * 0.2;
        if (price <= dynPeek) {
            return this.matchResult(true, rtInfo.buyPrices[0]);
        };
        if (price > this.prePeekPrice) {
            this.prePeekPrice = price;
            strategyManager.flushStrategy(this);
        };
        return {match, stepInCritical, account: this.account};
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('止损止盈,满足条件时全部卖出'));
        view.appendChild(this.createStepsInput('止盈 ', 20));
        view.appendChild(this.createPopbackInput('止损 ', 15));
        return view;
    }
}

let strategyManager = new StrategyManager();
