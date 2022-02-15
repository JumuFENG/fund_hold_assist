'use strict';

class RetroPanelPage extends RadioAnchorPage {
    constructor() {
        super('回测');
    }

    show() {
        super.show();
        if (this.retroEngine === undefined) {
            this.initRetroPanel();
        }
    }

    initRetroPanel() {
        this.retroEngine = new RetroEngine();
        emjyBack.setupRetroAccount();

        this.iptRetroCode = document.createElement('input');
        this.iptRetroCode.placeholder = '股票代码';
        this.container.appendChild(this.iptRetroCode);

        var btnStartRetro = document.createElement('button');
        btnStartRetro.textContent = '执行';
        btnStartRetro.onclick = e => {
            var code = this.iptRetroCode.value;
            this.retro(code);
        }
        this.container.appendChild(btnStartRetro);
    }

    retro(code) {
        if (this.retroEngine) {
            this.retroEngine = new RetroEngine();
        }
        // this.retroEngine.initRetro(code, {"grptype":"GroupStandard","strategies":{"0":{"key":"StrategyMA","enabled":true, kltype:'101'}},"amount":10000}, '2021-01-04');
        this.retroEngine.retroStrategyMa(code, '2021-01-04');
    }
}
