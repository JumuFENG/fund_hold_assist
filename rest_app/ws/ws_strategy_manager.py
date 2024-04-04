# Python 3
# -*- coding:utf-8 -*-

import json
from utils import Utils

class WsStrategyManager:
    stocks = set()

    @classmethod
    def add_stock_strategy(self, code, strategy):
        if 'strategies' not in strategy:
            Utils.log(f'{code} not set strategies', Utils.Warn)
            return
        for s in strategy['strategies'].values():
            if s['key'] == 'StrategyBuyZTBoard':
                self.stocks.add(code)
                break

    @classmethod
    def get_period_code(self, period):
        return self.stocks
