# Python 3
# -*- coding:utf-8 -*-

from utils import *

class StockGeneral():
    """
    the basic info of a stock.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        if isinstance(code, tuple):
            _, self.code, self.name, self.short_term_rate, self.type, sn, _s, self.setupdate, self.qdate = code
        elif isinstance(code, str):
            self.code = code.upper()
            self.name = None
            self.short_term_rate = None
            self.setupdate = None
            generals = self.sqldb.select(gl_all_stocks_info_table, [column_name, column_shortterm_rate, column_setup_date], "%s = '%s'" % (column_code, code))
            if generals is not None and len(generals) > 0:
                (self.name, self.short_term_rate, self.setupdate), = generals
        else:
            raise Exception('Not valid initialize param')

        if self.short_term_rate is None:
            self.short_term_rate = 0.02
        if self.setupdate is None:
            self.setupdate = '1990-12-19'

        self.sohucode = 'cn_' + self.code
        if self.code.startswith('SZ') or self.code.startswith('SH'):
            self.sohucode = 'cn_' + self.code[2:]

        self.emseccode = '1.' + self.code
        if self.code.startswith('SH'):
            self.emseccode = '1.' + self.code[2:]
        elif self.code.startswith('SZ'):
            self.emseccode = '0.' + self.code[2:]
        elif self.code.startswith('60') or self.code.startswith('68'):
            self.emseccode = '1.' + self.code
        else:
            self.emseccode = '0.' + self.code

        self.stockKtable = 's_k_his_' + self.code
        self.stockKwtable = 's_kw_his_' + self.code
        self.stockKmtable = 's_km_his_' + self.code
        self.stockK15table = 's_k15_his_' + self.code
        self.bonustable = 's_bonus_' + self.code
        self.fflowtable = 's_fflow_' + self.code
