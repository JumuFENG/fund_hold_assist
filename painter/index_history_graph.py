# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import SingleHistoryGraph

class IndexHistoryGraph(SingleHistoryGraph):
    """draw index history graph"""
    def __init__(self, sqldb, code, showAll = False):
        super(IndexHistoryGraph, self).__init__(sqldb, code)
        self.showAll = showAll
        
    def getGlobalInfoTableName(self):
        return gl_index_info_table

    def getHisTableNameToRead(self):
        return column_table_full_history if self.showAll else column_table_history

    def getColsToRead(self):
        return [column_date, column_close, column_p_change]
        
    def unpackDataRead(self, dataRead):
        self.dates = []
        self.values = []
        self.rates = []

        for x in dataRead:
            (d,v,r) = x
            self.dates.append(d)
            self.values.append(float(v))
            rate = 0 if r == "None" else float(r)
            self.rates.append(rate)

    def getRoundedRates(self, values):
        minRate = max(-10, min(values))
        maxRate = min(10, max(values))
        rates = [round(r, 1) if r > minRate else minRate for r in values]
        return [round(r, 1) if r < maxRate else maxRate for r in rates]

    def getRoundedValues(self, values):
        return [100*round(v/100) for v in values]

    def getOriginalNetVal(self):
        return None

    def getNetValTickWidth(self):
        return 250

    def getNetValBarWidth(self):
        return 75
