'use strict';

class StrategyIntradingView {
    constructor(istr) {
        this.amount = 0;
        this.account = '';
        this.data = {key: istr.key};
        this.container = document.createElement('div');
        var strTitle = document.createTextNode(istr.name);
        this.container.appendChild(strTitle);
        this.container.appendChild(document.createElement('br'));
        var descLbl = document.createTextNode(istr.desc);
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
        this.accSelector = document.createElement('select');
        var accountNames = [['normal', '普通账户'], ['','自动分配'], ['track', '模拟账户']];
        for (var i = 0; i < accountNames.length; i++) {
            this.accSelector.options.add(new Option(accountNames[i][1], accountNames[i][0]));
        }
        addInput(this.container, this.accSelector, '买入账户');
        emjyBack.getFromLocal('itstrategy_' + this.data.key, svstr => {
            if (!svstr) {
                return;
            }
            for (const key in svstr) {
                this.data[key] = svstr[key];
            }
            this.chkEnable.checked = svstr.enabled;
            this.accSelector.value = svstr.account;
            this.amtIpt.value = svstr.amount;
        });
    }

    isChanged() {
        var changed = false;
        if (this.chkEnable.checked != this.data.enabled) {
            changed = true;
            this.data.enabled = this.chkEnable.checked;
        }
        if (this.amtIpt.value - this.amount != 0) {
            changed = true;
            this.data.amount = this.amtIpt.value;
        }
        if (this.accSelector.value != this.account) {
            changed = true;
            this.data.account = this.accSelector.value;
        }
        return changed;
    }
}

class StrategyIntradingPanelPage extends RadioAnchorPage {
    constructor(text) {
        super(text);
        this.intradingStrategies = [];
    }

    show() {
        super.show();
        if (!this.initialized) {
            emjyBack.getFromLocal('all_available_istr', all_str => {
                this.init(all_str);
            });
        }
    }

    init(str_available) {
        this.initialized = true;
        for (const istr of str_available) {
            var item = new StrategyIntradingView(istr);
            this.intradingStrategies.push(item);
            this.container.appendChild(item.container);
        }

        var saveBtn = document.createElement('button')
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
    }

    saveStrategy(item) {
        var data = {};
        data['itstrategy_' + item.key] = item;
        emjyBack.saveToLocal(data);
    }
}
