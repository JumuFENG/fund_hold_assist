# Python 3
# -*- coding:utf-8 -*-

from utils import *
from decimal import *
from datetime import datetime, timedelta

class Select_Fund():
    """to select fund in all_funds"""
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.funds = self.sqldb.select(gl_all_funds_info_table, [column_code, column_name, column_type, column_risk_level, column_5star_num, column_rating_cx3, column_rating_cx5], "%s = 3" % column_5star_num, order = " ORDER BY %s ASC" % column_rating_cx3)
    def show_funds(self, fund_type):
        n = 0
        for x in self.funds:
            if x[2] == fund_type and x[5] == '5' and (x[6] >= '4' or x[6] == '0'):
                print(x)
                n += 1
        print(n)

    def show_bond_funds(self):
        self.show_funds("债券型")#

    def show_stock_funds(self):
        self.show_funds("股票型")

    def show_mixed_funds(self):
        self.show_funds("混合型")

