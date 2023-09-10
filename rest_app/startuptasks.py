# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from datetime import datetime
import json
import websockets
import asyncio

from user.user_stock import *


ws_port = 1792
ws_periods = [0.2, 1, 60, 900]


class WsStrategyManager:
    @classmethod
    def add_stock_strategy(self, code, strategy):
        pass

    @classmethod
    def get_period_code(self, period):
        return []


class WsClientManager:
    subscriptions = {}

    @classmethod
    def add_strategy_client(self, code, wsclient, strategy):
        if code not in self.subscriptions:
            self.subscriptions[code] = []
        self.subscriptions[code].append({'client': wsclient, 'strategy': strategy})

    @classmethod
    def get_subscription_clients(self, code, period):
        return []


subscriptions = {}


def get_realtime_data(code):
    # 这里可以查询获取实时数据
    # 这里使用简化的示例
    return {"code": code, "price": 100.0, "time": str(datetime.now())}

async def process_client_message(websocket, message):
    action = message.get("action")
    code = message.get("code")

    if action == "subscribe":
        if code not in subscriptions:
            subscriptions[code] = []
        subscriptions[code].append(websocket)
    elif action == "unsubscribe":
        if code in subscriptions and websocket in subscriptions[code]:
            subscriptions[code].remove(websocket)
    elif action == 'strategy':
        strategy = message.get('strategy')
        WsClientManager.add_strategy_client(code, websocket, strategy)
        WsStrategyManager.add_stock_strategy(code, strategy)

async def periodic_task(period):
    while True:
        scodes = WsStrategyManager.get_period_code(period)
        for code in scodes:
            data = get_realtime_data(code)
            wsclents = WsClientManager.get_subscription_clients(code, period)
            for ws in wsclents:
                await ws.send(json.dumps(data))
        await asyncio.sleep(period)

async def handle_client(websocket, path):
    try:
        async for message in websocket:
            try:
                message_data = json.loads(message)
                if 'mid' in message_data:
                    await websocket.send(f'{{"type":"ack", "mid": {message_data["mid"]}}}')
                await process_client_message(websocket, message_data)
            except json.JSONDecodeError:
                pass
            except Exception as e:
                Utils.log(e, Utils.Err)
    except websockets.ConnectionClosed:
        pass
    finally:
        for code, ws_list in subscriptions.items():
            if websocket in ws_list:
                ws_list.remove(websocket)

async def main():
    server = await websockets.serve(handle_client, "localhost", ws_port)
    for period in ws_periods:
        asyncio.create_task(periodic_task(period))
    await server.wait_closed()

def check_network():
    retry = 0
    max_retries = 100

    while True:
        try:
            nw = requests.get('http://quote.eastmoney.com/newapi/sczm', timeout=2)
            if nw is not None or retry > max_retries:
                print(nw.content.decode())
                break
        except Exception as e:
            Utils.log(f'Network error: {e}', Utils.Err)
            if retry > max_retries:
                break
            time.sleep(5)
            retry += 1

    if retry > max_retries:
        Utils.log(f'Network not available, retry = {retry}', Utils.Err)
        return False
    return True

if __name__ == '__main__':
    dnow = datetime.now()
    Utils.setup_logger('startup.access')
    Utils.log('------------------------------------------------------------------------')

    task_files = ['start_tasks.py']
    if check_network():
        mtd = TradingDate.maxTradingDate()
        if dnow.weekday() < 5 and Utils.today_date() == mtd and dnow.hour < 15:
            task_files += ['trade_closed.py', 'trade_opening.py']

    for tfile in task_files:
        task_spath = os.path.join(os.path.dirname(__file__), 'tasks', tfile)
        log_path = os.path.join(os.path.dirname(task_spath), 'logs', f'{tfile}.log')
        err_path = os.path.join(os.path.dirname(task_spath), 'logs', f'{tfile}.err.log')
        cmd = f'{sys.executable} {task_spath} 1>>{log_path} 2>>{err_path} &'
        os.system(cmd)

    asyncio.run(main())
