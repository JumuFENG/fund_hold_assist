function addInput(fath, ele, text) {
    var eleout = document.createElement('div');
    eleout.appendChild(document.createTextNode(text));
    eleout.appendChild(ele);
    fath.appendChild(eleout);
}

class SettingsView extends RadioAnchorPage {
    constructor(accs) {
        super('设置');
        this.accounts = accs;
        this.citemsList = [];
    }

    show() {
        super.show();
        if (!this.settingPanel) {
            this.settingPanel = document.createElement('div');
            this.container.appendChild(this.settingPanel);
            this.iptHost = document.createElement('input');
            this.iptHost.placeholder = 'server';
            this.iptUser = document.createElement('input');
            this.iptUser.placeholder = '账户/邮箱';
            this.iptPwd = document.createElement('input');
            this.iptPwd.placeholder = '密码';
            this.iptPwd.type = 'password';
            this.settingPanel.appendChild(this.iptHost);
            this.settingPanel.appendChild(this.iptUser);
            this.settingPanel.appendChild(this.iptPwd);
            if (emjyBack.fha.uemail && emjyBack.fha.pwd && emjyBack.fha.server) {
                this.iptHost.value = emjyBack.fha.server;
                this.iptUser.value = emjyBack.fha.uemail;
                this.iptPwd.value = emjyBack.fha.pwd;
            }

            var topsubmit = document.createElement('button');
            topsubmit.textContent = '保存';
            this.settingPanel.appendChild(topsubmit);
            topsubmit.onclick = e => {
                emjyBack.fha = {'server': this.iptHost.value, 'uemail': this.iptUser.value, 'pwd': this.iptPwd.value};
                emjyBack.saveToLocal({'fha_server': emjyBack.fha});
            }

            this.addSubAccountsView();
            this.addCostDogView();
        }
    }

    hide() {
        super.hide();
        if (this.citemsList.filter(il => il.isChanged()).length > 0) {
            const durl = emjyBack.fha.server + 'stock';
            var fd = new FormData();
            fd.append('act', 'costdog');
            fd.append('cdata', JSON.stringify(emjyBack.costDog));
            const headers = emjyBack.headers.headers;
            fetch(durl, {method: 'POST', headers, body:fd});
        }
    }

    addCostDogView() {
        this.citemsView = document.createElement('div');
        this.citemsView.appendChild(document.createTextNode('成本方案管理'));
        this.container.appendChild(this.citemsView);
        for (const c of Object.values(emjyBack.costDog)) {
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
            if (Object.keys(emjyBack.costDog).includes(key)) {
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
            emjyBack.costDog[key] = cdo;
            ncv.reset({key: '', amount: 5000, max_amount: 80000, expect_earn_rate: 0.05});
        }
        ncvDiv.appendChild(addBtn);
    }

    addSubAccountsView() {
        if (this.taPanel) {
            utils.removeAllChild(this.taPanel);
        } else {
            this.taPanel = document.createElement('div');
            this.container.appendChild(this.taPanel);
        }
        this.taPanel.appendChild(document.createTextNode('模拟账户:'));
        for (const acc of this.accounts) {
            if (acc.realcash) {
                continue;
            }
            var traccDiv = document.createElement('div');
            this.taPanel.appendChild(traccDiv);
            traccDiv.appendChild(document.createTextNode(acc.name));
            var btnDel = document.createElement('button');
            btnDel.textContent = 'X';
            btnDel.accid = acc.id;
            btnDel.acc = acc.name;
            btnDel.onclick = e => {
                const url = emjyBack.fha.server + '/user/edit';
                const headers = emjyBack.headers.headers;
                const fd = new FormData();
                fd.append('act', 'rmvsub');
                fd.append('acc', e.target.acc);
                fd.append('accid', e.target.accid);
                fetch(url, {method: 'POST', headers}).then(t => {
                    if (t == 'OK') {
                        delete(this.accounts.find(a => a.id == e.target.accid))
                        this.addSubAccountsView();
                    }
                });
            }
            traccDiv.appendChild(btnDel);
        }
        this.taPanel.appendChild(document.createTextNode('添加模拟账户'));
        this.newTrackKey = document.createElement('input');
        addInput(this.taPanel, this.newTrackKey, '关键词/账户名');
        var accSave = document.createElement('button');
        accSave.textContent = '新增';
        this.taPanel.appendChild(accSave);
        accSave.onclick = e => {
            var acc = this.newTrackKey.value;
            if (!acc || this.accounts.find(a => a.name == acc)) {
                alert('key invalid or already exists:', acc);
                return;
            }
            const url = emjyBack.fha.server + '/user/edit';
            const headers = emjyBack.headers.headers;
            const fd = new FormData();
            fd.append('act', 'addsub');
            fd.append('acc', acc);
            fetch(url, {method: 'POST', headers, body:fd}).then(nacc => {
                if (nacc && nacc.id) {
                    this.accounts.push(nacc);
                    this.addSubAccountsView();
                }
            });
        }
    }
}


class CostItemView {
    constructor(citem) {
        this.costitem = citem;

        this.rootview = document.createElement('div');
        this.rootview.appendChild(document.createElement('hr'));

        this.ciKey = document.createElement('input');
        this.ciKey.value = citem.key;
        this.ciKey.disabled = citem.key !== '';
        this.ciKey.style.maxWidth = '80px';
        addInput(this.rootview, this.ciKey, '关键词');
        if (citem.key !== '') {
            var delBtn = document.createElement('button');
            delBtn.textContent = 'X';
            this.ciKey.parentElement.appendChild(delBtn);
            delBtn.onclick = e => {
                this.rootview.style.display = 'none';
                this.changed = true;
                delete(emjyBack.costDog[citem.key]);
            }
        }
        this.ciAmt = document.createElement('input');
        this.ciAmt.value = citem.amount;
        this.ciAmt.style.maxWidth = '60px';
        addInput(this.rootview, this.ciAmt, '基础仓位');
        this.ciMxAmt = document.createElement('input');
        this.ciMxAmt.value = citem.max_amount;
        this.ciMxAmt.style.maxWidth = '60px';
        addInput(this.rootview, this.ciMxAmt, '最大仓位');
        this.ciEer = document.createElement('input');
        this.ciEer.value = 100 * citem.expect_earn_rate;
        this.ciEer.style.maxWidth = '50px';
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
}
