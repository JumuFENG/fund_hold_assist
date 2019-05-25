# Python 3
# -*- coding:utf-8 -*-

from _pwd import db_pwd
from datetime import datetime, timedelta
from sql_helper import SqlHelper
from commons import *

class InvestBudget():
    """to help do the invest budget"""
    def __init__(self):
        self.dbname = "fund_center"#"testdb"
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)

    def add_budget(self, fund_code, budget, date = ""):
        self.fund_code = fund_code
        self.budget = budget
        
        if not self.sqldb.isExistTable(gl_all_info_table):
            print("can not find fund info DB.")
            return
        if not self.sqldb.isExistTableColumn(gl_all_info_table, column_invest_budget):
            self.sqldb.addColumn(gl_all_info_table, column_invest_budget, "varchar(64) DEFAULT NULL")
        ((his_db_table, budget_table),) = self.sqldb.select(gl_all_info_table, [column_table_history, column_invest_budget], "%s = '%s'" % (column_code, self.fund_code))
        if not his_db_table:
            print("can not get history table.")
            return

        if not budget_table:
            budget_table = self.fund_code + "_inv_budget"
            self.sqldb.update(gl_all_info_table, {column_invest_budget:budget_table}, {column_code:self.fund_code})

        if not self.sqldb.isExistTable(budget_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'varchar(20) DEFAULT NULL',column_budget:'varchar(10) DEFAULT NULL', column_consumed:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(budget_table, attrs, constraint)

        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        ((netvalue,),) = self.sqldb.select(his_db_table, column_net_value, "%s = '%s'" % (column_date, date))
        if not netvalue:
            print("no value on %s" % date)
            return

        self.sqldb.insert(budget_table, {column_date:date, column_net_value:str(netvalue), column_budget: str(budget)})

if __name__ == '__main__':
    ib = InvestBudget()
    #ib.add_budget("000217",100,"2019-05-24")
    #ib.add_budget("161724",100,"2019-05-24")
    #ib.add_budget("260108",100,"2019-05-24")
    #ib.add_budget("110003",10,"2019-05-24")
    ib.add_budget("005633",100,"2019-05-24")
