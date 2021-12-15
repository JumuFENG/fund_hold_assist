'use strict';
let EmjyFront = null;

class JywgUtils {
    constructor(log) {
        this.log = log;
        this.retry = 0;
    }

    getValidateKey() {
        var tradePath = '/MarginTrade/MarginBuy';//'/MarginTrade/Buy';
        if (location.pathname != tradePath) {
            return;
        }

        return document.getElementById('em_validatekey').value;
    }

    getCookie() {
        return document.cookie;
    }

    post(url, form, cb, that) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('POST', url);
        httpRequest.setRequestHeader('Host', 'jywg.18.cn');
        httpRequest.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0');
        httpRequest.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
        httpRequest.setRequestHeader('Accept-Language', 'zh-CN,en-US;q=0.7,en;q=0.3');
        httpRequest.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
        httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        httpRequest.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        httpRequest.setRequestHeader('Content-Length', '108');
        httpRequest.setRequestHeader('Origin', 'https://jywg.18.cn');
        httpRequest.setRequestHeader('Connection', 'keep-alive');
        httpRequest.setRequestHeader('Referer', 'https://jywg.18.cn/MarginTrade/MarginBuy');
        httpRequest.setRequestHeader('Cookie', this.getCookie());
        httpRequest.send(form);

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                console.log(httpRequest.readyState, httpRequest.status, httpRequest.responseText);
                if (typeof(cb) === 'function') {
                    // {"Status":-2,"Message":"会话已超时，请重新登录!"}
                    // {"Status":-1,"Message": "当前时间不允许做该项业务","Count": 0,"Data": [],"Errcode": 0}
                    cb(that);
                };
            };
        }
    }

    tradeBuy() {
        var tradeUrl = 'https://jywg.18.cn/MarginTrade/SubmitTradeV2?' + this.getValidateKey();
        var fd = new FormData();
        fd.append('stockCode', '002460');
        fd.append('stockName', '赣锋锂业');
        fd.append('price', '109.67');
        fd.append('amount', '400');
        fd.append('tradeType', 'B');
        fd.append('xyjylx', 'a'); // 
        this.post(tradeUrl, fd, function() {
            alert('tradeBuy POSTed!');
        });
    }

    onErrorMessageAlert(errorText) {
        if (errorText && errorText.textContent == 'The Jylb field is required.') {
            if (!location.pathname.includes('Buy') && !location.pathname.includes('Sale')) {
                return;
            }
            document.querySelector('#delegateWay').childNodes[0].value = 'B';
            var aprices = document.querySelector('#datalist').querySelectorAll('a');
            for (var i = 0; i < aprices.length; i++) {
                var x = i;
                if (location.pathname.includes('Sale')) {
                    x = aprices.length - 1 - i;
                }
                if (aprices[x].childNodes[1].textContent == '-') {
                    continue;
                }
                aprices[x].click();
                break;
            }
        }
    }

    clickConfirmAgainBtn() {
        var checkAgainInterval = setInterval(() => {
            var confirmAgain = document.querySelector('.btn_jh', '.btnts', '.cl', '.btn', '.btn-default-blue');
            if (confirmAgain) {
                clearInterval(checkAgainInterval);
                confirmAgain.click();
                this.clickTradeCompleteAlert();
            } else if (this.retry < 100){
                this.retry ++;
            } else {
                this.retry = 0;
                clearInterval(checkAgainInterval);
                EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'confirmAgainInvalid'});
                this.log('retry more than 100');
            }
        }, 200);
    }

    clickTradeCompleteAlert() {
        setTimeout(() => {
            var what = '';
            var responseAlert = document.querySelector('.cxc_bd', '.info');
            if (responseAlert) {
                what = responseAlert.textContent;
            };
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'success', what});
            // document.querySelector('#btnCxcConfirm').click();
        }, 200);
    }

    clickTrade(path, code, name, price, count, sendResponse) {
        if (location.pathname != path || (!location.href.includes('code=') && document.querySelector('#btnConfirm').disabled)) {
            var url = new URL(location.href);
            url.pathname = path;
            url.search = '?code=' + code;
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        }

        if (document.querySelector('#stockCode').value != code) {
            document.querySelector('#stockCode').value = code;
            document.querySelector('#iptbdName').value = name;
        };
        document.querySelector('#iptPrice').value = price;
        if (document.querySelector('#lbMaxCount').textContent < count) {
            if (sendResponse) {
                sendResponse({command:'emjy.trade', status: 'success', result: 'error', reason: 'maxCountInvalid', what: 'maxCount = ' + document.querySelector('#lbMaxCount').textContent + ', count = ' + count})
            };
            return;
        };
        if (count <= 4 && count >= 1) {
            var radId = ['', '#radall', '#radtwo', '#radstree', '#radfour'][count];
            var iptRad = document.querySelector(radId);
            if (!iptRad.checked) {
                document.querySelector(radId).click();
            };
        } else if (count < 100) {
            if (sendResponse) {
                sendResponse({command:'emjy.trade', status: 'success', result: 'error', reason: 'countInvalid', what: 'count = ' + count});
            };
            return;
        } else {
            document.querySelector('#iptCount').value = count;
        }

        if (sendResponse) {
            sendResponse({command:'emjy.trade', status: 'success', result: 'unknown'});
        };
        var checkInterval = setInterval(() => {
            if (document.querySelector('#btnConfirm').disabled) {
                return;
            };
            clearInterval(checkInterval);
            document.querySelector('#btnConfirm').click();
            this.clickConfirmAgainBtn();
        }, 200);
    }

    newStockBondBatBuy() {
        setTimeout(() => {
            document.querySelector('#btnBatBuy').click();
            var checkInterval = setInterval(() => {
                if (!document.querySelector('#btnConfirm')) {
                    return;
                };
                clearInterval(checkInterval);
                document.querySelector('#btnConfirm').click();
                this.clickTradeCompleteAlert();
            }, 200);
        }, 300);
    }

    tradeNewStockBond(command, tradePath, sendResponse) {
        if (location.pathname != tradePath) {
            var url = new URL(location.href);
            url.pathname = tradePath;
            url.search='';
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        };

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

        if (seletedCount > 0) {
            this.newStockBondBatBuy();
            if (sendResponse) {
                sendResponse({command, status: 'success', result:'unknown'});
            };
        } else {
            if (sendResponse) {
                console.log('maxCountInvalid', seletedCount, sendResponse);
                sendResponse({command, status: 'success', result: 'success', reason: 'maxCountInvalid', what: 'no new stocks to buy.'});
            };
        };
    }
}

class CommandReactor {
    constructor() {
    }

    onTaskMessage(sendResponse) {
    }

    onStepsMessage(step, sendResponse) {
    }
}

class AssetsReactor extends CommandReactor {
    constructor() {
        super();
        this.normalAssetsPath = '/Search/Position';
        this.creditAssetsPath = '/MarginSearch/MyAssets';
    }

    getStocks() {
        var stocks = [];
        var tableStocks = document.querySelector('#tabBody').querySelectorAll('tr');
        console.log('getStocks', tableStocks);
        for (var i = 0; i < tableStocks.length; ++i) {
            var rowCells = tableStocks[i].querySelectorAll('td');
            if (rowCells.length == 11) {
                var stockInfo = {
                    code: rowCells[0].textContent,
                    name: rowCells[1].textContent,
                    holdCount: rowCells[2].textContent,
                    availableCount: rowCells[3].textContent,
                    holdCost: rowCells[4].textContent,
                    latestPrice: rowCells[5].textContent
                };
                stocks.push(stockInfo);
            }
        }
        return stocks;
    }

    getAssetsCredit() {
        var myAssets = document.querySelector('#myAssets_main');
        if (!myAssets || !myAssets.childNodes || myAssets.childNodes.length < 1) {
            return;
        }
        var assets0 = myAssets.childNodes[0];
        if (!assets0 || !assets0.childNodes || assets0.childNodes.length != 4) {
            return;
        }
        var assetsTableRows = assets0.childNodes;

        return {
            totalAssets: assetsTableRows[0].childNodes[0].childNodes[1].textContent,
            availableMoney: assetsTableRows[0].childNodes[2].childNodes[1].textContent,
            pureAssets: assetsTableRows[1].childNodes[0].childNodes[1].textContent,
            availableCreditMoney: assetsTableRows[1].childNodes[2].childNodes[1].textContent,
            stocks: this.getStocks()
        };
    }

    getAssetsNor() {
        var myAssets = document.querySelector('#assest_cont');
        if (!myAssets || !myAssets.childNodes || myAssets.childNodes.length < 1) {
            return;
        }
        var assets0 = myAssets.childNodes[0];
        if (!assets0 || !assets0.childNodes || assets0.childNodes.length < 1) {
            return;
        }
        var assets1 = assets0.childNodes[0];
        if (!assets1 || !assets1.childNodes || assets1.childNodes.length != 3) {
            return;
        }
        var assetsTableRows = assets1.childNodes;

        return {
            pureAssets: assetsTableRows[0].childNodes[0].childNodes[1].textContent,
            availableMoney: assetsTableRows[1].childNodes[0].childNodes[1].textContent,
            stocks: this.getStocks()
        };
    }

    onTaskMessage(sendResponse) {
        if (!document.querySelector('#tabBody').querySelectorAll('tr')) {
            sendResponse({command:'step', step:'waiting'});
            return;
        }

        var assetsMsg = {};
        if (location.pathname == this.creditAssetsPath) {
            assetsMsg = this.getAssetsCredit();
        } else {
            assetsMsg = this.getAssetsNor();
        }
        console.log('onTaskMessage', assetsMsg);
        if (assetsMsg) {
            assetsMsg.assetsPath = location.pathname;
            sendResponse({command:'step', step:'got', assets: assetsMsg});
        } else {
            sendResponse({command:'step', step:'waiting'});
        }
    }

    onStepsMessage(step, sendResponse) {
        if (step == 'get') {
            console.log('onStepsMessage', 'get');
            this.onTaskMessage(sendResponse);
        }
    }
}

class NewStocksReactor extends CommandReactor {
    constructor() {
        super();
    }

    onTaskMessage(sendResponse) {
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

        sendResponse({command:'step', step: 'set', count: seletedCount});
    }

    onStepsMessage(step, sendResponse) {
        if (step == 'batclick') {
            document.querySelector('#btnBatBuy').click();
            sendResponse({command:'step', step, status:'done'});
        } else if (step == 'confirm') {
            var status = 'waiting';
            if (document.querySelector('#btnConfirm')) {
                document.querySelector('#btnConfirm').click();
                status = 'done';
            }
            sendResponse({command:'step', step, status})
        } else if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            sendResponse({command:'step', step, status, alert});
        }
    }
}

class BondRepurchaseReactor extends CommandReactor {
    constructor(code) {
        super();
        this.code = code;
    }

    onTaskMessage(sendResponse) {
        if (!document.querySelector('#iptZqdm')) {
            sendResponse({command:'step', step:'codeinput', status:'waiting'});
            return;
        }
        document.querySelector('#iptZqdm').value = this.code;
        document.querySelector('#iptZqdm').click();
        sendResponse({command:'step', step:'codeinput', status:'done'});
    }

    onStepsMessage(step, sendResponse) {
        if (step == 'codeinput') {
            this.onTaskMessage(sendResponse);
            return;
        }
        
        if (step == 'quicksale') {
            var quickSale = document.querySelector('#quickSale');
            if (!quickSale || !quickSale.childNodes) {
                sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            var qsRows = quickSale.querySelectorAll('tr');
            if (!qsRows || qsRows.length < 2) {
                sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            qsRows[1].click();
            sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'chkcount') {
            if (document.querySelector('#lblKrsl').textContent == 0) {
                sendResponse({command:'step', step, status:'waiting'});
                return;
            }
            document.querySelector('#iptRqsl').value = document.querySelector('#lblKrsl').textContent;
            document.querySelector('#btnConfirm').disabled = false;
            document.querySelector('#btnConfirm').click();
            sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'confirm') {
            var confirmAgain = document.querySelector('.btn_jh', '.btnts', '.cl', '.btn', '.btn-default-blue');
            if (!confirmAgain) {
                sendResponse({command:'step', step, status:'waiting'});
                return;
            } 

            confirmAgain.click();
            sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            sendResponse({command:'step', step, status, alert});
            return;
        }
    }
}

class TradeReactor extends CommandReactor {
    constructor(code, name, count, price) {
        super();
        this.code = code;
        this.name = name;
        this.count = count;
        this.price = price;
    }

    clickToSetPrice(sendResponse) {
        if (!document.querySelector('#datalist')) {
            sendResponse({command:'step', step:'stockinput', status:'waiting'});
            return false;
        }
        var aprices = document.querySelector('#datalist').querySelectorAll('a');
        if (!aprices || aprices.length < 1) {
            sendResponse({command:'step', step:'stockinput', status:'waiting'});
            return false;
        }
        var prAnchor = aprices[0];
        var fprice = 0;
        if (location.pathname.includes('Sale')) {
            prAnchor = aprices[aprices.length - 1];
            if (prAnchor.childNodes[1].textContent != '-' ) {
                prAnchor.click();
                return true;
            }
            fprice = document.querySelector('#dt').textContent;
        } else {
            if (prAnchor.childNodes[1].textContent != '-') {
                prAnchor.click();
                return true;
            }
            fprice = document.querySelector('#zt').textContent;
        }

        if (fprice != '-') {
            document.querySelector('#iptPrice').value = fprice;
            console.log('set price to top/bottom price', fprice);
            return true;
        }
        sendResponse({command:'step', step:'stockinput', status:'waiting', what: 'no valid price to set'});
        console.log('clickToSetPrice error: no valid price to click!');
        return false;
    }

    setCount(sendResponse) {
        if (this.count - 4 <= 0 && this.count - 1 >= 0) {
            var radId = ['', '#radall', '#radtwo', '#radstree', '#radfour'][this.count];
            if (!document.querySelector(radId)) {
                sendResponse({command:'step', step:'stockinput', status:'waiting'});
                return;
            } else {
                document.querySelector(radId).click();
                sendResponse({command:'step', step: 'stockinput', status:'done'});
                return;
            };
        }
        if (this.count - 100 < 0) {
            sendResponse({command:'step', step:'stockinput', status: 'error', what: 'countInvalid count = ' + this.count});
            return;
        }

        document.querySelector('#iptCount').value = this.count;
        sendResponse({command:'step', step: 'stockinput', status:'done'});
    }

    checkSubmitDisabled(sendResponse) {
        var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
        var errorText = document.querySelector('.cxc_bd', 'error');
        if (btnCxcConfirm && errorText) {
            btnCxcConfirm.click();
            console.log('error alert:', errorText.textContent);
            if (errorText && errorText.textContent == 'The Jylb field is required.') {
                document.querySelector('#delegateWay').childNodes[0].value = 'B';
                if (this.clickToSetPrice(sendResponse)) {
                    this.setCount(sendResponse);
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
                sendResponse({command:'step', step: 'chksubmit', status: 'error', what:'NoStockInfo'});
                return;
            }
        }

        if (document.querySelector('#lbMaxCount').textContent - this.count < 0) {
            sendResponse({command:'step', step: 'chksubmit', status:'waiting', what: 'maxCountInvalid maxCount = '+ document.querySelector('#lbMaxCount').textContent});
            return;
        } else {
            sendResponse({command:'step', step: 'chksubmit', status:'waiting', what: ''});
            return;
        }
    }

    onTaskMessage(sendResponse) {
        if (!document.querySelector('#stockCode')) {
            sendResponse({command:'step', step:'stockinput', status:'waiting'});
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
        } else if (!this.clickToSetPrice(sendResponse)) {
            return;
        }
        this.setCount(sendResponse);
    }

    onStepsMessage(step, sendResponse) {
        if (step == 'stockinput') {
            this.onTaskMessage(sendResponse);
            return;
        }

        if (step == 'chksubmit') {
            if (document.querySelector('#btnConfirm').disabled) {
                this.checkSubmitDisabled(sendResponse);
            } else {
                document.querySelector('#btnConfirm').click();
                sendResponse({command:'step', step, status:'done'});
            }
            return;
        }

        if (step == 'confirm') {
            var confirmAgain = document.querySelector('.btn_jh', '.btnts', '.cl', '.btn', '.btn-default-blue');
            if (!confirmAgain) {
                sendResponse({command:'step', step, status:'waiting'});
                return;
            } 

            confirmAgain.click();
            sendResponse({command:'step', step, status:'done'});
            return;
        }

        if (step == 'waitcomplete') {
            var status = 'waiting';
            var alert = '';
            if (document.querySelector('.cxc_bd', '.info')) {
                status = 'done';
                alert = document.querySelector('.cxc_bd', '.info').textContent;
            }
            sendResponse({command:'step', step, status, alert});
            return;
        }
    }
}

class EmjyFrontend {
    constructor() {
        this.loginPath = '/Login';
        this.jywgutils = null;
        this.log = null;
        this.pageLoaded = null;
        this.commandReactor = null;
    }

    Init(log) {
        this.jywgutils = new JywgUtils(log);
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
            var vkey = this.jywgutils.getValidateKey();
            if (vkey) {
                this.sendMessageToBackground({command:'emjy.getValidateKey', key: vkey});
            }
        } else if (message.command == 'emjy.getAssets') {
            this.commandReactor = new AssetsReactor();
            this.commandReactor.onTaskMessage(sendResponse);
        } else if (message.command == 'emjy.trade') {
            this.commandReactor = new TradeReactor(message.code, message.name, message.count, message.price);
            this.commandReactor.onTaskMessage(sendResponse);
        } else if (message.command == 'emjy.trade.bonds') {
            this.commandReactor = new BondRepurchaseReactor(message.code);
            this.commandReactor.onTaskMessage(sendResponse);
        } else if (message.command == 'emjy.trade.newbonds') {
            this.commandReactor = new NewStocksReactor();
            this.commandReactor.onTaskMessage(sendResponse);
        } else if (message.command == 'emjy.trade.newstocks') {
            this.commandReactor = new NewStocksReactor();
            this.commandReactor.onTaskMessage(sendResponse);
        } else if (message.command == 'emjy.step') {
            console.log(message);
            if (this.commandReactor) {
                this.commandReactor.onStepsMessage(message.step, sendResponse);
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

    checkError() {
        console.log('btnCxcConfirm checking');
        var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
        var errorText = document.querySelector('.cxc_bd', 'error');
        if (btnCxcConfirm && errorText) {
            this.jywgutils.onErrorMessageAlert(errorText);
            this.sendMessageToBackground({command:'emjy.contentErrorAlert', url: location.href, what: errorText.textContent});
            btnCxcConfirm.click();
        }
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
