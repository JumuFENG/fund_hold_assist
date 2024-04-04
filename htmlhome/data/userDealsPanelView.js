'use strict';

class UserDealsPanel extends RadioAnchorPage {
    constructor() {
        super('实盘');
    }

    show() {
        super.show();
        if (!this.topPanel) {
            this.topPanel = document.createElement('div');
            this.contentPanel =  document.createElement('div');
            this.container.appendChild(this.topPanel);
            this.container.appendChild(this.contentPanel);

            this.iptHost = document.createElement('input');
            this.iptHost.placeholder = 'server';
            this.iptUser = document.createElement('input');
            this.iptUser.placeholder = '账户/邮箱';
            this.iptPwd = document.createElement('input');
            this.iptPwd.placeholder = '密码';
            this.iptPwd.type = 'password';
            this.topPanel.appendChild(this.iptHost);
            this.topPanel.appendChild(this.iptUser);
            this.topPanel.appendChild(this.iptPwd);

            var topsubmit = document.createElement('button');
            topsubmit.textContent = '保存';
            this.topPanel.appendChild(topsubmit);
            topsubmit.onclick = e => {
                emjyBack.fha = {'server': this.iptHost.value, 'uemail': this.iptUser.value, 'pwd': this.iptPwd.value};
                emjyBack.saveToLocal({'fha_server': emjyBack.fha});
                this.getUserDeals();
            }

            this.chkShowFunds = document.createElement('input');
            this.chkShowFunds.type = 'checkbox';
            this.chkShowFunds.id = 'checkbox_showfunds';
            this.chkShowFunds.onclick = e => {
                this.showDeals();
            }
            this.topPanel.appendChild(this.chkShowFunds);
            var clbl = document.createElement('label');
            clbl.textContent = '显示基金';
            clbl.setAttribute('for', 'checkbox_showfunds');
            this.topPanel.appendChild(clbl);

            var filterDiv = document.createElement('div');
            this.topPanel.appendChild(filterDiv);

            this.iptFilter = document.createElement('input');
            this.iptFilter.placeholder = '代码';
            this.iptFilter.oninput = e => {
                if (this.iptFilter.value == '' || (this.iptFilter.value.length > 2)) {
                    this.showDeals();
                }
            }
            filterDiv.appendChild(this.iptFilter);

            this.durationSelector = document.createElement('select');
            this.durationSelector.appendChild(new Option('当年', 'yr'));
            this.durationSelector.appendChild(new Option('近1年', 'yr1'));
            this.durationSelector.appendChild(new Option('近半年', 'yr.5'));
            this.durationSelector.appendChild(new Option('近3月', 'mth3'));
            this.durationSelector.appendChild(new Option('近1月', 'mth1'));
            this.durationSelector.appendChild(new Option('近1周', 'wk1'));
            this.durationSelector.appendChild(new Option('全部', 'all'));
            this.durationSelector.onchange = e => {
                this.showDeals();
            }
            filterDiv.appendChild(this.durationSelector);

            this.dealCategorySel = document.createElement('select');
            filterDiv.appendChild(this.dealCategorySel);
            if (!this.dealCategories) {
                var dcUrl = emjyBack.fha.server + 'stock?act=dealcategory';
                utils.get(dcUrl, null, dt => {
                    this.dealCategories = JSON.parse(dt);
                    for (const dc of this.dealCategories) {
                        this.dealCategorySel.appendChild(new Option(
                            dc[1]?dc[1]:dc[0], dc[0]));
                    }
                    this.dealCategorySel.selectedIndex = -1;
                });
            }
            this.iptNewCategoryKey = document.createElement('input');
            this.iptNewCategoryKey.placeholder = '策略存储名';
            filterDiv.appendChild(this.iptNewCategoryKey);
            this.iptNewCategoryDesc = document.createElement('input');
            this.iptNewCategoryDesc.placeholder = '策略描述';
            filterDiv.appendChild(this.iptNewCategoryDesc);
            this.dealCategorySel.onchange = e => {
                if (this.dealCategorySel.selectedIndex == -1) {
                    return;
                }
                var sopt = this.dealCategorySel.selectedOptions[0];
                this.iptNewCategoryKey.value = sopt.value;
                this.iptNewCategoryDesc.value = sopt.text == sopt.value ? '' : sopt.text;
            }
            var btnAddDeals = document.createElement('button');
            btnAddDeals.textContent = '添加交易记录';
            filterDiv.appendChild(btnAddDeals);
            btnAddDeals.onclick = e => {
                if (this.checkedDeals.length == 0) {
                    return;
                }
                if (this.dealCategorySel.selectedIndex == - 1 && !this.iptNewCategoryKey.value) {
                    console.error('no category key selected!');
                    return;
                }
                var track_name = this.iptNewCategoryKey.value;
                var track_desc = this.iptNewCategoryDesc.value;
                var dlUrl = emjyBack.fha.server + 'stock';
                var fd = new FormData();
                fd.append('act', 'trackdeals');
                fd.append('name', track_name);
                var selectedDesc = this.dealCategorySel.selectedIndex >= 0 ? this.dealCategorySel.selectedOptions[0].text : null;
                if (track_desc && (selectedDesc == track_name || selectedDesc != track_desc)) {
                    fd.append('desc', track_desc);
                }
                for (var cdeal of this.checkedDeals) {
                    if (cdeal.code.length == 8) {
                        cdeal.code = cdeal.code.substring(2);
                    }
                }
                fd.append('data', JSON.stringify(this.checkedDeals));
                utils.post(dlUrl, fd, null, dl => {
                    if (dl != 'OK') {
                        console.error('add deals to', track_name, 'failed!');
                    } else {
                        console.log('add deals to', track_name, 'success!')
                    }
                });
            }

            this.contentPanel.style.display = 'flex';
            this.dealsTable = new SortableTable();
            this.contentPanel.appendChild(this.dealsTable.container);
            this.wkSoldList = document.createElement('div');
            this.contentPanel.appendChild(this.wkSoldList);

            if (emjyBack.fha.uemail && emjyBack.fha.pwd && emjyBack.fha.server) {
                this.iptHost.value = emjyBack.fha.server;
                this.iptUser.value = emjyBack.fha.uemail;
                this.iptPwd.value = emjyBack.fha.pwd;
                this.getUserDeals();
                this.getCurWeekSold();
            } else {
                emjyBack.getFromLocal('fha_server', fha => {
                    if (fha) {
                        emjyBack.fha = fha;
                        this.iptHost.value = emjyBack.fha.server;
                        this.iptUser.value = emjyBack.fha.uemail;
                        this.iptPwd.value = emjyBack.fha.pwd;
                        this.getUserDeals();
                        this.getCurWeekSold();
                    }
                });
            }
        }
    }

    getUserDeals() {
        if (!emjyBack.fha.uemail || !emjyBack.fha.pwd) {
            console.error('user/password not set!');
            return;
        }
        var url = emjyBack.fha.server + 'stock?act=trackdeals&name=archived';
        var header = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)};
        utils.get(url, header, rsp => {
            var jrsp = JSON.parse(rsp);
            this.userDeals = jrsp.deals;
            this.showDeals();
        });
    }

    getCurWeekSold() {
        if (!emjyBack.fha.uemail || !emjyBack.fha.pwd) {
            console.error('user/password not set!');
            return;
        }
        var url = emjyBack.fha.server + 'stock?act=archivedcodes&since=' + utils.dateToString(new Date() - 7 * 24 * 60 * 60 * 1000);
        var header = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)};
        utils.get(url, header, rsp => {
            this.curWkSold = JSON.parse(rsp);
            this.showWkSold();
        });
    }

    selectDeals() {
        var skey = this.durationSelector.value;
        if (skey == 'all') {
            return this.userDeals;
        }

        var now = new Date();
        var dealstarts = {
            'yr': new Date(now.getFullYear(), 0, 1),
            'yr1': (new Date(now)).setFullYear(now.getFullYear() - 1),
            'yr.5': (new Date(now)).setMonth(now.getMonth() - 6),
            'mth3': (new Date(now)).setMonth(now.getMonth() - 3),
            'mth1': (new Date(now)).setMonth(now.getMonth() - 1),
            'wk1': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        var fkey = this.iptFilter.value;
        var sDeals = [];
        for (const dl of this.userDeals) {
            if (new Date(dl.time) > dealstarts[skey]) {
                if (!fkey || dl.code.includes(fkey)) {
                    sDeals.push(dl);
                }
            }
        }
        return sDeals;
    }

    showDeals() {
        this.dealsTable.reset();
        this.checkedDeals = [];
        if (!this.userDeals) {
            return;
        }

        this.dealsTable.setClickableHeader('序号', '代码', '名称', '买卖', '价格', '数量', '日期', '');
        var fDeals = this.selectDeals();
        var n = 1;
        fDeals.sort((d1, d2) => {
            if (d1.code == d2.code) {
                return d1.time > d2.time;
            }
            return d1.code > d2.code;
        });
        var showFunds = this.chkShowFunds.checked;
        for (const deali of fDeals) {
            var chkbx = document.createElement('input');
            chkbx.type = 'checkbox';
            chkbx.deal = {...deali};
            chkbx.onchange = e => {
                if (e.target.checked) {
                    this.checkedDeals.push(e.target.deal);
                } else {
                    this.checkedDeals.splice(this.checkedDeals.indexOf(e.target.deal));
                }
            }
            var dcode = deali.code.length == 8 ? deali.code.substring(2) : deali.code;
            if (!showFunds && (dcode.startsWith('5') || dcode.startsWith('1'))) {
                continue;
            }
            this.dealsTable.addRow(
                n++, dcode, emjyBack.stockAnchor(dcode), deali.tradeType,
                deali.price, deali.count, deali.time.split(' ')[0], chkbx
            );
        }
    }

    showWkSold() {
        utils.removeAllChild(this.wkSoldList);
        if (!this.curWkSold) {
            return;
        }

        this.wkSoldList.appendChild(document.createTextNode('一周内清仓:'));
        var slselect = document.createElement('select');
        this.wkSoldList.appendChild(slselect);
        var showFunds = this.chkShowFunds.checked;
        for (const codei of this.curWkSold) {
            var dcode = codei.length == 8 ? codei.substring(2) : codei;
            if (!showFunds && (dcode.startsWith('5') || dcode.startsWith('1'))) {
                continue;
            }
            slselect.options.add(new Option(emjyBack.stockName(dcode), dcode));
        }
        slselect.selectedIndex = -1;
        slselect.onchange = e => {
            if (e.target.selectedIndex !== -1) {
                this.iptFilter.value = e.target.value;
                this.iptFilter.oninput();
            }
        }
    }
}