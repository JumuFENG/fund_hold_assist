'use strict';

class GlobalManager {
    constructor() {
        this.klines = {};
    }

    log(...args) {
        var dt = new Date();
        var l = '[' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds()  + '] ' +  args.join(' ');
        console.log(l);
    }

    saveToLocal(data) {
        console.log('GlobalManager.saveToLocal');
    }

    getFromLocal(key, cb) {
        console.log('chrome.storage.local.get(data);');
        if (typeof(cb) === 'function') {
            cb();
        }
    }

    saveToLocal(data) {
        console.log('chrome.storage.local.set();');
    }

    removeLocal(key) {
        console.log('chrome.storage.local.remove(', key, ');');
    }

    applyGuardLevel(strgrp, allklt) {
        console.log('GlobalManager.applyGuardLevel();');
    }

    loadKlines(code) {

    }

    setupRetroAccount() {
        this.testAccount = new TestingAccount();
        this.testAccount.loadAssets();
    }

    trySellStock(code, price, count, account, cb) {
        var sellAccount = this.normalAccount;
        if (account) {
            // if (account == this.trackAccount.keyword) {
            //     sellAccount = this.trackAccount;
            // } else 
            if (this.testAccount && account == this.testAccount.keyword) {
                sellAccount = this.testAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        sellAccount.sellStock(code, price, count, cb);
    }

    tryBuyStock(code, price, count, account, cb) {
        var buyAccount = this.normalAccount;
        if (account) {
            // if (account == this.trackAccount.keyword) {
            //     buyAccount = this.trackAccount;
            // } else 
            if (this.testAccount && account == this.testAccount.keyword) {
                buyAccount = this.testAccount;
            } else {
                console.log('Error, no valid account', account);
                return;
            }
        };

        buyAccount.buyStock(code, price, count, cb);
    }
}

var emjyBack = new GlobalManager();
