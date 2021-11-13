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
        if (str.count0) {
            this.count0 = str.count0;
        }
        if (str.amount) {
            this.amount = str.amount;
        }
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
        if (this.buydetail && this.buydetail.length > 0) {
            data.buydetail = this.buydetail;
        }
        if (this.count0 !== undefined) {
            data.count0 = this.count0;
        }
        if (this.amount !== undefined) {
            data.amount = this.amount;
        }
        return JSON.stringify(data);
    }

    save() {
        var data = {};
        data[this.storeKey] = this.tostring();
        chrome.storage.local.set(data);
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + '-' + ('' + (now.getMonth()+1)).padStart(2, '0') + '-' + ('' + now.getDate()).padStart(2, '0');
    }

    setHoldCost(cost) {
        if (cost === undefined || cost <= 0) {
            return;
        };

        for (var id in this.strategies) {
            var key = this.strategies[id].key();
            if (key == 'StrategySellEL' || key == 'StrategySellMAD' || key == 'StrategySellELS') {
                this.strategies[id].setHoldCost(cost);
            };
        };
    }

    totalCount() {
        if (!this.buydetail) {
            return 0;
        }
        var count = 0;
        for (var i = 0; i < this.buydetail.length; i++) {
            count += this.buydetail[i].count;
        }
        return count;
    }

    availableCount() {
        if (!this.buydetail) {
            return 0;
        }
        var td = this.getTodayDate();
        var count = 0;
        for (var i = 0; i < this.buydetail.length; i++) {
            if (this.buydetail[i].date < td) {
                count += this.buydetail[i].count;
            }
        }
        return count;
    }

    sellDetail(count) {
        if (!this.buydetail) {
            return;
        }
        var td = this.getTodayDate();
        var soldCount = count;
        for (var i = 0; i < this.buydetail.length && soldCount > 0; i++) {
            if (this.buydetail[i].count - soldCount <= 0) {
                this.buydetail[i].count = 0;
                soldCount -= this.buydetail[i].count;
            } else {
                this.buydetail[i].count -= soldCount;
                soldCount = 0;
            }
        }
        var ndetail = [];
        for (var i = 0; i < this.buydetail.length; i++) {
            if (this.buydetail[i].count > 0) {
                ndetail.push(this.buydetail[i]);
            }
        }
        this.buydetail = ndetail;
    }

    setHoldCount(count, acount) {
        if (count === undefined || count <= 0) {
            return;
        };

        if (!this.buydetail || this.totalCount() != count || this.availableCount() != acount) {
            this.buydetail = [];
            if (count == acount) {
                this.buydetail.push({date: '0', count});
            } else {
                this.buydetail.push({date: '0', count: acount});
                this.buydetail.push({date: this.getTodayDate(), count: count - acount});
            }
        }
    }

    applyGuardLevel() {
        for (var id in this.strategies) {
            if (!this.strategies[id].enabled()) {
                continue;
            };
            var gl = this.strategies[id].guardLevel();
            if (gl == 'kline') {
                emjyBack.klineAlarms.addStock(this.code, this.strategies[id].kltype());
            } else if (gl == 'kday') {
                emjyBack.dailyAlarm.addStock(this.code, this.strategies[id].kltype());
            } else if (gl == 'otp') {
                emjyBack.otpAlarm.addStock(this.code);
            } else if (gl == 'rtp') {
                emjyBack.rtpTimer.addStock(this.code);
            } else if (gl == 'zt') {
                emjyBack.ztBoardTimer.addStock(this.code);
            } else if (gl == 'kzt') {
                emjyBack.rtpTimer.addStock(this.code);
                emjyBack.klineAlarms.addStock(this.code);
            };
        };
    }

    applyKlines(klines) {
        if (!klines) {
            return;
        }

        if (!this.strategies[0] || !this.strategies[3]) {
            return;
        }

        var key = this.strategies[3].key();
        if (this.strategies[0].key() == 'StrategyBuy' || this.strategies[0].key() == 'StrategyBuyZTBoard') {
            var elIdx = this.strategies[0].key() == 'StrategyBuy' ? 3 : 1;
            if (key == 'StrategySellEL' || key == 'StrategySellELS') {
                if (this.strategies[elIdx].data.guardPrice !== undefined && this.strategies[elIdx].data.guardPrice != null) {
                    return;
                }
                emjyBack.log('set guardPrice for', this.account, this.code);
                if (klines['101']) {
                    var kl0 = klines['101'][klines['101'].length - 2];
                    var kl1 = klines['101'][klines['101'].length - 3];
                    this.strategies[elIdx].data.guardPrice = kl1.c - kl0.l > 0 ? kl0.l : kl1.c;
                    if (!this.strategies[elIdx].data.enabled) {
                        this.strategies[elIdx].data.enabled = true;
                    }
                } else {
                    emjyBack.log('no daily kline data', this.code, this.account);
                }
            }
        }

        if (this.strategies[0].key() == 'StrategyBuyMAE') {
            if (key == 'StrategySellEL' || key == 'StrategySellELS') {
                if (this.strategies[3].data.guardPrice !== undefined && this.strategies[3].data.guardPrice != null) {
                    return;
                }
                emjyBack.log('set guardPrice for', this.account, this.code);
                if (klines['101']) {
                    var kl0 = klines['101'][klines['101'].length - 1];
                    var kl1 = klines['101'][klines['101'].length - 2];
                    this.strategies[3].data.guardPrice = kl1.c - kl0.l > 0 ? kl0.l : kl1.c;
                    if (!this.strategies[3].data.enabled) {
                        this.strategies[3].data.enabled = true;
                    }
                } else {
                    emjyBack.log('no daily kline data', this.code, this.account);
                }
            }
        }
    }

    calcCount(amount, price) {
        var ct = (amount / 100) / price;
        var d = ct - Math.floor(ct);
        if (d <= ct * 0.15) {
            return 100 * Math.floor(ct);
        };
        return 100 * Math.ceil(ct);
    }

    getBuyCount(price) {
        if (!this.count0 || this.count0 <= 0) {
            var amount = 40000;
            if (this.amount && this.amount > 0) {
                amount = this.amount;
            };
            this.count0 = this.calcCount(amount, price);
        }
        return this.count0;
    }

    check(rtInfo) {
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled()) {
                continue;
            };
            var checkResult = curStrategy.check(rtInfo);
            var price = checkResult.price;
            if (checkResult.match) {
                if (curStrategy.isBuyStrategy()) {
                    var count = this.getBuyCount(price);
                    emjyBack.log('checkStrategies buy match', this.code, rtInfo.name, 'buy count:', count, JSON.stringify(curStrategy));
                    emjyBack.tryBuyStock(this.code, rtInfo.name, price, count, checkResult.account === undefined ? this.account : checkResult.account);
                    if (curStrategy.guardLevel() == 'zt') {
                        emjyBack.ztBoardTimer.removeStock(rtInfo.code);
                    };
                    if (curStrategy.guardLevel() == 'opt') {
                        emjyBack.otpAlarm.removeStock(rtInfo.code);
                    }
                    if (this.buydetail) {
                        this.buydetail.push({date: this.getTodayDate(), count, price});
                    }
                    this.onTradeMatch(id, {price});
                } else {
                    var count = this.availableCount();
                    var countAll = this.totalCount();
                    if (count > 0) {
                        emjyBack.log('checkStrategies sell match', this.code, rtInfo.name, 'sell count:', count, JSON.stringify(curStrategy));
                        emjyBack.trySellStock(this.code, price, count, this.account);
                        if (this.buydetail) {
                            this.sellDetail(count);
                        }
                        this.onTradeMatch(id, {price});
                    } else if (countAll > 0) {
                        emjyBack.log('checkStrategies sell match, no available count to sell', this.code, rtInfo.name, JSON.stringify(curStrategy));
                        curStrategy.sellMatchUnavailable();
                    }
                }
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
        this.save();
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
