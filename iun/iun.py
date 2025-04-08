import requests
import json
import base64
import asyncio
import easyquotation
from app.logger import logger
from app.config import Config
from app.tradeInterface import TradeInterface
from app.accounts import accld
from app.intrade_base import StrategyI_Simple_Watcher

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

async def check_tasks_finished(tasks):
    while True:
        if all([task.done() for task in tasks]):
            break
        await asyncio.sleep(1)


class iun:

    @classmethod
    async def main(cls):
        dconfig = Config.data_service()
        accld.dserver = dconfig['server']
        accld.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'''Basic {base64.b64encode(f"{dconfig['user']}:{dconfig['password']}".encode()).decode()}'''
        }
        # accld.loadAccounts()

        tconfig = Config.trading_service()
        TradeInterface.tserver = tconfig['server']
        cfg = Config.iun_config()
        from app.intrade_base import TestWatcher
        stasks = [StrategyI_Simple_Watcher('21:35'), TestWatcher('21:35')]
        async with asyncio.TaskGroup() as tg:
            for task in stasks:
                tg.create_task(task.start_strategy_tasks())
            tg.create_task(check_tasks_finished(stasks))


if __name__ == '__main__':
    asyncio.run(iun.main())
