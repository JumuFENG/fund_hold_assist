# Python 3
# -*- coding:utf-8 -*-

import requests
import json
from utils import *
from datetime import datetime, timedelta

class TradingDate():
    '''
    从上证指数历史记录中查询是否是交易日
    '''
    sqldb = SqlHelper(password=db_pwd, database=history_db_name)

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
        return 0 != self.sqldb.selectOneValue(self.__tablename(date), 'count(*)', f'{column_date} = "{date}"')

    @classmethod
    def nextTradingDate(self, date):
        d = self.sqldb.selectOneValue(self.__tablename(date), 'min(date)', f'{column_date} > "{date}"')
        if d is None:
            return self.maxTradingDate()
        return d

    @classmethod
    def prevTradingDate(self, date):
        return self.sqldb.selectOneValue(self.__tablename(date), 'max(date)', f'{column_date} < "{date}"')

    @classmethod
    def maxTradingDate(self):
        d = self.sqldb.selectOneValue('i_k_his_000001', 'max(date)')
        if d != Utils.today_date():
            self.renewSql()
            d = self.sqldb.selectOneValue('i_k_his_000001', 'max(date)')
            if d != Utils.today_date():
                sys_date, tradeday = self.get_today_system_date()
                print('TradingDate.maxTradingDate', 'get_today_system_date', sys_date, tradeday)
                if tradeday:
                    return sys_date
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
