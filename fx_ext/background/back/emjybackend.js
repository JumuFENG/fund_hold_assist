'use strict';


window.emjyBack = {
    fha: null,
    log(...args) {
        logger.log(...args);
    },
    Init() {
        this.running = true;
        svrd.getFromLocal('hsj_stocks').then(hsj => {
            if (hsj) {
                feng.loadSaved(hsj);
            }
            this.normalAccount.loadWatchings();
            this.collateralAccount.loadWatchings();
        });
        svrd.getFromLocal('purchase_new_stocks').then(pns => {
            if (!alarmHub.config) {
                alarmHub.config = {}
            }
            alarmHub.config.purchaseNewStocks = pns;
        });
        if (emjyBack.fha.save_on_server) {
            const url = emjyBack.fha.server + 'stock?act=costdog';
            fetch(url, {headers: accinfo.fha.headers}).then(r=>r.json()).then(cd => {
                this.costDog = new CostDog(cd);
            });
        } else {
            svrd.getFromLocal('cost_dog').then(cd => {
                this.costDog = new CostDog(cd);
            });
        }
        this.log('EmjyBack initialized!');
    },
    totalAssets() {
        return this.normalAccount.pureAssets + this.collateralAccount.pureAssets;
    },
    loadAssets() {
        this.normalAccount.loadAssets();
        this.collateralAccount.loadAssets();
    },
    loadDeals() {
        this.normalAccount.loadDeals();
        this.collateralAccount.loadDeals();
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
    testTradeApi(code) {
        if (!code) {
            code = '601398';
        }
        feng.getStockSnapshot(code).then(snap => {
            this.tryBuyStock(code, snap.bottomprice, guang.calcBuyCount(1000, snap.bottomprice), 'normal').then(bd => {
                if (bd) {
                    console.log('tade test with deal', bd);
                }
            }).catch(err => {
                console.log('test trade failed', err)
            });
        });
    },
    isTradeTime() {
        var now = new Date();
        if (now > new Date(now.toDateString() + ' 9:30') && now < new Date(now.toDateString() + ' 15:00')) {
            return true;
        }
        return false;
    },
    tradeBeforeClose() {
        this.normalAccount.buyFundBeforeClose();
        this.collateralAccount.buyFundBeforeClose();
    },
    tradeClosed() {
        this.normalAccount.buyFundBeforeClose();
        for (const acc of Object.values(this.all_accounts)) {
            acc.loadDeals();
        }
        this.normalAccount.fillupGuardPrices();
        this.collateralAccount.fillupGuardPrices();
        for (const account of this.track_accounts) {
            account.fillupGuardPrices();
        }

        const allstks = Object.values(emjyBack.all_accounts).map(a => a.stocks.map(x=>x.code)).flat();
        let holdcached = feng.dumpCached(allstks);
        this.saveToLocal({'hsj_stocks': holdcached});

        const prm = Object.values(emjyBack.all_accounts).map(acc=>acc.stocks.filter(s=>s.strategies).map(s=>s.strategies.updateKlines())).flat();

        Promise.all(prm).then(()=>{
            this.normalAccount.save();
            this.collateralAccount.save();
            this.track_accounts.forEach(acc => {acc.save()});
            if (this.costDog) {
                this.costDog.save();
            }
            Object.values(this.klines).forEach(kl => kl.save());
            this.flushLogs();
            this.running = false;
        });
    },
    flushLogs() {
        this.log('flush log!');
        if (logger.logs && logger.logs.length > 0) {
            var blob = new Blob(logger.logs, {type: 'application/text'});
            this.saveToFile(blob, 'logs/stock.assist' + guang.getTodayDate() + '.log');
            logger.logs = [];
        }
    }
}
