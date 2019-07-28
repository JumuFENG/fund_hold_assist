# Python 3
# -*- coding:utf-8 -*-

from utils import *

class FundGeneral():
    """
    the basic info of a fund.
    """
    def __init__(self, sqldb, code):
        self.sqldb = sqldb

        details = self.sqldb.select(gl_fund_info_table, "*", "%s = '%s'" % (column_code, code))
        (i, self.name, self.code, self.history_table, self.buy_table, self.sell_table, 
            self.cost_hold, self.portion_hold, self.average, self.budget_table), = details
        generals = self.sqldb.select(gl_all_funds_info_table, "*", "%s = '%s'" % (column_code, code))
        (i, code, name, url, ftype, risklvl, amount, setup_date, star, summery_url, fee, shzq, zszq, jajx, num5star, mstar3, mstar5, self.short_term_rate), = generals

    def netvalue_by_date(self, date):
        if not date:
            return
        netvalue = self.sqldb.select(self.history_table, column_net_value, "%s = '%s'" % (column_date, date))
        if netvalue:
            (netvalue,), = netvalue
        return netvalue

    def latest_netvalue(self):
        history_dvs = self.sqldb.select(self.history_table, [column_date, column_net_value], order = " ORDER BY %s ASC" % column_date)
        (d, netvalue) = history_dvs[-1]
        return netvalue

    def last_day_earned(self):
        history_dvs = self.sqldb.select(self.history_table, [column_date, column_net_value, column_growth_rate], order = " ORDER BY %s ASC" % column_date);
        (lastd, n, grate) = history_dvs[-1]
        (d, nv, g) = history_dvs[-2]
        latest_earned_per_portion = float(nv) * float(grate)

        pre_portion = float(self.portion_hold)
        if self.buy_table:
            last_portion = self.sqldb.select(self.buy_table, [column_portion], "%s = '%s'" % (column_date, lastd))
            if last_portion:
                (last_portion,), = last_portion
            if not last_portion:
                last_portion = 0
            pre_portion -= float(last_portion)

        return round(latest_earned_per_portion * pre_portion, 2)
