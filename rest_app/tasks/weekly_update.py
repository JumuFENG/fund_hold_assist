# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))
from utils import *
from user import *
from history import *
from phon.data.history import AllIndexes

class WeeklyUpdater():
    """for weekly update"""
    def __init__(self):
        pass

    def update_all(self):
        Utils.log('Start weekly update.')

        AllIndexes.update_kline_data('w')

        usermodel = UserModel()
        all_users = usermodel.all_users()
        stocks = []
        for u in all_users:
            ustks = u.get_interested_stocks_code()
            if ustks is not None:
                stocks = stocks + ustks

        sh = Stock_history()
        sfh = Stock_Fflow_History()
        for s in stocks:
            sh.getKwHistoryFromSohuTillToday(s)
            sh.getK15HistoryFromEmTillToday(s)
            sfh.updateFflow(s)

if __name__ == '__main__':
    wu = WeeklyUpdater()
    wu.update_all()
