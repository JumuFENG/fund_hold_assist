# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from commons import *
from decimal import *

class simulator_decrease(simulator_base):
    """
    buy when decreasing
    """
    
    def simulate(self, container, trade, sIdx, eIdx):
        cost_prepared = 1000
        trade.buy(1000, container.allDays[sIdx])
        for x in range(sIdx + 1, eIdx):
            date = container.allDays[x]
            grate = container.sqldb.select(trade.fund_history_table, column_growth_rate, "%s = '%s'" % (column_date, date))
            grate = Decimal(str(grate[0][0]))
            if grate < Decimal("0"):
                trade.buy(cost_prepared, date)
                cost_prepared = 1000
            else:
                cost_prepared += 1000

