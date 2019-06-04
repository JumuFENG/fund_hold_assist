# Python 3
# -*- coding:utf-8 -*-

from utils import *

class TableManager():
    """
    the basic class to manage info tables
    """
    def __init__(self, sqldb, tablename, code):
        self.sqldb = sqldb
        self.tablename = tablename
        self.code = code
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {column_code:'varchar(20) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.tablename, attrs, constraint)
        
        if not self.sqldb.select(self.tablename, [column_code], "%s = '%s'" %(column_code, self.code)):
            params = {column_code:self.code}
            self.sqldb.insert(self.tablename, params)
        
    def GetTableColumnInfo(self, col, defval, tp = 'varchar(64) DEFAULT NULL'):
        if not self.sqldb.isExistTable(self.tablename):
            print(self.tablename, "table not exists!")
            return

        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)
        col_info = self.sqldb.select(self.tablename, fields=[col], conds = "%s = '%s'" % (column_code, self.code))
        
        col_val = None
        if col_info:
            ((col_val,),) = col_info
        if not col_val:
            col_val = defval
            self.sqldb.update(self.tablename, {col:col_val}, {column_code:"%s" % self.code})

        return col_val
