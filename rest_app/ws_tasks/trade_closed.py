# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/../..'))

from user.models import *
from timer_task import TimerTask


class TradeClosedTask(TimerTask):
    def __init__(self, _task) -> None:
        super().__init__('15:01', _task)


def save_earning_task():
    dnow = datetime.now()
    print('trade_closed_task', dnow.strftime(f"%Y-%m-%d %H:%M:%s"))
    um = UserModel()
    user = um.user_by_id(11)
    user.save_stocks_eaning_html(shared_cloud_foler)


if __name__ == '__main__':
    print('start trade closed task!')
    tasks = [TradeClosedTask(save_earning_task)]
    TimerTask.run_tasks(tasks)
