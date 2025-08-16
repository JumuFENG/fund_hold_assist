# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))
from utils import *
from phon.data.user import User
from phon.data.history import AllIndexes, AllStocks

class WeeklyUpdater():
    """for weekly update"""
    @staticmethod
    def update_all():
        Utils.log('Start weekly update.')

        AllIndexes.update_kline_data('w')
        AllStocks.update_kline_data('w')

        all_users = User.all_users()
        stocks = []
        for u in all_users:
            if u.id <= 10:
                continue
            ustks = u.all_interest_stocks()
            if ustks:
                stocks = stocks + ustks

        stocks = [s for s in set(stocks) if not AllStocks.is_quited(s)]
        AllStocks.update_klines_by_code(stocks, 'w')

if __name__ == '__main__':
    wu = WeeklyUpdater()
    wu.update_all()
