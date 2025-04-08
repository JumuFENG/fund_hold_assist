# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/../..'))

from user.models import *
from timer_task import TimerTask


class AuctionTask(TimerTask):
    def __init__(self, _task) -> None:
        super().__init__('9:25', _task)


def stock_market_opening_task():
    if Utils.today_date() != TradingDate.maxTradingDate():
        TimerTask.logger.warn(f'today is not trading day!')
        return
    sauc = StockAuction()
    sauc.update_daily_auctions()
    shr = StockHotRank()
    shr.getNext()


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    TimerTask.logger.info('start trade opening tasks!')
    stock_market_opening_task()
    # tasks = [AuctionTask(stock_market_opening_task)]
    # TimerTask.run_tasks(tasks)
