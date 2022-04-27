'use strict';

class SettingsPanelPage extends RadioAnchorPage {
    constructor(text) {
        super(text);
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

    addServerPanel() {
        var svrDiv = document.createElement('div');
        var addInput = function(fath, ele, text) {
            var eleout = document.createElement('div');
            eleout.appendChild(document.createTextNode(text));
            eleout.appendChild(ele);
            fath.appendChild(eleout);
        }
        this.svrHost = document.createElement('input');
        addInput(svrDiv, this.svrHost, 'Server Host');
        this.userEmail = document.createElement('input');
        addInput(svrDiv, this.userEmail, 'Account(e-mail)');
        this.pwd = document.createElement('input');
        addInput(svrDiv, this.pwd, 'Password');
        emjyBack.getFromLocal('fha_server', fhainfo => {
            if (fhainfo) {
                this.svrHost.value = fhainfo.server;
                this.userEmail.value = fhainfo.uemail;
                this.pwd.value = fhainfo.pwd;
            }
        });
        this.container.appendChild(svrDiv);
    }

    addSMICenterPanel() {
        var smiDiv = document.createElement('div');
        smiDiv.appendChild(document.createTextNode('大盘中枢'));
        this.smiTable = new SortableTable(1, 0, false);
        smiDiv.appendChild(this.smiTable.container);
        smiDiv.appendChild(document.createTextNode('日期'));
        this.dateIpt = document.createElement('input');
        smiDiv.appendChild(this.dateIpt);
        smiDiv.appendChild(document.createTextNode('点位'));
        this.smiValue = document.createElement('input');
        smiDiv.appendChild(this.smiValue);
        var btnAdd = document.createElement('button');
        btnAdd.textContent = '添加';
        btnAdd.onclick = () => {
            var date = this.dateIpt.value;
            var value = this.smiValue.value;
            if (!this.smiList) {
                this.smiList = [];
            }
            this.smiList.push({date, value});
            this.showSmiList();
            this.dateIpt.value = '';
            this.smiValue.value = '';
        }
        smiDiv.appendChild(btnAdd);
        emjyBack.getFromLocal('smilist', smi => {
            if (smi) {
                this.smiList = smi
                this.showSmiList();
            }
        });
        this.container.appendChild(smiDiv);
    }

    showSmiList() {
        this.smiTable.reset();
        this.smiTable.setClickableHeader('', '日期', '点位');
        for (var i = 0; i < this.smiList.length; ++i) {
            this.smiTable.addRow(i + 1, this.smiList[i].date, this.smiList[i].value);
        }
    }

    init() {
        this.addImportPanel();
        this.addServerPanel();
        this.addSMICenterPanel();
        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            this.saveServerInfo();
            this.saveSmiInfo();
        }
        this.container.appendChild(saveBtn);
    }

    saveServerInfo() {
        if (this.svrHost) {
            var fhaInfo = {server: this.svrHost.value, uemail: this.userEmail.value, pwd: this.pwd.value};
            emjyBack.saveToLocal({'fha_server': fhaInfo});
        }
    }

    saveSmiInfo() {
        if (this.smiList) {
            emjyBack.saveToLocal({'smilist': this.smiList});
        }
    }
}
