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
            subscribe_detail = {'account': account, 'amount': amount}
            amtkey = message.get('amtkey')
            if amtkey:
                subscribe_detail['amtkey'] = amtkey
            self.intrade_strategies[strategy] = subscribe_detail
            Utils.log(f'subscribe {strategy} {json.dumps(subscribe_detail)}')

    def is_watching(self, code, period):
        for stock in self.watch_stocks:
            if stock.code == code:
                return True
        return False

    def get_subscription(self, ikey):
        if ikey not in self.intrade_strategies.keys():
            Utils.log(f'{ikey} not subscribed.')
            return

        subscribe_detail = {}
        for k,v in self.intrade_strategies[ikey].items():
            subscribe_detail[k] = v
        if 'amount' not in subscribe_detail:
            subscribe_detail['amount'] = 10000
        return subscribe_detail
