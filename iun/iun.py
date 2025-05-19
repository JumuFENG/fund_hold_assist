import requests
import json
import base64
import asyncio
import traceback
import stockrt as asrt
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
    stocks = ['sz001234', 'sz003003', 'sh600200']
    while guang.delay_seconds('15:00') > 0:
        # 模拟K线检查
        await asyncio.sleep(60)
        if guang.delay_seconds('9:30') > 0:
            continue
        if guang.delay_seconds('11:30') < 0 and guang.delay_seconds('13:00') > 0:
            continue

        try:
            asrt.klines(stocks, kltype=1, length=32)
        except Exception as e:
            logger.error("K-line check failed: %s", e)
            logger.error(traceback.format_exc())
        logger.info("Checking K-line data... %d", i)
        i += 1


async def start_rtp_check():
    """
    启动实时数据检查
    :return: None
    """
    # 这里可以添加实时数据检查的代码
    logger.info("Starting real-time data check...")
    while True:
        codes = []
        for acc in accld.all_accounts.values():
            for c, v in acc.stocks.items():
                pass
        # msquote = quotation.market_snapshot(prefix=True)
        codes = list(set(codes))
        if len(codes) > 0:
            sq = asrt.quotes(codes)
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
        # accld.loadAccounts()

        cfg = Config.iun_config()
        strategies = [StrategyI_AuctionUp(), StrategyI_Zt1Bk(), StrategyI_EndFundFlow(), StrategyI_DeepBigBuy()]
        async with asyncio.TaskGroup() as tg:
            for task in strategies:
                task.on_intrade_matched = cls.intrade_matched
                tg.create_task(task.start_strategy_tasks())
            if cfg['enable_kl_check']:
                tg.create_task(start_kl_check())
            if cfg['enable_rtp_check']:
                tg.create_task(start_rtp_check())
            tg.create_task(cls.check_tasks_finished(strategies))


if __name__ == '__main__':
    asyncio.run(iun.main())
