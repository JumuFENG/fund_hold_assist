# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta
from decimal import Decimal
import pandas as pd
import os

class InvestBudget():
    """to help do the invest budget"""
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.summary_text = ""

    def add_budget(self, fund_code, budget, date = ""):
        self.fund_code = fund_code
        self.budget = budget
        
        fg = FundGeneral(self.sqldb, self.fund_code)

        his_db_table = fg.history_table
        if not his_db_table:
            print("can not get history table.")
            return

        budget_table = fg.budget_table
        if not budget_table:
            tbl_mgr = TableManager(self.sqldb, gl_fund_info_table, self.fund_code)
            budget_table = tbl_mgr.GetTableColumnInfo(column_budget_table, self.fund_code + "_inv_budget")

        if not self.sqldb.isExistTable(budget_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'varchar(20) DEFAULT NULL',column_budget:'varchar(10) DEFAULT NULL', column_consumed:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(budget_table, attrs, constraint)

        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        bu_rec = self.sqldb.select(budget_table, conds = "%s = '%s'" % (column_date, date))
        if bu_rec:
            ((bu_rec),) = bu_rec
        if bu_rec:
            print("already add budget", bu_rec)
            return

        netvalue = fg.netvalue_by_date(date)
        if not netvalue:
            print("no value on", date)
            return

        self.sqldb.insert(budget_table, {column_date:date, column_net_value:str(netvalue), column_budget: str(budget)})
        self.delete_cosumed(budget_table)

    def delete_cosumed(self, budget_table):
        if not self.sqldb.isExistTable(budget_table):
            return

        self.sqldb.delete(budget_table, {column_consumed:'1'})

    def prepare_sell_info(self, fg, ppg):
        history_table = fg.history_table
        history_dvs = self.sqldb.select(history_table, [column_date, column_net_value], order = " ORDER BY %s ASC" % column_date)
        dvs = history_dvs[-7:]
        (dateBegin,v) = dvs[0]
        (d, netvalue) = dvs[-1]

        buy_table = fg.buy_table
        if not buy_table:
            return
        (portion_cannot_sell,), = self.sqldb.select(buy_table, "sum(%s)" % column_portion, "%s > '%s'" % (column_date, dateBegin))
        dcp_not_sell = self.sqldb.select(buy_table, [column_date, column_cost, column_portion], "%s = 0" % column_soldout)
        max_value_to_sell = netvalue * (1.0 - float(fg.short_term_rate))
        dcp_can_sell = []
        portion_can_sell = 0
        for (d,c,p) in dcp_not_sell:
            for (dd,v) in history_dvs:
                if d == dd and v <= max_value_to_sell:
                    portion_can_sell += p
                    dcp_can_sell.append(d)
        if not portion_cannot_sell:
            portion_cannot_sell = 0
        return "sell: min(" + str(round((fg.portion_hold - portion_cannot_sell) / ppg, 4)) + ", "+ str(round(portion_can_sell/ppg,4)) + ")\n" + str(dcp_can_sell)

    def get_budgets(self):
        if not self.sqldb.isExistTable(gl_fund_info_table):
            print("can not find fund info DB.")
            return

        fund_codes = self.sqldb.select(gl_fund_info_table, [column_code])

        no_budget_summary = ""
        for (c, ) in fund_codes:
            ppg = 1 if not ppgram.__contains__(c) else ppgram[c]
            fg = FundGeneral(self.sqldb, c)
            budget_table = fg.budget_table
            if budget_table and self.sqldb.isExistTable(budget_table):
                self.delete_cosumed(budget_table)
                budget = self.sqldb.select(budget_table, [column_date, column_net_value, column_budget])
                sum_b = 0
                index = []
                values = []
                for (d,v,b) in budget:
                    sum_b += int(b)
                    index.append(d)
                    values.append([Decimal(str(v)) * ppg, b])
                if sum_b == 0:
                    no_budget_summary += self.collect_budgets(fg.name, fg.cost_hold, Decimal(str(fg.average)) * ppg)
                    sell_prepared = self.prepare_sell_info(fg, ppg)
                    if sell_prepared:
                        no_budget_summary += sell_prepared + "\n"
                else:
                    self.summary_text += self.collect_budgets(fg.name, fg.cost_hold, Decimal(str(fg.average)) * ppg, index, values, sum_b)
                    sell_prepared = self.prepare_sell_info(fg, ppg)
                    if sell_prepared:
                        self.summary_text += sell_prepared + "\n"

            elif fg.cost_hold and fg.average:
                no_budget_summary += self.collect_budgets(fg.name, fg.cost_hold, Decimal(str(fg.average)) * ppg)
                sell_prepared = self.prepare_sell_info(fg, ppg)
                if sell_prepared:
                    no_budget_summary += sell_prepared + "\n"

        self.summary_text += no_budget_summary
        self.save_budgets()

    def collect_budgets(self, name, hold, aver_price, index = None, budget = None, budget_sum = 0):
        summary_text = ""
        if not hold == 0:
            summary_text += "\n" + name

        if budget and index and not budget_sum == 0:
            summary_text += "\nall %d<%.4f> budgets: %d\n" % (hold, aver_price, budget_sum)
            summary_text += str(pd.DataFrame(data=budget, columns=["net","budget"], index=index)) + "\n"
        elif not hold == 0:
            summary_text += "\nall %d<%.4f>\n" % (hold, aver_price)

        return summary_text

    def save_budgets(self):
        f = open(gl_budget_file, 'w')
        f.write(datetime.now().strftime("%m-%d %H:%M") + self.summary_text)
        f.close()
        f = open("budget.txt", 'w')
        f.write(self.summary_text)
        f.close()

if __name__ == '__main__':
    dbname = "fund_center"
    #dbname = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = dbname)
    ib = InvestBudget(sqldb)
    #ib.add_budget("000217",100,"2019-06-17")
    #ib.add_budget("005633",100,"2019-06-17")
    #ib.add_budget("161724",100,"2019-06-27")
    #ib.add_budget("260108",100,"2019-06-27")
    #ib.add_budget("110003",10, "2019-06-27")
    ib.get_budgets()
