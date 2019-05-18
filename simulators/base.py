# Python 3
# -*- coding:utf-8 -*-

class simulator_base(object):
    """
    the basic simulator
    """

    def simulate(self, container, trade, sIdx, eIdx):
        # 每日定投
        for x in range(sIdx, eIdx):
            trade.buy(1000, container.allDays[x])
