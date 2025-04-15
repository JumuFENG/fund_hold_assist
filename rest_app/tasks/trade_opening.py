# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/../..'))

from user.models import *
from timer_task import TimerTask
from tasks import StockMarket_Stats_Task

def stock_market_opening_task():
    if Utils.today_date() != TradingDate.maxTradingDate():
        TimerTask.logger.warn(f'today is not trading day!')
        return
    sauc = StockAuction()
    sauc.update_daily_auctions()
    shr = StockHotRank()
    shr.getNext()

class AuctionTask(TimerTask):
    def __init__(self) -> None:
        super().__init__('9:25', stock_market_opening_task)


def bk_changes_prepare_task():
    bkchghis = StockBkChangesHistory()
    for bk in bkchghis.dumpDataByDate():
        sbk = StockEmBk(bk)
        sbk.getNext()
    clsbkhis = StockClsBkChangesHistory()
    for bk in clsbkhis.dumpDataByDate():
        sbk = StockClsBk(bk)
        sbk.getNext()


class UpdateBkTask(TimerTask):
    def __init__(self) -> None:
        super().__init__('9:16', bk_changes_prepare_task)

class SmStatsTask925(TimerTask):
    def __init__(self) -> None:
        super().__init__('9:25:05', StockMarket_Stats_Task.execute_simple_task)

class SmStatsTask940(TimerTask):
    def __init__(self) -> None:
        super().__init__('9:40', StockMarket_Stats_Task.execute_simple_task)


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    TimerTask.logger.info('start trade opening tasks!')
    tasks = [AuctionTask(), UpdateBkTask(), SmStatsTask925(), SmStatsTask940()]
    TimerTask.run_tasks(tasks)
