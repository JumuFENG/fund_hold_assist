class SettingsView extends RadioAnchorPage {
    constructor() {
        super('设置');
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
        }
    }
}
