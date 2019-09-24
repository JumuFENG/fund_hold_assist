# Python 3
# -*- coding:utf-8 -*-

from utils import *

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
