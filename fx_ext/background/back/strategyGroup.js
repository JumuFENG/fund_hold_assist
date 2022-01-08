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
        if (str.buydetail) {
            this.buydetail = str.buydetail;
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
        if (!this.buydetail || this.buydetail.length == 0) {
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

    getCountLessThan(price) {
        if (!this.buydetail || this.buydetail.length == 0) {
            return 0;
        }

        var lessDetail = this.buydetail.filter(bd => bd.price - price <= 0);
        var moreDetail = this.buydetail.filter(bd => bd.price - price > 0);
        var count = 0;
        var tdcount = 0;
        var td = this.getTodayDate();
        for (var i = 0; i < lessDetail.length; i++) {
            if (lessDetail[i].date < td) {
                count += lessDetail[i].count;
            } else {
                tdcount += lessDetail[i].count;
            }
        }

        if (tdcount > 0) {
            var morecount = 0;
            for (let i = 0; i < moreDetail.length; i++) {
                const md = moreDetail[i];
                morecount += md.count;
            }
            if (morecount > tdcount) {
                return count + tdcount;
            } else {
                return count + morecount;
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
        if (ndetail.length == 0) {
            if (this.amount > 0) {
                this.count0 = 0;
            }
        }
        this.buydetail = ndetail;
    }

    addBuyDetail(detail) {
        var date = detail.time;
        if (!date) {
            date = this.getTodayDate();
        }
        if (this.buydetail) {
            this.buydetail.push({date, count: detail.count, price: detail.price, sid: detail.sid});
        } else {
            this.buydetail = [{date, count: detail.count, price: detail.price, sid: detail.sid}];
        }
        this.save();
    }

    updateBuyDetail(sid, price, count) {
        emjyBack.log('updateBuyDetail', this.code, sid, price, count);
        if (!this.buydetail) {
            if (count != 0) {
                this.buydetail = [{date: this.getTodayDate(), count, price, sid}];
            }
            return;
        }

        var didx = this.buydetail.findIndex(bd => bd.sid == sid);
        if (didx >= 0) {
            if (count == 0) {
                this.buydetail.splice(didx, 1);
            } else {
                this.buydetail[didx].price = price;
                this.buydetail[didx].count = count;
            }
        } else if (count != 0){
            this.buydetail.push({date: this.getTodayDate(), count, price, sid});
        }
    }

    setHoldCount(count, acount) {
        if (count === undefined || count <= 0) {
            return;
        };

        if (!this.buydetail || this.totalCount() != count || this.availableCount() != acount) {
            this.buydetail = [];
            if (count == acount) {
                this.buydetail.push({date: '0', count});
            } else if (acount > 0) {
                this.buydetail.push({date: '0', count: acount});
                this.buydetail.push({date: this.getTodayDate(), count: count - acount});
            } else {
                this.buydetail.push({date: this.getTodayDate(), count});
            }
        }
    }

    applyGuardLevel(allklt = true) {
        var addToKlineAlarm = function(code, kl, isall) {
            if (kl % 101 == 0) {
                emjyBack.dailyAlarm.addStock(code, kl);
            } else {
                emjyBack.klineAlarms.addStock(code, kl, isall);
            }
        };

        for (var id in this.strategies) {
            if (!this.strategies[id].enabled()) {
                continue;
            };
            var gl = this.strategies[id].guardLevel();
            if (gl == 'kline') {
                addToKlineAlarm(this.code, this.strategies[id].kltype(), allklt);
            } else if (gl == 'klines') {
                this.strategies[id].kltype().forEach(kl => {
                    addToKlineAlarm(this.code, kl);
                });
            } else if (gl == 'kday') {
                emjyBack.dailyAlarm.addStock(this.code, this.strategies[id].kltype());
            } else if (gl == 'otp') {
                if (this.count0 !== undefined && this.count0 > 0) {
                    emjyBack.otpAlarm.addTask({params:{id}, exec: (params) => {
                        this.onOtpAlarm(params.id);
                    }});
                }
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

    calcBuyCount(amount, price) {
        var ct = (amount / 100) / price;
        var d = ct - Math.floor(ct);
        if (d <= ct * 0.15) {
            return 100 * Math.floor(ct);
        };
        return 100 * Math.ceil(ct);
    }

    getBuyCount(price) {
        if (!this.count0 || this.count0 <= 0) {
            var amount = 10000;
            if (this.amount && this.amount > 0) {
                amount = this.amount;
            };
            this.count0 = this.calcBuyCount(amount, price);
        }
        return this.count0;
    }

    onOtpAlarm(id) {
        var curStrategy = this.strategies[id];
        if (!curStrategy.enabled()) {
            return;
        }

        if (curStrategy.isBuyStrategy()) {
            this.doTrade(id, {price:0, count: this.count0 === undefined ? 0 : this.count0});
        } else {
            emjyBack.log('!!!NOT IMPLEMENTED!!! onOtpAlarm sell match', this.code, JSON.stringify(curStrategy));
        }
    }

    check(rtInfo) {
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled() || curStrategy.guardLevel() == 'otp') {
                continue;
            };

            var checkResult = curStrategy.check(rtInfo);
            if (checkResult.match) {
                var price = checkResult.price;
                if (curStrategy.isBuyStrategy()) {
                    var count = this.getBuyCount(price);
                    this.doTrade(id, {price, count});
                } else {
                    this.doTrade(id, {price});
                }
            } else if (checkResult.stepInCritical) {
                emjyBack.checkAvailableMoney(rtInfo.latestPrice, checkResult.account);
            };
        };
    }

    doTrade(id, info) {
        var curStrategy = this.strategies[id];
        if (!curStrategy || !curStrategy.enabled()) {
            return;
        }

        if (!this.count0 && this.amount) {
            this.count0 = this.calcBuyCount(this.amount, info.price);
        }
        var price = info.price === undefined ? 0 : info.price;
        if (info.tradeType) {
            if (this.account == 'normal' || this.account == 'collat') {
                price = 0;
            }
            if (info.tradeType == 'B') {
                var account = curStrategy.data.account === undefined ? this.account : curStrategy.data.account;
                var count = this.count0;
                emjyBack.log('checkStrategies buy match', account, this.code, 'buy count:', count, 'price', price, JSON.stringify(curStrategy))
                emjyBack.tryBuyStock(this.code, price, count, account, bd => {
                    this.addBuyDetail(bd);
                });
            } else if (info.tradeType == 'S') {
                var count = this.count0;
                var countAll = this.availableCount();
                if (info.count == 1 || count - countAll > 0) {
                    count = countAll;
                } else if (info.count == 2) {
                    count = this.getCountLessThan(info.price);
                }
                if (count > 0) {
                    emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', price, JSON.stringify(curStrategy));
                    emjyBack.trySellStock(this.code, price, count, this.account);
                    if (this.buydetail) {
                        this.sellDetail(count);
                    }
                }
            }
            this.save();
        } else if (curStrategy.isBuyStrategy()) {
            var count = info.count;
            if (count === undefined && price > 0) {
                count = this.getBuyCount(info.price);
            }
            var account = curStrategy.data.account === undefined ? this.account : curStrategy.data.account;
            emjyBack.log('checkStrategies buy match', account, this.code, 'buy count:', count, 'price', price, JSON.stringify(curStrategy));
            emjyBack.tryBuyStock(this.code, price, count, account, bd => {
                this.addBuyDetail(bd);
            });
            if (curStrategy.guardLevel() == 'zt') {
                emjyBack.ztBoardTimer.removeStock(this.code);
            };
            if (curStrategy.guardLevel() == 'opt') {
                emjyBack.otpAlarm.removeStock(this.code);
            }
            this.onTradeMatch(id, {price});
        } else {
            var count = this.availableCount();
            var countAll = this.totalCount();
            if (count > 0) {
                emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', price, JSON.stringify(curStrategy));
                emjyBack.trySellStock(this.code, price, count, this.account);
                if (this.buydetail) {
                    this.sellDetail(count);
                }
                this.onTradeMatch(id, {price});
            } else if (countAll > 0) {
                emjyBack.log('checkStrategies sell match, no available count to sell', this.code, JSON.stringify(curStrategy));
                curStrategy.sellMatchUnavailable();
            }
        }
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

    checkKlines(updatedKlt) {
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled()) {
                continue;
            }
            if (typeof(curStrategy.checkKlines) !== 'function') {
                continue;
            }

            var matchResult = curStrategy.checkKlines(emjyBack.klines[this.code], updatedKlt, this.buydetail);
            if (matchResult) {
                if (matchResult.match) {
                    this.doTrade(id, matchResult);
                }
                if (matchResult.stepInCritical) {
                    this.save();
                }
                return;
            }
            if (curStrategy.inCritical()) {
                if (curStrategy.isBuyStrategy()) {
                    var count = this.count0;
                    if (count === undefined || count == 0) {
                        count = this.getBuyCount(emjyBack.klines[this.code].getLatestKline(curStrategy.kltype()));
                    }
                    this.doTrade(id, {price: 0, count});
                } else {
                    this.doTrade(id, {price: 0});
                }
            }
        };
    }
}

let strategyGroupManager = new GroupManager();
