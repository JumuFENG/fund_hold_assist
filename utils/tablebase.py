# Python 3
# -*- coding:utf-8 -*-
from utils import *
from threading import Thread
from datetime import datetime


class TableBase():
    def __init__(self, autocreate = True) -> None:
        self.constraint = None
        self.sqldb = None
        self.dbname = None
        self.tablename = None
        self.colheaders = []
        self.initConstrants()
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)
        if autocreate:
            self._check_or_create_table()

    def initConstrants(self):
        pass

    def _check_table_exists(self):
        if self.sqldb is None:
            self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)
        return self.sqldb.isExistTable(self.tablename)

    def _check_or_create_table(self):
        if not self._check_table_exists():
            attrs = {col['col']: col['type'] for col in self.colheaders}
            constraint = 'PRIMARY KEY(`id`)' if self.constraint is None else self.constraint
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
            return []
        return pool


class MultiThrdTableBase(TableBase):
    def __init__(self, autocreate=True) -> None:
        self.threads_num = 2
        super().__init__(autocreate)

    def task_prepare(self, date=None):
        pass

    def post_process(self):
        pass

    def task_processing(self):
        pass

    def start_multi_task(self, date=None):
        self.task_prepare(date)

        ctime = datetime.now()
        t_thrds = []
        for x in range(0, self.threads_num):
            t = Thread(target=self.task_processing)
            t.start()
            t_thrds.append(t)

        for t in t_thrds:
            t.join()

        Utils.log(f'threads: {self.threads_num} time used: {datetime.now() - ctime}')
        self.post_process()
