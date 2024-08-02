# Python 3
# -*- coding:utf-8 -*-

import mysql.connector
import time


class SqlHelper():

    """操作mysql数据库，基本方法 

        """
    def __init__(self , host="localhost", username="root", password="", port=3306, database="world"):
        self.host = host
        self.username = username
        self.password = password
        self.database = database
        self.port = port
        self.con = None
        self.cur = None

        retry = 0
        while True:
            try:
                self.con = mysql.connector.connect(user=self.username, database=self.database, host=self.host, password=self.password)
                # 所有的查询，都在连接 con 的一个模块 cursor 上面运行的
                self.cur = self.con.cursor()
                if not self.isExistSchema(self.database):
                    sql = "CREATE DATABASE IF NOT EXISTS " + self.database
                    self.cur.execute(sql)
                return
            except Exception as e:
                retry += 1
                while retry < 5:
                    time.sleep(3)
                    continue

                print(e)
                raise Exception("DataBase connect error,please check the db config.")

    def close(self):
        """关闭数据库连接

        """
        if self.con:
            self.con.close()
        else:
            raise Exception("DataBase doesn't connect,close connectiong error;please check the db config.")

    def getVersion(self):
        """获取数据库的版本号

        """
        self.cur.execute("SELECT VERSION()")
        ver, = self.cur.fetchone()
        return ver

    def createTable(self, tablename, attrdict, constraint):
        # type: (str, dict, str) -> None
        """创建数据库表

            args:
                tablename  :表名字
                attrdict   :属性键值对,{'book_name':'varchar(200) NOT NULL'...}
                constraint :主外键约束,PRIMARY KEY(`id`)
        """
        if self.isExistTable(tablename):
            return

        sql = ''
        sql_mid = '`id` bigint(11) NOT NULL AUTO_INCREMENT,' if 'PRIMARY KEY(`id`)' == constraint else ''
        for attr,value in attrdict.items():
            sql_mid = sql_mid + '`'+attr + '`'+' '+ value+','
        sql = sql + 'CREATE TABLE IF NOT EXISTS %s (' % tablename
        sql = sql + sql_mid
        sql = sql + constraint
        sql = sql + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        #print('createTable:' + sql)
        self.executeCommit(sql)

    def executeSql(self, sql=''):
        """执行sql语句，针对读操作返回结果集

            args:
                sql  :sql语句
        """
        try:
            self.cur.execute(sql)
            records = self.cur.fetchall()
            return records
        except mysql.connector.Error as e:
            error = 'MySQL execute failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def executeCommit(self, sql=''):
        """执行数据库sql语句，针对更新,删除,事务等操作失败时回滚

        """
        try:
            self.cur.execute(sql)
            self.con.commit()
        except mysql.connector.Error as e:
            self.con.rollback()
            error = 'MySQL execute failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print("error:", error)
            return error

    def insert(self, tablename, params):
        # type: (str, dict) -> None
        """插入一行数据到数据库
        @tablename: 表名字
        @params:
            key: 列名
            value: 值
        example:
            params = {
                'code': '000001',
                'date': '2020-05-01'}
            mydb.insert(table, params)
        """
        key = [k for k in params.keys()]
        value = []
        for tmpvalue in params.values():
            if isinstance(tmpvalue, str):
                value.append("\'" + tmpvalue + "\'")
            else:
                value.append("\'" + str(tmpvalue) + "\'")
        sql = f'insert into {tablename} ({",".join(key)}) values({",".join(value)})'
        self.executeCommit(sql)

    def generate_where_clause(self, conditions=''):
        """
        生成WHERE子句的函数

        Args:
            conditions (str, list, tuple, dict): 查询条件

        Returns:
            str: 生成的WHERE子句
        """
        if not conditions or conditions == '' or len(conditions) == 0:
            return ''

        where_clause = ''
        if isinstance(conditions, (list, tuple)):
            where_clause = 'WHERE ' + ' AND '.join(conditions)
        elif isinstance(conditions, dict):
            where_clause = 'WHERE ' + ' AND '.join(
                [f'{k} IS NULL' if v is None else f'{k}="{str(v)}"' for k, v in conditions.items()])
        else:
            where_clause = 'WHERE ' + conditions
        return where_clause

    def __gen_select_sql(self, tablename, fields='*', conds=''):
        # type: (str, str/list, list/dict/str) -> str
        if isinstance(fields, (list, tuple)):
            fields = ','.join(fields)
        return f'''select {fields} from {tablename} {self.generate_where_clause(conds)}'''

    def selectOneRow(self, tablename, fields='*', conds=''):
        # type: (str, str/list, list/dict/str) -> tuple
        ''' 查询一行数据，如果有多行数据，仅返回第一行
        '''
        sql = self.__gen_select_sql(tablename, fields, conds)
        try:
            self.cur.execute(sql)
            r1 = self.cur.fetchone()
            rs = self.cur.fetchall()
            if len(rs) > 0:
                print('more than 1 row, others', rs)
            return r1
        except mysql.connector.Error as e:
            self.con.rollback()
            error = f'MySQL execute failed! ERROR ({e.args[0]}): {e.args[1]}'
            print("error:", error)

    def selectOneValue(self, tablename, fields='*', conds=''):
        # type: (str, str/list, list/dict/str) -> any
        ''' 查询一个数据，如果有多个数据，仅返回第一个
        '''
        row = self.selectOneRow(tablename, fields, conds)
        if row is None:
            return
        result, *_ = row
        return result

    def select(self, tablename, fields='*', conds='', order=''):
        # type: (str, str/list, list/dict/str, str) -> list
        """查询数据
        @tablename  :表名字
        @fields: 查询项 str/list
        @conds: 查询条件 str/list/dict
        @order: 其他语句
            order by / limit ...
        example:
            mydb.select(table)

            fields="name", fields=["name", "age"]

            conds = 'name="usr_name"', conds = ["name = 'usr_name'", "age < 30"]

            conds = {'name': 'usr_name', 'age': 30}

            conds = 'name="usr_name" and age="30" and height>"120"'

            order = 'order by age desc', order = 'limit 10', order = 'order by age asc limit 10'

            mydb.select(table, fields, conds = conds)
        """
        sql = self.__gen_select_sql(tablename, fields, conds) + order
        try:
            self.cur.execute(sql)
            return self.cur.fetchall()
        except mysql.connector.Error as e:
            error = f'MySQL execute failed! ERROR ({e.args[0]}): {e.args[1]}'
            print('select:' + sql)
            print(error)

    def insertMany(self, tablename, attrs=None, values=None):
        # type: (str, list/tuple, list/tuple) -> None
        """插入多条数据
        @tablename: 表名
        @attrs: 列名list
        @values: 值数组(二维数组或一维字典数组)

        example:
            table='test_mysqldb'

            key = ["id" ,"name", "age"]

            value = [[101, "xiaoqiao", "25"], [102,"xiaoqiao1", "26"], [103 ,"xiaoqiao2", "27"], [104 ,"xiaoqiao3", "28"]]

            mydb.insertMany(table, key, value)

            values = [{'id': 101, "name": "xiaoqiao", "age":25}, {'id': 102, "name": "xiaoqiao1", "age":26}, {'id': 103, "name": "xiaoqiao2", "age":27}]

            mydb.insertMany(table, values=values)
        """
        assert isinstance(values, list) or isinstance(values, tuple)
        if attrs is None:
            assert isinstance(values[0], dict)
            attrs = list(values[0].keys())
            values = [list(v.values()) for v in values]

        sql = f'insert into {tablename} ({",".join(attrs)}) values ({",".join(["%s"]*len(attrs))})'
        try:
            for i in range(0, len(values), 20000):
                self.cur.executemany(sql, values[i:i+20000])
                self.con.commit()
        except mysql.connector.Error as e:
            self.con.rollback()
            error = 'insertMany executemany failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def delete(self, tablename, conds):
        # type: (str, str/list/dict) -> None
        """删除数据

            args:
                tablename  :表名字
                cond_dict  :删除条件字典

            example:
                params = {"name" : "caixinglong", "age" : "38"}
                mydb.delete(table, params)

        """
        sql = f"DELETE FROM {tablename} {self.generate_where_clause(conds)}"
        return self.executeCommit(sql)

    def update(self, tablename, attrs, conds):
        # type: (str, dict/list, str/list/dict) -> None
        """更新数据
            args:
                tablename: 表名字
                attrs: 更新属性键值对
                conds: 更新条件

            example:
                params = {"name" : "caixinglong", "age" : "38"}
                cond_dict = {"name" : "xiaoqiao", "age" : "18"}
                mydb.update(table, params, cond_dict)

        """
        attrs_list = []
        if isinstance(attrs, dict):
            for tmpkey, tmpvalue in attrs.items():
                attrs_list.append("`" + tmpkey + "`" + (' = NULL' if tmpvalue is None else "=\'" + str(tmpvalue) + "\'"))
        elif isinstance(attrs, list) or isinstance(attrs, tuple):
            if isinstance(attrs[0], str):
                attrs_list = attrs
            elif len(attrs[0]) == 2:
                for k, v in attrs:
                    attrs_list.append("`" + k + "`" + (' = NULL' if v is None else "=\'" + str(v) + "\'"))
        attrs_sql = ",".join(attrs_list)
        sql = f"UPDATE {tablename} SET {attrs_sql} {self.generate_where_clause(conds)}"
        #print(sql)
        return self.executeCommit(sql)

    def updateMany(self, table, attrs, conkeys, values):
        """更新多条数据, 有重复则
        @attrs: all attrs
        @condkeys: conditions in attrs
        @values: values for all attrs
            args:
                tablename  :表名字
                attrs      :属性键
                conkeys      : 条件属性键
                values     :所有属性值

            example:
                table='test_mysqldb'
                keys = ["name", "age", "id"]
                conkeys = ["id"]
                values = [["xiaoqiao", "25", 101], ["xiaoqiao1", "26", 102], ["xiaoqiao2", "27", 103], ["xiaoqiao3", "28", 104]]
                mydb.updateMany(table, keys, conkeys, values)
        """
        if isinstance(conkeys, str):
            conkeys = [conkeys]
        cidx = [attrs.index(c) for c in conkeys]
        eattr = []
        for i in range(0, len(attrs)):
            if i not in cidx:
                eattr.append(attrs[i])
        if attrs[len(eattr):] != conkeys:
            evalues = []
            for v in values:
                ev = []
                for i in range(0, len(v)):
                    if i not in cidx:
                        ev.append(v[i])
                for i in cidx:
                    ev.append(v[i])
                evalues.append(ev)
            values = evalues
        attrs = eattr
        attrs_list = [a + '=(%s)' for a in attrs]
        attrs_sql = ','.join(attrs_list)
        cond_list = [c + '=(%s)' for c in conkeys]
        cond_sql = ' and '.join(cond_list)
        sql = "UPDATE %s SET %s where %s" % (table, attrs_sql, cond_sql)
        #print(sql)
        try:
            for i in range(0,len(values),20000):
                self.cur.executemany(sql, values[i:i+20000])
                self.con.commit()
        except mysql.connector.Error as e:
            self.con.rollback()
            error = 'insertUpdateMany executemany failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def insertUpdateMany(self, table, attrs, conkeys, values):
        # type: (str, list, list, list) -> None
        """插入多条数据, 有重复则更新
        @attrs: all attrs
        @condkeys: conditions in attrs
        @values: values for all attrs
        """
        values_new = []
        values_exist = []
        if isinstance(conkeys, str):
            conkeys = [conkeys]
        allvalues = self.select(table, attrs)
        conidx = [attrs.index(k) for k in conkeys]
        allvalues = {tuple([v[x] for x in conidx]):v for v in allvalues}
        for v in values:
            condv = tuple([v[x] for x in conidx])
            if condv in allvalues:
                if allvalues[condv] != tuple(v):
                    values_exist.append(v)
            else:
                values_new.append(v)
            # cond_list = []
            # for i in range(0, len(conkeys)):
            #     tmpv = v[attrs.index(conkeys[i])]
            #     cond_list.append(f'{conkeys[i]} is NULL' if tmpv is None else f'{conkeys[i]} = \'{str(tmpv)}\'')
            # cond_sql = ' and '.join(cond_list)
            # selectrows = self.select(table, conkeys, conds = cond_sql)
            # if selectrows is None or len(selectrows) == 0:
            #     values_new.append(v)
            # else:
            #     values_exist.append(v)

        if len(values_new) > 0:
            self.insertMany(table, attrs, values_new)

        if len(values_exist) > 0:
            self.updateMany(table, attrs, conkeys, values_exist)

    def dropTable(self, tablename):
        """删除数据库表

            args:
                tablename  :表名字
        """
        sql = "DROP TABLE  %s" % tablename
        self.executeCommit(sql)

    def deleteTable(self, tablename):
        """清空数据库表

            args:
                tablename  :表名字
        """
        sql = "DELETE FROM %s" % tablename
        self.executeCommit(sql)

    def isExistSchema(self, database):
        return 0 != self.selectOneValue("information_schema.SCHEMATA", "count(*)", f"schema_name = '{database}'")

    def isExistTable(self, tablename):
        """判断数据表是否存在

            args:
                tablename  :表名字

            Return:
                存在返回True，不存在返回False
        """
        return 0 != self.selectOneValue("information_schema.tables","count(*)", [f"table_name = '{tablename}'", f"table_schema = '{self.database}'"])

    def isExistTableColumn(self, tablename, column_name):
        return 0 != self.selectOneValue("information_schema.columns","count(*)", [f"table_name = '{tablename}'", f"column_name = '{column_name}'", f"table_schema = '{self.database}'"])

    def getCloumns(self, tablename):
        return [c for c, in self.select("information_schema.columns","column_name", [f"table_name = '{tablename}'", f"table_schema = '{self.database}'"])]

    def addColumn(self, tablename, col, tp):
        sql = f"alter table {tablename} add {col} {tp}"
        self.executeCommit(sql)

    def deleteColumn(self, tablename, col):
        sql = f"alter table {tablename} drop column {col}"
        self.executeCommit(sql)

    def renameColumn(self, tablename, col, ncol, tp):
        sql = f'alter table {tablename} change {col} {ncol} {tp}'
        self.executeCommit(sql)

    def sortTable(self, tablename, col):
        # 获取表的所有列名
        cols = self.getColumns(tablename)
        cols.remove('id')  # 移除'id'列

        # 查询表中的所有记录
        frecs = self.select(tablename, cols)

        # 根据排序列的类型进行不同的排序操作
        if isinstance(col, (list, tuple)):
            # 多列排序
            skeys = [cols.index(c) for c in col]
            frecs = sorted(list(frecs), key=lambda x: [x[k] for k in skeys])
        else:
            # 单列排序
            cid = cols.index(col)
            frecs = sorted(list(frecs), key=lambda x: x[cid])

        # 获取表中的所有'id'值
        ids = self.select(tablename, 'id')

        # 将排序后的记录与对应的'id'值合并
        sorted_records = [record + [id] for record, id in zip(frecs, ids)]

        # 更新表中的记录，包括合并后的记录和'id'值
        self.updateMany(tablename, cols + ['id'], ['id'], sorted_records)
