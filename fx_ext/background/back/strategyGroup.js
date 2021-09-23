'use strict';

class GroupManager {
    create(group, account, code, skey) {
        if (group.grptype == 'GroupStandard') {
            return new StrategyGroup(group, account, code, skey);
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
    constructor(str, account, code, key) {
        this.storeKey = key;
        this.account = account;
        this.code = code;
        this.strategies = {};
        this.grptype = str.grptype;
        this.initStrategies(str.strategies);
        this.transfers = {};
        this.initTransfers(str.transfers);
    }

    enabled() {
        for (var i in this.strategies) {
            if (this.strategies[i].enabled()) {
                return true;
            };
        };
        return false;
    }

    initStrategies(strs) {
        for (var id in strs) {
            this.strategies[id] = strategyManager.create(strs[id]);
        };
    }

    initTransfers(conn) {
        for (var id in conn) {
            this.transfers[id] = new StrategyTransferConnection(conn[id]);
        };
    }

    tostring() {
        var data = {grptype: this.grptype};
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
            if (this.strategies[id].key() == 'StrategySellEL' || this.strategies[id].key() == 'StrategySellMAD') {
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
        for (var id in this.strategies) {
            if (!this.strategies[id].enabled()) {
                continue;
            };
            var gl = this.strategies[id].guardLevel();
            if (gl == 'kline') {
                emjyBack.klineAlarms.addStock(this.code);
            } else if (gl == 'rtp') {
                emjyBack.rtpTimer.addStock(this.code);
            } else if (gl == 'zt') {
                emjyBack.ztBoardTimer.addStock(this.code);
            };
        };
    }

    check(rtInfo) {
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled()) {
                continue;
            };
            var checkResult = curStrategy.check(rtInfo);
            if (checkResult.match) {
                if (curStrategy.isBuyStrategy()) {
                    emjyBack.log('checkStrategies buy match', this.code, rtInfo.name, JSON.stringify(curStrategy));
                    emjyBack.tryBuyStock(this.code, rtInfo.name, checkResult.price, checkResult.count, checkResult.account === undefined ? this.account : checkResult.account);
                    if (curStrategy.guardLevel() == 'zt') {
                        emjyBack.ztBoardTimer.removeStock(rtInfo.code);
                    };
                } else {
                    emjyBack.log('checkStrategies sell match', this.code, rtInfo.name, JSON.stringify(curStrategy));
                    emjyBack.trySellStock(this.code, checkResult.price, checkResult.count, this.account);
                };
                this.onTradeMatch(id, {price: checkResult.price});
            } else if (checkResult.stepInCritical) {
                emjyBack.checkAvailableMoney(rtInfo.latestPrice, checkResult.account);
            };
        };
    }

    onTradeMatch(id, refer) {
        this.strategies[id].setEnabled(false);
        var curStrategy = this.strategies[id];
        if (curStrategy.guardLevel() == 'kline') {
            refer.kltype = curStrategy.kltype();
        };
        if (!this.transfers || !this.transfers[id]) {
            return;
        };
        var tid = this.transfers[id].getTransferId();
        if (tid != -1) {
            this.strategies[tid].setEnabled(true);
            if (curStrategy.isBuyStrategy()) {
                this.strategies[tid].buyMatch(refer);
            } else {
                this.strategies[tid].sellMatch(refer);
            };
            this.applyGuardLevel();
        };
    }

    checkKlines(klines, updatedKlt) {
        var critical = false;
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled()) {
                continue;
            };
            curStrategy.checkKlines(klines, updatedKlt);
            critical |= curStrategy.inCritical();
        };
        if (critical) {
            emjyBack.fetchStockSnapshot(this.code);
        };
    }
}

let strategyGroupManager = new GroupManager();
