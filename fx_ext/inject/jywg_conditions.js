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
            // document.querySelector('#btnCxcConfirm').click();
        }, 200);
    }

    tradeBondRepurchase(code, command, sendResponse) {
        if (location.pathname != BondRepurchasePath) {
            var url = new URL(location.href);
            url.pathname = BondRepurchasePath;
            url.search='';
            EmjyFront.sendMessageToBackground({command:'emjy.trade', result: 'error', reason: 'pageNotLoaded', expected: url.href});
            location.href = url;
            return;
        };
        if (sendResponse) {
            sendResponse({command, status: 'success', result:'unknown'});
        };
        document.querySelector('#iptZqdm').value = code;
        document.querySelector('#iptZqdm').click();
        var quickSaleInterval = setInterval(() => {
            var quickSale = document.querySelector('#quickSale');
            if (!quickSale) {
                return;
            };
            quickSale.childNodes[0].childNodes[1].childNodes[0].click();
            clearInterval(quickSaleInterval);
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
        }, 300);
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

    tradeNewStockBuy(command, sendResponse) {
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
                console.log('maxCountInvalid', sendResponse);
                sendResponse({command, status: 'success', result: 'error', reason: 'maxCountInvalid', what: 'no new stocks to buy.'});
            };
        };
    }

    tradeNewBondsBuy(command, sendResponse) {
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
        if (sendResponse) {
            sendResponse({command, status: 'success', result:'unknown'});
        };
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

    onBackMessageReceived(message, sender, sendResponse) {
        if (message.command == 'emjy.navigate') {
            location.href = message.url;
        } else if (message.command == 'emjy.getValidateKey') {
            var vkey = this.jywgutils.getValidateKey();
            if (vkey) {
                this.sendMessageToBackground({command:'emjy.getValidateKey', key: vkey});
            }
        } else if (message.command == 'emjy.getAssets') {
            this.getAssets(message.path, sendResponse);
        } else if (message.command == 'emjy.trade') {
            this.stockTrade(message, sendResponse);
        } else if (message.command == 'emjy.trade.bonds') {
            this.jywgutils.tradeBondRepurchase(message.code, message.command, sendResponse);
        } else if (message.command == 'emjy.trade.newbonds') {
            this.jywgutils.tradeNewBondsBuy(message.command, sendResponse);
        } else if (message.command == 'emjy.trade.newstocks') {
            this.jywgutils.tradeNewStockBuy(message.command, sendResponse);
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

    getAssets(assetsPath, sendResponse) {
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
            assetsMsg.status = 'success';
            assetsMsg.result = 'success';
            if (sendResponse) {
                sendResponse(assetsMsg);
            };
        }
    }

    stockTrade(message, sendResponse) {
        this.log('stockTrade', JSON.stringify(message));
        var stockName = message.stock.name;
        if (stockName === undefined) {
            stockName = '';
        }
        this.jywgutils.clickTrade(message.path, message.stock.code, stockName, message.price, message.count, sendResponse);
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
            EmjyFront.onBackMessageReceived(message, sender, sendResponse);
        } else {
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
