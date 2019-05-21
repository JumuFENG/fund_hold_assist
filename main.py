# Python 3
# -*- coding:utf-8 -*-

from _pwd import db_pwd
from datetime import datetime, timedelta
from sql_helper import SqlHelper
from fund_history import FundHistoryDataDownloader
from fund_trade import TradeFund
from commons import *

class DailyUpdater():
    """for daily update"""
    def __init__(self):
        self.dbname = "fund_center"
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)

    def update_all(self):
        fundcodes = self.sqldb.select(gl_all_info_table, fields=[column_code])
        fundcodes = [c[0] for c in fundcodes]
        for c in fundcodes:
            self.download_all_fund_history(c)

    def download_all_fund_history(self, fundcodes):
        fh = FundHistoryDataDownloader(fundcodes, self.sqldb)
        fh.fundHistoryTillToday()

if __name__ == '__main__':
    du = DailyUpdater()
    #du.download_all_fund_history("161724")
    du.update_all()
