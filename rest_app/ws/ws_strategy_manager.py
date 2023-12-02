# Python 3
# -*- coding:utf-8 -*-

import json


class WsStrategyManager:
    stocks = set()

    @classmethod
    def add_stock_strategy(self, code, strategy):
        for s in strategy['strategies'].values():
            if s['key'] == 'StrategyBuyZTBoard':
                self.stocks.add(code)
                break

    @classmethod
    def get_period_code(self, period):
        return self.stocks
