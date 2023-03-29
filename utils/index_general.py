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
        self.khistable = "i_k_his_" + self.code
        self.kwhistable = "i_kw_his_" + self.code
        self.kmhistable = "i_km_his_" + self.code
        self.histable = "i_his_" + self.code

    def get_hist_db(self):
        if self.histdb is None:
            self.histdb = SqlHelper(password = db_pwd, database = history_db_name)
        return self.histdb

    def get_index_hist_data(self):
        index_hist_data = ("date", "sz" + self.code),
        sqldb = self.get_hist_db()
        his_data = sqldb.select(self.khistable, [column_date, column_close, column_p_change], order = " ORDER BY %s ASC" % column_date)
        for (date, close, p_change) in his_data:
            index_hist_data += (DateConverter.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        return index_hist_data
