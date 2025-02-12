# Python 3
# -*- coding:utf-8 -*-

import pytest
from utils import *

class TestSQL():
    def setup_class(self):
        self.sqldb = SqlHelper(password=db_pwd, database='testdb')
        self.tablename = 'test'

    def termdown_class(self):
        self.sqldb.close()

    def test_sql_get_version(self):
        x = self.sqldb.getVersion()
        print(x)
        assert x
        assert isinstance(x, str)

    def test_schema_exists(self):
        assert self.sqldb.isExistSchema('testdb')

    def test_table_exists(self):
        self.sqldb.isExistTable('test')

    def test_create_table(self):
        if self.sqldb.isExistTable(self.tablename):
            self.sqldb.dropTable(self.tablename)
        attrs = {
            'code': 'varchar(20) DEFAULT NULL',
            'date': 'varchar(20) DEFAULT NULL',
            'price': 'double DEFAULT NULL',
            'count': 'tinyint DEFAULT 0'
        }
        constraint = 'PRIMARY KEY(`id`)'
        self.sqldb.createTable(self.tablename,attrs, constraint)
        assert self.sqldb.isExistTable(self.tablename)

    def test_create_delete_table(self):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename,attrs, constraint)
        assert self.sqldb.isExistTable(self.tablename)
        self.sqldb.deleteTable(self.tablename)
        assert self.sqldb.isExistTable(self.tablename)

    def test_create_drop_table(self):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename,attrs, constraint)
        assert self.sqldb.isExistTable(self.tablename)
        self.sqldb.dropTable(self.tablename)
        assert not self.sqldb.isExistTable(self.tablename)

    def test_insert(self):
        self.test_create_table()
        self.sqldb.insert(self.tablename,{'code':'code1', 'price': 1})

    def test_select_one_row(self):
        self.test_insert()
        row = self.sqldb.selectOneRow(self.tablename,conds={'id':1})
        assert isinstance(row, tuple)
        assert row[0] == 1
        self.sqldb.insert(self.tablename,{'code':'code2', 'price': 1})
        row = self.sqldb.selectOneRow(self.tablename)
        assert isinstance(row, tuple)
        assert row[0] == 1

    def test_select_one_val(self):
        self.test_insert()
        val = self.sqldb.selectOneValue(self.tablename,'code', {'id': 1})
        assert val == 'code1'
        val = self.sqldb.selectOneValue(self.tablename)
        assert val == 1

    def test_select_field(self):
        self.test_insert()
        rows = self.sqldb.select(self.tablename,'code')
        assert isinstance(rows, list)
        c, = rows[0]
        assert c == 'code1'

        rows = self.sqldb.select(self.tablename,'code, count')
        assert isinstance(rows, list)
        c, t = rows[0]
        assert c == 'code1'
        assert t == 0

        rows = self.sqldb.select(self.tablename,['code', 'price'])
        assert isinstance(rows, list)
        c, p = rows[0]
        assert c == 'code1'
        assert p == 1

        self.sqldb.insert(self.tablename,{'code': 'c1', 'date': 'd1', 'price':5.1, 'count': 3})
        rows = self.sqldb.select(self.tablename,'code, price, count', {'code': 'c1', 'date': 'd1'})
        assert isinstance(rows, list)
        c,p,t = rows[0]
        assert c == 'c1'
        assert p == 5.1
        assert t == 3

        rows = self.sqldb.select(self.tablename,'code, price, count', ['code="c1"', 'date="d1"'])
        assert isinstance(rows, list)
        c,p,t = rows[0]
        assert c == 'c1'
        assert p == 5.1
        assert t == 3

        rows = self.sqldb.select(self.tablename,'code, price, count', ['code="c1"', 'count>2'])
        assert isinstance(rows, list)
        c,p,t = rows[0]
        assert c == 'c1'
        assert p == 5.1
        assert t == 3

        rows = self.sqldb.select(self.tablename,'code, price, count', 'code="c1" and count>2')
        assert isinstance(rows, list)
        c,p,t = rows[0]
        assert c == 'c1'
        assert p == 5.1
        assert t == 3

    def test_insert_many(self):
        self.test_create_table()
        arows = len(self.sqldb.select(self.tablename))
        attrs = ['code', 'price', 'count']
        values = [['c1', 1.1, 1], ['c2', 1.2, 2]]
        self.sqldb.insertMany(self.tablename,attrs, values)
        brows = len(self.sqldb.select(self.tablename))
        assert brows - arows == len(values)

        values = [{'code':'c3','price':1.3,'date':'d3'},{'code':'c4','price':1.4,'date':'d4'},{'code':'c5','price':1.5,'date':'d5'}]
        self.sqldb.insertMany(self.tablename,values=values)
        crows = len(self.sqldb.select(self.tablename))
        assert crows - brows == len(values)

    def test_delete(self):
        if not self.sqldb.isExistTable(self.tablename) or self.sqldb.selectOneValue(self.tablename, 'count(*)') == 0:
            self.test_insert()
        id = self.sqldb.selectOneValue(self.tablename, 'id')
        self.sqldb.delete(self.tablename, f'id={id}')
        nid = self.sqldb.selectOneValue(self.tablename, 'id')
        assert id != nid

    def test_update(self):
        if not self.sqldb.isExistTable(self.tablename) or self.sqldb.selectOneValue(self.tablename, 'count(*)') == 0:
            self.test_insert()
        id,*_ = self.sqldb.selectOneRow(self.tablename)
        self.sqldb.update(self.tablename, {'code': 'c3', 'date': 'dd', 'count': 2}, f'id={id}')
        _,c,d,p,t = self.sqldb.selectOneRow(self.tablename, conds={'id': id})
        assert c == 'c3'
        assert d == 'dd'
        assert t == 2

        self.sqldb.update(self.tablename, [['code', 'c4'], ['date', 'd4'], ['price', 2]], [f'id={id}'])
        _,c,d,p,t = self.sqldb.selectOneRow(self.tablename, conds={'id': id})
        assert c == 'c4'
        assert d == 'd4'
        assert p == 2
        assert t == 2

        self.sqldb.update(self.tablename, ['code="c5"', 'date="d5"', 'price=1.5', 'count=5'], [f'id={id}'])
        _,c,d,p,t = self.sqldb.selectOneRow(self.tablename, conds={'id': id})
        assert c == 'c5'
        assert d == 'd5'
        assert p == 1.5
        assert t == 5

    def test_table_column_exist(self):
        if not self.sqldb.isExistTable(self.tablename):
            self.test_create_table()

        assert self.sqldb.isExistTableColumn(self.tablename, 'code')

    def test_table_get_columns(self):
        if not self.sqldb.isExistTable(self.tablename):
            self.test_create_table()

        clns = self.sqldb.getColumns(self.tablename)
        assert len(clns) == 5
        assert 'code' in clns

    def test_table_add_delete_column(self):
        if not self.sqldb.isExistTable(self.tablename):
            self.test_create_table()

        if not self.sqldb.isExistTableColumn(self.tablename, 'colx'):
            self.sqldb.addColumn(self.tablename, 'colx', 'varchar(20) DEFAULT NULL')
            assert self.sqldb.isExistTableColumn(self.tablename, 'colx')

        if self.sqldb.isExistTableColumn(self.tablename, 'colx'):
            self.sqldb.deleteColumn(self.tablename, 'colx')
            assert not self.sqldb.isExistTableColumn(self.tablename, 'colx')

    def test_table_rename_column(self):
        if not self.sqldb.isExistTable(self.tablename):
            self.test_create_table()

        if not self.sqldb.isExistTableColumn(self.tablename, 'colx'):
            self.sqldb.addColumn(self.tablename, 'colx', 'varchar(20) DEFAULT NULL')

        if self.sqldb.isExistTableColumn(self.tablename, 'coly'):
            self.sqldb.deleteColumn(self.tablename, 'coly')

        self.sqldb.renameColumn(self.tablename, 'colx', 'coly', 'double DEFAULT NULL')
        assert not self.sqldb.isExistTableColumn(self.tablename, 'colx')
        assert self.sqldb.isExistTableColumn(self.tablename, 'coly')

    def test_table_insert_update_many(self):
        self.test_create_table()

        arows = len(self.sqldb.select(self.tablename))
        attrs = ['code', 'price', 'count']
        values = [['c1', 1.1, 1], ['c2', 1.2, 2]]
        self.sqldb.insertMany(self.tablename,attrs, values)
        brows = len(self.sqldb.select(self.tablename))
        assert brows - arows == len(values)

        values = [['c1', 2.2, 2], ['c3', 1.3, 3], ['c4', 1.4, 4]]
        self.sqldb.insertUpdateMany(self.tablename, attrs, ['code'], values)
        crows = len(self.sqldb.select(self.tablename))
        assert crows - brows == len(values) - 1

        attrs = ['price', 'count', 'code']
        values = [[2.3, 3, 'c3'], [2.4, 4, 'c4'], [2.5, 5, 'c5'], [2.6, 6, 'c6']]
        self.sqldb.insertUpdateMany(self.tablename, attrs, ['code'], values)
        drows = len(self.sqldb.select(self.tablename))
        assert drows - crows == 2
