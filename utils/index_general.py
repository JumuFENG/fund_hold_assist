# Python 3
# -*- coding:utf-8 -*-

from utils import *

class IndexGeneral():
    """
    the basic info of an index.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = code
        self.name = None
        self.histdb = None

        generals = self.sqldb.select(gl_index_info_table, "*", "%s = '%s'" % (column_code, code))
        if generals is not None and len(generals) > 0:
            (id, self.code, self.name), = generals
        self.fullhistable = "i_ful_his_" + self.code
        self.histable = "i_his_" + self.code

    def get_hist_db(self):
        if self.histdb is None:
            self.histdb = SqlHelper(password = db_pwd, database = "history_db")
        return self.histdb

    def get_index_hist_data(self):
        index_hist_data = ("date", "sz" + self.code),
        sqldb = self.get_hist_db()
        his_data = sqldb.select(self.fullhistable, [column_date, column_close, column_p_change], order = " ORDER BY %s ASC" % column_date)
        date_conv = DateConverter()
        for (date, close, p_change) in his_data:
            index_hist_data += (date_conv.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        return index_hist_data
