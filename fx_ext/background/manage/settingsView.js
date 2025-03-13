'use strict';

class SettingsPanelPage extends RadioAnchorPage {
    constructor() {
        super('设置');
    }

    show() {
        super.show();
        if (!this.initialized) {
            this.initialized = true;
            this.init();
        }
    }

    addImportPanel() {
        var btnExport = document.createElement('button');
        btnExport.textContent = '导出';
        btnExport.onclick = e => {
            emjyManager.sendExtensionMessage({command:'mngr.export'});
        };
        this.container.appendChild(btnExport);
        var importDiv = document.createElement('div');
        var fileIpt = document.createElement('input');
        fileIpt.type = 'file';
        fileIpt.multiple = false;
        fileIpt.onchange = e => {
            e.target.files[0].text().then(text => {
                emjyManager.sendExtensionMessage({command:'mngr.import', config: JSON.parse(text)});
            });
        };
        importDiv.appendChild(document.createTextNode('导入'));
        importDiv.appendChild(fileIpt);
        this.container.appendChild(importDiv);
    }

    addInput(fath, ele, text) {
        var eleout = document.createElement('div');
        eleout.appendChild(document.createTextNode(text));
        eleout.appendChild(ele);
        fath.appendChild(eleout);
    }

    addServerPanel() {
        var svrDiv = document.createElement('div');
        this.svrHost = document.createElement('input');
        this.addInput(svrDiv, this.svrHost, 'Server Host');
        this.userEmail = document.createElement('input');
        this.addInput(svrDiv, this.userEmail, 'Account(e-mail)');
        this.pwd = document.createElement('input');
        this.addInput(svrDiv, this.pwd, 'Password');
        this.strategySave = document.createElement('input');
        this.strategySave.type = 'checkbox';
        this.strategySave.title = '服务器保存功能, 不启用则保存在localstorage';
        this.addInput(svrDiv, this.strategySave, '启用保存');
        this.account = document.createElement('input');
        this.addInput(svrDiv, this.account, '资金账户');
        this.accpwd = document.createElement('input');
        this.accpwd.type = 'password';
        this.addInput(svrDiv, this.accpwd, '密码');
        this.creditEnabled = document.createElement('input');
        this.creditEnabled.type = 'checkbox';
        this.addInput(svrDiv, this.creditEnabled, '启用两融账户');
        emjyBack.getFromLocal('fha_server').then(fhainfo => {
            if (fhainfo) {
                this.svrHost.value = fhainfo.server;
                this.userEmail.value = fhainfo.uemail;
                this.pwd.value = fhainfo.pwd;
                this.strategySave.checked = fhainfo.save_on_server;
            }
        });
        emjyBack.getFromLocal('acc_np').then(anp => {
            if (anp) {
                this.account.value = anp.account;
                this.accpwd.value = atob(anp.pwd);
                this.creditEnabled.checked = anp.credit;
            }
        });
        this.container.appendChild(svrDiv);
        emjyBack.getFromLocal('purchase_new_stocks').then(pns => {
            var purchaseNewStocks = document.createElement('input');
            purchaseNewStocks.type = 'checkbox';
            purchaseNewStocks.checked = pns;
            purchaseNewStocks.onchange = e => {
                emjyBack.saveToLocal({'purchase_new_stocks': e.target.checked});
            }
            this.addInput(svrDiv, purchaseNewStocks, '申购新股');
        });
    }

    addTrackAccountPanel() {
        if (this.taPanel) {
            utils.removeAllChild(this.taPanel);
        } else {
            this.taPanel = document.createElement('div');
            this.container.appendChild(this.taPanel);
        }
        this.taPanel.appendChild(document.createTextNode('模拟账户:'));
        for (const acc in emjyBack.trackAccountNames) {
            var traccDiv = document.createElement('div');
            this.taPanel.appendChild(traccDiv);
            traccDiv.appendChild(document.createTextNode(acc + ' ' + emjyBack.trackAccountNames[acc]));
            var btnDel = document.createElement('button');
            btnDel.textContent = 'X';
            btnDel.accountname = acc;
            btnDel.onclick = e => {
                delete(emjyBack.trackAccountNames[e.target.accountname]);
                emjyBack.saveToLocal({'track_accounts': emjyBack.trackAccountNames});
                this.addTrackAccountPanel();
            }
            traccDiv.appendChild(btnDel);
        }
        this.taPanel.appendChild(document.createTextNode('添加模拟账户'));
        this.newTrackKey = document.createElement('input');
        this.addInput(this.taPanel, this.newTrackKey, '关键词');
        this.newTrackName = document.createElement('input');
        this.addInput(this.taPanel, this.newTrackName, '账户名');
        var accSave = document.createElement('button');
        accSave.textContent = '新增';
        this.taPanel.appendChild(accSave);
        accSave.onclick = e => {
            var acc = this.newTrackKey.value;
            if (!acc || acc in emjyBack.trackAccountNames) {
                alert('key invalid or already exists:', acc, emjyBack.trackAccountNames[acc])
                return;
            }
            emjyBack.trackAccountNames[acc] = this.newTrackName.value;
            emjyBack.initTrackAccounts();
            emjyBack.saveToLocal({'track_accounts': emjyBack.trackAccountNames});
            this.addTrackAccountPanel();
        }
    }

    init() {
        this.addImportPanel();
        this.addServerPanel();
        this.addTrackAccountPanel();
        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            this.saveServerInfo();
            this.saveAccountInfo();
        }
        this.container.appendChild(saveBtn);
    }

    saveServerInfo() {
        if (this.svrHost) {
            var fhaInfo = {
                server: this.svrHost.value,
                uemail: this.userEmail.value,
                pwd: this.pwd.value,
                save_on_server: this.strategySave.checked
            }
            emjyBack.saveToLocal({'fha_server': fhaInfo});
        }
    }

    saveAccountInfo() {
        if (this.account && this.accpwd) {
            var anp = {account: this.account.value, pwd: btoa(this.accpwd.value), credit: this.creditEnabled.checked};
            emjyBack.saveToLocal({'acc_np': anp})
        }
    }
}
