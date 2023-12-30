# Python 3
# -*- coding:utf-8 -*-

import json
from ws_strategy_manager import *
from utils import *


class WatchStock:
    def __init__(self, account, code) -> None:
        self.account = account
        self.code = code
        self.counter = 1


class WsClientAgent:
    def __init__(self, ws) -> None:
        self.websocket = ws
        self.watch_stocks = []
        self.intrade_strategies = {}

    def process_message(self, message):
        action = message.get("action")

        if action == 'addwatch':
            code = message.get("code")
            strategy = message.get('strategy')
            account = message.get('account')
            self.watch_stocks.append(WatchStock(account, code))
            # WsClientManager.add_strategy_client(code, websocket, strategy)
            WsStrategyManager.add_stock_strategy(code, strategy)
        if action == 'subscribe':
            strategy = message.get('strategy')
            account = message.get('account')
            amount = message.get('amount')
            self.intrade_strategies[strategy] = {'account': account, 'amount': amount}
            Utils.log(json.dumps(self.intrade_strategies))

    def is_watching(self, code, period):
        for stock in self.watch_stocks:
            if stock.code == code:
                return True
        return False

    def get_subscription(self, ikey):
        if ikey not in self.intrade_strategies.keys():
            Utils.log(f'{ikey} is not in {json.dumps(self.intrade_strategies)}')
            return

        account = self.intrade_strategies[ikey]['account'] if 'account' in self.intrade_strategies[ikey] else 'normal'
        amount = self.intrade_strategies[ikey]['amount'] if 'amount' in self.intrade_strategies[ikey] else 10000
        return {'account': account, 'amount': amount}
