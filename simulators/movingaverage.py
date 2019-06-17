# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from utils import *
from decimal import *

class simulator_moving_average(simulator_base):
    """
    buy according to the moving average.
    """
    def prepare_cost(self):
        curIdx = self.sim_host.allDays.index(self.curDate)
        val10ds = self.sim_host.allValues[curIdx - 250 : curIdx]
        s = 0
        for v in val10ds:
            s += v
        average = Decimal(s) / len(val10ds)
        curVal = self.get_current_netval()
        k = 1/(1 + (curVal - average) * 20 / average)
        #k = ((average * average * average * average) / (curVal * curVal * curVal * curVal)).quantize(Decimal("0.0000"))
        budget = 1000 * k * k * k * k
        budget = min(2500, budget) if budget > 1000 else max(100, budget)
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
