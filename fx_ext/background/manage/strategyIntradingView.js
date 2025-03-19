'use strict';
try {
    const ses = require('../strategies.json');
    const emjyBack = require('../back/emjybackend.js');
} catch (err) {

}

class StrategyIntradingView {
    constructor(iskey, isext=false) {
        this.data = {key: iskey};
        this.container = document.createElement('div');
        var strTitle = document.createTextNode(ses.ExtIstrStrategies[iskey].name);
        this.container.appendChild(strTitle);
        this.container.appendChild(document.createElement('br'));
        var descLbl = document.createTextNode(ses.ExtIstrStrategies[iskey].desc);
        this.chkEnable = document.createElement('input');
        this.chkEnable.type = 'checkbox';
        var checkLbl = document.createElement('label');
        checkLbl.textContent = '订阅';
        checkLbl.appendChild(this.chkEnable);

        this.container.appendChild(checkLbl);
        this.container.appendChild(descLbl);

        var addInput = function(fath, ele, text) {
            var eleout = document.createElement('div');
            eleout.appendChild(document.createTextNode(text));
            eleout.appendChild(ele);
            fath.appendChild(eleout);
        }

        this.amtIpt = document.createElement('input');
        addInput(this.container, this.amtIpt, '买入金额');
        this.costSelector = document.createElement('select');
        this.costSelector.options.add(new Option('无成本方案', ''));
        for (const ikey of emjyBack.costDogView.cikeys) {
            this.costSelector.options.add(new Option('方案: ' + ikey, ikey));
        }
        addInput(this.container, this.costSelector, '仓位管理');
        this.accSelector = document.createElement('select');
        var accountNames = {'normal':'普通账户','':'自动分配'};
        for (var acc in accountNames) {
            this.accSelector.options.add(new Option(accountNames[acc], acc));
        }
        for (var acc in emjyBack.trackAccountNames) {
            this.accSelector.options.add(new Option(emjyBack.trackAccountNames[acc], acc));
        }
        addInput(this.container, this.accSelector, '买入账户');
        emjyBack.getFromLocal((isext ? 'exstrategy_' : 'itstrategy_') + this.data.key).then(svstr => {
            if (!svstr) {
                return;
            }
            for (const key in svstr) {
                this.data[key] = svstr[key];
            }
            this.chkEnable.checked = svstr.enabled;
            this.accSelector.value = svstr.account;
            this.costSelector.value = svstr.amtkey ? svstr.amtkey : '';
            this.amtIpt.value = svstr.amount;
        });
    }

    isChanged() {
        var changed = false;
        if (this.chkEnable.checked != this.data.enabled) {
            changed = true;
            this.data.enabled = this.chkEnable.checked;
        }
        if (this.amtIpt.value - this.data.amount != 0) {
            changed = true;
            this.data.amount = this.amtIpt.value;
        }
        if (this.accSelector.value != this.data.account) {
            changed = true;
            this.data.account = this.accSelector.value;
        }
        var cval = this.costSelector.value;
        if (cval == '') {
            cval = undefined;
        }
        if (cval != this.data.amtkey) {
            changed = true;
            this.data.amtkey = cval;
        }
        return changed;
    }
}

class StrategyIntradingPanelPage extends RadioAnchorPage {
    constructor() {
        super('盘中策略');
        this.intradingStrategies = [];
        this.exStrsStrategies = [];
    }

    show() {
        super.show();
        if (!this.initialized) {
            emjyBack.getFromLocal('all_available_istr').then(all_str => {
                this.init(all_str);
                for (const estr of ses.ExtIstrStrategies) {
                    var item = new StrategyIntradingView(estr, true);
                    this.exStrsStrategies.push(item);
                    this.exStrsContainer.appendChild(item.container);
                    this.exStrsContainer.appendChild(document.createElement('hr'));
                }
            });
        }
    }

    init(str_available) {
        this.initialized = true;
        for (const istr of str_available) {
            var item = new StrategyIntradingView(istr);
            this.intradingStrategies.push(item);
            this.container.appendChild(item.container);
            this.container.appendChild(document.createElement('hr'));
        }

        var hext = document.createElement('h3');
        hext.textContent = '盘中策略(ext)';
        this.container.appendChild(hext);
        this.exStrsContainer = document.createElement('div');
        this.container.appendChild(this.exStrsContainer);

        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = _ => {
            this.save()
        }

        this.container.appendChild(saveBtn);
    }

    save() {
        for (var i = 0; i < this.intradingStrategies.length; i++) {
            var item = this.intradingStrategies[i];
            if (item.isChanged()) {
                this.saveStrategy(item.data);
            }
        }
        for (var i = 0; i < this.exStrsStrategies.length; i++) {
            var item = this.exStrsStrategies[i];
            if (item.isChanged()) {
                this.saveStrategy(item.data, true);
            }
        }
    }

    saveStrategy(item, isext=false) {
        var data = {};
        data[(isext ? 'exstrategy_' : 'itstrategy_') + item.key] = item;
        emjyBack.saveToLocal(data);
    }
}
