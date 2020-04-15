# Python 3
# -*- coding:utf-8 -*-

from utils import *

class GoldGeneral():
    """
    the basic info of gold.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = code
        self.name = None

        generals = self.sqldb.select(gl_gold_info_table, "*", "%s = '%s'" % (column_code, code))
        if generals is not None and len(generals) > 0:
            (id, self.code, self.name), = generals

        if self.name is None:
            self.name = gold_code_instid[self.code]
            if generals is None or len(generals) == 0:
                self.sqldb.insert(gl_gold_info_table, {column_code: self.code, column_name: self.name})
            else:
                self.sqldb.update(gl_gold_info_table, {column_name: self.name}, {column_code: self.code})
        self.gold_history_table = 'g_his_' + self.code
        self.gold_history_table_30 = self.gold_history_table + "_30"
        self.gold_rt_history_table = 'g_rt_his_' + self.code
        self.goldk_history_table = 'g_k_his_' + self.code
        self.goldkweek_history_table = 'g_kweek_his_' + self.code
        self.goldkmonth_history_table = 'g_kmonth_his_' + self.code

    def get_gold_hist_data(self):
        pass