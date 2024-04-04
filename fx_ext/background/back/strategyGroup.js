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

    lastBuyDate() {
        var buyrec = this.buyRecords();
        if (buyrec.length == 0) {
            return '';
        }
        var date0 = buyrec[0].date;
        for (let i = 1; i < buyrec.length; i++) {
            if (buyrec[i].date > date0) {
                date0 = buyrec[i].date;
            }
        }
        return date0;
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
        if (date === undefined) {
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
                tdcount -= soldrec[i].count;
            }
        }

        tdcount = -tdcount;
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
            count -= buyrec[i].count;
        }
        return -count - this.pendingSoldCount();
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
                count -= buyrec[i].count;
            }
        }
        return -count - this.pendingSoldCount();
    }

    getCountLessThan(price, fac = 0, smi=true) {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var lessDetail = []; // buyrec.filter(bd => bd.price - price <= 0);
        var moreDetail = []; //buyrec.filter(bd => bd.price - price > 0);
        buyrec.forEach(c => {
            var smioff = smi ? emjyBack.getSmiOffset(c.date) : 0;
            if (c.price - price * (1 - fac - smioff) <= 0) {
                lessDetail.push(c);
            } else {
                moreDetail.push(c);
            }
        });

        var count = 0;
        var tdcount = 0;
        var td = this.getTodayDate();
        for (var i = 0; i < lessDetail.length; i++) {
            if (lessDetail[i].date < td) {
                count -= lessDetail[i].count;
            } else {
                tdcount -= lessDetail[i].count;
            }
        }

        if (tdcount < 0) {
            var morecount = 0;
            for (let i = 0; i < moreDetail.length; i++) {
                const md = moreDetail[i];
                morecount -= md.count;
            }
            if (morecount < tdcount) {
                return -count - tdcount;
            } else {
                return -count - morecount;
            }
        }
        return -count - this.pendingSoldCount();
    }

    getCountMatched(selltype, price, fac=0, smi=false) {
        if (selltype == 'all') {
            return this.availableCount();
        }

        if (selltype == 'earned') {
            return this.getCountLessThan(price, fac, smi);
        }

        var aCount = this.availableCount();
        if (selltype == 'half_all') {
            var halfall = 100 * Math.ceil(this.totalCount() / 200);
            return halfall - aCount <= 0 ? halfall : aCount;
        }

        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var count = buyrec[buyrec.length - 1].count;
        if (selltype == 'half') {
            count = 100 * Math.ceil(count / 200);
        }
        return count - aCount <= 0 ? count : aCount;
    }

    pendingSoldCount() {
        var selrec = this.sellRecords();
        if (!selrec || selrec.length == 0) {
            return 0;
        }

        var count = 0;
        for (var i = 0; i < selrec.length; i++) {
            count -= selrec[i].count;
        }
        return -count;
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

        if (this.records && this.totalCount() == tcount) {
            if (this.availableCount() == acount || (new Date()).getHours() > 15) {
                return;
            }
        }

        this.records = [];
        if (acount == 0) {
            this.addBuyDetail({count: tcount, price});
        } else if (tcount == acount) {
            this.addBuyDetail({time: '0', count: tcount, price});
        } else {
            this.addBuyDetail({time: '0', count: acount, price});
            this.addBuyDetail({count: tcount - acount, price});
        }
    }

    averPrice() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var amount = 0;
        var count = 0;
        for (let i = 0; i < buyrec.length; i++) {
            amount += buyrec[i].price * buyrec[i].count
            count -= buyrec[i].count;
        }
        if (count < 0) {
            return -amount / count;
        }
        return 0;
    }

    minBuyPrice() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }
        var mp = buyrec[0].price;
        for (let i = 1; i < buyrec.length; i++) {
            if (buyrec[i].price - mp < 0) {
                mp = buyrec[i].price;
            }
        }
        return mp;
    }

    maxBuyPrice() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }
        var mp = buyrec[0].price;
        for (let i = 1; i < buyrec.length; i++) {
            if (buyrec[i].price - mp > 0) {
                mp = buyrec[i].price;
            }
        }
        return mp;
    }

    latestBuyDate() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return this.getTodayDate();
        }

        var date = buyrec[0].date;
        for (var i = 1; i < buyrec.length; i++) {
            if (buyrec[i].date > date) {
                date = buyrec[i].date;
            }
        }
        return date;
    }

    highestBuyDate() {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return this.getTodayDate();
        }

        var price = buyrec[0].price;
        var date = buyrec[0].date;
        for (var i = 1; i < buyrec.length; i++) {
            if (buyrec[i].price - price > 0) {
                date = buyrec[i].date;
                price = buyrec[i].price;
            }
        }
        return date;
    }

    fixBuyRecords(deals) {
        var sd = deals.filter(d => d.tradeType == 'S');
        var bd = deals.filter(d => d.tradeType == 'B');
        var scount = 0;
        sd.forEach(d => {
            scount -= d.count;
        });

        while(scount < 0) {
            scount += bd[0].count;
            bd.shift();
        }

        if (scount > 0) {
            bd[0].count = -(-scount - bd[0].count);
        }

        this.records = [];
        bd.forEach(b => {
            var date = b.time.split(' ')[0];
            var count = b.count;
            var price = b.price;
            var sid = b.sid;
            this.records.push({date, count, price, type:'B', sid});
        });
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
        if (str.gmeta) {
            this.gmeta = str.gmeta;
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
            this.strategies[id] = emjyBack.strategyManager.create(strs[id]);
        };
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
        this.strategies[id] = emjyBack.strategyManager.create(str);
        this.save();
    }

    addStrategyGroup(strgrp) {
        var id = this.getNextValidId();
        var idmap = {'-1':'-1'};
        for (var oid in strgrp.strategies) {
            this.strategies[id] = emjyBack.strategyManager.create(strgrp.strategies[oid]);
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
        if (this.gmeta !== undefined) {
            data.gmeta = this.gmeta;
        }
        return JSON.stringify(data);
    }

    save() {
        var data = {};
        data[this.storeKey] = this.tostring();
        emjyBack.saveToLocal(data);
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
        emjyBack.applyGuardLevel(this, allklt);
    }

    applyKlines(klines) {
        if (!klines) {
            return;
        }

        if (!this.gmeta) {
            return;
        }

        if (this.gmeta.setguard && this.gmeta.guardid && this.buydetail.averPrice() > 0) {
            if (!this.strategies[this.gmeta.guardid].data.guardPrice) {
                // min(min(开盘价, 买入价) * 88.5%, 最低价)
                emjyBack.log('set guardPrice for', this.account, this.code);
                var latestPrice = null;
                if (klines['101']) {
                    var kl = klines['101'][klines['101'].length - 1];
                    var now = new Date();
                    var today = now.getFullYear() + '-' + ('' + (now.getMonth()+1)).padStart(2, '0') + '-' + ('' + now.getDate()).padStart(2, '0');
                    if (kl.time == today) {
                        latestPrice = kl.o;
                    }
                }
                if (latestPrice) {
                    this.strategies[this.gmeta.guardid].data.guardPrice = Math.min(latestPrice * 0.885, this.buydetail.averPrice() * 0.885, kl.l * 1);
                } else {
                    this.strategies[this.gmeta.guardid].data.guardPrice = Math.min(this.buydetail.averPrice() * 0.885, kl.l * 1);
                    emjyBack.log('no daily kline data', this.code, this.account);
                }
                if (this.gmeta.settop && !this.strategies[this.gmeta.guardid].data.topprice) {
                    this.strategies[this.gmeta.guardid].data.topprice = this.buydetail.averPrice() * 1.06;
                    delete(this.gmeta.settop);
                }
                if (!this.strategies[this.gmeta.guardid].data.enabled) {
                    this.strategies[this.gmeta.guardid].data.enabled = true;
                }
            }
            delete(this.gmeta.setguard);
            delete(this.gmeta.guardid);
        }
    }

    getBuyCount(price) {
        if (!this.count0 || this.count0 <= 0) {
            var amount = 10000;
            if (this.amount && this.amount > 0) {
                amount = this.amount;
            };
            this.count0 = emjyBack.calcBuyCount(amount, price);
        }
        return this.count0;
    }

    onOtpAlarm(id) {
        var curStrategy = this.strategies[id];
        if (!curStrategy.enabled()) {
            return;
        }

        if (curStrategy) {
            curStrategy.check({id, rtInfo: {latestPrice:0, count: this.count0 === undefined ? 0 : this.count0}, buydetail: this.buydetail}, (matchResult, cb) => {
                if (matchResult) {
                    this.doTrade(matchResult, cb);
                }
            });
        } else {
            emjyBack.log('!!!NOT IMPLEMENTED!!! onOtpAlarm sell match', this.code, JSON.stringify(curStrategy));
        }
    }

    check(rtInfo) {
        for (var id in this.strategies) {
            var curStrategy = this.strategies[id];
            if (!curStrategy.enabled()) {
                continue;
            }

            curStrategy.check({id, rtInfo, buydetail: this.buydetail}, (matchResult, cb) => {
                if (matchResult) {
                    this.doTrade(matchResult, cb);
                }
            });
        };
    }

    doTrade(info, tradeCb) {
        if (info.tradeType === undefined) {
            this.save();
            return;
        }

        var curStrategy = this.strategies[info.id];
        if (!curStrategy) {
            return;
        }

        if (info.tradeType === undefined) {
            emjyBack.log('error in doTrade! info.tradeType is undefined');
            return;
        }

        if (info.count !== undefined && info.count - 0 > 0) {
            this.count0 = info.count;
        } else if (this.amount && info.price) {
            this.count0 = emjyBack.calcBuyCount(this.amount, info.price);
        }
        var price = info.price === undefined ? 0 : info.price;
        if (this.account == 'normal' || this.account == 'collat') {
            price = 0;
        }
        if (info.tradeType == 'B') {
            var account = curStrategy.data.account === undefined ? this.account : curStrategy.data.account;
            var count = this.count0;
            emjyBack.log('checkStrategies buy match', account, this.code, 'buy count:', count, 'price', price, JSON.stringify(curStrategy), 'buy detail', JSON.stringify(this.buydetail.records))
            emjyBack.tryBuyStock(this.code, price, count, account, bd => {
                this.buydetail.addBuyDetail(bd);
                if (typeof(tradeCb) === 'function') {
                    tradeCb(bd);
                }
                this.onTradeMatch(info);
            });
        } else if (info.tradeType == 'S') {
            var count = this.count0;
            if (info.count - 10 >= 0) {
                count = info.count;
            }
            if (count > 0) {
                emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', info.price, JSON.stringify(curStrategy), 'aver price', this.buydetail.averPrice(), 'buy detail', JSON.stringify(this.buydetail.records));
                emjyBack.trySellStock(this.code, price, count, this.account, sd => {
                    this.buydetail.addSellDetail(sd);
                    if (typeof(tradeCb) === 'function') {
                        tradeCb(sd);
                    }
                    this.onTradeMatch(info);
                });
            }
        }
        this.save();
    }

    onTradeMatch(refer) {
        var curStrategy = this.strategies[refer.id];
        if (curStrategy.guardLevel() == 'kline') {
            refer.kltype = curStrategy.kltype();
        };
        if (!this.transfers || !this.transfers[refer.id]) {
            return;
        };
        var tid = this.transfers[refer.id].getTransferId();
        if (tid >= 0) {
            this.strategies[tid].setEnabled(true);
            if (refer.tradeType == 'B') {
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

            curStrategy.checkKlines({id, code:this.code, kltypes: updatedKlt, buydetail: this.buydetail}, (matchResult, cb) => {
                if (matchResult) {
                    this.doTrade(matchResult, cb);
                }
            });
        }
    }
}

let strategyGroupManager = new GroupManager();
