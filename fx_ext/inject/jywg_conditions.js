'use strict';
let EmjyFront = null;

class CommandReactor {
    constructor(sendResponse) {
        this.sendResponse = sendResponse;
    }

    onTaskMessage(sendResponse) {
    }

    onStepsMessage(step, sendResponse) {
    }
}

class NewStocksReactor extends CommandReactor {
    constructor(sendResponse) {
        super(sendResponse);
    }

    onTaskMessage() {
        var seletedCount = 0;
        document.querySelector('#tableBody').querySelectorAll('tr').forEach(r => {
            var tds = r.querySelectorAll('td');
            if (tds.length < 2) {
                return;
            };
            var code = tds[2].textContent;
            console.log(code);
            if (code.startsWith('68') || code.startsWith('30')) {
                return;
            };
            var chkbx = r.querySelector('input');
            if (chkbx) {
                chkbx.click();
                seletedCount++;
            };
        });

        this.sendResponse({command:'step', step: 'set', count: seletedCount});
    }

    onStepsMessage(step) {
        if (step == 'batclick') {
            document.querySelector('#btnBatBuy').click();
            this.sendResponse({command:'step', step, status:'done'});
        } else if (step == 'confirm') {
            var status = 'waiting';
            if (document.querySelector('#btnConfirm')) {
                document.querySelector('#btnConfirm').click();
                status = 'done';
            }
            this.sendResponse({command:'step', step, status})
        } else if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            this.sendResponse({command:'step', step, status, alert});
        }
    }
}

class BondRepurchaseReactor extends CommandReactor {
    constructor(code, sendResponse) {
        super(sendResponse);
        this.code = code;
    }

    onTaskMessage() {
        if (!document.querySelector('#iptZqdm')) {
            this.sendResponse({command:'step', step:'codeinput', status:'waiting'});
            return;
        }
        document.querySelector('#iptZqdm').value = this.code;
        document.querySelector('#iptZqdm').click();
        this.sendResponse({command:'step', step:'codeinput', status:'done'});
    }

    onStepsMessage(step) {
        if (step == 'codeinput') {
            this.onTaskMessage(this.sendResponse);
            return;
        }
        
        if (step == 'quicksale') {
            var quickSale = document.querySelector('#quickSale');
            if (!quickSale || !quickSale.childNodes) {
                this.sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            var qsRows = quickSale.querySelectorAll('tr');
            if (!qsRows || qsRows.length < 2) {
                this.sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            qsRows[1].click();
            this.sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'chkcount') {
            if (document.querySelector('#lblKrsl').textContent == 0) {
                this.sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            document.querySelector('#iptRqsl').value = document.querySelector('#lblKrsl').textContent;
            document.querySelector('#btnConfirm').disabled = false;
            document.querySelector('#btnConfirm').click();
            this.sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'confirm') {
            var confirmAgain = document.querySelector('.btn_jh', '.btnts', '.cl', '.btn', '.btn-default-blue');
            if (!confirmAgain) {
                this.sendResponse({command:'step', step, status:'waiting'});
                return;
            } 

            confirmAgain.click();
            this.sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            this.sendResponse({command:'step', step, status, alert});
            return;
        }
    }
}

class TradeReactor extends CommandReactor {
    constructor(code, name, count, price, sendResponse) {
        super(sendResponse);
        this.code = code;
        this.name = name;
        this.count = count;
        this.price = price;
        this.bodyObserver = new MutationObserver((mutelist, obs) => {
            for (var mu of mutelist) {
                if (mu.type == 'childList' && mu.addedNodes.length > 1) {
                    this.bodyChildChanged();
                }
            }
        });
        this.bodyObserver.observe(document.querySelector('body'), {childList: true});
    }

    clickToSetPrice() {
        console.log('clickToSetPrice enter');
        if (!document.querySelector('#datalist')) {
            console.log('clickToSetPrice datalist null');
            this.sendResponse({command:'step', step:'stockinput', status:'waiting'});
            return false;
        }
        var aprices = document.querySelector('#datalist').querySelectorAll('a');
        if (!aprices || aprices.length < 1) {
            console.log('clickToSetPrice anchors in datalist is 0');
            this.sendResponse({command:'step', step:'stockinput', status:'waiting'});
            return false;
        }
        var prAnchor = aprices[0];
        var tbAnchor = null;
        if (location.pathname.includes('Sale')) {
            prAnchor = aprices[aprices.length - 1];
            if (prAnchor.childNodes[1].textContent != '-' ) {
                prAnchor.click();
                console.log('clickToSetPrice anchor clicked sell!');
                return true;
            }
            tbAnchor = document.querySelector('#dt');
        } else {
            if (prAnchor.childNodes[1].textContent != '-') {
                console.log('clickToSetPrice anchor clicked buy!');
                prAnchor.click();
                return true;
            }
            tbAnchor = document.querySelector('#zt');
        }

        if (tbAnchor.textContent != '-') {
            tbAnchor.click();
            console.log('set price to top/bottom price', tbAnchor.textContent);
            return true;
        }
        this.sendResponse({command:'step', step:'stockinput', status:'waiting', what: 'no valid price to set'});
        console.log('clickToSetPrice error: no valid price to click!');
        return false;
    }

    setCount() {
        if (this.count - 4 <= 0 && this.count - 1 >= 0) {
            var radId = ['', '#radall', '#radtwo', '#radstree', '#radfour'][this.count];
            if (!document.querySelector(radId)) {
                this.sendResponse({command:'step', step:'stockinput', status:'waiting'});
                return;
            } else {
                document.querySelector(radId).click();
                this.sendResponse({command:'step', step: 'stockinput', status:'done'});
                return;
            };
        }
        if (this.count - 100 < 0) {
            this.sendResponse({command:'step', step:'stockinput', status: 'error', what: 'countInvalid count = ' + this.count});
            return;
        }

        document.querySelector('#iptCount').value = this.count;
        this.sendResponse({command:'step', step: 'stockinput', status:'done'});
    }

    checkSubmitDisabled() {
        var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
        var errorText = document.querySelector('.cxc_bd', 'error');
        if (btnCxcConfirm && errorText) {
            btnCxcConfirm.click();
            console.log('error alert:', errorText.textContent);
            if (errorText && errorText.textContent == 'The Jylb field is required.') {
                document.querySelector('#delegateWay').childNodes[0].value = 'B';
                if (this.clickToSetPrice(this.sendResponse)) {
                    this.setCount(this.sendResponse);
                }
                return;
            }
        }

        if (document.querySelector('.sub_title')) {
            var subtitle = document.querySelector('.sub_title').querySelectorAll('span');
            var valid = 0;
            for (var i = 0; i < subtitle.length; i++) {
                if (subtitle[i].textContent != '-') {
                    valid++;
                }
            }
            var aprices = document.querySelector('#datalist').querySelectorAll('a');
            for (var i = 0; i < aprices.length; i++) {
                var pr = aprices[i].querySelectorAll('span');
                if (pr[1].textContent != '-') {
                    valid++;
                }
            }
            if (valid == 0) {
                this.sendResponse({command:'step', step: 'chksubmit', status: 'error', what:'NoStockInfo'});
                return;
            }
        }

        if (document.querySelector('#lbMaxCount').textContent - this.count < 0) {
            this.sendResponse({command:'step', step: 'chksubmit', status:'waiting', what: 'maxCountInvalid maxCount = '+ document.querySelector('#lbMaxCount').textContent});
            return;
        } else {
            this.sendResponse({command:'step', step: 'chksubmit', status:'waiting', what: ''});
            return;
        }
    }

    bodyChildChanged() {
        console.log('bodyChildChanged');
        var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
        var errorText = document.querySelector('.cxc_bd', 'error');
        if (btnCxcConfirm && errorText) {
            // if (errorText.textContent.includes('委托已提交') || errorText.textContent.includes('当前时间不允许做该项业务') || errorText.textContent.includes('委托已成功提交') || errorText.textContent.includes('可用资金不足')) {
            //     return;
            // }
            btnCxcConfirm.click();
            console.log('error alert:', errorText.textContent);
            if (errorText && errorText.textContent == 'The Jylb field is required.') {
                document.querySelector('#delegateWay').childNodes[0].value = 'B';
            }
            if (this.clickToSetPrice()) {
                this.setCount();
            }
        }
    }

    onTaskMessage() {
        if (!document.querySelector('#stockCode')) {
            this.sendResponse({command:'step', step:'stockinput', status:'waiting'});
            return;
        }
        if (document.querySelector('#stockCode').value != this.code) {
            document.querySelector('#stockCode').value = this.code;
        }
        if (this.name.length > 0) {
            document.querySelector('#iptbdName').value = this.name;
        }
        if (this.price !== undefined && this.price > 0) {
            document.querySelector('#iptPrice').value = this.price;
        } else if (this.clickToSetPrice(this.sendResponse)) {
            this.setCount(this.sendResponse);
        }
    }

    onStepsMessage(step) {
        if (step == 'stockinput') {
            this.onTaskMessage(this.sendResponse);
            return;
        }

        if (step == 'chksubmit') {
            if (document.querySelector('#btnConfirm').disabled) {
                this.checkSubmitDisabled(this.sendResponse);
            } else {
                document.querySelector('#btnConfirm').click();
                this.sendResponse({command:'step', step, status:'done'});
            }
            return;
        }

        if (step == 'confirm') {
            var confirmAgain = document.querySelector('.btn_jh', '.btnts', '.cl', '.btn', '.btn-default-blue');
            if (!confirmAgain) {
                this.sendResponse({command:'step', step, status:'waiting'});
                return;
            } 

            confirmAgain.click();
            this.sendResponse({command:'step', step, status:'done'});
            this.bodyObserver.disconnect();
            return;
        }

        if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            this.sendResponse({command:'step', step, status, alert});
            return;
        }
    }
}

class EmjyFrontend {
    constructor() {
        this.loginPath = '/Login';
        this.commandReactor = null;
        this.ocr_retry = 0;
    }

    Init() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.command.startsWith('emjy.')) {
                this.log('recieve command', message.command);
                this.onBackMessageReceived(message, sender, sendResponse);
            } else {
                this.log("command not recognized.");
            }
        });
    }

    log(...args) {
        console.log(args.join(' '));
    }
    
    sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message);
    }

    onBackMessageReceived(message, sender, sendResponse) {
        if (message.command == 'emjy.navigate') {
            location.href = message.url;
        } else if (message.command == 'emjy.loginnp') {
            this.setLoginNp(message.np);
        } else if (message.command == 'emjy.captcha') {
            this.submitCaptcha(message.text);
        } else if (message.command == 'emjy.getValidateKey') {
            this.sendEmValidateKey();
        } else if (message.command == 'emjy.trade') {
            this.commandReactor = new TradeReactor(message.code, message.name, message.count, message.price, sendResponse);
            this.commandReactor.onTaskMessage();
        } else if (message.command == 'emjy.trade.bonds') {
            this.commandReactor = new BondRepurchaseReactor(message.code, sendResponse);
            this.commandReactor.onTaskMessage();
        } else if (message.command == 'emjy.trade.newbonds') {
            this.commandReactor = new NewStocksReactor(sendResponse);
            this.commandReactor.onTaskMessage();
        } else if (message.command == 'emjy.trade.newstocks') {
            this.commandReactor = new NewStocksReactor(sendResponse);
            this.commandReactor.onTaskMessage();
        } else if (message.command == 'emjy.step') {
            console.log(message);
            if (this.commandReactor) {
                this.commandReactor.sendResponse = sendResponse;
                this.commandReactor.onStepsMessage(message.step);
            } else {
                console.log('onBackMessageReceived', 'commandReactor is null', this.commandReactor);
            }
        }
    }

    sendEmValidateKey(){
        var elevk = document.querySelector('#em_validatekey');
        if (elevk) {
            var key = elevk.value;
            this.sendMessageToBackground({command:'emjy.getValidateKey', key});
        }
    }

    onLoginPageLoaded() {
        var loginInterval = setInterval(()=>{
            var btnConfirm = document.querySelector('.btn-orange', '.vbtn-confirm');
            if (btnConfirm) {
                btnConfirm.click();
                clearInterval(loginInterval);
            }
        }, 200);
        document.querySelector('#rdsc45').checked = true;
        var inputValidate = document.querySelector('#txtValidCode');
        inputValidate.oninput = function (e) {
            if (e.target.value.length == 4) {
                document.querySelector('#btnConfirm').click();
            }
        }
        if (!document.querySelector('#txtPwd').value || !document.querySelector('#txtZjzh').value) {
            this.sendMessageToBackground({command:'emjy.loginnp'});
        }
        var imgValid = document.querySelector('#imgValidCode');
        imgValid.onload = function() {
            EmjyFront.recogizeImage();
        }
        this.recogizeImage();
    }

    recogizeImage() {
        if (this.ocr_retry > 20) {
            this.log('recogizeImage retried 20 times. stop!');
            return;
        }

        this.ocr_retry ++;
        var imgValid = document.querySelector('#imgValidCode');
        var canvas = document.createElement('canvas');
        canvas.width = imgValid.width;
        canvas.height = imgValid.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(imgValid, 0, 0, imgValid.width, imgValid.height);
        this.sendMessageToBackground({command:'emjy.captcha', img: canvas.toDataURL()});
    }

    clickSubmit() {
        if (!document.querySelector('#txtPwd').value || !document.querySelector('#txtValidCode').value) {
            return;
        }
        document.querySelector('#btnConfirm').click();
    }

    setLoginNp(np) {
        document.querySelector('#txtZjzh').value = np.account;
        document.querySelector('#txtPwd').value = atob(np.pwd);
        this.clickSubmit();
    }

    submitCaptcha(text) {
        if (!text || text.length != 4 || isNaN(text)) {
            document.querySelector('#imgValidCode').click();
            return;
        }
        document.querySelector('#txtValidCode').value = text;
        this.clickSubmit();
    }

    onPageLoaded() {
        this.log('onPageLoaded begin');
        var path = location.pathname;
        if (path == this.loginPath) {
            var errorConfirmInterval = setInterval(() => {
                var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
                if (btnCxcConfirm) {
                    btnCxcConfirm.click();
                    clearInterval(errorConfirmInterval);
                } else {
                    btnCxcConfirm = document.querySelector('#btnConfirm');
                    if (btnCxcConfirm) {
                        btnCxcConfirm.click();
                        clearInterval(errorConfirmInterval);
                    }
                }
            }, 500);
            this.onLoginPageLoaded();
        }

        this.sendMessageToBackground({command:'emjy.contentLoaded', url: location.href});
        if (path != this.loginPath) {
            this.sendEmValidateKey();
        }
        this.log('onPageLoaded', path);
    }
}

if (location.host == 'jywg.18.cn' || location.host == 'jywg.eastmoneysec.com') {
    EmjyFront = new EmjyFrontend();
    EmjyFront.Init();
    EmjyFront.onPageLoaded();
}
