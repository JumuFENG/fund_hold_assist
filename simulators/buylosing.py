# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from commons import *
from decimal import *

class simulator_anti_lose(simulator_base):
    """
    buy while at a loss
    """
    
    def simulate(self, container, trade, sIdx, eIdx):
        cost_prepared = 1000
        trade.buy(1000, container.allDays[sIdx])
        for x in range(sIdx + 1, eIdx):
            date = container.allDays[x]
            netval = container.sqldb.select(trade.fund_history_table, column_net_value, "%s = '%s'" % (column_date, date))
            netval = Decimal(str(netval[0][0]))
            aver = container.sqldb.select(gl_all_info_table, column_averagae_price, "%s = '%s'" % (column_code, container.fund_code))
            aver = Decimal(str(aver[0][0]))
            if netval < aver:
                trade.buy(cost_prepared, date)
                cost_prepared = 1000
            else:
                cost_prepared += 1000