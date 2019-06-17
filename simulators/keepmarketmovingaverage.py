# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from utils import *
from decimal import *

class simulator_keepmarket_movingaverage(simulator_base):
    """
    keep market and multi by the moving average scaler.
    """
    def prepare_cost(self):
        cost = Decimal('1000')
        if self.sim_host.sqldb.isExistTable(self.trade.buy_table):
            (cost_buy,portion), = self.sim_host.sqldb.select(self.trade.buy_table, ["sum(%s)" % column_cost, "sum(%s)" % column_portion], "%s = 0" % column_soldout)
            if cost_buy and portion:
                cost = Decimal(cost) + Decimal(str(cost_buy)) - Decimal(str(portion)) * self.get_current_netval()
                cost.quantize(Decimal('0.0000'))

        curIdx = self.sim_host.allDays.index(self.curDate)
        val10ds = self.sim_host.allValues[curIdx - 250 : curIdx]
        s = 0
        for v in val10ds:
            s += v
        average = Decimal(s) / len(val10ds)
        curVal = self.get_current_netval()
        k = 1/(1 + (curVal - average) * 20 / average)
        scaler = k * k * k * k
        scaler = min(2.5, scaler) if scaler > 1 else max(0.1, scaler)
        budget = (cost * Decimal(scaler)).quantize(Decimal("0.0000"))
        self.cost_prepared += ((budget, self.get_current_netval()),)

    def buy(self):
        cost = 0
        for (p,v) in self.cost_prepared:
            cost += p
        backup_remain = ()
        netval = self.get_current_netval()
        for (p,v) in self.cost_backup:
            if v >= netval:
                cost += p
            else:
                backup_remain += ((p,v),)

        self.trade.buy(cost, self.curDate)
        self.cost_prepared = ()
        self.cost_backup = backup_remain
