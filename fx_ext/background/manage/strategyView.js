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
        if (strategy.key == 'StrategySellELTop') {
            return new StrategySellElTopView(strategy);
        }
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
        if (strategy.key == 'StrategyBuySupport') {
            return new StrategyBuySupportView(strategy);
        }
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
        if (strategy.key == 'StrategyGEMid') {
            return new StrategyGridEarningMidView(strategy);
        }
        if (strategy.key == 'StrategyTD') {
            return new StrategyTDView(strategy);
        }
        if (strategy.key == 'StrategyBH') {
            return new StrategyBarginHuntingView(strategy);
        }
        if (strategy.key == 'StrategySD') {
            return new StrategyStopDecView(strategy);
        }
        if (strategy.key == 'StrategyIncDec') {
            return new StrategyIncDecView(strategy);
        }
        if (strategy.key == 'StrategyZt0') {
            return new StrategyZt0View(strategy);
        }
        if (strategy.key == 'StrategyZt1') {
            return new StrategyZt1View(strategy);
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
            }
        }

        if (this.inputUpEarn) {
            var upRate = parseFloat(this.inputUpEarn.value) / 100;
            if (!this.isEqualNum(this.strategy.upRate, upRate)) {
                changed = true;
                this.strategy.upRate = upRate;
            }
        }

        if (this.inputStep) {
            var stepRate = parseFloat(this.inputStep.value) / 100;
            if (!this.isEqualNum(this.strategy.stepRate, stepRate)) {
                this.strategy.stepRate = stepRate;
                changed = true;
            };
        };

        if (this.inputVolGuard) {
            var guardVol = parseInt(this.inputVolGuard.value);
            if (!this.isEqualNum(this.strategy.guardVol, guardVol)) {
                this.strategy.guardVol = guardVol;
                changed = true;
            }
        }

        if (this.inputZt0Date) {
            var date = this.inputZt0Date.value;
            if (date.length == 8) {
                date = date.substring(0,4) + '-' + date.substring(4, 6) + '-' + date.substring(6);
            }
            if (this.strategy.zt0date != date) {
                changed = true;
                this.strategy.zt0date = date;
            }
        }

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

        if (this.sellCntSelector) {
            var selltype = this.sellCntSelector.value;
            if (selltype != this.strategy.selltype) {
                changed = true;
                this.strategy.selltype = selltype;
            }
        }

        if (this.inputData) {
            var dtext = this.inputData.value;
            if (dtext.length > 0) {
                if (!dtext.startsWith('{')) {
                    dtext = '{' + dtext;
                }
                if (!dtext.endsWith('}')) {
                    dtext += '}';
                }

                var data = JSON.parse(dtext);
                var changes = 0;
                for (var k in data) {
                    if (this.strategy[k] != data[k]) {
                        this.strategy[k] = data[k];
                        changes++;
                    }
                }
                if (changes > 0) {
                    changed = true;
                }
            }
        }
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

    createSellCountTypeSelector() {
        var sellCntDiv = document.createElement('div');
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '卖出量'
        this.sellCntSelector = document.createElement('select');
        this.sellCntSelector.options.add(new Option('全部卖出', 'all'));
        this.sellCntSelector.options.add(new Option('盈利部分卖出', 'earned'));
        this.sellCntSelector.options.add(new Option('卖出半仓', 'half_all'));
        this.sellCntSelector.options.add(new Option('卖出单次', 'single'));
        this.sellCntSelector.options.add(new Option('卖出半次', 'half'));
        if (this.strategy.selltype === undefined) {
            this.sellCntSelector.value = 'single';
        } else {
            this.sellCntSelector.value = this.strategy.selltype;
        }
        checkLbl.appendChild(this.sellCntSelector);
        sellCntDiv.appendChild(checkLbl);
        return sellCntDiv;
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
        if (this.strategy.backRate) {
            this.inputPop.value = 100 * this.strategy.backRate;
        } else {
            this.inputPop.value = rate;
        }
        popDiv.appendChild(this.inputPop);
        popDiv.appendChild(document.createTextNode('%'));
        return popDiv;
    }

    createUpEarnedInput(text, rate = 25) {
        var upDiv = document.createElement('div');
        upDiv.appendChild(document.createTextNode(text));
        this.inputUpEarn = document.createElement('input');
        if (this.strategy.upRate) {
            this.inputUpEarn.value = 100 * this.strategy.upRate;
        } else {
            this.inputUpEarn.value = rate;
        }
        upDiv.appendChild(this.inputUpEarn);
        upDiv.appendChild(document.createTextNode('%'));
        return upDiv;
    }

    createVolGuardInput(text) {
        var vDiv = document.createElement('div');
        vDiv.appendChild(document.createTextNode(text));
        this.inputVolGuard = document.createElement('input');
        if (this.strategy.guardVol) {
            this.inputVolGuard.value = this.strategy.guardVol;
        }
        vDiv.appendChild(this.inputVolGuard);
        return vDiv;
    }

    createZt0DateInput(text) {
        var dDiv = document.createElement('div');
        dDiv.appendChild(document.createTextNode(text));
        this.inputZt0Date = document.createElement('input');
        if (this.strategy.zt0date) {
            this.inputZt0Date.value = this.strategy.zt0date;
        }
        dDiv.appendChild(this.inputZt0Date);
        return dDiv;
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

    createAmountDiv(text = '买入金额 ', amt = 10000) {
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
                var opt = new Option(emjyManager.accountNames[acc], acc);
                this.accountSelector.options.add(opt);
            });
            acctDiv.appendChild(this.accountSelector);
            if (this.strategy.account !== undefined) {
                this.accountSelector.value = this.strategy.account;
            } else if (emjyManager.accountsMap[this.ownerAccount].includes('credit')) {
                this.accountSelector.value = 'credit';
            } else {
                this.accountSelector.value = this.ownerAccount;
            }
        };
        return acctDiv;
    }

    getDefaultKltype() {
        return '101';
    }

    createKlineTypeSelector(text = 'K线类型 ') {
        var kltDiv = document.createElement('div');
        kltDiv.appendChild(document.createTextNode(text));
        this.klineSelector = document.createElement('select');
        var kltypes = [{klt:'4', text:'4分钟'}, {klt:'8', text:'8分钟'}, {klt:'15', text:'15分钟'}, {klt:'30', text:'30分钟'}, {klt:'60', text:'1小时'}, {klt:'120', text:'2小时'}, {klt:'101', text:'1日'}, {klt:'202', text:'2日'}];
        //{klt:'1', text:'1分钟'}, {klt:'2', text:'2分钟'}, , {klt:'404', text:'4日'}, {klt:'808', text:'8日'}, {klt:'102', text:'1周'}, {klt:'103', text:'1月'}, {klt:'104', text:'1季度'}, {klt:'105', text:'半年'}, {klt:'106', text:'年'}

        kltypes.forEach(klt => {
            this.klineSelector.options.add(new Option(klt.text, klt.klt));
        });
        if (this.klineSelector) {
            this.klineSelector.value = this.strategy.kltype ? this.strategy.kltype : this.getDefaultKltype();
        }

        kltDiv.appendChild(this.klineSelector);
        return kltDiv;
    }

    skippedDataInput() {
        return ['enabled', 'account', 'kltype', 'key', 'meta'];
    }

    createDataInput(text) {
        var dataDiv = document.createElement('div');
        this.inputData = document.createElement('input');
        if (text) {
            this.inputData.placeholder = text;
        }
        this.inputData.style.width = 600;
        dataDiv.appendChild(document.createTextNode('data:'));
        dataDiv.appendChild(this.inputData);
        var skipped = this.skippedDataInput();
        var kv = [];
        for (var k in this.strategy) {
            if (skipped.includes(k)) {
                continue;
            }
            kv.push('"' + k + '": "' + this.strategy[k] + '"');
        }
        this.inputData.value = '{' + kv.join(',') + '}';
        return dataDiv;
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
        view.appendChild(document.createElement('br'));
        view.appendChild(this.createSellCountTypeSelector());
        view.appendChild(this.createGuardInput('止损点 '));
        return view;
    }
}

class StrategySellElTopView extends StrategyBaseView {
    getDefaultKltype() {
        return '4';
    }

    skippedDataInput() {
        return ['enabled', 'account', 'kltype', 'key', 'guardPrice', 'topprice', 'selltype', 'meta'];
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('短K达到目标价之后以低点抬高法(或日K最高价距离目标价百分比upRate)卖出，设置止损价格则在短K收盘价低于止损价时卖出(不设置则不止损)。'));
        view.appendChild(this.createSellCountTypeSelector());
        view.appendChild(this.createKlineTypeSelector('短K类型'));
        view.appendChild(this.createReferedInput('目标价 '))
        if (this.strategy.topprice) {
            this.inputRefer.value = this.strategy.topprice;
        }
        view.appendChild(this.createGuardInput('止损点 '));
        view.appendChild(this.createDataInput());
        return view;
    }

    isChanged() {
        var changed = super.isChanged();
        if (this.inputRefer && this.inputRefer.value) {
            var topprice = this.inputRefer.value;
            if (this.strategy.topprice != topprice) {
                this.strategy.topprice = topprice;
                changed = true;
            };
        };
        return changed;
    }
}

class StrategyBuyMAView extends StrategyBaseView {
    getDefaultKltype() {
        return '60';
    }

    maDescription() {
        return '连续2根K线>18周期均线, 以第3根K线开盘时买入';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createKlineTypeSelector());
        view.appendChild(this.createBuyAccountSelector());
        return view;
    }
}

class StrategyBuyStopDecView extends StrategyBuyMAView {
    getDefaultKltype() {
        return '15';
    }

    maDescription() {
        return '止跌买入，下跌趋势中设置。直接买入的优化。';
    }
}

class StrategySellMAView extends StrategyBaseView {
    getDefaultKltype() {
        return '60';
    }

    maDescription() {
        return '连续2根K线<18周期均线,以第3根K线开盘时(全部)卖出';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createKlineTypeSelector());
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

    getDefaultKltype() {
        return '60';
    }
}

class StrategyBuySupportView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('支撑位之上,接近支撑位买入'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createKlineTypeSelector());
        view.appendChild(this.createGuardInput('支撑位'));
        view.appendChild(this.createPopbackInput('接近程度', 2));
        return view;
    }
}

class StrategyBuyMADynamicView extends StrategyBuyMAView {
    maDescription() {
        return '连续2根K线>18周期均线, 以第3根K线开盘时买入, 动态调整K线类型';
    }

    getDefaultKltype() {
        return '30';
    }
}

class StrategySellMADynamicView extends StrategySellMAView {
    maDescription() {
        return '连续2根K线<18周期均线,以第3根K线开盘时(全部)卖出, 累计收益>20%或单日涨幅>8.5% 调整K线类型为4分钟';
    }

    getDefaultKltype() {
        return '30';
    }

    createView() {
        var view = super.createView();
        var inputGuard = this.createGuardInput('安全线');
        inputGuard.appendChild(document.createTextNode('安全线以上盈利>5%且满足卖出条件才卖出，避免横盘震荡中反复割肉。'));
        view.appendChild(inputGuard);
        return view;
    }
}

class StrategyMAView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('MA建仓清仓, TD点波段买卖组合策略(长期)'));
        view.appendChild(this.createBuyAccountSelector());
        var inputGuard = this.createGuardInput('安全线');
        inputGuard.appendChild(document.createTextNode('安全线以上盈利>5%且满足卖出条件才卖出，避免横盘震荡中反复割肉。'));
        view.appendChild(inputGuard);
        view.appendChild(this.createStepsInput('波段盈亏比例', 8));
        view.appendChild(this.createPopbackInput('加仓亏损比例', 15));
        view.appendChild(this.createUpEarnedInput('最低止盈比例', 25));
        return view;
    }
}

class StrategyGridEarningView extends StrategyBaseView {
    getDefaultKltype() {
        return '30';
    }

    defaultStepRate() {
        return '10';
    }

    maDescription() {
        return '买入条件:网格法逢低止跌买入. 卖出条件:18周期均线跌破卖出盈利部分';
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode(this.maDescription()));
        view.appendChild(this.createStepsInput('网格波幅 ', this.defaultStepRate()));
        view.appendChild(this.createBuyAccountSelector());

        view.appendChild(this.createKlineTypeSelector('卖出K线类型'));
        return view;
    }
}

class StrategyGridEarningMidView extends StrategyGridEarningView {
    defaultStepRate() {
        return '15';
    }

    maDescription() {
        return '网格买入,盈利卖出, 波段策略,不建仓不清仓';
    }
}

class StrategyTDView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('TD点买卖组合策略, 无止损'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createStepsInput('波段盈亏比例', 8));
        view.appendChild(this.createPopbackInput('加仓亏损比例', 15));
        view.appendChild(this.createUpEarnedInput('最低止盈比例', 25));
        return view;
    }
}

class StrategyBarginHuntingView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('中长阴线之后止跌买入，并在反弹时卖出。止损点为中长阴线之后的最低点。'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createKlineTypeSelector());
        view.appendChild(this.createDataInput());
        return view;
    }
}

class StrategyStopDecView extends StrategyBaseView {
    skippedDataInput() {
        return ['enabled', 'account', 'kltype', 'key', 'meta', 'guardPrice', 'topprice', 'selltype'];
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('设置止损价和目标止盈价, 在止损价附近买入, 止盈价附近卖出。'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createKlineTypeSelector());
        view.appendChild(this.createReferedInput('目标点'));
        if (this.strategy.topprice) {
            this.inputRefer.value = this.strategy.topprice;
        }
        view.appendChild(this.createGuardInput('止损点'));
        view.appendChild(this.createDataInput());
        return view;
    }

    isChanged() {
        var changed = super.isChanged();
        if (this.inputRefer && this.inputRefer.value) {
            var topprice = this.inputRefer.value;
            if (this.strategy.topprice != topprice) {
                this.strategy.topprice = topprice;
                changed = true;
            };
        };
        return changed;
    }
}

class StrategyIncDecView extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('大跌买入, 大涨卖出, 累计跌幅大于1.5倍stepRate时买入'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createKlineTypeSelector());
        view.appendChild(this.createUpEarnedInput('涨幅'));
        view.appendChild(this.createPopbackInput('跌幅'));
        view.appendChild(this.createStepsInput('区间涨跌幅'));
        view.appendChild(this.createDataInput());
        return view;
    }
}

class StrategyZt0View extends StrategyBaseView {
    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('首板战法'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createZt0DateInput('首板日期'));
        return view;
    }
}

class StrategyZt1View extends StrategyBaseView {
    skippedDataInput() {
        return ['enabled', 'account', 'kltype', 'key', 'meta', 'guardVol', 'zt0date'];
    }

    createView() {
        var view = document.createElement('div');
        view.appendChild(this.createEnabledCheckbox());
        view.appendChild(document.createTextNode('首板一字涨停, 次日巨量阴线, 缩量止跌买入, 股价回升超过涨停之后的最高价之后不再关注。'));
        view.appendChild(this.createBuyAccountSelector());
        view.appendChild(this.createZt0DateInput('一字涨停日'));
        view.appendChild(this.createVolGuardInput('成交量前低'));
        view.appendChild(this.createDataInput());
        return view;
    }
}

let strategyViewManager = new StrategyViewManager();
