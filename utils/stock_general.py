# Python 3
# -*- coding:utf-8 -*-

from utils import *

class StockGeneral():
    """
    the basic info of a stock.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = None
        self.name = None

        generals = self.sqldb.select(gl_all_stocks_info_table, "*", "%s = '%s'" % (column_code, code))
        if generals:
            (id, self.name, self.code, self.short_term_rate), = generals
        if not self.short_term_rate:
            self.short_term_rate = 0.02

    def get_stock_hist_data(self):
        pass
        # index_hist_data = ("date", "sz" + self.code),
        # his_data = self.sqldb.select(self.fullhistable, [column_date, column_close, column_p_change], order = " ORDER BY %s ASC" % column_date)
        # date_conv = DateConverter()
        # for (date, close, p_change) in his_data:
        #     index_hist_data += (date_conv.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        # return index_hist_data
