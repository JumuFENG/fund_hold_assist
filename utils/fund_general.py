# Python 3
# -*- coding:utf-8 -*-

from utils import *

class FundGeneral():
    """
    the basic info of a fund.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb

        details = self.sqldb.select(gl_fund_info_table, "*", "%s = '%s'" % (column_code, code))
        (i, self.code, self.name, self.history_table, self.buy_table, self.sell_table, 
            self.cost_hold, self.portion_hold, self.average, self.budget_table), = details
