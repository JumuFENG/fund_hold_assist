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
        this.log = null;
        this.pageLoaded = null;
        this.commandReactor = null;
    }

    Init(log) {
        this.pageLoaded = false;
        this.log = log;
    }

    sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message);
    }

    onBackMessageReceived(message, sender, sendResponse) {
        if (message.command == 'emjy.navigate') {
            location.href = message.url;
        } else if (message.command == 'emjy.getValidateKey') {
            var vkey = document.querySelector('#em_validatekey').value;
            this.sendMessageToBackground({command:'emjy.getValidateKey', key: vkey});
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

    onLoginPageLoaded() {
        var loginInterval = setInterval(()=>{
            var btnConfirm = document.querySelector('.btn-orange', '.vbtn-confirm');
            if (btnConfirm) {
                btnConfirm.click();
                clearInterval(loadInterval);
            }
        }, 200);
        // document.getElementById('txtZjzh').value = '';
        // document.getElementById('txtPwd').value = '';
        document.getElementById('rdsc45').checked = true;
        var inputValidate = document.getElementById('txtValidCode');
        inputValidate.oninput = function (e) {
            if (e.target.value.length == 4) {
                document.getElementById('btnConfirm').click();
            }
        }
    }

    onPageLoaded() {
        this.log('onPageLoaded begin');
        var path = location.pathname;
        if (path == this.loginPath) {
            this.onLoginPageLoaded();
            var errorConfirmInterval = setInterval(() => {
                var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
                if (btnCxcConfirm) {
                    btnCxcConfirm.click();
                    clearInterval(errorConfirmInterval);
                }
            }, 500);
        }

        this.pageLoaded = true;
        this.sendMessageToBackground({command:'emjy.contentLoaded', url: location.href});
        this.log('onPageLoaded', path);
    }
}

function logInfo(...args) {
    console.log(args.join(' '));
}

function onMessage(message, sender, sendResponse) {
    if (message.command.startsWith('emjy.')) {
        logInfo('recieve command', message.command);
        if (!EmjyFront) {
            EmjyFront = new EmjyFrontend();
            EmjyFront.Init(logInfo);
        }
        if (EmjyFront.pageLoaded) {
            console.log('onMessage 1');
            EmjyFront.onBackMessageReceived(message, sender, sendResponse);
        } else {
            console.log('onMessage 2')
            setTimeout(EmjyFront.onBackMessageReceived(message, sender, sendResponse), 1100);
        }
    } else {
        logInfo("command not recognized.");
    }
}

if (location.host == 'jywg.18.cn') {
    // console.log('sendMessage to background');
    if (!EmjyFront) {
        EmjyFront = new EmjyFrontend();
        EmjyFront.Init(logInfo);
    }
    if (location.pathname != EmjyFront.loginPath) {
        chrome.runtime.onMessage.addListener(onMessage);
    }

    EmjyFront.onPageLoaded();
}
