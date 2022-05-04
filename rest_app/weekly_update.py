# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from utils import *
from user import *
from history import *

class WeeklyUpdater():
    """for weekly update"""
    def __init__(self):
        pass

    def update_all(self):
        print('')
        print('Start weekly update.', datetime.now())

        all_idx = AllIndexes()
        codes = all_idx.sqldb.select(all_idx.infoTable, '*')
        ih = Index_history()
        for (i, c, n) in codes:
            ih.getKwHistoryFromSohuTillToday(c)

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
            sfh.getFflowFromEm(s)

if __name__ == '__main__':
    wu = WeeklyUpdater()
    wu.update_all()
