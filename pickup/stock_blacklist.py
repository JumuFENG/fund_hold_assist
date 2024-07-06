# Python 3
# -*- coding:utf-8 -*-

from utils import *

class StockBlackHotrank(TableBase):
    '''
    人气排行选股黑名单, 人气排行有买入操作时加入黑名单, 加入黑名单后跌出人气排行前20连续5个交易日后移出黑名单
    '''
    def initConstrants(self):
        super().initConstrants()
        self.dbname = stock_db_name
        self.tablename = 'stock_bl_hotrank'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'odate','type':'varchar(20) DEFAULT NULL'},
            {'col':'quit','type':'varchar(20) DEFAULT NULL'},
        ]
        self.blackdetails = None
        self.blacklist = None

    def add(self, code, date=None):
        if code in self.dumpDataByDate():
            return

        if date is None:
            date = Utils.today_date()
        self.sqldb.insert(self.tablename, {column_code: code, column_date: date})
        self.blackdetails.append([code, date, None, None])

    def check_quit(self, ranks, date=None):
        if len(ranks) == 0:
            return

        self.blackdetails = super().dumpDataByDate()
        rks = [c for c, r in ranks]
        if date is None:
            date = Utils.today_date()
        outs = []
        quits = []
        keeps = []
        for c, d, o, q in self.blackdetails:
            if d >= date:
                keeps.append([c, d, o, q])
                continue
            if c not in rks:
                if o is None:
                    outs.append([c, d, date, None])
                    continue
                if q is None:
                    days = TradingDate.calcTradingDays(o, date)
                    if days >= 5:
                        quits.append([c, d, o, date])
                        continue
            keeps.append([c, d, o, q])
        if len(outs) > 0:
            self.sqldb.updateMany(self.tablename, [column_code, column_date, 'odate', 'quit'], [column_code, column_date], outs)
        if len(quits) > 0:
            self.sqldb.updateMany(self.tablename, [column_code, column_date, 'odate', 'quit'], [column_code, column_date, 'odate'], quits)
        self.blackdetails = keeps + outs
        if date == Utils.today_date():
            self.blackdetails += quits

    def getDumpKeys(self):
        return [column_code, column_date, 'odate', 'quit']

    def getDumpCondition(self, date=None):
        if date is None:
            return [f'quit is NULL']
        return [f'{column_date}<"{date}"', f'quit is NULL or quit>"{date}"']

    def dumpDataByDate(self, date=None):
        if self.blackdetails is None:
            self.blackdetails = super().dumpDataByDate(date)
        self.blacklist = [c for c,d,o,q in self.blackdetails]
        return self.blacklist
