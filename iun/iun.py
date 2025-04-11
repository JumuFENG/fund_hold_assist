import requests
import json
import base64
import asyncio
import easyquotation
from app.logger import logger
from app.config import Config
from app.tradeInterface import TradeInterface
from app.accounts import accld
from app.intrade_base import iunCloud
from app.intrade_strategy import *



async def start_kl_check():
    """
    启动K线检查
    :return: None
    """
    # 这里可以添加K线检查的代码
    logger.info("Starting K-line check...")
    i = 0
    while True:
        # 模拟K线检查
        await asyncio.sleep(60)
        logger.info("Checking K-line data...")
        i += 1


async def start_rtp_check():
    """
    启动实时数据检查
    :return: None
    """
    # 这里可以添加实时数据检查的代码
    logger.info("Starting real-time data check...")
    # easyquotation.update_stock_codes()
    quotation = easyquotation.use('sina')
    while True:
        codes = []
        for acc in accld.all_accounts.values():
            for c, v in acc.stocks.items():
                pass
        # msquote = quotation.market_snapshot(prefix=True)
        codes = list(set(codes))
        if len(codes) > 0:
            sq = quotation.real(codes, True)
            for c, q in sq.items():
                for acc in accld.all_accounts.values():
                    code = c.upper()
                    if code in acc.stocks and acc.stocks[code]['strategies']:
                        TradeInterface.submit_trade(acc.keyword)
            logger.info("Checking real-time data...")
        await asyncio.sleep(5)


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
        subscribe_detail = TradeInterface.iun_str_conf(ikey)
        if subscribe_detail and callable(istr_message_creator):
            msg = istr_message_creator(match_data, subscribe_detail)
            if msg:
                await TradeInterface.submit_trade(json.dumps(msg))
                logger.info(f'send {match_data}, {subscribe_detail}, {ikey}')

    @classmethod
    async def main(cls):
        tconfig = Config.trading_service()
        TradeInterface.tserver = tconfig['server']
        if not TradeInterface.ccheck_trade_server():
            logger.error('trading server is not available')
            return

        dconfig = Config.data_service()
        accld.dserver = dconfig['server']
        iunCloud.dserver = dconfig['server']
        accld.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'''Basic {base64.b64encode(f"{dconfig['user']}:{dconfig['password']}".encode()).decode()}'''
        }
        # accld.loadAccounts()

        cfg = Config.iun_config()
        strategies = [StrategyI_AuctionUp(), StrategyI_Zt1Bk(), StrategyI_EndFundFlow()]
        async with asyncio.TaskGroup() as tg:
            for task in strategies:
                task.on_intrade_matched = cls.intrade_matched
                tg.create_task(task.start_strategy_tasks())
            tg.create_task(cls.check_tasks_finished(strategies))


if __name__ == '__main__':
    asyncio.run(iun.main())
    # iunCloud.dserver = 'http://localhost/5000/'
    # ff=iunCloud.to_be_divided('600605')
