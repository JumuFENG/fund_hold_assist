import os,sys
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../../iun'))
import unittest
from app.klpad import klPad
from app.planned_strategy import StrategyFac
from app.config import IunCache
import stockrt as srt
import asyncio
import pandas as pd


class TestklPadCache(unittest.TestCase):

    def test_cache_new_code(self):
        code = 'new_code'
        klines = pd.DataFrame([{'time': '2022-01-01', 'open': 10.0, 'close': 11.0, 'high': 12.0, 'low': 9.0, 'volume': 1000}])
        quotes = {'bid': 10.5, 'ask': 11.5}
        result = klPad.cache(code, klines, quotes)
        self.assertEqual(result, [1])
        self.assertEqual(klPad.get_quotes(code), quotes)

    def test_cache_existing_code(self):
        code = 'existing_code'
        klines = pd.DataFrame([{'time': '2022-01-01', 'open': 10.0, 'close': 11.0, 'high': 12.0, 'low': 9.0, 'volume': 1000}])
        klPad.cache(code, klines)
        klines = pd.DataFrame([{'time': '2022-01-02', 'open': 10.0, 'close': 11.0, 'high': 12.0, 'low': 9.0, 'volume': 1000}])
        quotes = {'bid': 10.5, 'ask': 11.5}
        result = klPad.cache(code, klines, quotes)
        self.assertEqual(result, [1, 2])
        self.assertEqual(klPad.get_quotes(code), quotes)

    def test_cache_empty_klines(self):
        code = 'test_code'
        klines = []
        quotes = {'bid': 10.5, 'ask': 11.5}
        result = klPad.cache(code, klines, quotes)
        self.assertEqual(result, [])
        result = klPad.cache(code, quotes=quotes)
        self.assertEqual(result, [])

    def test_cache_non_empty_klines(self):
        code = '603332'
        srt.set_array_format('pd')
        qk = srt.qklines([code], 1, 64)
        result = klPad.cache(code, qk['603332']['klines'], qk['603332']['qt'], 1)
        klines1 = klPad.get_klines(code, 1)
        klines2 = klPad.get_klines(code, 2)
        klines3 = klPad.get_klines(code, 4)
        klines4 = klPad.get_klines(code, 8)
        quotes = klPad.get_quotes(code)
        self.assertEqual(result, [1, 2, 4, 8])
        self.assertEqual(len(klines1), 64)
        self.assertEqual(quotes, qk['603332']['qt'])

    def test_cache_with_klines(self):
        code = '603332'
        klines1 = pd.DataFrame([
            {'time': '2025-05-26 09:51', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 2800, 'amount': 50315.9984},
            {'time': '2025-05-26 09:52', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 12200, 'amount': 219233.999}])
        result = klPad.cache(code, klines1)
        self.assertEqual(len(klPad.get_klines(code, 1)), 2)

        klines2 = pd.DataFrame([{'time': '2025-05-26 09:51', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 2800, 'amount': 50315.9984}, 
            {'time': '2025-05-26 09:52', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 12200, 'amount': 219233.999},
            {'time': '2025-05-26 09:53', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 5200, 'amount': 93443.9972},
            {'time': '2025-05-26 09:54', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 6200, 'amount': 111413.9962}])
        result = klPad.cache(code, klines2)
        self.assertEqual(len(klPad.get_klines(code, 1)), 4)

class TestStrategyGE(unittest.TestCase):
    def setUp(self):
        IunCache.cache_strategy_data('collat', '510050', {'holdCost': 2.6994, 'holdCount': 14500.0, 'strategies': {'grptype': 'GroupStandard', 'strategies': {
                '0': {'key': 'StrategyGE', 'enabled': True, 'stepRate': 0.03, 'account': 'credit',
                        'kltype': '30', 'guardPrice': '2.706000', 'inCritical': False, 'selltype': 'egate', 'cutselltype': 'egate'}},
                'transfers': {'0': {'transfer': -1}}, 'amount': 10000,
                'buydetail': [
                    {'id': 2, 'code': 'SH510050', 'date': '2024-11-19', 'count': 2600, 'price': 2.776, 'sid': '260544', 'type': 'B'},
                    {'id': 432, 'code': 'SH510050', 'date': '2025-04-25', 'count': 3700, 'price': 2.706, 'sid': '382233', 'type': 'B'},
                    {'id': 561, 'code': 'SH510050', 'date': '2024-11-25', 'count': 4000, 'price': 2.682, 'sid': '436853', 'type': 'B'},
                    {'id': 562, 'code': 'SH510050', 'date': '2025-04-07', 'count': 4200, 'price': 2.581, 'sid': '311495', 'type': 'B'}],
                'buydetail_full': [
                    {'id': 2, 'code': 'SH510050', 'date': '2023-08-03', 'count': 3600, 'price': 2.716, 'sid': '305584', 'type': 'B'},
                    {'id': 3, 'code': 'SH510050', 'date': '2024-11-19', 'count': 7200, 'price': 2.776, 'sid': '260544', 'type': 'B'},
                    {'id': 4, 'code': 'SH510050', 'date': '2024-11-25', 'count': 7400, 'price': 2.682, 'sid': '436853', 'type': 'B'},
                    {'id': 238, 'code': 'SH510050', 'date': '2025-04-07', 'count': 800, 'price': 2.581, 'sid': '311495', 'type': 'B'},
                    {'id': 471, 'code': 'SH510050', 'date': '2025-04-23', 'count': 8200, 'price': 2.707, 'sid': '275716', 'type': 'S'},
                    {'id': 484, 'code': 'SH510050', 'date': '2025-04-23', 'count': 8200, 'price': 2.711, 'sid': '275716', 'type': 'S'},
                    {'id': 498, 'code': 'SH510050', 'date': '2025-04-25', 'count': 3700, 'price': 2.71, 'sid': '382233', 'type': 'B'}]}}
        )
        self.strategy = StrategyFac.get_strategy('StrategyGE')

    def test_check_kline(self):
        async def call_check_kline():
            await self.strategy.check_kline('collat', '510050', [1, 15, 30])
        loop = asyncio.get_event_loop()
        loop.run_until_complete(call_check_kline())


if __name__ == '__main__':
    suite = unittest.TestSuite()
    suite.addTest(TestStrategyGE('test_check_kline'))
    # suite.addTest(TestklPadCache('test_cache_with_klines'))
    runner = unittest.TextTestRunner()
    runner.run(suite)

    # unittest.main()
