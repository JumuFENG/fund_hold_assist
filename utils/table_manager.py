# Python 3
# -*- coding:utf-8 -*-

from utils import *

class TableCopy():
    """
    A class to copy and sync table data between databases.
    """
    def get_primary_key(self, fromDb, fromtable):
        """获取原表的主键列"""
        result = fromDb.select('information_schema.key_column_usage', 'column_name', f"table_schema = '{fromDb.database}' AND table_name = '{fromtable}' AND constraint_name = 'PRIMARY'")
        if result:
            return [row[0] for row in result]  # 返回主键列名列表
        return None  # 没有主键

    def CopyTo(self, fromDb, toDb, fromtable, totable):
        """
        Copy a table from one database to another.

        Args:
            fromDb: Source database connection.
            toDb: Destination database connection.
            fromtable: Source table name.
            totable: Destination table name.
        """
        # 检查原表是否存在
        if not fromDb.isExistTable(fromtable):
            print("no table named", fromtable)
            return

        # 检查目标表是否已存在
        if toDb.isExistTable(totable):
            print(totable, "already exists.")
            return

        # 获取原表的列信息
        result = fromDb.select(
            "information_schema.columns",
            ["column_name", "column_type", "column_default", "is_nullable"],
            [f"table_name = '{fromtable}'", f"table_schema = '{fromDb.database}'"],
            order=" ORDER BY ordinal_position ASC"
        )
        if not result:
            print(f"Failed to get column info for table {fromtable}")
            return

        # 解析列信息
        headers = []
        attrs = {}
        for (cnm, ctp, cdef, is_nullable) in result:
            if cnm == 'id':
                continue
            headers.append(cnm)
            stp = ctp.decode('utf-8') if isinstance(ctp, bytes) else ctp
            default = ('NULL' if is_nullable == 'YES' else 'NOT NULL') if cdef is None else f"'{cdef}'"
            attrs[cnm] = f"{stp} DEFAULT {default}"

        # 获取原表的主键信息
        primary_keys = self.get_primary_key(fromDb, fromtable)
        if primary_keys != ['id']:
            print('Primary key is not id copy manually if necessary!', fromtable)
            return
        if primary_keys:
            constraint = f"PRIMARY KEY(`{'`,`'.join(primary_keys)}`)"
        else:
            constraint = None  # 没有主键

        # 创建新表
        toDb.createTable(totable, attrs, constraint)

        # 复制数据
        values = fromDb.select(fromtable, headers, order=f" ORDER BY {','.join(primary_keys)} ASC" if primary_keys else '')
        if values is None:
            print(f'CopyTo failed {fromtable} -> {totable}')
            return
        toDb.insertMany(totable, headers, values)
        print(f"Table {fromtable} copied to {totable} successfully!")

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

        primary_keys = self.get_primary_key(fromDb, fromtable)

        valuesMore = fromDb.select(fromtable, headers, order=f" ORDER BY {','.join(primary_keys)} ASC" if primary_keys else '')
        if valuesMore is None:
            print(f'Update failed {fromtable} -> {totable}')
            return
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
