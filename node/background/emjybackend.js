const {logger} = xreq('./background/nbase.js');
const {NormalAccount, CreditAccount, CollateralAccount} = xreq('./background/accounts.js');
const {TrackingAccount} = xreq('./background/trackAccount.js');

const emjyBack = {
    validateKey: null,
    log(...args) {
        var l = args.join(' ');
        logger.info(l);
    },
    Init() {
        this.running = true;
        this.normalAccount = new NormalAccount();
        this.collateralAccount = new CollateralAccount();
        this.creditAccount = new CreditAccount();
        this.all_accounts = {};
        this.all_accounts[this.normalAccount.keyword] = this.normalAccount;
        this.all_accounts[this.collateralAccount.keyword] = this.collateralAccount;
        this.all_accounts[this.creditAccount.keyword] = this.creditAccount;
    },
    initTrackAccounts() {
        this.track_accounts = [];
        for (let ac of ['track_3b']) {
            this.track_accounts.push(new TrackingAccount(ac));
        }
        for (const account of this.track_accounts) {
            this.all_accounts[account.keyword] = account;
            account.loadWatchings();
        }
    },
    loadAssets() {
        this.normalAccount.loadAssets();
        this.collateralAccount.loadAssets();
    },
    updateHistDeals() {

    },
    doUpdateHistDeals(date) {
        this.normalAccount.loadHistDeals(date);
        this.collateralAccount.loadHistDeals(date);
    },
    loadOtherDeals(date) {
        this.normalAccount.loadOtherDeals(date);
        this.collateralAccount.loadOtherDeals(date);
    },
    refreshAssets() {
        if (this.normalAccount.stocks.length > 0) {
            this.normalAccount.save();
        };
        if (this.collateralAccount.stocks.length > 0) {
            this.collateralAccount.save();
        };

        this.loadAssets();
    },
    loadDeals() {
        this.normalAccount.loadDeals();
        this.collateralAccount.loadDeals();
    },
    updateHistDeals() {
    },
    testFhaServer() {
        var url = this.fha.server + 'stock?act=test';
        var headers = {}
        if (this.fha) {
            headers['Authorization'] = 'Basic ' + btoa(this.fha.uemail + ":" + this.fha.pwd);
        }
        return fetch(url, {headers}).then(r=>r.text());
    },
    checkRzrq(code) {
        if (!this.creditAccount) {
            return Promise.resolve();
        }
        if (!this.creditAccount.tradeClient) {
            this.creditAccount.createTradeClient();
        }
        return this.creditAccount.tradeClient.checkRzrqTarget(code);
    },
    trySellStock(code, price, count, account, cb) {
        if (!this.all_accounts[account]) {
            this.log('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].sellStock(code, price, count).then(sd => {
            var holdacc = this.all_accounts[account].holdAccount();
            var stk = this.all_accounts[holdacc].getStock(code);
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[holdacc].applyStrategy(code, {grptype: 'GroupStandard', strategies: {'0': {key: 'StrategySellELS', enabled: false, cutselltype: 'all', selltype: 'all'}}, transfers: {'0': {transfer: '-1'}}, amount: '5000'});
                }
                if (sd) {
                    stk.strategies.buydetail.addSellDetail(sd);
                }
            }
            return sd;
        });
    },
    tryBuyStock(code, price, count, account) {
        if (!this.all_accounts[account]) {
            this.log('Error, no valid account', account);
            return Promise.resolve();
        }

        return this.all_accounts[account].buyStock(code, price, count).then(bd => {
            var holdacc = this.all_accounts[account].holdAccount();
            var stk = this.all_accounts[holdacc].getStock(code);
            var strgrp = {};
            if (!stk) {
                this.all_accounts[holdacc].addWatchStock(code, strgrp);
                stk = this.all_accounts[holdacc].getStock(code);
            }
            if (stk) {
                if (!stk.strategies) {
                    this.all_accounts[holdacc].addStockStrategy(stk, strgrp);
                }
                stk.strategies.buydetail.addBuyDetail(bd);
            }
            return bd;
        });
    },
    buyWithAccount(code, price, count, account, strategies) {
        var holdacc = this.all_accounts[account].holdAccount();
        if (strategies) {
            this.all_accounts[holdacc].addWatchStock(code, strategies);
        }
        if (!count) {
            var stk = this.all_accounts[holdacc].getStock(code);
            if (stk) {
                count = stk.strategies.getBuyCount(price);
            }
            if (count * price - this.all_accounts[account].availableMoney > 0) {
                count = guang.calcBuyCount(this.all_accounts[account].availableMoney, price);
            }
        }
        return this.tryBuyStock(code, price, count, account);
    },
    tradeBeforeClose() {
        this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
    },
    removeStock(account, code) {
        this.all_accounts[account].removeStock(code);
    },
    tradeClosed() {
        logger.info(emjyBack.normalAccount.orderfeched);
        logger.info(emjyBack.collateralAccount.orderfeched);
        this.track_accounts.forEach(acc => {
            logger.info(acc.deals);
        });
        this.running = false;
    },
    saveToFile(blob, filename, conflictAction = 'overwrite') {
    },
    getFromLocal(key) {
        return Promise.resolve();
    },
    saveToLocal(data) {
    },
    removeLocal(key) {
    }
};


if (typeof module !== 'undefined' && module.exports) {
    global.emjyBack = emjyBack;
    module.exports = {emjyBack};
}
