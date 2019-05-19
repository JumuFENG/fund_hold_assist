# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from commons import *
from decimal import *

class simulator_decrease(simulator_base):
    """
    buy when decreasing
    """
        
    def should_buy(self):
        grate = self.sim_host.sqldb.select(self.trade.fund_history_table, column_growth_rate, "%s = '%s'" % (column_date, self.curDate))
        return Decimal(str(grate[0][0]))< Decimal("0")
