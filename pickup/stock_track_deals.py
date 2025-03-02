# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from threading import Thread

class StockTrackDeals(TableBase):
    '''
    模拟账户的交易记录
    '''
    def initConstrants(self):
        super().initConstrants()
        self.dbname = stock_db_name
        self.tablename = 'stock_track_deals_table'
        self.colheaders = [
            {'col':column_name,'type':'varchar(64) DEFAULT NULL'},
            {'col':'description','type':'varchar(255) DEFAULT NULL'}
        ]
        self.dealsheaders = [
            {'col': column_date, 'type':'varchar(20) DEFAULT NULL'},
            {'col': column_code, 'type':'varchar(10) DEFAULT NULL'},
            {'col': column_type, 'type':'varchar(10) DEFAULT NULL'},
            {'col': '委托编号', 'type':'varchar(10) DEFAULT NULL'},
            {'col': column_price, 'type':'double(16,4) DEFAULT NULL'},
            {'col': column_portion, 'type':'int DEFAULT NULL'}
        ]

    def removeTrackDealsTable(self, tablename):
        if self.sqldb.isExistTable(tablename):
            self.sqldb.dropTable(tablename)

    def removeTrackDealsRecord(self, trackname):
        if isinstance(trackname, str):
            trackname = [trackname]

        print(trackname)
        for tn in trackname:
            self.removeTrackDealsTable(tn)
            self.sqldb.delete(self.tablename, f'{column_name}="{tn}"')

    def get_available_dealtable(self):
        return self.sqldb.select(self.tablename, f'{column_name}, description')

    def addDeals(self, trackname, deals, desc=None):
        tname = self.sqldb.select(self.tablename, '*', f'{column_name}="{trackname}"')
        if tname is None or len(tname) == 0:
            if desc is None:
                self.sqldb.insert(self.tablename, {column_name: trackname})
            else:
                self.sqldb.insert(self.tablename, {column_name: trackname, 'description': desc})
        elif desc is not None:
            if tname[0][-1] != desc:
                self.sqldb.update(self.tablename, {'description': desc}, {column_name: trackname})

        if len(deals) > 0:
            if not self.sqldb.isExistTable(trackname):
                constraint = 'PRIMARY KEY(`id`)'
                attrs = {kv['col']: kv['type'] for kv in self.dealsheaders}
                self.sqldb.createTable(trackname, attrs, constraint)

            values = []
            for deal in deals:
                ddate = deal['time']
                code = deal['code']
                sid = deal['sid']
                ed = self.sqldb.select(trackname, '*', [f'{column_code}="{code}"', f'{column_date}="{ddate}"', f'委托编号="{sid}"'])
                if ed is None or len(ed) == 0:
                    values.append([deal['time'], code, deal['tradeType'], sid, deal['price'], deal['count']])
                elif ed[0][-1] != deal['count']:
                    self.sqldb.update(trackname, {column_portion: deal['count']}, {'id': ed[0][0]})

            if len(values) > 0:
                attrs = [kv['col'] for kv in self.dealsheaders]
                self.sqldb.insertMany(trackname, attrs, values)

    def dump_deals_summary(self):
        names = self.sqldb.select(self.tablename, f'{column_name}')
        summa = {}
        for n, in names:
            summa[n] = self.get_deals(n)

        for k, v in summa.items():
            print(k)
            print(v)

    def get_deals(self, dtable):
        deals = self.sqldb.select(dtable, '*')
        track = {'tname': dtable}
        ds = []
        if deals is not None:
            for _,d,c,tp,sid,pr,ptn in deals:
                fee = 0
                if sid != '0':
                    fYhGh = self.sqldb.selectOneRow('u11_archived_deals', f'{column_fee}, 印花税, 过户费', [f'{column_code}="{StockGlobal.full_stockcode(c)}"', f'委托编号="{sid}"'])
                    if fYhGh is not None:
                        fee, fYh, fGh = fYhGh
                        fee = round(fee + fYh + fGh, 3)
                ds.append({'code': c, 'time': d, 'tradeType': tp, 'sid': sid, 'price': pr, 'count': ptn, 'fee': fee})
        track['deals'] = ds
        return track

    def get_stocks_in_deals(self, dtable):
        d = self.sqldb.select(dtable, f'{column_code}', order=f'group by {column_code}')
        return [x for x, in d]

    def fork_deals(self, ftrackname, ttrackname, startdate='2024-02-19', maxbuy=0):
        '''从现存的记录中选出符合条件的记录保存到新的表中
        @param ftrackname: 原始交易记录表名
        @param ttrackname: 新的交易记录表名
        @param startdate: 开始日期, 只选择建仓日期大于该日期的记录
        @param maxbuy: 最大买入次数, 0表示保持原样, 1 表示不加仓, 2 表示加仓一次
        '''
        fname = self.sqldb.select(self.tablename, '*', f'{column_name}="{ftrackname}"')
        if fname is None or len(fname) == 0:
            print('deals table not exist', ftrackname)
            return

        tname = self.sqldb.select(self.tablename, '*', f'{column_name}="{ttrackname}"')
        if tname is None or len(tname) == 0:
            self.sqldb.insert(self.tablename, {column_name: ttrackname})
        else:
            self.removeTrackDealsRecord(ttrackname)

        deals = self.sqldb.select(ftrackname, '*')
        ds = []
        cur = None
        curbuy = None
        dsdic = {}
        for _,d,c,tp,sid,pr,ptn in deals:
            if tp == 'B' and curbuy is None:
                curbuy = d
            if cur is None and tp == 'B':
                if d < startdate:
                    continue
                else:
                    cur = c
            if cur is None and tp == 'S':
                continue
            if curbuy < startdate:
                if tp == 'S':
                    curbuy = None
                continue
            fee = 0
            deal = {'code': c, 'time': d, 'tradeType': tp, 'sid': sid, 'price': pr, 'count': ptn, 'fee': fee}
            ds.append(deal)
            if c not in dsdic:
                dsdic[c] = []
            dsdic[c].append(deal)
            if tp == 'S':
                cur = None
                curbuy = None
        if maxbuy == 0:
            self.addDeals(ttrackname, ds)
            return
        dsarr = []
        ds = []
        for c in dsdic:
            cds = []
            count = 0
            for dl in dsdic[c]:
                if dl['tradeType'] == 'B':
                    cds.append(dl)
                    count += dl['count']
                if dl['tradeType'] == 'S':
                    cds.append(dl)
                    count -= dl['count']
                    if count == 0:
                        dsarr.append(cds)
                        cds = []
        for dlarr in dsarr:
            if len([dl for dl in dlarr if dl['tradeType'] == 'B']) <= maxbuy:
                ds += dlarr
            else:
                mds = []
                for dl in dlarr:
                    if len(mds) < maxbuy:
                        mds.append(dl)
                dl = dlarr[maxbuy]
                dl['tradeType'] = 'S'
                dl['count'] = sum([x['count'] for x in mds])
                mds.append(dl)
                ds += mds

        self.addDeals(ttrackname, ds)

    def rebuild_count(self, ftrackname, ttrackname):
        '''重新设置买卖数量(仓位)
        @param ftrackname: 原始交易记录表名
        @param ttrackname: 新的交易记录表名
        '''
        fname = self.sqldb.select(self.tablename, '*', f'{column_name}="{ftrackname}"')
        if fname is None or len(fname) == 0:
            print('deals table not exist', ftrackname)
            return

        tname = self.sqldb.select(self.tablename, '*', f'{column_name}="{ttrackname}"')
        if tname is None or len(tname) == 0:
            self.sqldb.insert(self.tablename, {column_name: ttrackname})
        else:
            self.removeTrackDealsRecord(ttrackname)

        deals = self.sqldb.select(ftrackname, '*')
        dsdic = {}
        sell_ds = []
        for _,d,c,tp,sid,pr,ptn in deals:
            deal = {'code': c, 'time': d, 'tradeType': tp, 'sid': sid, 'price': pr, 'count': ptn, 'fee': 0}
            if tp == 'S':
                sell_ds.append(deal)
            if c not in dsdic:
                dsdic[c] = []
            dsdic[c].append(deal)
        sell_ds = sorted(sell_ds, key=lambda d: d['time'])

        buy_ds = []
        for c in dsdic:
            hcount = 0
            for dl in dsdic[c]:
                if hcount == 0 and dl['tradeType'] == 'B':
                    buy_ds.append(dl)
                if dl['tradeType'] == 'B':
                    hcount += dl['count']
                else:
                    hcount -= dl['count']
        buy_ds = sorted(buy_ds, key=lambda d: d['time'])

        amt_base = 5000
        amt_max = 20000
        expect_earn_rate = 0.05
        max_single_cover = amt_max * expect_earn_rate
        to_ds = []
        for dls in sell_ds:
            bcost = 0
            tmpds = []
            while len(dsdic[dls['code']]) > 0:
                bdl = dsdic[dls['code']].pop(0)
                tmpds.append(bdl)
                if bdl['time'] < dls['time'] and bdl['tradeType'] == 'B':
                    bcost += bdl['price'] * bdl['count']
                if bdl['time'] == dls['time'] and bdl['tradeType'] == 'S':
                    break

            to_ds += tmpds
            if bcost > dls['price'] * dls['count']:
                lost = bcost - dls['price']*dls['count']
                lost_split = round(lost / max_single_cover)
                if max_single_cover * lost_split < lost:
                    lost_split += 1
                while len(buy_ds) > 0:
                    if buy_ds[0]['time'] > dls['time']:
                        break
                    buy_ds.pop(0)
                newcost = round((lost / lost_split) / expect_earn_rate)
                if newcost < amt_base:
                    newcost += amt_base
                elif newcost < 2 * amt_base:
                    newcost = 2 * amt_base
                print(lost, lost_split, newcost)
                for i in range(0, lost_split):
                    if len(buy_ds) == 0:
                        print('lost not covered', dls)
                        break
                    bdl = buy_ds.pop(0)
                    buy_id = []
                    sellid = 0
                    for j, tdl in enumerate(dsdic[bdl['code']]):
                        if tdl['time'] < bdl['time']:
                            continue
                        if tdl['tradeType'] == 'B':
                            buy_id.append([j, tdl['count']])
                        else:
                            sellid = j
                            break

                    bcount = Utils.calc_buy_count(newcost, dsdic[bdl['code']][buy_id[0][0]]['price'])
                    if dsdic[bdl['code']][buy_id[0][0]]['count'] == bcount:
                        continue

                    scount = bcount
                    dsdic[bdl['code']][buy_id[0][0]]['count'] = bcount
                    for j in range(1, len(buy_id)):
                        tct = 100 * round(bcount * buy_id[j][1] / (buy_id[0][1] * 100))
                        scount += tct
                        dsdic[bdl['code']][buy_id[j][0]]['count'] = tct
                    dsdic[bdl['code']][sellid]['count'] = scount
                    # print(dls, lost, bdl)

        self.addDeals(ttrackname, to_ds)

    def copy_deals(self, ftrackname, ttrackname, conds=''):
        '''简单复制，将符合条件的交易记录从一个表中复制到另一个表中，不做任何检查'''
        deals = self.sqldb.select(ftrackname, '*', conds)
        ds = []
        for _,d,c,tp,sid,pr,ptn in deals:
            fee = 0
            ds.append({'code': c, 'time': d, 'tradeType': tp, 'sid': sid, 'price': pr, 'count': ptn, 'fee': fee})
        self.addDeals(ttrackname, ds)

    def copy_deals1(self, ftrackname, ttrackname, selecor=None):
        '''简单复制，将符合条件的交易记录从一个表中复制到另一个表中，selector为检查回调'''
        deals = self.sqldb.select(ftrackname, '*')
        ds = []
        for _,d,c,tp,sid,pr,ptn in deals:
            if callable(selecor):
                if not selecor((d,c,tp,sid,pr,ptn)):
                    continue
            fee = 0
            ds.append({'code': c, 'time': d, 'tradeType': tp, 'sid': sid, 'price': pr, 'count': ptn, 'fee': fee})
        self.addDeals(ttrackname, ds)


class StockTrackDealReview(TableBase):
    def __init__(self) -> None:
        super().__init__(False)
        self._check_table_exists()

    def initConstrants(self):
        self.threads_num = 2
        self.dbname = stock_db_name
        self.tablename = 'stock_track_review'
        self.colheaders = [
            {'col': column_code, 'type':'varchar(10) DEFAULT NULL'},
            {'col': column_date, 'type':'varchar(20) DEFAULT NULL'},
            {'col': 'sdate', 'type':'varchar(20) DEFAULT NULL'}
        ]

    def walk_prepare(self, track_simtable):
        simdeals = self.sqldb.select(track_simtable, [column_date, column_code, column_type, column_price])
        self.wkstocks = []
        record = []
        for d,c,t,p in simdeals:
            if t == 'B':
                if len(record) == 0:
                    record = [c, d]
            elif t == 'S':
                if len(record) == 2 and record[0] == c:
                    record.append(d)
                if len(record) == 3:
                    self.wkstocks.append(record)
                    record = []
        self.wkselected = []

    def walkOnHistory(self, track_simtable):
        self.walk_prepare(track_simtable)

        ctime = datetime.now()
        wk_thds = []
        for x in range(0, self.threads_num):
            t = Thread(target=self.walk_on_history_thread)
            t.start()
            wk_thds.append(t)

        for t in wk_thds:
            t.join()

        print('time used:', datetime.now() - ctime)
        self.walk_post_process()

    def walk_on_history_thread(self):
        sd = StockDumps()
        while len(self.wkstocks) > 0:
            code, d1, d2 = self.wkstocks.pop(0)
            sdate = datetime.strptime(d1, '%Y-%m-%d')
            allkl = sd.read_kd_data(code, length=50, start=(sdate - timedelta(days=12)).strftime('%Y-%m-%d'))
            allkl = [KNode(kl) for kl in allkl]
            for i in range(1, len(allkl)):
                if allkl[i].date == d1:
                    if (allkl[i].close - allkl[i].open) / allkl[i-1].close < -0.08:
                        self.wkselected.append([code, d1, d2])
                        break

    def walk_post_process(self):
        if self.sqldb.isExistTable(self.tablename):
            self.sqldb.dropTable(self.tablename)
            self._check_or_create_table()

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.wkselected)

    def dumpTrackReviews(self):
        if not self._check_table_exists():
            return
        return self.sqldb.select(self.tablename, [col['col'] for col in self.colheaders])

    def dumpDztLongBear(self):
        ''' 买入当日长阴线
        '''
        self.walkOnHistory('track_sim_dzt')
