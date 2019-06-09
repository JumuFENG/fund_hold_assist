# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import SingleHistoryGraph

class IndexHistoryGraph(SingleHistoryGraph):
    """draw index history graph"""
    def __init__(self, sqldb, code, showAll = False):
        super(IndexHistoryGraph, self).__init__(sqldb, code)
        self.sqldb = sqldb
        self.code = code
        self.showAll = showAll
        
    def getGlobalInfoTableName(self):
        return gl_index_info_table

    def getHisTableNameToRead(self):
        return column_table_full_history if self.showAll else column_table_history

    def getColsToRead(self):
        return [column_date, column_close]