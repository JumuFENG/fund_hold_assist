'use strict';
let EmjyFront = null;
let BondRepurchasePath = '/BondRepurchase/SecuritiesLendingRepurchase';
let NewStockPurchasePath = '/Trade/NewBatBuy';
let NewBondsPurchasePath = '/Trade/XzsgBatPurchase';

class JywgUtils {
    constructor(log) {
        this.log = log;
        this.retry = 0;
    }

    getStocks() {
        var stocks = [];

        var tableStocks = document.querySelector('#tabBody').querySelectorAll('tr');
        for (var i = 0; i < tableStocks.length; ++i) {
            var rowCells = tableStocks[i].querySelectorAll('td');
            if (rowCells.length == 11) {
                var stockInfo = {
                    code: rowCells[0].textContent,
                    name: rowCells[1].textContent,
                    holdCount: rowCells[2].textContent,
                    availableCount: rowCells[3].textContent,
                    holdCost: rowCells[4].textContent,
                    market: rowCells[9].textContent == '深圳A股' ? 'SZ' : "SH"
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
            document.querySelector('#btnCxcConfirm').click();
        }, 200);
    }

    tradeBondRepurchase(code) {
        if (location.pathname != BondRepurchasePath) {
            var url = new URL(location.href);
            url.pathname = BondRepurchasePath;
            url.search='';
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        };
        document.querySelector('#iptZqdm').value = code;
        document.querySelector('#iptZqdm').click();
        setTimeout(() => {
            document.querySelector('#quickSale').childNodes[0].childNodes[1].childNodes[0].click();
            setTimeout(() => {
                if (document.querySelector('#lblKrsl').textContent == 0) {
                    this.log('可融数量: 0');
                    EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'maxCountInvalid'});
                    return;
                };
                document.querySelector('#iptRqsl').value = document.querySelector('#lblKrsl').textContent;
                document.querySelector('#btnConfirm').disabled = false;
                document.querySelector('#btnConfirm').click();
                this.clickConfirmAgainBtn();
            }, 1000);
        }, 1000);
    }

    clickTrade(path, code, name, price, count) {
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
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'maxCountInvalid', what: 'maxCount = ' + document.querySelector('#lbMaxCount').textContent + ', count = ' + count});
            return;
        };
        if (count <= 4 && count >= 1) {
            var radId = ['', '#radall', '#radtwo', '#radstree', '#radfour'][count];
            var iptRad = document.querySelector(radId);
            if (!iptRad.checked) {
                document.querySelector(radId).click();
            };
        } else if (count < 100) {
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'countInvalid', what: 'count = ' + count});
            return;
        } else {
            document.querySelector('#iptCount').value = count;
        }

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

    tradeNewStockBuy() {
        if (location.pathname != NewStockPurchasePath) {
            var url = new URL(location.href);
            url.pathname = NewStockPurchasePath;
            url.search='';
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        }

        var seletedCount = 0;
        document.querySelector('#tableBody').querySelectorAll('tr').forEach(r => {
            var code = r.querySelectorAll('td')[2].textContent;
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
        } else {
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'maxCountInvalid', what: 'no new stocks to buy.'});
        };
    }

    tradeNewBondsBuy() {
        if (location.pathname != NewBondsPurchasePath) {
            var url = new URL(location.href);
            url.pathname = NewBondsPurchasePath;
            url.search='';
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        };
        document.querySelector('#chk_all').click();
        this.newStockBondBatBuy();
    }
}

class EmjyFrontend {
    constructor() {
        this.loginPath = '/Login';
        this.normalAssetsPath = '/Search/Position';
        this.creditAssetsPath = '/MarginSearch/MyAssets';
        this.jywgutils = null;
        this.log = null;
        this.pageLoaded = null;
    }

    Init(log) {
        this.jywgutils = new JywgUtils(log);
        this.pageLoaded = false;
        this.log = log;
    }

    sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message);
    }

    onBackMessageReceived(message) {
        if (message.command == 'emjy.navigate') {
            location.href = message.url;
        } else if (message.command == 'emjy.getValidateKey') {
            var vkey = this.jywgutils.getValidateKey();
            if (vkey) {
                this.sendMessageToBackground({command:'emjy.getValidateKey', key: vkey});
            }
        } else if (message.command == 'emjy.getAssets') {
            this.getAssets(message.assetsPath);
        } else if (message.command == 'emjy.trade') {
            this.stockTrade(message);
        } else if (message.command == 'emjy.trade.bonds') {
            this.jywgutils.tradeBondRepurchase(message.code);
        } else if (message.command == 'emjy.trade.newbonds') {
            this.jywgutils.tradeNewBondsBuy();
        } else if (message.command == 'emjy.trade.newstocks') {
            this.jywgutils.tradeNewStockBuy();
        };
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
        // } else if (path == this.normalAssetsPath || path == this.creditAssetsPath) {
        //     var assetsMsg = this.getAssets(path);
        //     if (assetsMsg) {
        //         this.sendMessageToBackground(assetsMsg);
        //         this.log('sendMessageToBackground done');
        //     }
        }
        var btnCxcConfirm = document.querySelector('#btnCxcConfirm');
        if (btnCxcConfirm) {
            btnCxcConfirm.click();
        };

        this.pageLoaded = true;
        this.sendMessageToBackground({command:'emjy.contentLoaded', url: location.href});
        this.log('onPageLoaded', path);
    }

    getAssets(assetsPath) {
        this.log('getAssets', assetsPath, location.pathname);
        if (location.pathname != assetsPath) {
            var url = new URL(location.href);
            url.pathname = assetsPath;
            url.search='';
            this.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        };

        var assetsMsg = {};
        if (assetsPath == this.creditAssetsPath) {
            assetsMsg = this.jywgutils.getAssetsCredit();
        } else {
            assetsMsg = this.jywgutils.getAssetsNor();
        }

        if (assetsMsg) {
            assetsMsg.command = 'emjy.getAssets';
            assetsMsg.assetsPath = assetsPath;
            this.sendMessageToBackground(assetsMsg);
        }
    }

    stockTrade(message) {
        this.log('stockTrade', JSON.stringify(message));
        var stockName = message.stock.name;
        if (stockName === undefined) {
            stockName = '';
        }
        this.jywgutils.clickTrade(message.tradePath, message.stock.code, stockName, message.price, message.count);
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
        if (EmjyFront.pageLoaded) {
            EmjyFront.onBackMessageReceived(message);
        } else {
            setTimeout(EmjyFront.onBackMessageReceived(message), 1100);
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

    setTimeout(function(){
        EmjyFront.onPageLoaded();
    }, 1000);

    var now = new Date();
    if (now.getHours() <= 12) {
        setTimeout(function() {
            location.reload();
        }, 175 * 60 * 1000);  // less than 3 hrs
    };
}
