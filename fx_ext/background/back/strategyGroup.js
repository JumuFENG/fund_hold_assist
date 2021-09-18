'use strict';

class GroupManager {
    create(group, code, skey) {
        if (group.grptype == 'GroupStandard') {
            return new StrategyGroup(group, code, skey);
        };
    }
}

class StrategyTransferConnection {
    constructor(conn) {
        this.conn = conn;
    }

    getTransferId() {
        return this.conn.transfer;
    }
}

class StrategyGroup {
    constructor(str, code, key) {
        this.storeKey = key;
        this.code = code;
        this.strategies = {};
        this.curId = str.curId;
        this.grptype = str.grptype;
        this.initStrategies(str.strategies);
        this.transfers = {};
        this.initTransfers(str.transfers);
    }

    enabled() {
        if (this.curId === undefined || this.curId == -1) {
            return false;
        };

        return this.strategies[this.curId].enabled();
    }

    initStrategies(strs) {
        for (var id in strs) {
            this.strategies[id] = strategyManager.create(strs[id]);
            if (this.curId === undefined && this.strategies[id].enabled()) {
                this.curId = id;
            };
        };
    }

    initTransfers(conn) {
        for (var id in conn) {
            this.transfers[id] = new StrategyTransferConnection(conn[id]);
        };
    }

    tostring() {
        var data = {grptype: this.grptype};
        if (this.curId && this.curId != -1) {
            data.curId = this.curId;
        };
        var strNum = 0;
        var strategies = {};
        for (var id in this.strategies) {
            strategies[id] = this.strategies[id].data;
            strNum++;
        };
        if (strNum > 0) {
            data.strategies = strategies;
        };
        var transfers = {};
        var connNum = 0;
        for (var id in this.transfers) {
            transfers[id] = this.transfers[id].conn;
            connNum++;
        };
        if (connNum > 0) {
            data.transfers = transfers;
        };
        return JSON.stringify(data);
    }

    save() {
        var data = {};
        data[this.storeKey] = this.tostring();
        chrome.storage.local.set(data);
    }

    setHoldCost(cost) {
        if (cost === undefined || cost <= 0) {
            return;
        };

        for (var id in this.strategies) {
            if (this.strategies[id].key() == 'StrategySellEL') {
                this.strategies[id].setHoldCost(cost);
            };
        };
    }

    setHoldCount(count) {
        if (count === undefined || count <= 0) {
            return;
        };

        for (var id in this.strategies) {
            var key = this.strategies[id].key();
            if (key == 'StrategySellMA' || key == 'StrategySellMAR' ) {
                this.strategies[id].setHoldCount(count);
            };
        };
    }

    applyGuardLevel() {
        if (!this.enabled()) {
            return;
        };

        var strategy = this.strategies[this.curId];
        var gl = strategy.guardLevel();
        if (gl == 'kline') {
            emjyBack.klineAlarms.addStock(this.code, strategy.kltype());
        } else if (gl == 'rtp') {
            emjyBack.rtpTimer.addStock(this.code);
        } else if (gl == 'zt') {
            emjyBack.ztBoardTimer.addStock(this.code);
        };
    }

    check(rtInfo) {
        var curStrategy = this.strategies[this.curId];
        if (curStrategy) {
            var checkResult = curStrategy.check(rtInfo);
            if (checkResult.match) {
                if (curStrategy.isBuyStrategy()) {
                    emjyBack.log('checkStrategies buy match', this.code, JSON.stringify(curStrategy));
                    emjyBack.tryBuyStock(this.code, rtInfo.name, checkResult.price, checkResult.count, checkResult.account);
                    if (curStrategy.guardLevel() == 'zt') {
                        emjyBack.ztBoardTimer.removeStock(rtInfo.code);
                    };
                } else {
                    emjyBack.log('checkStrategies sell match', this.code, JSON.stringify(curStrategy));
                    emjyBack.trySellStock(this.code, checkResult.price, checkResult.count, checkResult.account);
                };
                this.onTradeMatch({price: checkResult.price});
                // if (curStrategy.isBuyStrategy()) {
                //     this.onBuyMatch(checkResult.price);
                // } else {
                //     this.onSellMatch(checkResult.price);
                // };
            } else if (checkResult.stepInCritical) {
                emjyBack.checkAvailableMoney(rtInfo.latestPrice, checkResult.account);
            }
        };
    }

    onTradeMatch(refer) {
        this.strategies[this.curId].setEnabled(false);
        if (this.strategies[this.curId].guardLevel() == 'kline') {
            refer.kltype = this.strategies[this.curId].kltype();
        };
        this.curId = this.transfers[this.curId].getTransferId();
        if (this.curId != -1) {
            //this.strategies[this.curId].buyMatch(refer);
            this.strategies[this.curId].setEnabled(true);
            this.applyGuardLevel();
        };
    }

    onBuyMatch(refer) {
        if (this.strategies[this.curId].isBuyStrategy()) {
            var strategies = {};
            for (var id in this.strategies) {
                if (id == this.curId) {
                    continue;
                };
                strategies[id] = this.strategies[id];
            };
            this.strategies = strategies;
        };
        this.curId = -1;
        for (var id in this.strategies) {
            if (!this.strategies[id].isBuyStrategy()) {
                this.curId = id;
                break;
            };
        };
        if (this.curId != -1) {
            this.strategies[this.curId].buyMatch(refer);
            this.applyGuardLevel();
        };
    }

    onSellMatch(refer) {
        if (!this.strategies[this.curId].isBuyStrategy()) {
            var strategies = {};
            for (var id in this.strategies) {
                if (id == this.curId) {
                    continue;
                };
                strategies[id] = this.strategies[id];
            };
            this.strategies = strategies;
        };
        this.curId = -1;
        for (var id in this.strategies) {
            if (this.strategies[id].isBuyStrategy()) {
                this.curId = id;
                break;
            };
        };
        if (this.curId != -1) {
            this.strategies[this.curId].sellMatch(refer);
            this.applyGuardLevel();
        };
    }
}

let strategyGroupManager = new GroupManager();
