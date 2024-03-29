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
    sauc = StockAuction()
    sauc.update_daily_auctions()


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    TimerTask.logger.info('start trade opening tasks!')
    tasks = [AuctionTask(stock_market_opening_task)]
    TimerTask.run_tasks(tasks)
