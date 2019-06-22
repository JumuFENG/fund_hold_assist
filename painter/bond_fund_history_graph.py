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
        return [r if r < 1 else 1 for r in values]
