# Python 3
# -*- coding:utf-8 -*-

import requests
import json
from utils import *
from datetime import datetime, timedelta
from threading import Lock

class TradingDate():
    '''
    从上证指数历史记录中查询是否是交易日
    '''
    sqldb = SqlHelper(password=db_pwd, database=history_db_name)
    max_trading_date = None
    tmp_trading_dates = []
    sqllock = Lock()

    @classmethod
    def __tablename(self, date):
        # 'i_k_his_000001' # start: 2019-12-31 to latest
        # 'i_ful_his_000001' # start: 1990-12-19 end: 2020-04-30
        return 'i_k_his_000001' if date >= '2020-01-10' else 'i_ful_his_000001'

    @classmethod
    def renewSql(self):
        self.sqldb = SqlHelper(password=db_pwd, database=history_db_name)

    @classmethod
    def isTradingDate(self, date):
        if date == self.max_trading_date:
            return True
        if date in self.tmp_trading_dates:
            return True
        self.sqllock.acquire()
        ret = 0 != self.sqldb.selectOneValue(self.__tablename(date), 'count(*)', f'{column_date} = "{date}"')
        self.sqllock.release()
        return ret

    @classmethod
    def nextTradingDate(self, date):
        if self.max_trading_date is not None and date == self.max_trading_date:
            return self.max_trading_date
        if len(self.tmp_trading_dates) == 0 or self.tmp_trading_dates[0] > date:
            self.sqllock.acquire()
            dates = self.sqldb.select(self.__tablename(date), column_date, f'{column_date} >= "{date}"')
            self.sqllock.release()
            self.tmp_trading_dates = [d for d, in dates]
        if len(self.tmp_trading_dates) == 0 or date == self.tmp_trading_dates[-1]:
            return self.maxTradingDate()
        if date not in self.tmp_trading_dates:
            if self.tmp_trading_dates[0] > date:
                return self.tmp_trading_dates[0]
            for d in self.tmp_trading_dates:
                if d > date:
                    return d
        return self.tmp_trading_dates[self.tmp_trading_dates.index(date) + 1]

    @classmethod
    def prevTradingDate(self, date):
        if self.tmp_trading_dates is not None and date > self.tmp_trading_dates[0] and date in self.tmp_trading_dates:
            return self.tmp_trading_dates[self.tmp_trading_dates.index(date) - 1]
        self.sqllock.acquire()
        prev = self.sqldb.selectOneValue(self.__tablename(date), 'max(date)', f'{column_date} < "{date}"')
        self.sqllock.release()
        return prev

    @classmethod
    def calcTradingDays(self, bdate, edate):
        if len(self.tmp_trading_dates) == 0 or self.tmp_trading_dates[0] > bdate:
            self.sqllock.acquire()
            dates = self.sqldb.select(self.__tablename(bdate), column_date, f'{column_date} >= "{bdate}"')
            self.sqllock.release()
            self.tmp_trading_dates = [d for d, in dates]
        return len([d for d in self.tmp_trading_dates if d >= bdate and d <= edate])

    @classmethod
    def maxTradingDate(self):
        if self.max_trading_date is not None:
            return self.max_trading_date
        self.sqllock.acquire()
        d = self.sqldb.selectOneValue('i_k_his_000001', 'max(date)')
        self.sqllock.release()
        if d != Utils.today_date():
            self.renewSql()
            self.sqllock.acquire()
            d = self.sqldb.selectOneValue('i_k_his_000001', 'max(date)')
            self.sqllock.release()
            if d != Utils.today_date():
                sys_date, tradeday = self.get_today_system_date()
                Utils.log(f'TradingDate.maxTradingDate get_today_system_date {sys_date}, {tradeday}')
                if tradeday:
                    self.max_trading_date = sys_date
                    return sys_date
        self.max_trading_date = d
        return d

    @classmethod
    def get_today_system_date(self):
        url = 'http://www.sse.com.cn/js/common/systemDate_global.js'
        sse = requests.get(url)
        if sse.status_code == 200:
            if 'var systemDate_global' in sse.text:
                sys_date = sse.text.partition('var systemDate_global')[2].strip(' =;')
                sys_date = sys_date.split()[0].strip(' =;"')
            if 'var whetherTradeDate_global' in sse.text:
                istrading_date = sse.text.partition('var whetherTradeDate_global')[2].strip(' =;')
                istrading_date = istrading_date.split()[0].strip(' =;')

            return sys_date, json.loads(istrading_date.lower())
        return None, None

    @classmethod
    def isholiday(self, date):
        if self.isTradingDate(date):
            return False

        if date == Utils.today_date():
            sys_date, tradeday = self.get_today_system_date()
            return not tradeday

        return True


class Holiday():
    """check if is Holiday"""
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = general_db_name)
        self.tablename = "Holidays"

    def isholiday(self, date):
        if not self.sqldb.isExistTable(self.tablename):
            return False
        
        result = self.sqldb.selectOneValue(self.tablename, "count(*)", "%s = '%s'" % (column_date, date))
        return result and result != 0

    def addholiday(self, date):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {column_date:'varchar(20) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)

        if not self.isholiday(date):
            self.sqldb.insert(self.tablename, {column_date: date})

class DateConverter():
    @classmethod
    def days_since_2000(self, date):
        if ' ' in date:
            date = date.split(' ')[0]
        d = datetime.strptime("2000-01-01", "%Y-%m-%d")
        if isinstance(date, str):
            dt = datetime.strptime(date, "%Y-%m-%d")
            return (dt - d).days
        return (date - d).days

    @classmethod
    def date_by_delta(self, days):
        d = datetime.strptime("2000-01-01", "%Y-%m-%d") + timedelta(days=days)
        return d.strftime("%Y-%m-%d")
