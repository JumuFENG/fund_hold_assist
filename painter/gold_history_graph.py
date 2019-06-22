# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import SingleHistoryGraph

class GoldHistoryGraph(SingleHistoryGraph):
    """draw gold history graph"""
    def __init__(self, sqldb, code, showAll = False):
        super(GoldHistoryGraph, self).__init__(sqldb, code)
        self.showAll = showAll
        
    def getGlobalInfoTableName(self):
        return gl_gold_info_table

    def getColsToRead(self):
        return [column_date, (column_close if self.showAll else column_price)]

    def unpackDataRead(self, dataRead):
        self.dates = [d for (d,v) in dataRead]
        self.values = [float(v) for (d,v) in dataRead]
        self.rates = [0]
        for x in self.values[0:-1]:
            self.rates.append(0 if x == 0 else  round(100 *(self.values[self.values.index(x) + 1] -x)/x, 2))

    def getRoundedValues(self, values):
        return [round(v/5)*5 for v in values]

    def getOriginalNetVal(self):
        return None

    def getNetValTickWidth(self):
        return 20

    def getNetValBarWidth(self):
        return 4