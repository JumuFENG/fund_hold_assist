# Python 3
# -*- coding:utf-8 -*-

from utils import *
from painter import FundHistoryGraph

class BondFundHistoryGraph(FundHistoryGraph):
    """draw fund trade history graph"""
    def __init__(self, sqldb, code):
        super(BondFundHistoryGraph, self).__init__(sqldb, code)

    def getRateTickWidth(self):
        return 0.1

    def getRateBarWidth(self):
        return 0.008

    def getRoundedRates(self, values):
        minRate = max(-1, min(values))
        maxRate = min(1, max(values), 0 - minRate - minRate)
        rates = [r if r > minRate else 0 for r in values]
        return [r if r < maxRate else 0 for r in rates]
