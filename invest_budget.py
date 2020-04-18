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

    def add_budget(self, user, fund_code, budget, date = ""):
        user.add_budget(fund_code, budget, date)

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
    dbname = fund_db_name
    #dbname = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = dbname)
    ib = InvestBudget(sqldb)
    #ib.add_budget("000217",100,"2019-07-01")
    #ib.add_budget("005633",100,"2019-07-01")
    #ib.add_budget("161725",200,"2019-07-20")
    #ib.add_budget("260108",100,"2019-07-01")
    usermodel = UserModel()
    user = usermodel.user_by_id(1)
    #ib.add_budget(user, "000217", 10, "2019-09-06")
    #ib.get_budgets_json(user)
    #ib.get_holding_funds_hist_data(user)
    #ib.save_budgets(summary_dest_dir if summary_dest_dir else gl_summary_dir)
    #ib.upload_budgets_to_ftp()
