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
    #du = DailyUpdater(sqldb, dbname, user)
    #du.update_all()
    #user.buy("000217", "2019-09-17", 1000, rollin_date = "2019-08-02")
    #user.fix_buy_rec("000217", "2019-09-09", 1000)
    #user.sell_by_dates("000217", "2019-09-17", ["2019-08-14","2019-08-15"])
    #user.sell_not_confirm("000217", "2019-09-18", ["2019-08-16","2019-08-19"])
    #user.confirm_sell("000217", "2019-09-18")
    #du.download_all_fund_history("000217")
    #du.download_all_index_history("399300")
    #du.download_all_gold_history("AU9999")
    #af = AllFunds(du.sqldb)
    #af.loadMorningStarRatingInfo()
    #af.get_fund_name("000001")
    #print(af.get_fund_url("960042"))
    astk = AllStocks(user.stock_center_db())
    astk.loadAllETFFunds()
