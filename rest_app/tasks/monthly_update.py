# Python 3
# -*- coding:utf-8 -*-

import sys
from datetime import datetime, timedelta
import traceback
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../..'))
from utils import *
from history import StockEmBk, StockDfsorg
from phon.data.history import AllIndexes, AllStocks
from phon.data.misc import PureLost4Up

class MonthlyUpdater():
    """for monthly update"""
    @staticmethod
    def update_all():
        print('')
        print('Start monthly update.', datetime.now())

        try:
            AllIndexes.update_kline_data('m')
            AllStocks.update_kline_data('m')
            PureLost4Up.update_em()

            Utils.log('update B bk stocks')
            bbk = StockEmBk('BK0636')
            bbk.getNext()

            Utils.log('update dfsorg details')
            dfsorg = StockDfsorg()
            dfsorg.updateDetails()
        except Exception as e:
            Utils.log(e, Utils.Err)
            Utils.log(traceback.format_exc(), Utils.Err)


if __name__ == '__main__':
    MonthlyUpdater.update_all()
