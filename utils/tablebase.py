# Python 3
# -*- coding:utf-8 -*-
from utils import *

class TableBase():
    def __init__(self, autocreate = True) -> None:
        self.initConstrants()
        if autocreate:
            self._check_or_create_table()

    def initConstrants(self):
        self.sqldb = None
        self.dbname = None
        self.tablename = None
        self.colheaders = []

    def _check_table_exists(self):
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)
        return self.sqldb.isExistTable(self.tablename)

    def _check_or_create_table(self):
        if not self._check_table_exists():
            attrs = {self.colheaders[0]['col']: self.colheaders[0]['type']}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)

        for col in self.colheaders:
            self._check_table_column(col['col'], col['type'])

    def _check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)

    def _max_date(self):
        if self.sqldb.isExistTable(self.tablename):
            return self.sqldb.selectOneValue(self.tablename, f"max({column_date})")

    def _select_keys(self, cols):
        if isinstance(cols, str):
            return cols
        assert(isinstance(cols, list))
        return ','.join(cols)

    def _select_condition(self, conds):
        if isinstance(conds, str):
            return conds
        assert(isinstance(conds, list) or isinstance(conds, dict))
        if isinstance(conds, list):
            vcond = []
            for cond in conds:
                assert(isinstance(cond, str))
                vcond.append(cond)
            return vcond
        if isinstance(conds, dict):
            vcond = []
            for k,v in conds.items():
                vcond.append(f'{k}={str(v)}')
            return vcond

    def _dump_data(self, keys, conds):
        return self.sqldb.select(self.tablename, keys, conds)

    def getDumpKeys(self):
        return '*'

    def getDumpCondition(self, date=None):
        return ''

    def dumpDataByDate(self, date = None):
        pool = self.sqldb.select(self.tablename, self.getDumpKeys(), self.getDumpCondition(date))
        if pool is None or len(pool) == 0:
            return ''
        return pool
