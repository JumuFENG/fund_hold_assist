# Python 3
# -*- coding:utf-8 -*-

from utils import *
from user import *
from history import *
from datetime import datetime, timedelta
import time

class DailyUpdater():
    """for daily update"""
    def __init__(self, dbname, user):
        self.sqldb = SqlHelper(password = db_pwd, database = dbname)
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
        fh = FundHistoryDataDownloader()
        fh.fundHistoryTillToday(code)

    def download_all_index_history(self, code):
        ih = Index_history()
        ih.indexHistoryTillToday(code)
        #ih.getHistoryFromSohu(code)
        ih.getHistoryFrom163(code)

    def download_all_gold_history(self, code):
        gh = Gold_history()
        gh.getJijinhaoHistory(code)
        gh.getJijinhaoRtHistory(code)

if __name__ == '__main__':
    dbname = fund_db_name
    #dbname = "testdb"
    # usermodel = UserModel()
    # user = usermodel.user_by_id(1)
    # du = DailyUpdater(dbname, user)
    #du.update_all()
    #user.buy("000217", "2019-09-17", 1000, rollin_date = "2019-08-02")
    #user.fix_buy_rec("000217", "2019-09-09", 1000)
    #user.sell_by_dates("000217", "2019-09-17", ["2019-08-14","2019-08-15"])
    #user.sell_not_confirm("000217", "2019-09-18", ["2019-08-16","2019-08-19"])
    #user.confirm_sell("000217", "2019-09-18")
    #du.download_all_fund_history("005633")
    #du.download_all_index_history("399300")
    #du.download_all_gold_history("AU9999")
    #af = AllFunds()
    #af.loadMorningStarRatingInfo()
    #af.get_fund_name("000001")
    #print(af.get_fund_url("960042"))
    # aidx = AllIndexes()
    # aidx.loadInfo(x)
    astk = AllStocks()
    codes = astk.sqldb.select(astk.infoTable, '*')
    sh = Stock_history()
    for (i, c, n, s, t, sn, m, st) in codes:
        sh.getKmHistoryTillToday(c)
    # sd = StockDumps()
    # sd.dump_all_stock_his()
    