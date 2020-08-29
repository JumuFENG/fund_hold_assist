# Python 3
# -*- coding:utf-8 -*-

from utils import *

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

        result = fromDb.select("information_schema.columns", ["column_name", "column_type", "column_default"], ["table_name = '%s'" % fromtable, "table_schema = '%s'" % fromDb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        attrs = {}
        for (cnm, ctp, cdef) in result:
            if not cnm == 'id':
                headers.append(cnm)
                attrs[cnm] = ctp + ' DEFAULT ' + ('NULL' if cdef is None else cdef)

        constraint = 'PRIMARY KEY(`id`)'
        toDb.createTable(totable, attrs, constraint)
        values = fromDb.select(fromtable, headers, order=" ORDER BY id ASC")
        toDb.insertMany(totable, headers, values)

    def Update(self, fromDb, toDb, fromtable, totable):
        if not fromDb.isExistTable(fromtable):
            print("no table named", fromtable)
            return

        if not toDb.isExistTable(totable):
            print(totable, "not exists. call CopyTo()")
            return

        result = fromDb.select("information_schema.columns", ["column_name", "column_type", "column_default"], ["table_name = '%s'" % fromtable, "table_schema = '%s'" % fromDb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        condkeys = []
        for (cnm, ctp, cdef) in result:
            if not cnm == 'id':
                headers.append(cnm)
                if not toDb.isExistTableColumn(totable, cnm):
                    toDb.addColumn(totable, cnm, ctp + ' DEFAULT ' + ('NULL' if cdef is None else cdef))
            else:
                condkeys.append(cnm)

        valuesMore = fromDb.select(fromtable, headers + condkeys, order=" ORDER BY id ASC")
        toDb.insertUpdateMany(totable, headers, condkeys, valuesMore)

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
