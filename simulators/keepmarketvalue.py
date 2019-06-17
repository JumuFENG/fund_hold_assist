# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from utils import *
from decimal import *

class simulator_keep_market(simulator_base):
    """
    buy and keep market value.
    """
    def prepare_cost(self):
        cost = 1000
        if self.sim_host.sqldb.isExistTable(self.trade.buy_table):
            (cost_buy,portion), = self.sim_host.sqldb.select(self.trade.buy_table, ["sum(%s)" % column_cost, "sum(%s)" % column_portion], "%s = 0" % column_soldout)
            if cost_buy and portion:
                cost = Decimal(cost) + Decimal(str(cost_buy)) - Decimal(str(portion)) * self.get_current_netval()
                cost.quantize(Decimal('0.0000'))
        self.cost_prepared += ((cost, self.get_current_netval()),)
