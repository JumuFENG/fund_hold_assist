# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from utils import *
from decimal import *

class simulator_anti_lose(simulator_base):
    """
    buy while at a loss
    """
    
    def should_buy(self):
        netval = self.get_current_netval()
        aver = self.get_average_price()
        if aver == Decimal("0"):
            return netval <= Decimal("1.0641")
        return netval < aver

    def sell(self, reDays = 7):
        simulator_base.sell(self, reDays)
        self.last_sell_net_val = self.get_current_netval()
