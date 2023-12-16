# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/../..'))
import json
import websockets
import asyncio

from ws_client_agent import *
from ws_strategy_manager import *
from ws_intrade_strategy import *

ws_port = 1792
ws_periods = [900] # [0.2, 1, 60, 900]
class WsClientManager:
    client_agents = []

    @classmethod
    def get_agent(self, websocket):
        for ws in self.client_agents:
            if ws.websocket == websocket:
                return ws

        self.client_agents.append(WsClientAgent(websocket))
        return self.client_agents[-1]

    @classmethod
    def remove_agent(self, websocket):
        for ws in self.client_agents:
            if ws.websocket == websocket:
                self.client_agents.remove(ws)
                break

    @classmethod
    def get_watching_clients(self, code, period):
        return [ws.websocket for ws in self.client_agents if ws.is_watching(code, period)]

    @classmethod
    async def broadcast_intrade(self, ikey, code, price):
        Utils.log(f'broadcasting intrade: {ikey}, {code}, {price}')
        if ikey == StrategyI_AuctionUp.key:
            for wsagent in self.client_agents:
                price = round(float(price), 2)
                msg = wsagent.create_intrade_buy_message(ikey, code, price)
                Utils.log(f'broadcasting intrade: {json.dumps(msg)}')
                if msg is None:
                    continue
                await wsagent.websocket.send(json.dumps(msg))
                Utils.log(f'send {json.dumps(msg)}')


def get_realtime_data(code):
    # 这里可以查询获取实时数据
    # 这里使用简化的示例
    return {"code": code, "price": 100.0, "time": str(datetime.now())}

async def periodic_task(period):
    while True:
        scodes = WsStrategyManager.get_period_code(period)
        for code in scodes:
            data = get_realtime_data(code)
            wsclents = WsClientManager.get_watching_clients(code, period)
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
                wsagent = WsClientManager.get_agent(websocket)
                action = message_data.get("action")
                if action == 'initialize':
                    await websocket.send(json.dumps({'type': 'str_available', 'strategies': WsIntradeStrategyFactory.all_available_istrategies()}))
                # elif action == 'subscribe':
                #     skey = message.get("key")
                #     pass
                else:
                    wsagent.process_message(message_data)
            except json.JSONDecodeError:
                pass
            except Exception as e:
                Utils.log(e, Utils.Err)
    except websockets.ConnectionClosed:
        pass
    finally:
        WsClientManager.remove_agent(websocket)

async def main():
    server = await websockets.serve(handle_client, "localhost", ws_port)
    for period in ws_periods:
        asyncio.create_task(periodic_task(period))
    WsIntradeStrategyFactory.setup_intrade_strategies(WsClientManager.broadcast_intrade)
    await WsIntradeStrategyFactory.create_tasks()
    await server.wait_closed()


if __name__ == "__main__":
    Utils.setup_logger('ws_server')
    Utils.log('------------------------------------------------------------------------')
    asyncio.run(main())
