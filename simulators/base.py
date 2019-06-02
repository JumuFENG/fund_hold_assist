# Python 3
# -*- coding:utf-8 -*-

from decimal import *
from utils import *

class simulator_base(object):
    """
    the basic simulator
    """
    def __init__ (self, expect_return = Decimal("0.015")):
        self.cost_prepared = ()
        self.expect_return = expect_return
        self.least_return = Decimal("0.0015")

    def setup(self, sim_host, trade):
        self.sim_host = sim_host
        self.trade = trade

    def simulate(self, sIdx, eIdx):
        # 每日定投
        for x in range(sIdx, eIdx):
            self.curDate = self.sim_host.allDays[x]
            if self.should_sell(self.expect_return):
                self.sell()
                continue

            if self.hold_too_long():
                self.sell_to_survive()
                continue
            
            self.cost_prepared += ((1000, self.get_current_netval()),)
            if self.should_buy():
                self.buy()

    def get_current_netval(self):
        ((netval,),) = self.sim_host.sqldb.select(self.trade.fund_history_table, column_net_value,
        "%s = '%s'" % (column_date, self.curDate))
        return Decimal(str(netval))

    def get_average_price(self):
        ((aver,),) = self.sim_host.sqldb.select(gl_fund_info_table, column_averagae_price,
        "%s = '%s'" % (column_code, self.sim_host.fund_code))
        return Decimal(str(aver))

    def is_start_decreasing(self):
        ((grate,),) = self.sim_host.sqldb.select(self.trade.fund_history_table, column_growth_rate,
        "%s = '%s'" % (column_date, self.curDate))
        prevDate = self.sim_host.allDays[self.sim_host.allDays.index(self.curDate) - 1]
        ((preGrate,),) = self.sim_host.sqldb.select(self.trade.fund_history_table, column_growth_rate,
        "%s = '%s'" % (column_date, prevDate))
        return Decimal(str(grate)) < Decimal("0") and Decimal(str(preGrate)) >= Decimal("0")

    def should_buy(self):
        return True

    def buy(self):
        netval = self.get_current_netval()
        cost = 0
        prepared_remain = ()
        for (p,v) in self.cost_prepared:
            if v >= netval:
                cost += p
            else:
                prepared_remain += ((p,v),)
        self.trade.buy(cost, self.curDate)
        self.cost_prepared = prepared_remain

    def should_sell(self, return_rate):
        netval = self.get_current_netval()
        aver = self.get_average_price()
        if aver == Decimal("0"):
            return False
        return self.is_start_decreasing() and (netval - aver) / aver >= return_rate

    def hold_too_long(self):
        buy_dates_before_30_days = self.trade.buy_dates_available_to_sell(30, self.curDate)
        return len(buy_dates_before_30_days) > 0

    def sell(self, reDays = 7):
        buy_dates = self.trade.buy_dates_available_to_sell(reDays, self.curDate)
        self.trade.sell_by_day(buy_dates, self.curDate)

    def sell_to_survive(self):
        still_hold = self.sim_host.sqldb.select(self.trade.buy_table,[column_date, column_cost, column_portion],["%s = 0" % column_soldout])
        to_sell = ()
        netval = self.get_current_netval()
        for (d,c,p) in still_hold:
            ((val,),) = self.sim_host.sqldb.select(self.trade.fund_history_table, column_net_value,
        "%s = '%s'" % (column_date, d))
            if netval - Decimal(str(val)) >= self.expect_return * Decimal(str(val)):
                to_sell += ((d,c,p),)
        self.trade.sell(to_sell, self.curDate)