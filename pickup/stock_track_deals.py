# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *

class StockTrackDeals(TableBase):
    '''
    模拟账户的交易记录
    '''
    def initConstrants(self):
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

    def addDeals(self, trackname, deals, desc=None):
        tname = self.sqldb.select(self.tablename, '*', f'{column_name}="{trackname}"')
        if tname is None or len(tname) == 0:
            if desc is None:
                self.sqldb.insert(self.tablename, {column_name: trackname})
            else:
                self.sqldb.insert(self.tablename, {column_name: trackname, 'description': desc})

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

            if len(values) > 0:
                attrs = [kv['col'] for kv in self.dealsheaders]
                self.sqldb.insertMany(trackname, attrs, values)

    def dump_deals_summary(self):
        names = self.sqldb.select(self.tablename, f'{column_name}')
        summa = {}
        for n, in names:
            deals = self.sqldb.select(n, '*')
            ds = []
            trade = {}
            track = {'earn': 0, 'count': 0, 'suc':0, 'fai': 0}
            for _, d, c, tp, sid, pr, ptn in deals:
                if c not in trade:
                    trade[c] = {}
                if tp == 'B':
                    trade[c]['buy'] = [d, pr, ptn]
                else:
                    trade[c]['sell'] = [d, pr, ptn]

                if 'buy' in trade[c] and 'sell' in trade[c]:
                    earn = (trade[c]['sell'][1] - trade[c]['buy'][1])/trade[c]['buy'][1]
                    ds.append([c, trade[c]['buy'][0], trade[c]['buy'][1], trade[c]['sell'][0], trade[c]['sell'][1], round(earn, 4)])
                    track['earn'] += earn
                    track['count'] += 1
                    if earn > 0:
                        track['suc'] += 1
                    else:
                        track['fai'] += 1
            track['deals'] = ds
            summa[n] = track

        for k, v in summa.items():
            print(k)
            print(v)
