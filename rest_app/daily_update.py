# Python 3
# -*- coding:utf-8 -*-

import sys
from threading import Thread
from datetime import datetime, timedelta
import os
import random
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from utils import *
from user import *
from history import *
from pickup import *

class DailyUpdater():
    """for daily update"""
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = fund_db_name)

    def update_all(self):
        print("START UPDATING....",datetime.now())
        datetoday = datetime.now()
        if datetoday.weekday() >= 5:
            print("it is weekend, no data to update.", datetoday.strftime("%Y-%m-%d"))
            return

        strtoday = Utils.today_date()
        if TradingDate.isholiday(strtoday):
            print("it is holiday, no data to update.", strtoday)
            return

        morningOnetime = False
        if datetoday.hour < 12:
            morningOnetime = True
            print("update in the morning at", datetoday.hour)

        self.download_all_fund_history(morningOnetime)
        self.download_all_gold_history(morningOnetime)
        self.download_all_index_history()
        self.update_stock_hotrank()
        if morningOnetime:
            # 只在早上执行的任务
            print("update in the morning...")
            # 分红派息，每天更新一次即可
            self.download_newly_noticed_bonuses()
            # 新股信息，可以间隔几天更新一次
            self.fetch_new_ipo_stocks()
        else:
            # 只在晚上执行的任务
            print("update in the afternoon")
            # 机构游资龙虎榜，可以间隔，首选晚上更新
            self.fetch_dfsorg_stocks()
            # 涨跌停数据，可以间隔，早晚都合适
            self.fetch_zdt_stocks()
            # 更新所有股票都日k数据
            self.download_all_stocks_khistory()
            #
            self.update_selectors()
        # 早上也执行的任务，以防前一晚上没执行

    def download_all_fund_history(self, morning):
        fh = FundHistoryDataDownloader()
        fsqlstr = f" {column_table_history} is not null and {column_table_history} != ''"
        if not morning:
            fsqlstr += f' and {column_qdii} = 0'
        fundcodes = self.sqldb.select(gl_all_funds_info_table, column_code, fsqlstr)
        if fundcodes:
            for c, in fundcodes:
                print("try to update fund history for:", c)
                fh.fundHistoryTillToday(c)

    def download_all_gold_history(self, morning):
        if not morning:
            print('only update gold history in the morning!')
            return

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code, column_name])
        if goldcodes:
            gh = Gold_history()
            for (c, n) in goldcodes:
                print("try to update gold history for:", c)
                gh.getJijinhaoHistory(c)
                gh.getJijinhaoRtHistory(c)
        print('gold history updated!')

    def download_all_index_history(self):
        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code])
        if indexcodes:
            ih = Index_history()
            for (code,) in indexcodes:
                print("try to update index history for:", code)
                ih.getKdHistoryFromSohuTillToday(code)
                ih.getHistoryFrom163(code)
        print('index history updated!')

    def download_all_stocks_khistory(self):
        StockGlobal.getStocksZdfRank()
        stkall = AllStocks()
        stkall.loadNewStock()
        usermodel = UserModel()
        all_users = usermodel.all_users()
        self.allcodes = []
        for u in all_users:
            ustks = u.get_interested_stocks_code()
            if ustks is not None:
                self.allcodes = self.allcodes + ustks
        abstks = stkall.sqldb.select(gl_all_stocks_info_table, 'code', [f'{column_type} = "ABSTOCK"', 'quit_date is NULL'])
        [self.allcodes.append(c) for c, in abstks]

        self.allcodes = set(self.allcodes)
        thds = []
        d = datetime.now()
        for i in range(0, 10):
            t = Thread(target=self.thread_download_stock_khistory)
            t.start()
            thds.append(t)

        for t in thds:
            t.join()

        print('download_all_stocks_khistory done!')
        print('time used:', datetime.now() - d)

    def thread_download_stock_khistory(self):
        if len(self.allcodes) == 0:
            return

        sh = Stock_history()
        sfh = Stock_Fflow_History()
        while len(self.allcodes) > 0:
            code = self.allcodes.pop()
            sh.getKdHistoryFromSohuTillToday(code)
            sfh.updateFflow(code)

    def download_newly_noticed_bonuses(self):
        print("update noticed bonuses")
        dbns = DividenBonus()
        dbns.getBonusNotice()

    def fetch_new_ipo_stocks(self):
        print("update new IPO stocks")
        stkall = AllStocks()
        stkall.loadNewStock()

    def fetch_zdt_stocks(self):
        print('update zt info')
        ztinfo = StockZtInfo()
        ztinfo.getNext()

        print('update zt concepts')
        ztcpt = StockZtConcepts()
        ztcpt.getNext()

        print('update dt info')
        dtinfo = StockDtInfo()
        dtinfo.getNext()

    def fetch_dfsorg_stocks(self):
        dfsorg = StockDfsorg()
        dfsorg.updateDfsorg()

    def update_selectors(self):
        print('update dzt info')
        sds = StockDztSelector()
        sds.updateDzt()

        print('update zt1')
        szt1 = StockZt1Selector()
        szt1.updateZt1()

        print('update dtmap info')
        sdm = StockDtMap()
        sdm.updateDtMap()

        print('update dt3')
        dts = StockDt3Selector()
        dts.updateDt3()

        print('update cents')
        scs = StockCentsSelector()
        scs.updateScs()

    def update_stock_hotrank(self):
        shr = StockHotRank()
        shr.getNext()


if __name__ == '__main__':
    du = DailyUpdater()
    du.update_all()
