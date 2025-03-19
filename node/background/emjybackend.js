const logger = require('./logger.js');
const {NormalAccount, CreditAccount, CollateralAccount} = require('./accounts.js');


class emjyBack {
    static log(...args) {
        logger.info(...args);
    }

    static Init() {
        this.running = true;
        this.normalAccount = new NormalAccount();
        this.collateralAccount = new CollateralAccount();
        this.creditAccount = new CreditAccount();
        this.all_accounts = {};
        this.all_accounts[this.normalAccount.keyword] = this.normalAccount;
        this.all_accounts[this.collateralAccount.keyword] = this.collateralAccount;
        this.all_accounts[this.creditAccount.keyword] = this.creditAccount;
        this.initTrackAccounts();
    }

    static loadAssets() {
        this.normalAccount.loadAssets();
        this.collateralAccount.loadAssets();
    }

    static refreshAssets() {
        if (this.normalAccount.stocks.length > 0) {
            this.normalAccount.save();
        };
        if (this.collateralAccount.stocks.length > 0) {
            this.collateralAccount.save();
        };

        this.loadAssets();
    }

    static loadDeals() {
        this.normalAccount.loadDeals();
        this.collateralAccount.loadDeals();
    }

    updateHistDeals() {
    }

    tradeClosed() {
        
        this.running = false;
    }
};


if (typeof module !== 'undefined' && module.exports) {
    module.exports = emjyBack;
}
