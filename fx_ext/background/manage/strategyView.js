'use strict';

class StrategyViewManager {
    viewer(strategy) {
        if (strategy.key == 'StrategyBuy') {
            return new StrategyBuyView(strategy);
        };
        if (strategy.key == 'StrategyBuyPopup') {
            return new StrategyBuyPopupView(strategy);
        };
        if (strategy.key == 'StrategyBuySD') {
            return new StrategyBuyStopDecView(strategy);
        }
        if (strategy.key == 'StrategySell') {
            return new StrategySellView(strategy);
        };
        if (strategy.key == 'StrategyBuyIPO') {
            return new StrategyBuyIPOView(strategy);
        };
        if (strategy.key == 'StrategySellIPO') {
            return new StrategySellIPOView(strategy);
        };
        if (strategy.key == 'StrategyBuyR') {
            return new StrategyBuyRepeatView(strategy);
        };
        if (strategy.key == 'StrategySellR') {
            return new StrategySellRepeatView(strategy);
        };
        if (strategy.key == 'StrategyBuyZTBoard') {
            return new StrategyBuyZTBoardView(strategy);
        };
        if (strategy.key == 'StrategySellEL') {
            return new StrategySellELView(strategy);
        };
        if (strategy.key == 'StrategySellELS') {
            return new StrategySellELSView(strategy);
        };
        if (strategy.key == 'StrategyBuyMA') {
            return new StrategyBuyMAView(strategy);
        };
        if (strategy.key == 'StrategySellMA') {
            return new StrategySellMAView(strategy);
        };
        if (strategy.key == 'StrategyBuyBE') {
            return new StrategyBuyBeforEndView(strategy);
        };
        if (strategy.key == 'StrategyBuyMAE') {
            return new StrategyBuyMABeforeEndView(strategy);
        };
        if (strategy.key == 'StrategyBuyMAD') {
            return new StrategyBuyMADynamicView(strategy);
        };
        if (strategy.key == 'StrategySellMAD') {
            return new StrategySellMADynamicView(strategy);
        };
        if (strategy.key == 'StrategyMA') {
            return new StrategyMAView(strategy);
        }
        if (strategy.key == 'StrategyGE') {
            return new StrategyGridEarningView(strategy);
        }
    }

    getStrategyName(key) {
        for (var i = 0; i < ComplexStrategyKeyNames.length; i++) {
            if (ComplexStrategyKeyNames[i].key == key) {
                return ComplexStrategyKeyNames[i].name;
            };
        };

        for (var i = 0; i < BuyStrategyKeyNames.length; i++) {
            if (BuyStrategyKeyNames[i].key == key) {
                return BuyStrategyKeyNames[i].name;
            };
        };

        for (var i = 0; i < SellStrategyKeyNames.length; i++) {
            if (SellStrategyKeyNames[i].key == key) {
                return SellStrategyKeyNames[i].name;
            };
        };
    }
}

class StrategyBaseView {
    constructor(str) {
        this.strategy = str;
    }

    createView() {

    }

    isEqualNum(a, b) {
        if (a == b) {
            return true;
        }
        if (isNaN(a) && isNaN(b)) {
            return true;
        }
        if (isNaN(a)) {
            return !b;
        }
        if (isNaN(b)) {
            return !a;
        }
        return false;
    }

    isChanged() {
        var changed = false;
        if (this.enabledCheck) {
            if (this.enabledCheck.checked != this.strategy.enabled) {
                changed = true;
                this.strategy.enabled = this.enabledCheck.checked;
            }
        };

        if (this.inputGuard) {
            var guardPrice = parseFloat(this.inputGuard.value);
            if (!this.isEqualNum(this.strategy.guardPrice, guardPrice)) {
                changed = true;
                this.strategy.guardPrice = guardPrice;
            }
        };

        if (this.inputPop) {
            var backRate = parseFloat(this.inputPop.value) / 100;
            if (!this.isEqualNum(this.strategy.backRate, backRate)) {
                changed = true;
                this.strategy.backRate = backRate;
            };
        };

        if (this.inputStep) {
            var stepRate = parseFloat(this.inputStep.value) / 100;
            if (!this.isEqualNum(this.strategy.stepRate, stepRate)) {
                this.strategy.stepRate = stepRate;
                changed = true;
            };
        };

        if (this.inputCount) {
            var count = parseInt(this.inputCount.value);
            if (!this.isEqualNum(this.strategy.count, count)) {
                changed = true;
                this.strategy.count = count;
            };
        };

        if (this.inputAmount) {
            var amount = parseInt(this.inputAmount.value);
            if (!this.isEqualNum(this.strategy.amount, amount)) {
                changed = true;
                this.strategy.amount = amount;
            };
        };

        if (this.accountSelector) {
            var account = this.accountSelector.value;
            if (account != this.strategy.account) {
                changed = true;
                this.strategy.account = account;
            };
        };

        if (this.klineSelector) {
            var kltype = this.klineSelector.value;
            if (kltype != this.strategy.kltype) {
                changed = true;
                this.strategy.kltype = kltype;
            };
        };

        return changed;
    }

    createEnabledCheckbox() {
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '启用';
        this.enabledCheck = document.createElement('input');
        this.enabledCheck.type = 'checkbox';
        if (this.strategy.enabled === undefined) {
            this.enabledCheck.checked = true;
        } else {
            this.enabledCheck.checked = this.strategy.enabled;
        };
        checkLbl.appendChild(this.enabledCheck);
        return checkLbl;
    }

    createGuardInput(text) {
        var guardDiv = document.createElement('div');
        guardDiv.appendChild(document.createTextNode(text));
        this.inputGuard = document.createElement('input');
        if (this.strategy.guardPrice !== undefined) {
            this.inputGuard.value = this.strategy.guardPrice;
        };
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
        if (this.strategy.stepRate) {
            this.inputStep.value = 100 * this.strategy.stepRate;
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
            this.inputPop.value = 100 * this.strategy.backRate;
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
        if (this.strategy.count) {
            this.inputCount.value = this.strategy.count;
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
        if (this.strategy.amount) {
            this.inputAmount.value = this.strategy.amount;
        } else {
            this.inputAmount.value = amt;
        };
        amtDiv.appendChild(this.inputAmount);
        amtDiv.appendChild(document.createTextNode('元'));
        return amtDiv;
    }

    createBuyAccountSelector() {
        var acctDiv = document.createElement('div');
        if (emjyManager.accountsMap[this.ownerAccount].length > 1) {
            acctDiv.appendChild(document.createTextNode('买入账户 '));
            this.accountSelector = document.createElement('select');
            emjyManager.accountsMap[this.ownerAccount].forEach(acc => {
                var opt = document.createElement('option');
                opt.value = acc;
                opt.textContent = emjyManager.accountNames[acc];
                this.accountSelector.appendChild(opt);
            });
            acctDiv.appendChild(this.accountSelector);
            this.accountSelector.value = this.strategy.account === undefined ? this.ownerAccount : this.strategy.account;
        };
        return acctDiv;
    }

    createKlineTypeSelector(text = 'K线类型 ') {
        var kltDiv = document.createElement('div');
        kltDiv.appendChild(document.createTextNode(text));
        this.klineSelector = document.createElement('select');
        var kltypes = [{klt:'4', text:'4分钟'}, {klt:'8', text:'8分钟'}, {klt:'15', text:'15分钟'}, {klt:'30', text:'30分钟'}, {klt:'60', text:'1小时'}, {klt:'120', text:'2小时'}, {klt:'101', text:'1日'}, {klt:'202', text:'2日'}];
        //{klt:'1', text:'1分钟'}, {klt:'2', text:'2分钟'}, , {klt:'404', text:'4日'}, {klt:'808', text:'8日'}, {klt:'102', text:'1周'}, {klt:'103', text:'1月'}, {klt:'104', text:'1季度'}, {klt:'105', text:'半年'}, {klt:'106', text:'年'}

        for (var i = 0; i < kltypes.length; i++) {
            var opt = document.createElement('option');
            opt.value = kltypes[i].klt;
            opt.textContent = kltypes[i].text;
            this.klineSelector.appendChild(opt);
        };
        kltDiv.appendChild(this.klineSelector);
        return kltDiv;
    }
}

class StrategyBuyView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('直接买入'));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategyBuyPopupView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 <= '));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createGuardInput('监控价格 >= '));
        view.appendChild(this.createPopbackInput('回撤幅度 '));
        view.appendChild(this.createCountDiv());
        return view;
    }
}

class StrategyBuyRepeatView extends StrategyBaseView {
    isChanged() {
        var changed = super.isChanged();
        if (this.inputRefer && this.inputRefer.value && this.inputStep) {
            var guard = this.inputRefer.value * (100 - this.inputStep.value) / 100;
            if (this.strategy.guardPrice != guard) {
                this.strategy.guardPrice = guard;
                changed = true;
            };
        };
        return changed;
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createReferedInput('参考价(前高) '));
        view.appendChild(this.createStepsInput('波段振幅 '));
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellRepeatView extends StrategyBaseView {
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
            if (this.strategy.guardPrice != guard) {
                this.strategy.guardPrice = guard;
                changed = true;
            };
        };
        return changed;
    }
}

class StrategyBuyIPOView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(this.createPopbackInput('反弹幅度 '));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellIPOView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('涨停板打开直接卖出,开盘不涨停则从高点反弹1%时卖出,跌停开盘直接卖出'));
        view.appendChild(this.createCountDiv());
        return view;
    }
}

class StrategyBuyZTBoardView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('打板买入'));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategySellELView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('止损止盈,满足条件时全部卖出'));
        view.appendChild(document.createElement('br'));
        view.appendChild(document.createTextNode('收益 < 7%, 止损点止损'));
        view.appendChild(document.createElement('br'));
        view.appendChild(document.createTextNode('收益 < 9%, 买入价+1%止损'));
        view.appendChild(document.createElement('br'));
        view.appendChild(document.createTextNode('收益 < 18%, 回撤8%止盈'));
        view.appendChild(document.createElement('br'));
        view.appendChild(document.createTextNode('收益 > 18%, 回撤10%止盈'));
        view.appendChild(this.createGuardInput('止损点 '));
        view.appendChild(document.createTextNode('遇大阳线(>6.5%)动态调整止损点为大阳线最低点'));
        return view;
    }
}

class StrategySellELSView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('低点抬高法, 1分钟，短线收益不错时设置该策略'));
        view.appendChild(this.createGuardInput('止损点 '));
        return view;
    }
}

class StrategyBuyMAView extends StrategyBaseView {
    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '60';
        };
    }

    maDescription() {
        return '连续2根K线>18周期均线, 以第3根K线开盘时买入';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createKlineTypeSelector());
        this.setDefaultKltype();
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategyBuyStopDecView extends StrategyBuyMAView {
    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '15';
        };
    }

    maDescription() {
        return '止跌买入，下跌趋势中设置。直接买入的优化。';
    }
}

class StrategySellMAView extends StrategyBaseView {
    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '60';
        };
    }

    maDescription() {
        return '连续2根K线<18周期均线,以第3根K线开盘时(全部)卖出';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createKlineTypeSelector());
        this.setDefaultKltype();
        return view;
    }
}

class StrategyBuyBeforEndView extends StrategyBuyMAView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('陆地朝阳(阴后阳缩量, 尾盘买入)'));
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategyBuyMABeforeEndView extends StrategyBuyMAView {
    maDescription() {
        return '尾盘突破18周期均线，或最高价回撤幅度<1/3时尾盘买入';
    }

    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '60';
        };
    }
}

class StrategyBuyMADynamicView extends StrategyBuyMAView {
    maDescription() {
        return '连续2根K线>18周期均线, 以第3根K线开盘时买入, 动态调整K线类型';
    }

    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '30';
        };
    }
}

class StrategySellMADynamicView extends StrategySellMAView {
    maDescription() {
        return '连续2根K线<18周期均线,以第3根K线开盘时(全部)卖出, 累计收益>20%或单日涨幅>8.5% 调整K线类型为4分钟';
    }

    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '30';
        };
    }

    createView() {
        var view = super.createView();
        var inputGuard = this.createGuardInput('安全线');
        inputGuard.appendChild(document.createTextNode('安全线以上盈利>5%且满足卖出条件才卖出，避免横盘震荡中反复割肉。'));
        view.appendChild(inputGuard);
        return view;
    }
}

class StrategyMAView extends StrategyBuyMAView {
    maDescription() {
        return '18周期MA均线买卖组合策略(长期)';
    }

    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '30';
        };
    }

    createView() {
        var view = super.createView();
        var inputGuard = this.createGuardInput('安全线');
        inputGuard.appendChild(document.createTextNode('安全线以上盈利>5%且满足卖出条件才卖出，避免横盘震荡中反复割肉。'));
        view.appendChild(inputGuard);
        return view;
    }
}

class StrategyGridEarningView extends StrategyBaseView {
    setDefaultKltype() {
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : '30';
        };
    }

    maDescription() {
        return '买入条件:网格法逢低止跌买入. 卖出条件:18周期均线跌破卖出盈利部分';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createStepsInput('网格波幅 '));
        view.appendChild(this.createBuyAccountSelector());

        view.appendChild(this.createKlineTypeSelector('卖出K线类型'));
        this.setDefaultKltype();
        return view;
    }

    isChanged() {
        var changed = super.isChanged();
        if (this.strategy.period === undefined) {
            this.strategy.period = 'l';
            changed = true;
        }
        return changed;
    }
}

let strategyViewManager = new StrategyViewManager();
