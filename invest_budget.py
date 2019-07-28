# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta
from decimal import Decimal
import pandas as pd
import os
import shutil
import json

class InvestBudget():
    """to help do the invest budget"""
    def __init__(self, sqldb):
        self.sqldb = sqldb

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

    def save_budgets(self):
        if(not os.path.isdir(gl_summary_dir)):
            os.mkdir(gl_summary_dir)
        for parent, dirs, files in os.walk("summary"):
            for f in files:
                shutil.copy(os.path.join(parent, f), os.path.join(gl_summary_dir, f))

    def manually_update_rolled(self, code, cost, date):
        fg = FundGeneral(self.sqldb, code)
        sell_table = fg.sell_table
        if not sell_table:
            return
        self.sqldb.update(sell_table, {column_rolled_in: str(cost)}, {column_date: date})

    def get_roll_in_arr(self, fg, ppg):
        sell_table = fg.sell_table
        if not sell_table or not self.sqldb.isExistTable(sell_table):
            return
        if not self.sqldb.isExistTableColumn(sell_table, column_rolled_in) or not self.sqldb.isExistTableColumn(sell_table, column_roll_in_value):
            print("table column not complete.")
            return

        sell_recs = self.sqldb.select(sell_table, [column_date, column_cost_sold, column_rolled_in, column_roll_in_value])
        if not sell_recs:
            return

        values = []
        for (d, c, r, v) in sell_recs:
            if not r:
                r = 0
            if c <= float(r):
                continue
            max_price_to_buy = 0
            if not v:
                netvalue = fg.netvalue_by_date(d)
                max_price_to_buy = round(netvalue * (1.0 - float(fg.short_term_rate)) * ppg, 4)
            else:
                max_price_to_buy = round(float(v) * ppg, 4)
            values.append({"date":d, "max_price_to_buy":max_price_to_buy, "to_rollin":str(int(c - float(r)))})

        return values

    def get_buy_arr(self, fg):
        buy_table = fg.buy_table
        if not buy_table:
            return

        dcp_not_sell = self.sqldb.select(buy_table, [column_date, column_cost, column_portion], "%s = 0" % column_soldout)
        values = []
        for (d,c,p) in dcp_not_sell:
            v = fg.netvalue_by_date(d)
            values.append({"date":d, "netvalue":v, "cost":c, "portion":p})
        return values

    def get_portions_morethan_7day(self, fg, ppg):
        dateToday = datetime.now().strftime("%Y-%m-%d")
        dateBegin = (datetime.strptime(dateToday, "%Y-%m-%d") + timedelta(days=-7)).strftime("%Y-%m-%d")
        history_table = fg.history_table

        buy_table = fg.buy_table
        if not buy_table:
            return 0
        (portion_cannot_sell,), = self.sqldb.select(buy_table, "sum(%s)" % column_portion, "%s > '%s'" % (column_date, dateBegin))
        if not portion_cannot_sell:
            portion_cannot_sell = 0
        return round((fg.portion_hold - portion_cannot_sell) / ppg, 4)

    def get_budgets_json(self):
        if not self.sqldb.isExistTable(gl_fund_info_table):
            print("can not find fund info DB.")
            return

        fund_codes = self.sqldb.select(gl_fund_info_table, [column_code])

        fund_json = {}

        for (c, ) in fund_codes:
            fund_json_obj = {}
            ppg = 1 if not ppgram.__contains__(c) else ppgram[c]
            fg = FundGeneral(self.sqldb, c)
            budget_table = fg.budget_table
            if budget_table and self.sqldb.isExistTable(budget_table):
                self.delete_cosumed(budget_table)

                budget = self.sqldb.select(budget_table, [column_date, column_net_value, column_budget])
                values = []
                for (d,v,b) in budget:
                    values.append({"date":d, "max_price_to_buy":Decimal(str(v)) * ppg, "budget":b})
                if len(values) > 0:
                    fund_json_obj["budget"] = values

            if fg.cost_hold and fg.average:
                fund_json_obj["name"] = fg.name
                fund_json_obj["ppg"] = ppg
                fund_json_obj["short_term_rate"] = fg.short_term_rate
                fund_json_obj["cost"] = fg.cost_hold
                fund_json_obj["averprice"] = str(Decimal(str(fg.average)) * ppg)
                fund_json_obj["latest_netvalue"] = fg.latest_netvalue()
                fund_json_obj["last_day_earned"] = fg.last_day_earned()
                fund_json_obj["earned_while_holding"] = round((float(fg.latest_netvalue()) - float(fg.average)) * float(fg.portion_hold), 2)

                rollin_arr = self.get_roll_in_arr(fg, ppg)
                if rollin_arr and len(rollin_arr) > 0:
                    fund_json_obj["rollin"] = rollin_arr

                fund_json_obj["morethan7day"] = self.get_portions_morethan_7day(fg, ppg)
                buy_arr = self.get_buy_arr(fg)
                if buy_arr and len(buy_arr) > 0:
                    fund_json_obj["buy_table"] = buy_arr

            if fund_json_obj:
                fund_json[c] = fund_json_obj

        f = open("summary/fund.json", 'w')
        f.write("var ftjson = " + json.dumps(fund_json) + ";")
        f.close()

        self.save_budgets()

if __name__ == '__main__':
    dbname = "fund_center"
    #dbname = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = dbname)
    ib = InvestBudget(sqldb)
    #ib.add_budget("000217",100,"2019-07-01")
    #ib.add_budget("005633",100,"2019-07-01")
    #ib.add_budget("161724",100,"2019-07-01")
    #ib.add_budget("260108",100,"2019-07-01")
    #ib.add_budget("110003",10, "2019-07-01")
    ib.get_budgets_json()
