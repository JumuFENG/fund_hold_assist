# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from utils import *
from user import *
from history import *

class MonthlyUpdater():
    """for monthly update"""
    def __init__(self):
        pass

    def update_all(self):
        print('')
        print('Start monthly update.', datetime.now())

        all_idx = AllIndexes()
        codes = all_idx.sqldb.select(all_idx.infoTable, '*')
        ih = Index_history()
        for (i, c, n) in codes:
            ih.getKmHistoryFromSohuTillToday(c)

        astk = AllStocks()
        stocks = astk.sqldb.select(astk.infoTable, '*')
        sh = Stock_history()
        for (i, c, n, s, t, sn, m, st) in stocks:
            if t == 'TSSTOCK':
                continue
            sh.getKmHistoryFromSohuTillToday(c)

if __name__ == '__main__':
    mu = MonthlyUpdater()
    mu.update_all()
