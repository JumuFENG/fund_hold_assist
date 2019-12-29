# Python 3
# -*- coding:utf-8 -*-

from utils import *

class FundGeneral():
    """
    the basic info of a fund.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb

        generals = self.sqldb.select(gl_all_funds_info_table, "*", "%s = '%s'" % (column_code, code))
        (i, self.code, self.name, self.fund_url, ftype, risklvl, amount, setup_date, star, self.summery_url, pre_buy_fee, shzq, zszq, jajx, num5star, mstar3, mstar5, self.short_term_rate, self.history_table), = generals
        if not self.history_table:
            self.history_table = "f_his_" + self.code
            self.sqldb.update(gl_all_funds_info_table, {column_table_history: self.history_table}, {column_code:self.code});
        self.pre_buy_fee = 0
        if pre_buy_fee:
            self.pre_buy_fee = float(pre_buy_fee.strip('%')) / 100

    def netvalue_by_date(self, date):
        if not date:
            return
        netvalue = self.sqldb.select(self.history_table, column_net_value, "%s = '%s'" % (column_date, date))
        if netvalue:
            (netvalue,), = netvalue
            return netvalue

    def latest_netvalue(self):
        history_dvs = self.sqldb.select(self.history_table, [column_date, column_net_value], order = " ORDER BY %s ASC" % column_date)
        if not history_dvs:
            return 0;

        (d, netvalue) = history_dvs[-1]
        return netvalue

    def get_fund_hist_data(self):
        fund_his = self.sqldb.select(self.history_table, [column_date, column_net_value, column_growth_rate], order = " ORDER BY %s ASC" % column_date)
        if not fund_his:
            return
        fund_his_data = ('date', self.code),
        date_conv = DateConverter()
        for (d, v, g) in fund_his:
            fund_his_data += (date_conv.days_since_2000(d), v, round(float(100 * g), 2)),
        return fund_his_data
        