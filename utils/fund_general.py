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
        (i, self.name, self.code, self.history_table, self.buy_table, self.sell_table, 
            self.cost_hold, self.portion_hold, self.average, self.budget_table), = details
        generals = self.sqldb.select(gl_all_funds_info_table, "*", "%s = '%s'" % (column_code, code))
        (i, code, name, url, ftype, risklvl, amount, setup_date, star, summery_url, fee, shzq, zszq, jajx, num5star, mstar3, mstar5, self.short_term_rate), = generals

    def netvalue_by_date(self, date):
        if not date:
            return
        netvalue = self.sqldb.select(self.history_table, column_net_value, "%s = '%s'" % (column_date, date))
        if netvalue:
            (netvalue,), = netvalue
        return netvalue
