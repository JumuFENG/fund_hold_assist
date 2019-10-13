# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta

class Holiday():
    """check if is Holiday"""
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = "general")
        self.tablename = "Holidays"

    def isholiday(self, date):
        if not self.sqldb.isExistTable(self.tablename):
            return False
        
        (result,), = self.sqldb.select(self.tablename, "count(*)", "%s = '%s'" % (column_date, date))
        return result and result != 0

    def addholiday(self, date):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {column_date:'varchar(20) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.tablename, attrs, constraint)

        if not self.isholiday(date):
            self.sqldb.insert(self.tablename, {column_date: date})

class DateConverter():
    def days_since_2000(self, date):
        d = datetime.strptime("2000-01-01", "%Y-%m-%d")
        if isinstance(date, str):
            dt = datetime.strptime(date, "%Y-%m-%d")
            return (dt - d).days
        return (date - d).days

    def date_by_delta(self, days):
        d = datetime.strptime("2000-01-01", "%Y-%m-%d") + timedelta(days=days)
        return d.strftime("%Y-%m-%d")
