# Python 3
# -*- coding:utf-8 -*-

import pymysql
import re

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

        try:
            self.con = pymysql.connect(host=self.host, user=self.username, passwd=self.password, port=self.port, charset="utf8mb4")
            # 所有的查询，都在连接 con 的一个模块 cursor 上面运行的
            self.cur = self.con.cursor()
            if not self.isExistSchema(self.database):
                sql = "CREATE DATABASE IF NOT EXISTS " + self.database
                self.cur.execute(sql)
            self.con.select_db(self.database)
        except Exception as e:
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
        return self.getOneData()

    def getOneData(self):
        # 取得上个查询的结果，是单个结果
        data = self.cur.fetchone()
        return data

    def createTable(self, tablename, attrdict, constraint):
        """创建数据库表

            args：
                tablename  ：表名字
                attrdict   ：属性键值对,{'book_name':'varchar(200) NOT NULL'...}
                constraint ：主外键约束,PRIMARY KEY(`id`)
        """
        if self.isExistTable(tablename):
            return
        sql = ''
        sql_mid = '`id` bigint(11) NOT NULL AUTO_INCREMENT,'
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

            args：
                sql  ：sql语句
        """
        try:
            self.cur.execute(sql)
            records = self.cur.fetchall()
            return records
        except pymysql.Error as e:
            error = 'MySQL execute failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def executeCommit(self, sql=''):
        """执行数据库sql语句，针对更新,删除,事务等操作失败时回滚

        """
        try:
            self.cur.execute(sql)
            self.con.commit()
        except pymysql.Error as e:
            self.con.rollback()
            error = 'MySQL execute failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print("error:", error)
            return error

    def insert(self, tablename, params):
        """插入数据库

            args：
                tablename  ：表名字
                key        ：属性键
                value      ：属性值
        """
        key = []
        value = []
        for tmpkey, tmpvalue in params.items():
            key.append(tmpkey)
            if isinstance(tmpvalue, str):
                value.append("\'" + tmpvalue + "\'")
            else:
                value.append("\'" + str(tmpvalue) + "\'")
        attrs_sql = '('+','.join(key)+')'
        values_sql = ' values('+','.join(value)+')'
        sql = 'insert into %s'%tablename
        sql = sql + attrs_sql + values_sql
        #print('_insert:'+sql)
        self.executeCommit(sql)

    def __gen_select_sql(self, tablename, fields='*', conds=''):
        if isinstance(fields, list):
            fields = ','.join(fields)

        consql = ''
        if conds != '':
            if isinstance(conds, list):
                conds = ' and '.join(conds)
                consql = 'where ' + conds
            elif isinstance(conds, dict):
                consql = 'where '
                for k, v in conds.items():
                    v = ' is NULL' if v is None else "=\'" + str(v) + "\'"
                    consql += str(k) + v + ' and '
                consql += ' 1=1 '
            else:
                consql = 'where ' + conds

        return f'''select {fields} from {tablename} {consql}'''

    def selectOneRow(self, tablename, fields='*', conds=''):
        sql = self.__gen_select_sql(tablename, fields, conds)
        try:
            self.cur.execute(sql)
            return self.cur.fetchone()
        except pymysql.Error as e:
            self.con.rollback()
            error = f'MySQL execute failed! ERROR ({e.args[0]}): {e.args[1]}'
            print("error:", error)

    def selectOneValue(self, tablename, fields='*', conds=''):
        result, = self.selectOneRow(tablename, fields, conds)
        return result

    def select(self, tablename, fields='*', conds='', order=''):
        """查询数据

            args：
                tablename  ：表名字
                conds      ：查询条件
                order      ：排序条件

            example：
                print mydb.select(table)
                print mydb.select(table, fields=["name"])
                print mydb.select(table, fields=["name", "age"])
                print mydb.select(table, fields=["age", "name"])
                print mydb.select(table, fields=["age", "name"], conds = ["name = 'usr_name'","age < 30"])
        """
        sql = self.__gen_select_sql(tablename, fields, conds) + order
        #print('select:' + sql)
        try:
            self.cur.execute(sql)
            return self.cur.fetchall()
        except pymysql.Error as e:
            error = f'MySQL execute failed! ERROR ({e.args[0]}): {e.args[1]}'
            print(error)

    def insertMany(self,table, attrs, values):
        """插入多条数据

            args：
                tablename  ：表名字
                attrs        ：属性键
                values      ：属性值

            example：
                table='test_mysqldb'
                key = ["id" ,"name", "age"]
                value = [[101, "liuqiao", "25"], [102,"liuqiao1", "26"], [103 ,"liuqiao2", "27"], [104 ,"liuqiao3", "28"]]
                mydb.insertMany(table, key, value)
        """
        values_sql = ['%s' for v in attrs]
        attrs_sql = '('+','.join(attrs)+')'
        values_sql = ' values('+','.join(values_sql)+')'
        sql = 'insert into %s'% table
        sql = sql + attrs_sql + values_sql
        try:
            for i in range(0,len(values),20000):
                self.cur.executemany(sql,values[i:i+20000])
                self.con.commit()
        except pymysql.Error as e:
            self.con.rollback()
            error = 'insertMany executemany failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def delete(self, tablename, cond_dict):
        """删除数据

            args：
                tablename  ：表名字
                cond_dict  ：删除条件字典

            example：
                params = {"name" : "caixinglong", "age" : "38"}
                mydb.delete(table, params)

        """
        consql = ' '
        if cond_dict!='':
            for k, v in cond_dict.items():
                v = ' is NULL' if v is None else "=\'" + str(v) + "\'"
                consql = consql + tablename + "." + str(k) + v + ' and '
        consql = consql + ' 1=1 '
        sql = "DELETE FROM %s where%s" % (tablename, consql)
        #print (sql)
        return self.executeCommit(sql)

    def update(self, tablename, attrs_dict, cond_dict):
        """更新数据

            args：
                tablename  ：表名字
                attrs_dict  ：更新属性键值对字典
                cond_dict  ：更新条件字典

            example：
                params = {"name" : "caixinglong", "age" : "38"}
                cond_dict = {"name" : "liuqiao", "age" : "18"}
                mydb.update(table, params, cond_dict)

        """
        attrs_list = []
        consql = ' '
        for tmpkey, tmpvalue in attrs_dict.items():
            attrs_list.append("`" + tmpkey + "`" + (' = NULL' if tmpvalue is None else "=\'" + str(tmpvalue) + "\'"))
        attrs_sql = ",".join(attrs_list)
        #print("attrs_sql:", attrs_sql)
        if cond_dict!='':
            for k, v in cond_dict.items():
                v = ' is NULL' if v is None else "=\'" + str(v) + "\'"
                consql = consql + "`" + tablename +"`." + "`" + str(k) + "`" + v + ' and '
        consql = consql + ' 1=1 '
        sql = "UPDATE %s SET %s where%s" % (tablename, attrs_sql, consql)
        #print(sql)
        return self.executeCommit(sql)

    def updateMany(self, table, attrs, conkeys, values):
        """更新多条数据, 有重复则
            args：
                tablename  ：表名字
                attrs      ：属性键
                conkeys      : 条件属性键
                values     ：所有属性值

            example：
                table='test_mysqldb'
                keys = ["name", "age"]
                conkeys = ["id"]
                values = [["liuqiao", "25", 101], ["liuqiao1", "26", 102], ["liuqiao2", "27", 103], ["liuqiao3", "28", 104]]
                mydb.updateMany(table, conkeys, keys, values)
        """
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
        except pymysql.Error as e:
            self.con.rollback()
            error = 'insertUpdateMany executemany failed! ERROR (%s): %s' %(e.args[0],e.args[1])
            print(error)

    def insertUpdateMany(self, table, attrs, conkeys, values):
        """插入多条数据, 有重复则更新
        """
        values_new = []
        values_exist = []
        for v in values:
            cond_list = []
            for i in range(0, len(conkeys)):
                tmpv = v[len(attrs) + i]
                cond_list.append(f'{conkeys[i]} is NULL' if tmpv is None else f'{conkeys[i]} = \'{str(tmpv)}\'')
            cond_sql = ' or '.join(cond_list)
            selectrows = self.select(table, conkeys, conds = cond_sql)
            if selectrows is None or len(selectrows) == 0:
                values_new.append(v)
            else:
                values_exist.append(v)

        if len(values_new) > 0:
            self.insertMany(table, attrs + conkeys, values_new)

        if len(values_exist) > 0:
            self.updateMany(table, attrs, conkeys, values_exist)

    def dropTable(self, tablename):
        """删除数据库表

            args：
                tablename  ：表名字
        """
        sql = "DROP TABLE  %s" % tablename
        self.executeCommit(sql)

    def deleteTable(self, tablename):
        """清空数据库表

            args：
                tablename  ：表名字
        """
        sql = "DELETE FROM %s" % tablename
        self.executeCommit(sql)

    def isExistSchema(self, database):
        return 0 != self.selectOneValue("information_schema.SCHEMATA", "count(*)", f"schema_name = '{database}'")

    def isExistTable(self, tablename):
        """判断数据表是否存在

            args：
                tablename  ：表名字

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
        cols = self.getCloumns(tablename)
        cols.remove('id')
        cols.remove(col)
        cols.insert(0, col)
        frecs = self.select(tablename, cols)
        ids = self.select(tablename, 'id')
        frecs = sorted(list(frecs), key=lambda x: x[0])
        for i in range(0, len(ids)):
            frecs[i] += ids[i]
        self.updateMany(tablename, cols, ['id'], frecs)
