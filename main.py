# Python 3
# -*- coding:utf-8 -*-

from utils import *
from user import *
from history import *
from datetime import datetime, timedelta
import time
from fund_trade import TradeFund

class DailyUpdater():
    """for daily update"""
    def __init__(self, sqldb, dbname, user):
        self.sqldb = sqldb
        self.dbname = dbname
        self.user = user

    def update_all(self):
        fundcodes = self.sqldb.select(self.user.funds_info_table(), fields=[column_code])
        if fundcodes :
            for (c,) in fundcodes:
                self.download_all_fund_history(c)

        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code])
        if indexcodes:
            for (c,) in indexcodes:
                self.download_all_index_history(c)

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code])
        if goldcodes:
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

    def buy(self, fundcode, cost, buyDate, budgetDates = None, rollin_date = None):
        trade = TradeFund(self.user, fundcode, self.dbname, db_pwd)
        trade.buy(cost, buyDate, budgetDates, rollin_date)

    def undo_buy(self, fundcode, date, removeall = False):
        trade = TradeFund(self.user,fundcode, self.dbname, db_pwd)
        trade.undo_buy(date, removeall)
        trade.update_average_price()

    def manually_fix_buy(self, fundcode, date, cost):
        trade = TradeFund(self.user, fundcode, self.dbname, db_pwd)
        trade.manually_fix_buy_table(date, cost)

    def sell(self, fundcode, sellDate, buyDates):
        trade = TradeFund(self.user, fundcode, self.dbname, db_pwd)
        trade.sell_by_day(buyDates, sellDate)

    def set_pre_buy_fee(self, code, fee):
        fg = AllFunds(self.sqldb)
        fg.set_pre_buy_fee(code, fee)

if __name__ == '__main__':
    dbname = "fund_center"
    #dbname = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = dbname)
    usermodel = UserModel(SqlHelper(password = db_pwd, database = "general"))
    user = usermodel.user_by_id(1)
    du = DailyUpdater(sqldb, dbname, user)
    #du.update_all()
    #du.download_all_fund_history("000217")
    #du.download_all_index_history("399300")
    #du.download_all_gold_history("AU9999")
    #du.buy("000217", 200,  "2019-07-29")
    #du.buy("260108", 45,   "2019-07-29")
    #du.buy("110003", 45,   "2019-07-29")
    #du.buy("005633", 45,   "2019-07-29")#
    #du.buy("001632", 45,   "2019-07-29")
    #du.buy("001551", 45,   "2019-07-29")
    #du.buy("161725", 200,  "2019-07-29")
    #du.buy("161724", 800,  "2019-07-19", rollin_date = "2019-07-02")
    #du.buy("160639", 840,  "2019-07-19", rollin_date="2019-07-02")
    #du.sell("000217", "2019-09-18", ['2019-07-29'])
    #du.sell("161724", "2019-07-02", ["2019-06-03","2019-06-12"])
    #du.sell("260108", "2019-07-02", [])
    #du.sell("001632", "2019-07-02", [])
    #du.sell("001551", "2019-07-02", [])
    #du.sell("005633", "2019-07-02", [])
    #du.sell("110003", "2019-06-28", [])
    #du.sell("160639", "2019-07-02", ['2019-06-17', '2019-06-18', '2019-06-19'])
    #du.manually_fix_buy("260108", "2019-06-28", 200)
    #af = AllFunds(du.sqldb)
    #af.loadMorningStarRatingInfo()
    #af.get_fund_name("000001")
    #print(af.get_fund_url("960042"))
