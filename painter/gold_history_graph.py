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
        