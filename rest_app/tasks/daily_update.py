# Python 3
# -*- coding:utf-8 -*-

import sys
from threading import Thread
from datetime import datetime, timedelta
import os
import traceback
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))
from utils import Utils
from history import *
from pickup import *
from phon.data.user import User
from phon.data.history import AllIndexes, AllStocks, TradingDate


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
        if TradingDate.is_holiday(strtoday):
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
        # 新股信息，可以间隔几天更新一次
        AllStocks.load_new_stocks()
        if morningOnetime:
            # 只在早上执行的任务
            Utils.log("update in the morning...")
            # 分红派息，每天更新一次即可
            self.download_newly_noticed_bonuses()
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
        AllIndexes.update_kline_data('d')
        TradingDate.clear_cache()
        Utils.log('index history updated!')

    def download_all_stocks_khistory(self):
        Utils.log('start download_all_stocks_khistory')
        sfh = Stock_Fflow_History()
        sfh.updateDailyFflow()
        all_users = User.all_users()
        allcodes = []
        for u in all_users:
            if u.id <= 10:
                continue
            ustks = u.all_interest_stocks()
            if ustks:
               allcodes = allcodes + ustks

        allcodes = [s for s in set(allcodes) if not AllStocks.is_quited(s)]
        upfailed = AllStocks.update_klines_by_code(allcodes, 'd')
        if not upfailed:
            Utils.log('all stocks kline data updated!')
            return

        upfailed = [s.upper() for s in upfailed]
        if upfailed:
            sa = StockAnnoucements()
            Utils.log(f'stocks update failed: {upfailed}')
            sa.check_stock_quit(upfailed)
            sa.check_fund_quit(upfailed)

        Utils.log('download_all_stocks_khistory done! %d' % len(allcodes))

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
            StockDztSelector(), StockZt1Selector(), StockZt1WbSelector(), StockCentsSelector(),
            StockMaConvergenceSelector(), StockZdfRanks(), StockZtLeadingSelector(), StockZtLeadingStepsSelector(),
            StockZtLeadingSelectorST(), StockDztStSelector(), StockDztBoardSelector(), StockDztStBoardSelector(),
            StockZdtEmotion(), StockHotStocksRetryZt0Selector(),
            StockZt1BreakupSelector(), StockZt1j2Selector(), StockLShapeSelector(), StockDfsorgSelector(),
            StockTrippleBullSelector(), StockEndVolumeSelector()]
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

    def update_fixzdt(self):
        self.fetch_zdt_stocks()
        self.update_stock_changes()
        self.update_selectors()
        self.update_twice_selectors()


if __name__ == '__main__':
    du = DailyUpdater()
    du.update_all()
    # du.update_fixzdt()
