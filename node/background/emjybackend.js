class emjyBack {
    static log(...args) {
        this.logger.info(args.join(' '));
    }

    static Init(logger) {
        this.logger = logger;
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


if (typeof window !== 'undefined') {
    window.emjyBack = emjyBack;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = emjyBack;
}
