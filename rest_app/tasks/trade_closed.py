# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))

from phon.data.user import User
from utils import Utils, TradingDate, datetime, shared_cloud_foler
from timer_task import TimerTask


class TradeClosedTask(TimerTask):
    def __init__(self, _task) -> None:
        super().__init__('15:01', _task)


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


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    TimerTask.logger.info('start trade closed task!')
    tasks = [TradeClosedTask(save_earning_task)]
    TimerTask.run_tasks(tasks)
