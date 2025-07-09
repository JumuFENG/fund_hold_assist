from functools import lru_cache
from app.logger import logger
from app.market_strategy import *
from app.stock_strategy import *


class StrategyFactory():
    @classmethod
    def market_strategies(cls):
        return [
            GlobalStartup(), StrategyI_AuctionUp(), StrategyI_Zt1Bk(), StrategyI_EndFundFlow(), StrategyI_DeepBigBuy(),
            StrategyI_3Bull_Breakup(), StrategyI_Zt1WbOpen(), StrategyI_HotrankOpen(), StrategyI_HotStocksOpen(),
            StrategyI_DtStocksUp(), StrategyI_HotstocksRetryZt0()
        ]

    @classmethod
    @lru_cache(maxsize=None)
    def stock_strategy(self, k, formkt=''):
        s = None
        if k == StrategyGE.key:
            s = StrategyGE()
        elif k == StrategySellELShort.key:
            s = StrategySellELShort()
        elif k == StrategySellBeforeEnd.key:
            s = StrategySellBeforeEnd()
        elif k == StrategySellMA.key:
            s = StrategySellMA()
        elif k == StrategyBuyZTBoard.key:
            s = StrategyBuyZTBoard()
        elif k == StrategyBuyDTBoard.key:
            s = StrategyBuyDTBoard()
        else:
            logger.error('Strategy not implemented: %s', k)

        if s:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(s.start_strategy_tasks())
            else:
                loop.call_soon(asyncio.ensure_future, s.start_strategy_tasks())

        return s

    @classmethod
    def add_stock_strategy(cls, acc, code, strategy):
        if not isinstance(strategy, dict):
            return None

        IunCache.cache_strategy_data(acc, code, {'strategies': strategy})
        for sobj in strategy['strategies'].values():
            if not sobj['enabled']:
                continue
            s = cls.stock_strategy(sobj['key'])
            if s:
                s.add_stock(acc, code)
        # logger.info(f'Set strategy for {acc} {code}: {strategy}')

    @classmethod
    def disable_stock_strategy(cls, acc, code, skey):
        if not skey:
            return

        smeta = IunCache.get_strategy_meta(acc, code, skey)
        if smeta and smeta['enabled']:
            smeta['enabled'] = False
            IunCache.update_strategy_meta(acc, code, skey, smeta)
        else:
            return

        s = cls.stock_strategy(smeta['key'])
        if s:
            s.remove_stock(acc, code)
        logger.info(f'stock  {acc} {code} {skey} disabled')
