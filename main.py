# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta
from fund_history import FundHistoryDataDownloader
from fund_trade import TradeFund

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

    def buy(self, fundcode, cost, buyDate, budgetDates):
        trade = TradeFund(fundcode, self.dbname, db_pwd)
        trade.buy(cost, buyDate, budgetDates)

    def sell(self, fundcode, buyDates, sellDate):
        trade = TradeFund(fundcode, self.dbname, db_pwd)
        trade.sell_by_day(buyDates, sellDate)

if __name__ == '__main__':
    du = DailyUpdater()
    #du.download_all_fund_history("161724")
    du.update_all()
    #du.buy("260108", 100, "2019-05-29", "2019-05-28")
    #du.sell("000217", ["2019-04-04","2019-04-08","2019-04-09"], "2019-05-15")