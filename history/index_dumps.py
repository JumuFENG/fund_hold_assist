# Python 3
# -*- coding:utf-8 -*-

from functools import cached_property
from utils import *
from history import KdataDumps
from phon.hu.hu import DateConverter
from phon.data.history import AllIndexes, IndexHistory


class IndexDumps(KdataDumps):
    def __init__(self):
        pass

    @cached_property
    def infoList(self):
        return AllIndexes.read_all()

    def get_km_table(self, code):
        return AllIndexes.get_ktablename(code, 'm')

    def get_kw_table(self, code):
        return AllIndexes.get_ktablename(code, 'w')

    def get_kd_table(self, code):
        return AllIndexes.get_ktablename(code, 'd')

    def get_khl_m_his(self, code):
        mdata = self.read_km_data(code)
        khl_m = []
        for (i, d, c, h, l, o, pr, p, v, a) in mdata:
            khl_m.append([DateConverter.days_since_2000(d), h, l])
        return khl_m

    def read_km_data(self, code, fqt = 0, length = 60, start = None):
        return IndexHistory(code).get_index_hist_data('m', length, start, fmt='list')

    def get_his(self, codes = None):
        all_index_obj = {}

        for (i,c,n) in self.infoList:
            if codes is not None and not c in codes:
                continue

            mdata = self.read_km_data(c)
            if mdata is None or len(mdata) < 2:
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
