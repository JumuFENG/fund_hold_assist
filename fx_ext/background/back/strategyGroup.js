'use strict';

const { ses } = xreq('./background/strategies_meta.js');
const { logger } = xreq('./background/nbase.js');
const { guang } = xreq('./background/guang.js');
const { feng } = xreq('./background/feng.js');
const { emjyBack } = xreq('./background/emjybackend.js');
const { strategyFac }  = xreq("./background/strategyController.js");


class GroupManager {
    static create(group, account, code, skey) {
        return new StrategyGroup(group, account, code, skey);
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
    constructor(records, frecords) {
        if (!records) {
            this.records = [];
        } else {
            this.records = records;
        }
        if (!frecords) {
            this.full_records = [...this.records];
        } else {
            this.full_records = frecords;
        }
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

    minBuyDate() {
        var buyrec = this.buyRecords();
        if (buyrec.length == 0) {
            return '';
        }
        var date0 = buyrec[0].date;
        for (let i = 1; i < buyrec.length; i++) {
            if (buyrec[i].date < date0) {
                date0 = buyrec[i].date;
            }
        }
        return date0;
    }

    sellRecords() {
        return this.records.filter(r => r.type == 'S');
    }

    addRecord(r) {
        this.records.push(r);
        var fr = {};
        for (let k in r) {
            fr[k] = r[k];
        }
        this.full_records.push(fr);
    }

    addBuyDetail(detail) {
        var date = detail.time;
        if (date === undefined) {
            date = guang.getTodayDate('-');
        }
        this.addRecord({date, count: detail.count, price: detail.price, sid: detail.sid, type:'B'});
    }

    addSellDetail(detail) {
        var date = detail.time;
        if (!date) {
            date = guang.getTodayDate('-');
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
        var td = guang.getTodayDate('-');
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

        var td = guang.getTodayDate('-');
        var count = 0;
        for (var i = 0; i < buyrec.length; i++) {
            if (buyrec[i].date < td) {
                count -= buyrec[i].count;
            }
        }
        return -count - this.pendingSoldCount();
    }

    getCountLessThan(price, fac = 0) {
        var buyrec = this.buyRecords();
        if (!buyrec || buyrec.length == 0) {
            return 0;
        }

        var lessDetail = []; // buyrec.filter(bd => bd.price - price <= 0);
        var moreDetail = []; //buyrec.filter(bd => bd.price - price > 0);
        buyrec.forEach(c => {
            if (c.price - price * (1 - fac) <= 0) {
                lessDetail.push(c);
            } else {
                moreDetail.push(c);
            }
        });

        var count = 0;
        var tdcount = 0;
        var td = guang.getTodayDate('-');
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

    getCountMatched(selltype, price, fac=0) {
        if (selltype == 'all') {
            return this.availableCount();
        }

        if (selltype == 'earned') {
            return this.getCountLessThan(price, fac);
        }

        if (selltype == 'egate') {
            if (fac > 0 && this.minBuyPrice() * (1 + fac) - price < 0) {
                return this.getCountLessThan(price, 0);
            }
            return 0;
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
            var frec = this.full_records.find(bd => bd.sid == sid);
            if (frec) {
                frec.price = price;
                frec.count = count;
            }
        } else if (count != 0){
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
            var frec = this.full_records.find(bd => bd.sid == sid);
            if (frec) {
                frec.price = price;
                frec.count = count;
            }
        } else if (count != 0){
            this.addSellDetail({count, price, sid});
        }
    }

    setHoldCount(tcount, acount, price) {
        if (tcount === undefined || tcount <= 0) {
            this.records = [];
            this.full_records = [];
            return;
        }

        if (this.records && this.totalCount() == tcount) {
            return;
        }

        emjyBack.log('setHoldCount reset buy records', tcount, acount, JSON.stringify(this.records), JSON.stringify(this.full_records))
        this.records = [];
        this.full_records = [];
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
            return guang.getTodayDate('-');
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
            return guang.getTodayDate('-');
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

    calcEarning() {
        if (this.totalCount() != 0) {
            return 0;
        }

        var earn = 0;
        for (const rec of this.full_records) {
            if (rec.type == 'B') {
                earn -= rec.price * rec.count;
            } else {
                earn += rec.price * rec.count;
            }
        }
        return earn;
    }
}

class CostDog {
    constructor(cdobj) {
        this.dogdic = {};
        if (cdobj && cdobj.length > 0) {
            for (const c of cdobj) {
                this.dogdic[c.key] = c;
            }
        }
    }

    save() {
        if (emjyBack.fha.save_on_server) {
            const url = emjyBack.fha.server + 'stock';
            const headers = {'Authorization': 'Basic ' + btoa(emjyBack.fha.uemail + ":" + emjyBack.fha.pwd)};
            const fd = new FormData();
            fd.append('act', 'costdog');
            fd.append('cdata', JSON.stringify(this.dogdic));
            fetch(url, {method:'POST', body: fd, headers});
        } else {
            emjyBack.saveToLocal({'cost_dog': Object.values(this.dogdic)});
        }
    }

    urBuyCount(key, code, amount, price) {
        var count = 0;
        if (key in this.dogdic) {
            var cdog = this.dogdic[key];
            if (cdog.amount) {
                amount = cdog.amount;
            }
            var ur = cdog.urque.find(u => !u.paired);
            if (!ur) {
                count = guang.calcBuyCount(amount, price);
            } else {
                ur.paired = true;
                ur.code = code;
                var uamt = ur.lost * (1 - amount/cdog.max_amount) / cdog.expect_earn_rate + amount;
                if (uamt - cdog.max_amount > 0) {
                    uamt = cdog.max_amount;
                }
                count = guang.calcBuyCount(uamt, price);
                return {count, 'id': ur.id};
            }
        } else {
            var amount = 10000;
            count = guang.calcBuyCount(amount, price);
        }
        return {count};
    }

    settleUr(key, earn, urid) {
        if (!this.dogdic[key]) {
            return;
        }

        var cdog = this.dogdic[key];
        if (!cdog.urque) {
            cdog.urque = [];
        }
        var ur = null;
        if (urid) {
            ur = cdog.urque.find(u => u.id == urid);
        }

        if (earn >= 0) {
            if (!ur) {
                ur = cdog.urque.find(u => !u.paired);
                if (!ur) {
                    return;
                }
            }
            if (earn - ur.lost > 0) {
                cdog.urque = cdog.urque.filter(u=> u.id !== ur.id);
                return;
            } else {
                var ur_x = cdog.urque.find(u => !u.paired && earn - u.lost >= 0);
                if (ur_x) {
                    ur.paired = false;
                    cdog.urque = cdog.urque.filter(u=> u.id !== ur_x.id);
                    return;
                }
            }
            ur.lost -= earn;
            ur.paired = false;
            cdog.urque.sort((a,b)=>b.lost - a.lost);
            return;
        }

        var lost = -earn;
        if (ur) {
            ur.paired = false;
            lost += ur.lost;
        }
        var max_single_cover = cdog.max_amount * cdog.expect_earn_rate;
        if (lost <= max_single_cover && ur) {
            ur.lost = lost;
            cdog.urque.sort((a,b)=>b.lost - a.lost);
            return;
        }

        var tlost = lost;
        if (ur) {
            ur.lost = tlost > max_single_cover ? max_single_cover : tlost;
            tlost -= max_single_cover;
        }
        var id = cdog.urque.length == 0 ? 0: Math.max(...cdog.urque.map(u => u.id));
        while (tlost > 0) {
            lost = tlost > max_single_cover ? max_single_cover : tlost;
            id++;
            cdog.urque.push({lost, id});
            tlost -= max_single_cover;
        }
        cdog.urque.sort((a,b)=>b.lost - a.lost);
    }
}


class StrategyGroup {
    constructor(str, account, code, key) {
        this.storeKey = key ? key : account + '_' + code + '_strategies';
        this.account = account;
        this.code = code;
        this.strategies = {};
        this.grptype = str.grptype ? str.grptype : 'GroupStandard';
        this.initStrategies(str.strategies);
        this.transfers = {};
        this.initTransfers(str.transfers);
        if (str.count0) {
            this.count0 = str.count0;
        }
        if (str.amount) {
            this.amount = str.amount;
        }
        if (str.uramount) {
            this.uramount = str.uramount;
        }
        if (str.gmeta) {
            this.gmeta = str.gmeta;
        }
        this.buydetail = new BuyDetail(str.buydetail, str.buydetail_full);
    }

    enabled() {
        return Object.values(this.strategies).filter(s=>s.enabled()).length > 0;
    }

    initStrategies(strs) {
        for (var id in strs) {
            this.strategies[id] = strategyFac.create(strs[id]);
        };
    }

    getNextValidId() {
        return Math.max(...Object.keys(this.strategies), -1) + 1;
    }

    addStrategy(str) {
        let merged = false;
        for (var sdat of Object.values(this.strategies)) {
            if (sdat.data.key === str.key) {
                Object.assign(sdat.data, str);
                merged = true;
                break;
            }
        }
        if (!merged) {
            var id = this.getNextValidId();
            this.strategies[id] = strategyFac.create(str);
        }
        this.save();
    }

    addStrategyGroup(strgrp) {
        var id = this.getNextValidId();
        var idmap = {'-1':'-1'};
        for (var oid in strgrp.strategies) {
            this.strategies[id] = strategyFac.create(strgrp.strategies[oid]);
            idmap[oid] = id;
            ++id;
        }

        for (var id in strgrp.transfers) {
            this.transfers[idmap[id]] = new StrategyTransferConnection(idmap[strgrp.transfers[id]]);
        }
        this.save();
    }

    disableStrategy(skey) {
        for (const id in this.strategies) {
            if (this.strategies[id] && this.strategies[id].key() == skey) {
                if (this.strategies[id].enabled()) {
                    this.strategies[id].setEnabled(false);
                    this.save();
                }
                break;
            }
        }
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
        if (this.buydetail && this.buydetail.full_records && this.buydetail.full_records.length > 0) {
            var fcount = 0;
            for (const record of this.buydetail.full_records) {
                if (record.type === 'B') {
                    fcount -= -record.count;
                } else {
                    fcount -= record.count;
                }
            }
            if (this.buydetail.totalCount() - fcount != 0) {
                data.buydetail_full = this.buydetail.records;
            } else {
                data.buydetail_full = this.buydetail.full_records;
            }
        }
        if (this.count0 !== undefined) {
            data.count0 = this.count0;
        }
        if (this.amount !== undefined) {
            data.amount = this.amount;
        }
        if (this.uramount !== undefined) {
            data.uramount = this.uramount;
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
        emjyBack.log('updateBuyDetail', this.code, sid, price, count, JSON.stringify(this.buydetail.records), JSON.stringify(this.full_records));
        this.buydetail.updateBuyDetail(sid, price, count);
    }

    updateSellDetail(sid, price, count) {
        emjyBack.log('updateSellDetail', this.code, sid, price, count);
        this.buydetail.updateSellDetail(sid, price, count);
    }

    archiveBuyDetail() {
        emjyBack.log('archiveBuyDetail', this.code, JSON.stringify(this.buydetail.full_records));
        if (this.uramount && this.buydetail.totalCount() == 0) {
            emjyBack.log('archiveBuyDetail.settleUr', this.buydetail.totalCount(), JSON.stringify(this.buydetail.records));
            emjyBack.costDog.settleUr(this.uramount.key, this.buydetail.calcEarning(), this.uramount.id);
            delete(this.uramount);
        }
        this.buydetail.archiveRecords();
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
        var amount = 10000;
        if (this.amount && this.amount > 0) {
            amount = this.amount;
        };
        if (this.uramount && this.uramount.key) {
            var ur = emjyBack.costDog.urBuyCount(this.uramount.key, this.code, amount, price);
            if (ur.id && ur.id != '0') {
                this.uramount.id = ur.id;
            }
            this.count0 = ur.count;
        } else {
            this.count0 = guang.calcBuyCount(amount, price);
        }
        return this.count0;
    }

    async checkStockRtSnapshot(is1time, islazy=true) {
        let changed = false;
        for (const [id, s] of Object.entries(this.strategies)) {
            if (!s.enabled() || !['otp', 'rtp', 'kzt', 'zt'].includes(s.guardLevel())) {
                continue;
            }
            if (ses.SellStrategyKeyNames[s.key()] && this.buydetail.availableCount() == 0) {
                continue;
            }

            let snap = null;
            if (is1time) {
                if (s.guardLevel() !== 'otp') continue;
                if (s.data.bway === 'direct' && this.count0) {
                    snap = { latestPrice: 0, count: this.count0 };
                }
            } else if (!islazy && !s.highspeed) {
                continue;
            }

            if (!snap) {
                snap = await feng.getStockSnapshot(this.code);
            }
            const matchResult = await s.check({id, rtInfo: snap, buydetail: this.buydetail});
            if (!matchResult) {
                continue;
            }
            const tradeResult = await this.doTrade(matchResult);
            if (tradeResult) {
                s.confirmMatched(tradeResult);
            }
            changed = true;
        }
        if (changed) {
            this.save();
        }
    }

    async checkStockRtKlines(klt) {
        let changed = false;
        for (const [id, s] of Object.entries(this.strategies)) {
            if (!s.enabled() || typeof(s.checkKlines) !== 'function' || !['kline', 'klines', 'kday', 'kzt'].includes(s.guardLevel())) {
                continue;
            }
            if (ses.SellStrategyKeyNames[s.key()] && this.buydetail.availableCount() == 0) {
                continue;
            }

            const canklt = [1,2,4,8].map(i => String(i * klt));
            let skl = s.kltype();
            if (typeof skl === 'string') {
                skl = [skl];
            }
            if (skl.filter(k => canklt.includes(k)).length <= 0) {
                continue;
            }

            const kline = await feng.getStockKline(this.code, klt);
            const matchResult = await s.checkKlines({id, code:this.code, kltypes: Object.keys(kline), buydetail: this.buydetail});
            if (!matchResult) {
                continue;
            }
            const tradeResult = await this.doTrade(matchResult);
            if (tradeResult) {
                s.confirmMatched(tradeResult, this.buydetail);
            }
            changed = true;
        }
        if (changed) {
            this.save();
        }
    }

    async doTrade(info) {
        if (info.tradeType === undefined) {
            return false;
        }

        var curStrategy = this.strategies[info.id];
        if (!curStrategy) {
            return false;
        }

        if (info.tradeType === undefined) {
            emjyBack.log('error in doTrade! info.tradeType is undefined');
            return false;
        }

        if (info.count !== undefined && info.count - 0 > 0) {
            this.count0 = info.count;
        } else if (this.amount && info.price) {
            this.count0 = this.getBuyCount(info.price);
        }
        var price = info.price === undefined ? 0 : info.price;
        if (!info.fixed && (this.account == 'normal' || this.account == 'collat')) {
            price = 0;
        }
        if (info.tradeType == 'B') {
            var account = curStrategy.data.account === undefined ? this.account : curStrategy.data.account;
            var count = this.count0;
            emjyBack.log('checkStrategies buy match', account, this.code, 'buy count:', count, 'price', price, JSON.stringify(curStrategy), 'buy detail', JSON.stringify(this.buydetail.records))
            const bd = await emjyBack.tryBuyStock(this.code, price, count, account);
            this.onTradeMatch(info);
            return bd;
        } else if (info.tradeType == 'S') {
            var count = this.count0;
            if (info.count - 10 >= 0) {
                count = info.count;
            }
            if (count > 0) {
                emjyBack.log('checkStrategies sell match', this.account, this.code, 'sell count:', count, 'price', info.price, JSON.stringify(curStrategy), 'aver price', this.buydetail.averPrice(), 'buy detail', JSON.stringify(this.buydetail.records));
                try {
                    const sd = await emjyBack.trySellStock(this.code, price, count, this.account);
                    this.onTradeMatch(info);
                    return sd;
                } catch(err) {
                    if (err) {
                        this.checkTradeError(info, err);
                    }
                    this.onTradeMatch(info);
                };
            }
        }
    }

    checkTradeError(refer, err) {
        var curStrategy = this.strategies[refer.id];
        if (err && err.details && err.details.Message.includes('可用股份数不足')) {
            curStrategy.setEnabled(false);
        }
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
        if (tid == refer.id) {
            return;
        }
        if (tid >= 0) {
            this.strategies[tid].setEnabled(true);
            if (refer.tradeType == 'B') {
                this.strategies[tid].buyMatch(refer);
            } else {
                this.strategies[tid].sellMatch(refer);
            };
        };
        this.save();
    }

    async updateKlines() {
        const date = await guang.getLastTradeDate();
        const kmaps = {
            '1': { t: ['1', '2', '4', '8'], etime: date + ' 15:00' },
            '15': { t: ['15', '30', '60', '120'], etime: date + ' 15:00' },
            '101': { t: ['101', '202', '404', '808'], etime: date },
        };
        const code = this.code;
        const klsNeedUpdate = (kls_1, bk, ck) => {
            if (!kls_1 || !kls_1.klines) return true;

            const bkKline = kls_1.klines[bk]?.slice(-1)[0]?.time;
            const ckKline = kls_1.klines[ck]?.slice(-1)[0]?.time;
            const targetTime = kmaps[bk].etime;

            if (bkKline === targetTime && ckKline === targetTime) return false;
            if (bkKline === targetTime && ckKline !== targetTime) kls_1.removeAll();

            return true;
        };
        const getBaseKlt = function (k_1) {
            for (const a in kmaps) {
                if (kmaps[a].t.includes(k_1)) {
                    return a;
                }
            }
        };
        const uppromise = [];
        for (const strategy of Object.values(this.strategies)) {
            let klt = strategy.kltype();
            if (!klt) {
                continue;
            }
            if (typeof klt === 'string') {
                klt = [klt];
            }

            for (const k_2 of klt) {
                const bkl = getBaseKlt(k_2);
                if (klsNeedUpdate(emjyBack.klines[code], bkl, k_2)) {
                    uppromise.push(feng.getStockKline(code, bkl));
                }
            }
        }
        await Promise.all(uppromise);
        if (!emjyBack.klines[code]) {
            emjyBack.log(code, 'no kline exists!');
            return;
        }
        emjyBack.klines[code].save();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {GroupManager, CostDog};
}
