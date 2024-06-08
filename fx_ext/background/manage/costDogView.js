'use strict';


class CostItemView {
    constructor(citem) {
        this.costitem = citem;

        this.rootview = document.createElement('div');
        this.rootview.appendChild(document.createElement('hr'));

        this.ciKey = document.createElement('input');
        this.ciKey.value = citem.key;
        this.ciKey.disabled = citem.key !== '';
        this.ciKey.style.maxWidth = 80;
        this.addInput(this.rootview, this.ciKey, '关键词');
        if (citem.key !== '') {
            var delBtn = document.createElement('button');
            delBtn.textContent = 'X';
            this.ciKey.parentElement.appendChild(delBtn);
            delBtn.onclick = e => {
                this.rootview.style.display = 'none';
                emjyBack.sendExtensionMessage({command: 'mngr.costdog.delete', cikey: this.costitem.key});
            }
        }
        this.ciAmt = document.createElement('input');
        this.ciAmt.value = citem.amount;
        this.ciAmt.style.maxWidth = 60;
        this.addInput(this.rootview, this.ciAmt, '基础仓位');
        this.ciMxAmt = document.createElement('input');
        this.ciMxAmt.value = citem.max_amount;
        this.ciMxAmt.style.maxWidth = 60;
        this.addInput(this.rootview, this.ciMxAmt, '最大仓位');
        this.ciEer = document.createElement('input');
        this.ciEer.value = 100 * citem.expect_earn_rate;
        this.ciEer.style.maxWidth = 50;
        var eerdiv = document.createElement('div');
        eerdiv.appendChild(document.createTextNode('期望收益率'));
        eerdiv.appendChild(this.ciEer);
        eerdiv.appendChild(document.createTextNode('%'));
        this.rootview.appendChild(eerdiv);

        if (citem.urque) {
            var upur = citem.urque.filter(x => !x.paired);
            if (upur.length > 0) {
                var updiv = document.createElement('div');
                updiv.appendChild(document.createTextNode('未分配亏损: '));
                updiv.appendChild(document.createTextNode(upur.map(x => x.lost).join(', ')));
                this.rootview.appendChild(updiv);
            }
            var pur = citem.urque.filter(x => x.paired);
            if (pur.length > 0) {
                var pdiv = document.createElement('div');
                pdiv.appendChild(document.createTextNode('已分配亏损: '));
                pdiv.appendChild(document.createTextNode(pur.map(x => x.lost).join(', ')));
                this.rootview.appendChild(pdiv);
            }
        }
    }

    addInput(fath, ele, text) {
        var eleout = document.createElement('div');
        eleout.appendChild(document.createTextNode(text));
        eleout.appendChild(ele);
        fath.appendChild(eleout);
    }

    reset(citem) {
        this.ciKey.value = citem.key;
        this.ciAmt.value = citem.amount;
        this.ciMxAmt.value = citem.max_amount;
        this.ciEer.value = 100 * citem.expect_earn_rate;
    }

    isChanged() {
        if (this.rootview.style.display == 'none') {
            return false;
        }
        var changed = false;
        if (this.ciAmt.value - this.costitem.amount != 0) {
            changed = true;
            this.costitem.amount = parseInt(this.ciAmt.value);
        }
        if (this.ciMxAmt.value - this.costitem.max_amount != 0) {
            changed = true;
            this.costitem.max_amount = parseInt(this.ciMxAmt.value);
        }
        if (this.ciEer.value - 100 * this.costitem.expect_earn_rate != 0) {
            this.costitem.expect_earn_rate = parseFloat(this.ciEer.value) / 100;
        }
        this.changed = changed;
        return this.changed;
    }

    submitChanges() {
        if (this.changed) {
            emjyBack.sendExtensionMessage({command: 'mngr.costdog.changed', cdo: this.costitem});
            this.changed = false;
        }
    }
}

class CostDogPanelPage extends RadioAnchorPage {
    constructor() {
        super('成本管理');
        this.cikeys = new Set();
        this.cidogs = null;
        this.citemsList = [];
    }

    show() {
        super.show();
        if (!this.initialized) {
            this.initialized = true;
            this.init(this.cidogs);
        }
    }

    hide() {
        super.hide();
        for (const civ of this.citemsList) {
            if (civ.isChanged()) {
                civ.submitChanges();
            }
        }
    }

    init(cdogs) {
        if (!this.initialized) {
            this.cidogs = cdogs;
            for (const c of cdogs) {
                this.cikeys.add(c.key);
            }
            return;
        }
        this.citemsView = document.createElement('div');
        this.container.appendChild(this.citemsView);
        for (const c of cdogs) {
            var civ = new CostItemView(c);
            this.citemsView.appendChild(civ.rootview);
            this.citemsList.push(civ);
        }

        this.addNewCostView();
    }

    addNewCostView() {
        this.container.appendChild(document.createElement('hr'));
        var ncvDiv = document.createElement('div');
        this.container.appendChild(ncvDiv);
        ncvDiv.appendChild(document.createTextNode('新增成本管理方案:'));

        var ncv = new CostItemView({key: '', amount: 5000, max_amount: 80000, expect_earn_rate: 0.05});
        ncvDiv.appendChild(ncv.rootview);

        var addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.onclick = _ => {
            var key = ncv.ciKey.value;
            if (!key) {
                alert('请设置关键词');
                ncv.ciKey.focus();
                return;
            }
            if (this.cikeys.has(key)) {
                alert('关键词重复');
                ncv.ciKey.focus();
                return;
            }
            var amount = parseInt(ncv.ciAmt.value);
            var max_amount = parseInt(ncv.ciMxAmt.value);
            var expect_earn_rate = parseFloat(ncv.ciEer.value)/100;
            var cdo = {key, amount, max_amount, expect_earn_rate, urque: []};
            var civ = new CostItemView(cdo);
            this.citemsView.appendChild(civ.rootview);
            this.citemsList.push(civ);
            this.cikeys.add(key);
            emjyBack.sendExtensionMessage({command: 'mngr.costdog.add', cdo});
            ncv.reset({key: '', amount: 5000, max_amount: 80000, expect_earn_rate: 0.05});
        }
        ncvDiv.appendChild(addBtn);
    }
}
