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
            allkl = sd.read_kd_data(code, length=50, start=(sdate - timedelta(days=10)).strftime('%Y-%m-%d'))
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
