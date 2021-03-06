# Python 3
# -*- coding:utf-8 -*-

from utils import *

class StockGeneral():
    """
    the basic info of a stock.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = code.upper()
        self.name = None
        self.short_term_rate = None
        self.setupdate = None

        generals = self.sqldb.select(gl_all_stocks_info_table, [column_name, column_shortterm_rate, column_setup_date], "%s = '%s'" % (column_code, code))
        if generals is not None and len(generals) > 0:
            (self.name, self.short_term_rate, self.setupdate), = generals
        if self.short_term_rate is None:
            self.short_term_rate = 0.02
        if self.setupdate is None:
            self.setupdate = '1990-12-19'

        self.sohucode = 'cn_' + self.code
        if self.code.startswith('SZ') or self.code.startswith('SH'):
            self.sohucode = 'cn_' + self.code[2:]

        self.stockKtable = 's_k_his_' + self.code
        self.stockKwtable = 's_kw_his_' + self.code
        self.stockKmtable = 's_km_his_' + self.code

    def get_stock_hist_data(self):
        pass
        # index_hist_data = ("date", "sz" + self.code),
        # his_data = self.sqldb.select(self.fullhistable, [column_date, column_close, column_p_change], order = " ORDER BY %s ASC" % column_date)
        # date_conv = DateConverter()
        # for (date, close, p_change) in his_data:
        #     index_hist_data += (date_conv.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        # return index_hist_data
