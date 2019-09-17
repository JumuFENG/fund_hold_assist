# Python 3
# -*- coding:utf-8 -*-

from utils import *
from user import *
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

    def save_budgets(self, dest_dir):
        for parent, dirs, files in os.walk("summary"):
            tar_folder = os.path.join(dest_dir, parent)
            if(not os.path.isdir(tar_folder)):
                os.mkdir(tar_folder)
            for f in files:
                shutil.copy(os.path.join(parent, f), os.path.join(tar_folder, f))

    def manually_update_rolled(self, code, cost, date):
        fg = FundGeneral(self.sqldb, code)
        sell_table = fg.sell_table
        if not sell_table:
            return
        self.sqldb.update(sell_table, {column_rolled_in: str(cost)}, {column_date: date})

    def get_budgets_json(self, user):
        fund_json = user.get_holding_funds_json()
        f = open("summary/json/fund.json", 'w')
        f.write("var ftjson = " + json.dumps(fund_json) + ";")
        f.close()

    def get_holding_funds_hist_data(self, user):
        all_hist_data = user.get_holding_funds_hist_data()
        f = open("summary/json/history_data.json", 'w')
        f.write("var all_hist_data = " + json.dumps(all_hist_data) + ";")
        f.close()

    def upload_budgets_to_ftp(self):
        ftp = FtpHelper(ftp_ip, ftp_port, ftp_usr_name, ftp_pwd)
        ftp.connect()
        ftp.login()
        ftp.upload_dir("summary", "_budget")
        ftp.quit()

if __name__ == '__main__':
    dbname = "fund_center"
    #dbname = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = dbname)
    ib = InvestBudget(sqldb)
    #ib.add_budget("000217",100,"2019-07-01")
    #ib.add_budget("005633",100,"2019-07-01")
    #ib.add_budget("161725",200,"2019-07-20")
    #ib.add_budget("260108",100,"2019-07-01")
    #ib.add_budget("110003",10, "2019-07-01")
    user = User(1, "test", "test@test.com")
    ib.get_budgets_json(user)
    ib.get_holding_funds_hist_data(user)
    ib.save_budgets(summary_dest_dir if summary_dest_dir else gl_summary_dir)
    #ib.upload_budgets_to_ftp()
