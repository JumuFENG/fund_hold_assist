# Python 3
# -*- coding:utf-8 -*-

from utils import *

class FundGeneral():
    """
    the basic info of a fund.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.histdb = None

        fgs = self.sqldb.select(gl_all_funds_info_table, "*", "%s = '%s'" % (column_code, code))
        fgs, = fgs
        self.code = fgs[1];
        self.name = fgs[2];
        self.fund_url = fgs[3];
        self.summery_url = fgs[9];
        pre_buy_fee = fgs[10];
        self.pre_buy_fee = 0;
        if pre_buy_fee:
            self.pre_buy_fee = float(pre_buy_fee.strip('%')) / 100
        self.short_term_rate = fgs[17]
        self.history_table = fgs[18]
        if not self.history_table:
            self.history_table = "f_his_" + self.code
            self.sqldb.update(gl_all_funds_info_table, {column_table_history: self.history_table}, {column_code:self.code});
        self.qdii = fgs[19]
        index_code = None
        if not fgs[20]:
            index_code = '000001'
        elif len(fgs[20]) == 6:
            index_code = fgs[20]
        self.index_code = index_code

    def netvalue_by_date(self, date):
        if not date:
            return
        sqldb = self.get_hist_db()
        netvalue = sqldb.select(self.history_table, column_net_value, "%s = '%s'" % (column_date, date))
        if netvalue:
            (netvalue,), = netvalue
            return netvalue

    def latest_netvalue(self):
        sqldb = self.get_hist_db()
        history_dvs = sqldb.select(self.history_table, [column_date, column_net_value], order = " ORDER BY %s ASC" % column_date)
        if not history_dvs:
            return 0;

        (d, netvalue) = history_dvs[-1]
        return netvalue

    def get_hist_db(self):
        if self.histdb is None:
            self.histdb = SqlHelper(password = db_pwd, database = history_db_name)
        return self.histdb

    def get_fund_hist_data(self):
        sqldb = self.get_hist_db()
        fund_his = sqldb.select(self.history_table, [column_date, column_net_value, column_growth_rate], order = " ORDER BY %s ASC" % column_date)
        if not fund_his:
            return
        fund_his_data = ('date', self.code),
        date_conv = DateConverter()
        for (d, v, g) in fund_his:
            fund_his_data += (date_conv.days_since_2000(d), v, round(float(100 * g), 2)),
        return fund_his_data
        