# Python 3
# -*- coding:utf-8 -*-

from simulators import *
from commons import *
from decimal import *

class simulator_anti_lose(simulator_base):
    """
    buy while at a loss
    """
    
    def should_buy(self):
        netval = self.get_current_netval()
        aver = self.get_average_price()
        return netval < aver
