# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta
from decimal import Decimal
import pandas as pd

class InvestBudget():
    """to help do the invest budget"""
    def __init__(self):
        self.dbname = "fund_center"#"testdb"#
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)

    def add_budget(self, fund_code, budget, date = ""):
        self.fund_code = fund_code
        self.budget = budget
        
        if not self.sqldb.isExistTable(gl_fund_info_table):
            print("can not find fund info DB.")
            return
        if not self.sqldb.isExistTableColumn(gl_fund_info_table, column_budget_table):
            self.sqldb.addColumn(gl_fund_info_table, column_budget_table, "varchar(64) DEFAULT NULL")
        ((his_db_table, budget_table),) = self.sqldb.select(gl_fund_info_table, [column_table_history, column_budget_table], "%s = '%s'" % (column_code, self.fund_code))
        if not his_db_table:
            print("can not get history table.")
            return

        if not budget_table:
            budget_table = self.fund_code + "_inv_budget"
            self.sqldb.update(gl_fund_info_table, {column_budget_table:budget_table}, {column_code:self.fund_code})

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
        self.delete_cosumed(budget_table)

    def delete_cosumed(self, budget_table):
        if not self.sqldb.isExistTable(budget_table):
            return

        self.sqldb.delete(budget_table, {column_consumed:'1'})

    def get_budgets(self):
        if not self.sqldb.isExistTable(gl_fund_info_table):
            print("can not find fund info DB.")
            return

        fund_invest_details = self.sqldb.select(gl_fund_info_table, [column_name, column_code, column_cost_hold, column_averagae_price,  column_budget_table])

        for (n, c, h, a, bt) in fund_invest_details:
            ppg = 1 if not ppgram.__contains__(c) else ppgram[c]
            if bt and self.sqldb.isExistTable(bt):
                budget = self.sqldb.select(bt, [column_date, column_net_value, column_budget], "%s = 0" % column_consumed)
                sum_b = 0
                index = []
                values = []
                for (d,v,b) in budget:
                    sum_b += int(b)
                    index.append(d)
                    values.append([Decimal(str(v)) * ppg, b])
                self.show_budgets_summary(n,h,Decimal(str(a)) * ppg, index, values, sum_b)
            else:
                self.show_budgets_summary(n,h,Decimal(str(a)) * ppg)

    def show_budgets_summary(self, name, hold, aver_price, index = None, budget = None, budget_sum = 0):
        print(name)
        if budget and index and not budget_sum == 0:
            print("all",hold,":", aver_price,"budgets:", budget_sum)
            print(pd.DataFrame(data=budget, columns=["net","budget"], index=index))
        else:
            print("all",hold,":", aver_price)
        print()

if __name__ == '__main__':
    ib = InvestBudget()
    ib.add_budget("000217",100,"2019-05-31")
    #ib.add_budget("161724",100,"2019-05-28")
    ib.add_budget("260108",100,"2019-05-31")
    ib.add_budget("110003",10, "2019-05-31")
    ib.add_budget("005633",100,"2019-05-31")
    ib.get_budgets()
