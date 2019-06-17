# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from utils import *
from decimal import *

class simulator_roll_over(simulator_base):
    """
    buy and sell roll over
    """
    def prepare_cost_after_sell(self):
        if not self.sim_host.sqldb.isExistTable(self.trade.sell_table):
            return

        sell_info = self.sim_host.sqldb.select(self.trade.sell_table, [column_date, column_cost_sold], order = " ORDER BY %s ASC" % column_date)
        if sell_info:
            (sellDate, sellcost) = sell_info[-1]
            (netval,), = self.sim_host.sqldb.select(self.trade.fund_history_table, column_net_value,
        "%s = '%s'" % (column_date, sellDate))
            for (c, v) in self.cost_prepared:
                sellcost += c
            netval = Decimal(str(netval))
            self.cost_prepared = ()
            self.cost_prepared += ((sellcost / 2, netval * Decimal("0.985"),),)
            self.cost_prepared += ((sellcost / 2, netval * Decimal("0.975"),),)
            #self.cost_prepared += ((sellcost / 4, netval * Decimal("0.96"),),)
            #self.cost_prepared += ((sellcost / 2, netval * Decimal("0.92"),),)
            #self.cost_prepared += ((sellcost / 8, netval * Decimal("0.90"),),)

        #print(self.cost_prepared)