import base64
import asyncio
import traceback
import stockrt as asrt
from app.guang import guang
from app.lofig import Config, logger, delayed_tasks
from app.trade_interface import TradeInterface
from app.accounts import accld
from app.klpad import klPad, DsvrKSource
from app.intrade_base import iunCloud
from app.strategy_factory import StrategyFactory


class iun:
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
        from stockrt.sources.rtbase import logger as rtlogger
        for handler in rtlogger.handlers[:]:
            rtlogger.removeHandler(handler)
        remain_secs = guang.delay_seconds('9:11')
        if remain_secs > 0:
            logger.info(f'wait to run at 9:11')
            await asyncio.sleep(remain_secs)
        tconfig = Config.trading_service()
        TradeInterface.tserver = tconfig['server']
        if not TradeInterface.check_trade_server():
            logger.info('not trading day or trade server not available')
            return

        dconfig = Config.data_service()
        DsvrKSource.dserver = dconfig['server']
        iunCloud.dserver = dconfig['server']
        iunCloud.strFac = StrategyFactory
        accld.dserver = dconfig['server']
        accld.headers = {
            'Authorization': f'''Basic {base64.b64encode(f"{dconfig['user']}:{dconfig['password']}".encode()).decode()}'''
        }
        asrt.set_default_sources('quotes', 'quotes', ('tencent', 'cls', 'sina', 'xueqiu', 'eastmoney', 'sohu'), False)
        asrt.set_default_sources('quotes5', 'quotes5', ('sina', 'tencent', 'eastmoney', 'cls', 'sohu', 'tgb'), False)
        asrt.set_array_format('df')
        accld.load_accounts()

        strategies = StrategyFactory.market_strategies()
        for task in strategies:
            task.on_intrade_matched = cls.intrade_matched
            await task.start_strategy_tasks()

        await asyncio.sleep(1)
        if len(delayed_tasks) > 0:
            await asyncio.gather(*delayed_tasks)

        accld.verify_strategies()
        logger.info("iun main exited.")
        # logger.info(f'{klPad.dump()}')


if __name__ == '__main__':
    asyncio.run(iun.main())
