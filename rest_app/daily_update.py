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
    def __init__(self, sqldb):
        self.sqldb = sqldb

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
                    if self.should_update(h):
                        self.download_all_fund_history(c)

        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code, column_table_history])
        if indexcodes:
            for (c, h) in indexcodes:
                if self.should_update(h):
                    self.download_all_index_history(c)

        if not morningOnetime:
            print("gold only update in the morning")
            return

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code, column_table_history])
        if goldcodes:
            for (c, h) in goldcodes:
                if self.should_update(h):
                    self.download_all_gold_history(c)

    def download_all_fund_history(self, code):
        print("try to update fund history for:", code)
        fh = FundHistoryDataDownloader(self.sqldb)
        fh.fundHistoryTillToday(code)

    def download_all_gold_history(self, code):
        print("try to update gold history for:", code)
        gh = Gold_history()
        gh.getJijinhaoHistory(code)
        gh.getJijinhaoRtHistory(code)

    def download_all_index_history(self, code):
        print("try to update index history for:", code)
        ih = Index_history()
        ih.indexHistoryTillToday(code)
        ih.getHistoryFrom163(code)
        ih.getHistoryFromSohu(code)

    def should_update(self, historytable):
        if not self.sqldb.isExistTable(historytable):
            print("history table", historytable, "not exist")
            return True

        maxDate = self.sqldb.select(historytable, "max(%s)" % column_date)
        if maxDate:
            (maxDate,), = maxDate
        if maxDate == datetime.now().strftime("%Y-%m-%d"):
            print(historytable, "already updated.")
            return False
        return True

if __name__ == '__main__':
    sqldb = SqlHelper(password = db_pwd, database = "fund_center")
    du = DailyUpdater(sqldb)
    du.update_all()

