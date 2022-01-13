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

class BuyDetail {
    constructor(records) {
        if (records) {
            this.records = records;
        } else {
            this.records = [];
        }
    }

    getTodayDate() {
        var now = new Date();
        return now.getFullYear() + '-' + ('' + (now.getMonth()+1)).padStart(2, '0') + '-' + ('' + now.getDate()).padStart(2, '0');
    }

    buyRecords() {
        return this.records.filter(r => r.type == 'B');
    }

    sellRecords() {
        return this.records.filter(r => r.type == 'S');
    }

    addRecord(r) {
        if (!this.records) {
            this.records = [];
        }
        this.records.push(r);
    }

    addBuyDetail(detail) {
        var date = detail.time;
        if (!date) {
            date = this.getTodayDate();
        }
        this.addRecord({date, count: detail.count, price: detail.price, sid: detail.sid, type:'B'});
    }

    addSellDetail(detail) {
        var date = detail.time;
        if (!date) {
            date = this.getTodayDate();
        }
        this.addRecord({date, count: detail.count, price: detail.price, sid: detail.sid, type:'S'});
    }

    archiveRecords() {
        var selrec = this.sellRecords();
        if (!selrec || selrec.length == 0) {
            return;
        }

        var buyrec = this.buyRecords();
        buyrec.sort((a, b) => {return a.price - b.price < 0;});
        var soldrec = [];
        var soldCount = this.pendingSoldCount();
        for (var i = buyrec.length - 1; i >= 0; i--) {
            if (buyrec[i].count == soldCount) {
                soldrec.push(buyrec.splice(i, 1)[0]);
                soldCount = 0;
                break;
            }
            if (buyrec[i].count > soldCount) {
                soldrec.push({date:buyrec[i].date, count:soldCount, price: buyrec[i].price, sid: buyrec[i].sid, type:buyrec[i].type});
                buyrec[i].count -= soldCount;
                soldCount = 0;
                break;
            }
            soldCount -= buyrec[i].count;
            soldrec.push(buyrec.splice(i, 1)[0]);
        }

        var tdcount = 0;
        var td = this.getTodayDate();
        for (let i = 0; i < soldrec.length; i++) {
            if (soldrec[i].date == td) {
                tdcount += soldrec[i].count;
            }
        }

        for (var i = buyrec.length - 1; i >= 0 && tdcount > 0; i--) {
            if (buyrec[i].count >= tdcount) {
                buyrec[i].date = td;
                tdcount = 0;
                break;
            }
            buyrec[i].date = td;
            tdcount -= buyrec[i].count;
        }
        this.records = buyrec;
    }

    totalCount() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var count = 0;
        for (var i = 0; i < buyrec.length; i++) {
            count += buyrec[i].count;
        }
        return count - this.pendingSoldCount();
    }

    availableCount() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var td = this.getTodayDate();
        var count = 0;
        for (var i = 0; i < buyrec.length; i++) {
            if (buyrec[i].date < td) {
                count += buyrec[i].count;
            }
        }
        return count - this.pendingSoldCount();
    }

    getCountLessThan(price) {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var lessDetail = buyrec.filter(bd => bd.price - price <= 0);
        var moreDetail = buyrec.filter(bd => bd.price - price > 0);
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
        return count - this.pendingSoldCount();
    }

    pendingSoldCount() {
        var selrec = this.sellRecords();
        if (!selrec || selrec.length == 0) {
            return 0;
        }

        var count = 0;
        for (var i = 0; i < selrec.length; i++) {
            count += selrec[i].count;
        }
        return count;
    }

    getMinBuyPrice() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var pmin = buyrec[0].price;
        for (let i = 1; i < buyrec.length; i++) {
            if (buyrec[i].price - pmin < 0) {
                pmin = buyrec[i].price;
            }
        }
        return pmin;
    }

    updateBuyDetail(sid, price, count) {
        if (!this.records) {
            if (count != 0) {
                this.addBuyDetail({count, price, sid});
            }
            return;
        }

        var didx = this.records.findIndex(bd => bd.sid == sid);
        if (didx >= 0) {
            if (count == 0) {
                this.records.splice(didx, 1);
            } else {
                this.records[didx].price = price;
                this.records[didx].count = count;
            }
        } else if (count != 0){
            if (this.records.length == 1 && this.records[0].count == count) {
                this.records = [];
            }
            this.addBuyDetail({count, price, sid});
        }
    }

    updateSellDetail(sid, price, count) {
        var selrec = this.sellRecords();
        if (!selrec || selrec.length == 0) {
            if (count != 0) {
                this.addSellDetail({count, price, sid});
            }
            return;
        }

        var didx = this.records.findIndex(bd => bd.sid == sid);
        if (didx >= 0) {
            if (count == 0) {
                this.records.splice(didx, 1);
            } else {
                this.records[didx].price = price;
                this.records[didx].count = count;
            }
        } else if (count != 0){
            this.addSellDetail({count, price, sid});
        }
    }

    setHoldCount(tcount, acount, price) {
        if (tcount === undefined || tcount <= 0) {
            this.records = [];
            return;
        }

        if (!this.records || this.totalCount() != tcount || this.availableCount() != acount) {
            this.records = [];
            if (acount == 0) {
                this.addBuyDetail({count: tcount, price});
            } else if (tcount == acount) {
                this.addBuyDetail({date: '0', count: tcount, price});
            } else {
                this.addBuyDetail({date: '0', count: acount, price});
                this.addBuyDetail({count: tcount - acount, price});
            }
        }
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
        this.buydetail = new BuyDetail(str.buydetail);
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

    isLongTerm() {
        for (var id in this.strategies) {
            if (this.strategies[id].data.period == 'l') {
                return true;
            }
        }
        return false;
    }

    getNextValidId() {
        var ids = Object.keys(this.strategies);
        var id = 0;
        if (ids) {
            for (let i = 0; i < ids.length; i++) {
                if (ids[i] - id > 0) {
                    id = ids[i];
                }
            }
            ++id;
        }
        return id;
    }

    addStrategy(str) {
        var id = this.getNextValidId();
        this.strategies[id] = strategyManager.create(str);
        this.save();
    }

    addStrategyGroup(strgrp) {
        var id = this.getNextValidId();
        var idmap = {'-1':'-1'};
        for (var oid in strgrp.strategies) {
            this.strategies[id] = strategyManager.create(strgrp.strategies[oid]);
            idmap[oid] = id;
            ++id;
        }

        for (var id in strgrp.transfers) {
            this.transfers[idmap[id]] = new StrategyTransferConnection(idmap[strgrp.transfers[id]]);
        }
        this.save();
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
        if (this.buydetail && this.buydetail.records && this.buydetail.records.length > 0) {
            data.buydetail = this.buydetail.records;
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

    setHoldCount(tcount, acount, price) {
        this.buydetail.setHoldCount(tcount, acount, price);
    }

    updateBuyDetail(sid, price, count) {
        emjyBack.log('updateBuyDetail', this.code, sid, price, count);
        this.buydetail.updateBuyDetail(sid, price, count);
    }

    updateSellDetail(sid, price, count) {
        emjyBack.log('updateSellDetail', this.code, sid, price, count);
        this.buydetail.updateSellDetail(sid, price, count);
    }

    archiveBuyDetail() {
        emjyBack.log('archiveBuyDetail', this.code);
        this.buydetail.archiveRecords();
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
            }
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
                    this.buydetail.addBuyDetail(bd);
                    this.save();
                });
            } else if (info.tradeType == 'S') {
                var count = this.count0;
                if (info.count >= 100) {
                    count = info.count;
                }
                if (count > 0) {
                    emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', price, JSON.stringify(curStrategy));
                    emjyBack.trySellStock(this.code, price, count, this.account, sd => {
                        this.buydetail.addSellDetail(sd);
                        this.save();
                    });
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
                this.buydetail.addBuyDetail(bd);
                this.save();
            });
            if (curStrategy.guardLevel() == 'zt') {
                emjyBack.ztBoardTimer.removeStock(this.code);
            };
            if (curStrategy.guardLevel() == 'opt') {
                emjyBack.otpAlarm.removeStock(this.code);
            }
            this.onTradeMatch(id, {price});
        } else {
            var count = this.buydetail.availableCount();
            var countAll = this.buydetail.totalCount();
            if (count > 0) {
                emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', price, JSON.stringify(curStrategy));
                emjyBack.trySellStock(this.code, price, count, this.account, sd => {
                    this.buydetail.addSellDetail(sd);
                    this.save();
                });
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
