'use strict';

class ReviewsPages extends RadioAnchorPage {
    constructor() {
        super('持仓');
    }

    show() {
        super.show();
        if (!this.navigator) {
            this.navigator = new RadioAnchorBar();
            this.container.appendChild(this.navigator.container);
            this.initTabs();
        }
    }

    initTabs() {
        const tabs = [];
        if (emjyBack.fha) {
            var url = emjyBack.fha.server + 'userbind?onlystock=1';
            const headers = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)}
            fetch(url, {headers}).then(r => r.json()).then(accs => {
                const showname = {'normal': '普通账户', 'collat': '担保品账户'}
                accs = [{name: 'normal', email: emjyBack.fha.uemail, realcash: 1}].concat(accs);
                for (const acc of accs) {
                    tabs.push(new StockListPanelPage(acc.name, showname[acc.name]??acc.name));
                }
                return accs;
            }).then(accs => {
                tabs.push(new SettingsView(accs));
                tabs.forEach(t => {
                    this.navigator.addRadio(t);
                    this.container.appendChild(t.container);
                });
                this.navigator.selectDefault();
            });
        }
    }
}
