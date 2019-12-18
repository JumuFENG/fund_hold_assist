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

class TableCopy():
    """
    to copy a table from on schema to another
    """
    def CopyTo(self, fromDb, toDb, fromtable, totable):
        if not fromDb.isExistTable(fromtable):
            print("no table named", fromtable)
            return
        if toDb.isExistTable(totable):
            print(totable, "already exists.")
            return

        result = fromDb.select("information_schema.columns", ["column_name","column_type"], ["table_name = '%s'" % fromtable, "table_schema = '%s'" % fromDb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        attrs = {}
        for (cnm, ctp) in result:
            if not cnm == 'id':
                headers.append(cnm)
                attrs[cnm] = ctp + ' DEFAULT NULL'

        constraint = 'PRIMARY KEY(`id`)'
        toDb.creatTable(totable, attrs, constraint)
        values = fromDb.select(fromtable, headers, order=" ORDER BY id ASC")
        toDb.insertMany(totable, headers, values)

    def Update(self, fromDb, toDb, fromtable, totable):
        if not fromDb.isExistTable(fromtable):
            print("no table named", fromtable)
            return

        if not toDb.isExistTable(totable):
            print(totable, "not exists. call CopyTo()")
            return

        result = fromDb.select("information_schema.columns", ["column_name","column_type"], ["table_name = '%s'" % fromtable, "table_schema = '%s'" % fromDb.database], order=" ORDER BY ordinal_position ASC")
        colAdded = False
        headers = []
        for (cnm, ctp) in result:
            if not cnm == 'id':
                headers.append(cnm)
                if not toDb.isExistTableColumn(totable, cnm):
                    toDb.addColumn(totable, cnm, ctp + ' DEFAULT NULL')
                    colAdded = True
        colAdded = True
        if colAdded:
            toIds = toDb.select(totable, 'id', order=" ORDER BY id ASC")
            for x in toIds:
                x, = x
                val = fromDb.select(fromtable, headers, ["id = '%s'" % x])
                if not val:
                    continue
                val, = val
                if not val:
                    continue
                valObj = {}
                for i in range(len(headers)):
                    valObj[headers[i]] = str(val[i])
                toDb.update(totable, valObj, {'id':str(x)})

        startId = toDb.select(totable, "max(id)")
        if startId:
            (startId,), = startId
        if not startId:
            startId = 0
        valuesMore = fromDb.select(fromtable, headers, ["id > %d" % startId], order=" ORDER BY id ASC")
        toDb.insertMany(totable, headers, valuesMore)

    def getTableHeaders(self, sqldb, tablename):
        result = sqldb.select("information_schema.columns", "column_name", ["table_name = '%s'" % tablename, "table_schema = '%s'" % sqldb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        for cnm, in result:
            if not cnm == 'id':
                headers.append(cnm)
        return headers

    def getTableAllHeaders(self, sqldb, tablename):
        result = sqldb.select("information_schema.columns", "column_name", ["table_name = '%s'" % tablename, "table_schema = '%s'" % sqldb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        for cnm, in result:
            headers.append(cnm)
        return headers

    def UpdateRows(self, fromDb, toDb, fromtable, totable, rowIds):
        if not fromDb.isExistTable(fromtable):
            print("no table named", fromtable)
            return

        if not toDb.isExistTable(totable):
            print(totable, "not exists. call CopyTo()")
            return

        headers = self.getTableHeaders(fromDb, fromtable)
        for rowId in rowIds:
            values, = fromDb.select(fromtable, headers, "id = %d" % rowId)
            valObj = {}
            for i in range(len(headers)):
                valObj[headers[i]] = str(values[i])
            toDb.update(totable, valObj, {'id':str(rowId)})

    def ReplaceAllValues(self, tarDb, tablename, oldVal, newVal):
        if not tarDb.isExistTable(tablename):
            print("no table named", tablename)
            return

        headers = self.getTableAllHeaders(tarDb, tablename)
        values = tarDb.select(tablename, headers, order=" ORDER BY id ASC")

        for x in values:
            for i in range(1, len(headers)):
                if x[i] == oldVal:
                    tarDb.update(tablename, {headers[i]:newVal}, {'id':str(x[0])})
