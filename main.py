# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from datetime import datetime, timedelta
import time
from fund_trade import TradeFund

class DailyUpdater():
    """for daily update"""
    def __init__(self):
        self.dbname = "fund_center"
        self.sqldb = SqlHelper(password = db_pwd, database = self.dbname)

    def update_all(self):
        fundcodes = self.sqldb.select(gl_fund_info_table, fields=[column_code])
        for (c,) in fundcodes:
            self.download_all_fund_history(c)

        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code])
        for (c,) in indexcodes:
            self.download_all_index_history(c)

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code])
        for (c,) in goldcodes:
            self.download_all_gold_history(c)

    def download_all_fund_history(self, code):
        fh = FundHistoryDataDownloader(self.sqldb)
        fh.fundHistoryTillToday(code)

    def download_all_index_history(self, code):
        ih = Index_history(self.sqldb)
        ih.indexHistoryTillToday(code)
        #ih.getHistoryFromSohu(code)
        ih.getHistoryFrom163(code)

    def download_all_gold_history(self, code):
        gh = Gold_history(self.sqldb)
        gh.getJijinhaoHistory(code)
        gh.getJijinhaoRtHistory(code)

    def buy(self, fundcode, cost, buyDate, budgetDates = None):
        trade = TradeFund(fundcode, self.dbname, db_pwd)
        trade.buy(cost, buyDate, budgetDates)

    def undo_buy(self, fundcode, date, removeall = False):
        trade = TradeFund(fundcode, self.dbname, db_pwd)
        trade.undo_buy(date, removeall)
        trade.update_average_price()

    def sell(self, fundcode, buyDates, sellDate):
        trade = TradeFund(fundcode, self.dbname, db_pwd)
        trade.sell_by_day(buyDates, sellDate)

if __name__ == '__main__':
    du = DailyUpdater()
    du.update_all()
    #du.download_all_fund_history("001632")
    #du.download_all_index_history("399300")
    #du.download_all_gold_history("AU9999")
    #du.buy("000217", 1000, "2019-06-06")
    #du.buy("260108", 300,  "2019-06-06", ["2019-05-27", "2019-06-05"])
    #du.buy("161724", 200,  "2019-06-06", "2019-06-05")
    #du.buy("110003", 30,   "2019-06-06", ["2019-05-27", "2019-06-05"])
    #du.buy("005633", 200,  "2019-06-06", ["2019-06-05"])
    #du.buy("001632", 1000, "2019-06-06")
    #du.sell("000217", ["2019-04-04","2019-04-08","2019-04-09"], "2019-05-15")
