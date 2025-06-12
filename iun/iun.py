import requests
import json
import base64
import asyncio
import traceback
import stockrt as asrt
from app.logger import logger
from app.config import Config, IunCache
from app.tradeInterface import TradeInterface
from app.accounts import accld
from app.klpad import klPad
from app.intrade_base import iunCloud
from app.intrade_strategy import all_intrade_strategies


class iun:
    @staticmethod
    async def check_tasks_finished(tasks):
        while True:
            if all([task.done() for task in tasks]):
                break
            await asyncio.sleep(1)
        logger.info("All tasks completed.")

    @classmethod
    async def intrade_matched(self, ikey, match_data, istr_message_creator):
        subscribe_detail = iunCloud.iun_str_conf(ikey)
        if subscribe_detail and callable(istr_message_creator):
            msg = istr_message_creator(match_data, subscribe_detail)
            if msg:
                TradeInterface.submit_trade(msg)
                logger.info(f'send {match_data}, {subscribe_detail}, {ikey}')

    @classmethod
    async def main(cls):
        tconfig = Config.trading_service()
        TradeInterface.tserver = tconfig['server']
        if not TradeInterface.check_trade_server():
            logger.info('not trading day or trade server not available')
            return

        dconfig = Config.data_service()
        accld.dserver = dconfig['server']
        iunCloud.dserver = dconfig['server']
        accld.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'''Basic {base64.b64encode(f"{dconfig['user']}:{dconfig['password']}".encode()).decode()}'''
        }
        asrt.set_logger(logger)
        asrt.set_array_format('df')
        accld.loadAccounts()
        iunCloud.accld = accld

        cfg = Config.iun_config()
        strategies = all_intrade_strategies()
        async with asyncio.TaskGroup() as tg:
            for task in strategies:
                task.on_intrade_matched = cls.intrade_matched
                tg.create_task(task.start_strategy_tasks())
            tg.create_task(cls.check_tasks_finished(strategies))

        logger.info("iun main exited.")
        logger.info(f'{klPad.dump()}')


if __name__ == '__main__':
    asyncio.run(iun.main())
