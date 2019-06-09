# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import SingleHistoryGraph

class FundHistoryGraph(SingleHistoryGraph):
    """draw fund history graph"""
    def __init__(self, sqldb, code):
        super(FundHistoryGraph, self).__init__(sqldb, code)
        
    def getGlobalInfoTableName(self):
        return gl_fund_info_table

    def getColsToRead(self):
        return [column_date, column_net_value]
