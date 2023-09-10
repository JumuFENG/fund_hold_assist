# Python 3
# -*- coding:utf-8 -*-

from utils import *

class TableCopy():
    """
    A class to copy and sync table data between databases.
    """
    def CopyTo(self, fromDb, toDb, fromtable, totable):
        """
        Copy a table from one database to another.

        Args:
            fromDb: Source database connection.
            toDb: Destination database connection.
            fromtable: Source table name.
            totable: Destination table name.
        """
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
        """
        Update a table in the destination database from the source database.

        Args:
            fromDb: Source database connection.
            toDb: Destination database connection.
            fromtable: Source table name.
            totable: Destination table name.
        """
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
            headers.append(cnm)
            if not cnm == 'id':
                if not toDb.isExistTableColumn(totable, cnm):
                    toDb.addColumn(totable, cnm, ctp + ' DEFAULT ' + ('NULL' if cdef is None else cdef))
            else:
                condkeys.append(cnm)

        valuesMore = fromDb.select(fromtable, headers, order=" ORDER BY id ASC")
        toDb.insertUpdateMany(totable, headers, condkeys, valuesMore)

    def getTableHeaders(self, sqldb, tablename, include_all=False):
        """
        Get the headers (column names) of a table.

        Args:
            sqldb: Database connection.
            tablename: Table name.
            include_all: If True, include all headers; if False, exclude 'id' column.

        Returns:
            List of table headers.
        """
        result = sqldb.select("information_schema.columns", "column_name", ["table_name = '%s'" % tablename, "table_schema = '%s'" % sqldb.database], order=" ORDER BY ordinal_position ASC")
        headers = []
        for cnm, in result:
            if include_all or cnm != 'id':
                headers.append(cnm)
        return headers

    def UpdateRows(self, fromDb, toDb, fromtable, totable, rowIds):
        """
        Update specific rows in a destination table from the source table.

        Args:
            fromDb: Source database connection.
            toDb: Destination database connection.
            fromtable: Source table name.
            totable: Destination table name.
            rowIds: List of row IDs to update.
        """
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
        """
        Replace all occurrences of a value in a table with a new value.

        Args:
            tarDb: Database connection.
            tablename: Table name.
            oldVal: Value to be replaced.
            newVal: New value to replace with.
        """
        if not tarDb.isExistTable(tablename):
            print("no table named", tablename)
            return

        headers = self.getTableHeaders(tarDb, tablename, True)
        values = tarDb.select(tablename, headers, order=" ORDER BY id ASC")

        for x in values:
            for i in range(1, len(headers)):
                if x[i] == oldVal:
                    tarDb.update(tablename, {headers[i]:newVal}, {'id':str(x[0])})
