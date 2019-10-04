# Python 3
# -*- coding:utf-8 -*-

from utils import *

class IndexGeneral():
    """
    the basic info of an index.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb

        generals = self.sqldb.select(gl_index_info_table, "*", "%s = '%s'" % (column_code, code))
        (id, self.name, self.code, self.histable, self.fullhistable), = generals

    def get_index_hist_data(self):
        index_hist_data = ("date", "sz" + self.code),
        his_data = self.sqldb.select(self.fullhistable, [column_date, column_close, column_p_change], order = " ORDER BY %s ASC" % column_date)
        for (date, close, p_change) in his_data:
            index_hist_data += (date, round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        return index_hist_data
