# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))

from phon.data.user import User
from utils import Utils, TradingDate, datetime, shared_cloud_foler
from timer_task import TimerTask
from history import StockBkChangesHistory, StockClsBkChangesHistory, Stock_Fflow_History
from tasks import StockMarket_Stats_Task


def save_earning_task():
    if Utils.today_date() != TradingDate.maxTradingDate():
        TimerTask.logger.warn(f'today is not trading day!')
        return
    TimerTask.logger.info(f'trade_closed_task!')
    User.save_stocks_eaning_html(shared_cloud_foler, [11, 14])
    dnow = datetime.now()
    if dnow.weekday() == 4:
        for uid in [11, 14]:
            user = User.user_by_id(uid)
            user.archive_deals(f'{dnow.year + 1}')

class SaveEarningTask(TimerTask):
    def __init__(self) -> None:
        super().__init__('15:01:03', save_earning_task)


def update_bkchanges_in5d():
    bkchghis = StockBkChangesHistory()
    bkchghis.updateBkChangedIn5Days()
    clsbkhis = StockClsBkChangesHistory()
    clsbkhis.updateBkChangedIn5Days()
    sfh = Stock_Fflow_History()
    sfh.updateLatestFflow()


class UpdateBkChangesIn5dTask(TimerTask):
    def __init__(self) -> None:
        super().__init__('15:01:05', update_bkchanges_in5d)


class SmStatsTask1501(TimerTask):
    def __init__(self) -> None:
        super().__init__('15:01:10', StockMarket_Stats_Task.execute_simple_task)


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    TimerTask.logger.info('start trade closed task!')
    tasks = [SaveEarningTask(), UpdateBkChangesIn5dTask(), SmStatsTask1501()]
    TimerTask.run_tasks(tasks)
