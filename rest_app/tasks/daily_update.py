# Python 3
# -*- coding:utf-8 -*-

import sys
from threading import Thread
from datetime import datetime, timedelta
import os
import traceback
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))
from utils import *
from user import *
from history import *
from pickup import *

class DailyUpdater():
    """for daily update"""
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = fund_db_name)

    def update_all(self):
        Utils.log(f"START UPDATING....")
        datetoday = datetime.now()
        if datetoday.weekday() >= 5:
            Utils.log(f'it is weekend, no data to update. {datetoday.strftime("%Y-%m-%d")}')
            return

        strtoday = Utils.today_date()
        if TradingDate.isholiday(strtoday):
            Utils.log(f"it is holiday, no data to update. {strtoday}")
            return

        morningOnetime = False
        if datetoday.hour < 12:
            morningOnetime = True
            Utils.log(f"update in the morning at {datetoday.hour}")

        self.download_all_fund_history(morningOnetime)
        self.download_all_gold_history(morningOnetime)
        self.download_all_index_history()
        self.update_stock_hotrank()
        if morningOnetime:
            # 只在早上执行的任务
            Utils.log("update in the morning...")
            # 分红派息，每天更新一次即可
            self.download_newly_noticed_bonuses()
            # 新股信息，可以间隔几天更新一次
            self.fetch_new_ipo_stocks()
        else:
            # 只在晚上执行的任务
            Utils.log("update in the afternoon")
            # 机构游资龙虎榜，可以间隔，首选晚上更新
            self.fetch_dfsorg_stocks()
            # 更新所有股票都日k数据
            self.download_all_stocks_khistory()
            # 涨跌停数据，可以间隔，早晚都合适
            self.fetch_zdt_stocks()
            # 盘口异动数据, 每个交易日收盘后更新, 错过无法补录
            self.update_stock_changes()
            #
            self.update_selectors()
        # 早上也执行的任务，以防前一晚上没执行
        self.update_twice_selectors()

    def download_all_fund_history(self, morning):
        fh = FundHistoryDataDownloader()
        fsqlstr = f" {column_table_history} is not null and {column_table_history} != ''"
        if not morning:
            fsqlstr += f' and {column_qdii} = 0'
        fundcodes = self.sqldb.select(gl_all_funds_info_table, column_code, fsqlstr)
        if fundcodes:
            for c, in fundcodes:
                Utils.log(f"try to update fund history for: {c}")
                fh.fundHistoryTillToday(c)

    def download_all_gold_history(self, morning):
        if not morning:
            Utils.log('only update gold history in the morning!')
            return

        goldcodes = self.sqldb.select(gl_gold_info_table, fields=[column_code, column_name])
        if goldcodes:
            gh = Gold_history()
            for (c, n) in goldcodes:
                Utils.log(f"try to update gold history for: {c}")
                gh.getJijinhaoHistory(c)
                gh.getJijinhaoRtHistory(c)
        Utils.log('gold history updated!')

    def download_all_index_history(self):
        indexcodes = self.sqldb.select(gl_index_info_table, fields=[column_code])
        if indexcodes:
            ih = Index_history()
            for (code,) in indexcodes:
                print("try to update index history for:", code)
                ih.getKdHistoryFromSohuTillToday(code)
                ih.getHistoryFrom163(code)
        Utils.log('index history updated!')

    def download_all_stocks_khistory(self):
        StockGlobal.getStocksZdfRank()
        stkall = AllStocks()
        stkall.loadNewStock()
        stkall.loadNewStock('BJ')
        usermodel = UserModel()
        all_users = usermodel.all_users()
        self.allcodes = []
        for u in all_users:
            ustks = u.get_interested_stocks_code()
            if ustks is not None:
                self.allcodes = self.allcodes + ustks
        abstks = stkall.sqldb.select(gl_all_stocks_info_table, 'code', [f'{column_type} = "ABSTOCK" or {column_type} = "BJStock"', 'quit_date is NULL'])
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

        Utils.log('download_all_stocks_khistory done!')
        Utils.log(f'time used: { datetime.now() - d}')

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
        Utils.log("update noticed bonuses")
        try:
            dbns = StockShareBonus()
            dbns.getNext()
        except Exception as e:
            Utils.log(e)
        Utils.log('update announcements')
        try:
            ann = StockAnnoucements()
            ann.getNext()
        except Exception as e:
            Utils.log(e)

    def fetch_new_ipo_stocks(self):
        Utils.log("update new IPO stocks")
        stkall = AllStocks()
        stkall.loadNewStock()
        stkall.loadNewStock('BJ')

    def fetch_zdt_stocks(self):
        Utils.log('update ST bk stocks')
        stbk = StockEmBk('BK0511')
        stbk.getNext()

        Utils.log('update zt info')
        ztinfo = StockZtDaily()
        ztinfo.getNext()

        Utils.log('update zt concepts')
        ztcpt = StockZtConcepts()
        ztcpt.getNext()

        Utils.log('update dt info')
        dtinfo = StockDtInfo()
        dtinfo.getNext()

    def fetch_dfsorg_stocks(self):
        dfsorg = StockDfsorg()
        try:
            dfsorg.updateDfsorg()
        except Exception as e:
            Utils.log(e, Utils.Err)
            Utils.log(traceback.format_exc(), Utils.Err)

    def update_selectors(self):
        Utils.log('update dtmap info')
        sdm = StockDtMap()
        sdm.updateDtMap()

        Utils.log('update dt3')
        dts = StockDt3Selector()
        dts.updateDt3()

        selectors = [
            StockDztSelector(), StockZt1Selector(), StockCentsSelector(),
            StockMaConvergenceSelector(), StockZdfRanks(), StockZtLeadingSelector(),
            StockZtLeadingSelectorST(), StockDztStSelector(), StockDztBoardSelector(), StockDztStBoardSelector(),
            StockZt1BreakupSelector()]
        for sel in selectors:
            Utils.log(f'update { sel.__class__.__name__}')
            sel.updatePickUps()

    def update_twice_selectors(self):
        selectors = [
            StockUstSelector()]
        for sel in selectors:
            Utils.log(f'update {sel.__class__.__name__}')
            sel.updatePickUps()

    def update_stock_hotrank(self):
        shr = StockHotRank()
        shr.getNext()

    def update_stock_changes(self):
        sch = StockChangesHistory()
        sch.updateDaily()


if __name__ == '__main__':
    du = DailyUpdater()
    # du.download_newly_noticed_bonuses()
    du.fetch_dfsorg_stocks()
