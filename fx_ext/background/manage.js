'use strict';

function logInfo(...args) {
    console.log(args.join(' '));
}

class Manager {
    constructor(log) {
        this.log = log;
    }

    sendExtensionMessage(message) {
        chrome.runtime.sendMessage(message);
    }

    handleExtensionMessage(message) {
        if (message.command == 'mngr.stocks') {
            this.loadStocks(JSON.parse(message.stocks));
        }
    }

    loadStocks(stocks) {
        //this.log(JSON.stringify(stocks));
        for (var i = 0; i < stocks.length; i++) {
            var t = document.createElement('div');
            t.textContent = (stocks[i].code + ' ' + stocks[i].name + ' ' + stocks[i].latestPrice);
            document.body.appendChild(t);
        };
    }
}

window.onunload = function() {
    emjyManager.sendExtensionMessage({command: 'mngr.closed'});
}

function onExtensionBackMessage(message) {
    if (message.command.startsWith('mngr.')) {
        emjyManager.handleExtensionMessage(message);
    }
}

chrome.runtime.onMessage.addListener(onExtensionBackMessage);

let emjyManager = new Manager();
emjyManager.sendExtensionMessage({command: 'mngr.init'});
