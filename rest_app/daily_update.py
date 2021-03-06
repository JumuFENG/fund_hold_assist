# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
sys.path.append("..")
from utils import *
from user import *
from history import *

class DailyUpdater():
    """for daily update"""
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = fund_db_name)

    def update_all(self):
        print("")
        print("START UPDATING....",datetime.now())
        datetoday = datetime.now()
        if datetoday.weekday() >= 5:
            print("it is weekend, no data to update.", datetoday.strftime("%Y-%m-%d"))
            return

        strtoday = datetoday.strftime("%Y-%m-%d")
        holi = Holiday()
        if holi.isholiday(strtoday):
            print("it is Holiday, no data to update.", strtoday)
            return

        morningOnetime = False
        if datetoday.hour < 12:
            morningOnetime = True
            print("update in the morning at", datetoday.hour)

        fundcodes = self.sqldb.select(gl_all_funds_info_table, [column_code, column_table_history, column_qdii], " %s is not null and %s != ''" % (column_table_history, column_table_history))
        if fundcodes :
            for (c, h, qd) in fundcodes:
                if (morningOnetime and qd) or not morningOnetime:
                    self.download_all_fund_history(c)

        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code])
        if indexcodes:
            for (c,) in indexcodes:
                self.download_all_index_history(c)

        if not morningOnetime:
            print("gold only update in the morning")
            return

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code, column_table_history])
        if goldcodes:
            for (c, h) in goldcodes:
                self.download_all_gold_history(c)

        self.dowload_all_interested_stocks_khistory()

    def download_all_fund_history(self, code):
        print("try to update fund history for:", code)
        fh = FundHistoryDataDownloader()
        fh.fundHistoryTillToday(code)

    def download_all_gold_history(self, code):
        print("try to update gold history for:", code)
        gh = Gold_history()
        gh.getJijinhaoHistory(code)
        gh.getJijinhaoRtHistory(code)

    def download_all_index_history(self, code):
        ih = Index_history()
        print("try to update index history for:", code)
        ih.getKdHistoryFromSohuTillToday(code)
        ih.getHistoryFrom163(code)

    def dowload_all_interested_stocks_khistory(self):
        print("update interested stocks' history")
        usermodel = UserModel()
        all_users = usermodel.all_users()
        stocks = []
        for u in all_users:
            ustks = u.get_interested_stocks_code()
            if ustks is not None:
                stocks = stocks + ustks

        sh = Stock_history()
        for s in stocks:
            sh.getKdHistoryFromSohuTillToday(s)

if __name__ == '__main__':
    du = DailyUpdater()
    du.update_all()
