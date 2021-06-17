'use strict';
let EmjyFront = null;

class JywgUtils {
    constructor() {
        this.totalAssets = 0.0
        this.availableMoney = 0.0;
        this.pureAssets = 0.0;
        this.availableCreditMoney = 0.0;
    }

    getAssetsCredit () {
        var assetsPath = '/MarginSearch/MyAssets';
        if (location.pathname != assetsPath)
        {
            location.pathname = assetsPath;
            return;
        }
        alert('getAssetsCredit');
        var assetsTableRows = document.getElementById('myAssets_main').childNodes[0].childNodes;
        this.totalAssets += float(assetsTableRows[0].childNodes[0].childNodes[1].textContent);
        this.availableMoney += float(assetsTableRows[0].childNodes[2].childNodes[1].textContent);
        this.pureAssets += float(assetsTableRows[1].childNodes[0].childNodes[1].textContent);
        this.availableCreditMoney += float(assetsTableRows[1].childNodes[2].childNodes[1].textContent);
    }

    getAssetsNor() {
        var assetsPath = '/Search/Position';
        if (location.pathname != assetsPath) {
            location.pathname = assetsPath;
            return;
        }

        alert('getAssetsNor');
        var assetsTableRows = document.getElementById('assest_cont').childNodes[0].childNodes[0].childNodes;
        this.pureAssets += float(assetsTableRows[0].childNodes[0].childNodes[1].textContent);
        this.availableMoney = float(assetsTableRows[1].childNodes[0].childNodes[1].textContent);
    }

    getAssets() {
        this.totalAssets = 0.0
        this.availableMoney = 0.0;
        this.pureAssets = 0.0;
        this.availableCreditMoney = 0.0;
        getAssetsCredit();
        getAssetsNor();
        alert("totalAssets = " + this.totalAssets + " pureAssets = " + this.pureAssets + " availableMoney = " + this.availableMoney + " availableCreditMoney = " + this.availableCreditMoney);
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
        this.jywgutils = null;
    }

    Init() {
        this.jywgutils = new JywgUtils();
    }

    onBackMessageReceived(message) {
        if (message.command == 'emjy.getValidateKey') {
            var vkey = this.jywgutils.getValidateKey();
            if (vkey) {
                chrome.runtime.sendMessage({command:'emjy.getValidateKey', key: vkey});
            }
        };
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
            EmjyFront.Init();
        }
        EmjyFront.onBackMessageReceived(message);
        logInfo('onBackMessageReceived called!');
    } else {
        logInfo("command not recognized.");
    }
}

if (location.host == 'jywg.18.cn') {
    // console.log('sendMessage to background');
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.runtime.sendMessage({command:'emjy.contentLoaded', path: location.pathname, search: location.search});
    logInfo('sendMessage Done!');
    // var jywgutils = new JywgUtils();
    // var vkey = jywgutils.clickBuy();
}

