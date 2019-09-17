# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import SingleHistoryGraph

class FundHistoryGraph(SingleHistoryGraph):
    """draw fund history graph"""
    def __init__(self, sqldb, code):
        super(FundHistoryGraph, self).__init__(sqldb, code)
        
    def getGlobalInfoTableName(self):
        return gl_all_funds_info_table

    def getColsToRead(self):
        return [column_date, column_net_value, column_growth_rate]

    def unpackDataRead(self, dataRead):
        self.dates = [d for (d,v,r) in dataRead]
        self.values = [float(v) for (d,v,r) in dataRead]
        self.rates = [round(r * 100, 2) for (d,v,r) in dataRead]

    def getRoundedValues(self, values):
        return [round(v, 3) for v in values]

    def getOriginalNetVal(self):
        return max(1.0, min(self.values))

    def getNetValTickWidth(self):
        delta = max(self.values) - min(self.values)
        if delta < 0.5:
            return 0.02
        elif delta < 1:
            return 0.05
        elif delta < 2:
            return 0.1
        return (round(max(self.values)/0.5) - round(min(self.values)/0.5))/50

    def getNetValBarWidth(self):
        return 0.001
