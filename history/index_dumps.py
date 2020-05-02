# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import time
import json
from datetime import datetime, timedelta
from decimal import Decimal

class IndexDumps(KdataDumps):
    def __init__(self):
        self.history = Index_history()
        allidx = AllIndexes()
        self.sqldb = allidx.sqldb
        self.infoList = allidx.readAll()

    def get_km_table(self, code):
        ig = IndexGeneral(self.sqldb, code)
        return ig.kmhistable

    def get_kw_table(self, code):
        ig = IndexGeneral(self.sqldb, code)
        return ig.kwhistable

    def get_kd_table(self, code):
        ig = IndexGeneral(self.sqldb, code)
        return ig.khistable

    def get_his(self, codes = None):
        all_index_obj = {}

        for (i,c,n) in self.infoList:
            if codes is not None and not c in codes:
                continue

            mdata = self.read_km_data(c)
            if mdata is None or len(mdata) < 10:
                continue

            index_obj = {}
            index_obj['name'] = n

            mdata = self.process_kdata(mdata)
            index_obj['mfluct_down'] = mdata['fluct_down']
            index_obj['mfluct_up'] = mdata['fluct_up']
            index_obj['mlen'] = mdata['data_len']
            index_obj['mlasthigh'] = mdata['last_high']
            index_obj['mlastlow'] = mdata['last_low']
            index_obj['last_close'] = mdata['last_close']
            all_index_obj[c] = index_obj

        return all_index_obj
        