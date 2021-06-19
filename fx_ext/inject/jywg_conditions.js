'use strict';
let EmjyFront = null;

class JywgUtils {
    constructor(log) {
        this.log = log;
    }

    getStocks() {
        var tableStocks = document.querySelector('#tabBody').childNodes;
        var stocks = [];

        for (var i = 0; i < tableStocks.length; ++i) {
            var rowCells = tableStocks[i].childNodes;
            if (rowCells.length == 11) {
                var stockInfo = {
                    code: rowCells[0].childNodes[0].textContent,
                    name: rowCells[1].childNodes[0].textContent,
                    holdCount: rowCells[2].childNodes[0].textContent,
                    availableCount: rowCells[3].childNodes[0].textContent,
                    market: rowCells[9].childNodes[0].textContent == '深圳A股' ? 'SZ' : "SH"
                };
                stocks.push(stockInfo);
            }
        }
        return stocks;
    }

    getAssetsCredit () {
        var assetsTableRows = document.getElementById('myAssets_main').childNodes[0].childNodes;
        
        return {
            totalAssets: assetsTableRows[0].childNodes[0].childNodes[1].textContent,
            availableMoney: assetsTableRows[0].childNodes[2].childNodes[1].textContent,
            pureAssets: assetsTableRows[1].childNodes[0].childNodes[1].textContent,
            availableCreditMoney: assetsTableRows[1].childNodes[2].childNodes[1].textContent,
            stocks: this.getStocks()
        };
    }

    getAssetsNor() {
        var assetsTableRows = document.getElementById('assest_cont').childNodes[0].childNodes[0].childNodes;
        
        return {
            pureAssets: assetsTableRows[0].childNodes[0].childNodes[1].textContent,
            availableMoney: assetsTableRows[1].childNodes[0].childNodes[1].textContent,
            stocks: this.getStocks()
        };
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

    clickBuy() {
        var btnConfirm = document.getElementById('btnConfirm');
        if (!location.href.includes('code=') && btnConfirm.disabled) {
            return;
        }

        var inputCode = document.getElementById('stockCode');
        inputCode.value = '002460';
        var inputName = document.getElementById('iptbdName');
        inputName.value = '赣锋锂业';
        var inputPrice = document.getElementById('iptPrice');
        inputPrice.value = '100.0';
        var inputCount = document.getElementById('iptCount');
        inputCount.value = '500';

        btnConfirm.click();
        var confirmAgain = document.getElementsByClassName('btn_jh btnts cl btn btn-default-blue')[0];
        confirmAgain.click();
    }
}

class EmjyFrontend {
    constructor() {
        this.loginPath = '/Login';
        this.normalAssetsPath = '/Search/Position';
        this.creditAssetsPath = '/MarginSearch/MyAssets';
        this.jywgutils = null;
        this.log = null;
    }

    Init(log) {
        this.jywgutils = new JywgUtils(log);
        this.log = log;
    }

    sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message);
    }

    getAssets(assetsPath) {
        this.log('getAssets', assetsPath, location.pathname);
        if (location.pathname != assetsPath) {
            location.pathname = assetsPath;
            return;
        }

        var assetsMsg = {};
        if (assetsPath == this.creditAssetsPath) {
            assetsMsg = this.jywgutils.getAssetsCredit(assetsPath);
        } else {
            assetsMsg = this.jywgutils.getAssetsNor(assetsPath);
        }

        if (assetsMsg) {
            assetsMsg.command = 'emjy.getAssets';
            assetsMsg.assetsPath = assetsPath;
        }
        return assetsMsg;
    }

    onLoginPageLoaded() {
        var btnConfirm = document.getElementsByClassName('btn-orange vbtn-confirm')[0];
        if (btnConfirm) {
            btnConfirm.click();
        }
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
        } else if (path == this.normalAssetsPath || path == this.creditAssetsPath) {
            var assetsMsg = this.getAssets(path);
            if (assetsMsg) {
                this.sendMessageToBackground(assetsMsg);
                this.log('sendMessageToBackground done');
            }
        }
        this.log('onPageLoaded', path);
    }

    onBackMessageReceived(message) {
        if (message.command == 'emjy.getValidateKey') {
            var vkey = this.jywgutils.getValidateKey();
            if (vkey) {
                this.sendMessageToBackground({command:'emjy.getValidateKey', key: vkey});
            }
        } else if (message.command == 'emjy.getAssets') {
            var assetsMsg = this.getAssets(message.assetsPath);
            if (assetsMsg) {
                this.sendMessageToBackground(assetsMsg);
                this.log('sendMessageToBackground done');
            }
        }
    }
}

function logInfo(...args) {
    console.log(args.join(' '));
}

function onMessage(message) {
    if (message.command.startsWith('emjy.')) {
        logInfo('recieve command', message.command);
        if (!EmjyFront) {
            EmjyFront = new EmjyFrontend();
            EmjyFront.Init(logInfo);
        }
        EmjyFront.onBackMessageReceived(message);
        logInfo('onBackMessageReceived called!');
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
        chrome.runtime.sendMessage({command:'emjy.contentLoaded', path: location.pathname, search: location.search});
        logInfo('sendMessage Done!');
    }

    setTimeout(function(){
        EmjyFront.onPageLoaded();
    }, 1000);
}

