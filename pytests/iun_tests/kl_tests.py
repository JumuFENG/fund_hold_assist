import os,sys
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../../iun'))
import unittest
from app.klpad import klPad
from app.planned_strategy import StrategyFac
from app.config import IunCache
import stockrt as srt
import asyncio
import pandas as pd
from datetime import datetime

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

    def test_cache_klines_on_930(self):
        code = '603332'
        klines1 = pd.DataFrame([{'time': '2025-05-26 09:30', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 2800, 'amount': 50315.9984}, 
            {'time': '2025-05-26 09:31', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 12200, 'amount': 219233.999},
            {'time': '2025-05-26 09:32', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 5200, 'amount': 93443.9972},
            {'time': '2025-05-26 09:33', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 6200, 'amount': 111413.9962},
            {'time': '2025-05-26 09:34', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 6200, 'amount': 111413.9962}])
        klPad.cache(code, klines1)
        ckls = klPad.get_klines(code, 1)
        self.assertEqual(len(ckls), 4)
        self.assertEqual(ckls['time'].iloc[0], '2025-05-26 09:31')
        self.assertEqual(ckls['volume'].iloc[0], 15000)

    def test_get_lclose_from_klines(self):
        code = '603332'
        klines1 = [{'time': '2025-05-26 09:30', 'open': 17.97, 'close': 17.97, 'high': 17.97, 'low': 17.97, 'volume': 2800, 'amount': 50315.9984}, 
            {'time': '2025-05-26 09:31', 'open': 17.97, 'close': 17.9, 'high': 17.97, 'low': 17.97, 'volume': 12200, 'amount': 219233.999},
            {'time': '2025-05-26 09:32', 'open': 17.97, 'close': 17.91, 'high': 17.97, 'low': 17.97, 'volume': 5200, 'amount': 93443.9972},
            {'time': '2025-05-26 09:33', 'open': 17.97, 'close': 17.92, 'high': 17.97, 'low': 17.97, 'volume': 6200, 'amount': 111413.9962},
            {'time': '2025-05-26 09:34', 'open': 17.97, 'close': 17.93, 'high': 17.97, 'low': 17.97, 'volume': 6200, 'amount': 111413.9962}]
        klines1[-1]['time'] = datetime.now().strftime(f"%Y-%m-%d")
        klines1 = pd.DataFrame(klines1)
        klPad.cache(code, klines1)
        lclose = klPad.get_lclose_from_klines(code)
        self.assertEqual(lclose, 17.92)

    def test_calcbss(self):
        code = '603332'
        klines1 = [
            ['2025-06-11 09:38',12.19,12.22,12.19,12.19],['2025-06-11 09:46',12.22,12.25,12.21,12.22],['2025-06-11 09:54',12.20,12.25,12.19,12.20],
            ['2025-06-11 10:02',12.19,12.22,12.19,12.19],['2025-06-11 10:10',12.18,12.22,12.18,12.18],['2025-06-11 10:18',12.17,12.19,12.16,12.17],
            ['2025-06-11 10:26',12.18,12.18,12.18,12.18],['2025-06-11 10:34',12.17,12.17,12.17,12.17],['2025-06-11 10:42',12.19,12.22,12.18,12.19],
            ['2025-06-11 10:50',12.17,12.17,12.17,12.17],['2025-06-11 10:58',12.15,12.15,12.15,12.15],['2025-06-11 11:06',12.16,12.16,12.16,12.16],
            ['2025-06-11 11:14',12.18,12.18,12.18,12.18],['2025-06-11 11:22',12.17,12.17,12.17,12.17],['2025-06-11 11:30',12.18,12.18,12.18,12.18],
            ['2025-06-11 13:08',12.17,12.17,12.17,12.17],['2025-06-11 13:16',12.17,12.17,12.17,12.17],['2025-06-11 13:24',12.15,12.15,12.15,12.15],
            ['2025-06-11 13:32',12.16,12.16,12.16,12.16],['2025-06-11 13:40',12.14,12.14,12.14,12.14],['2025-06-11 13:48',12.15,12.15,12.15,12.15],
            ['2025-06-11 13:56',12.16,12.16,12.16,12.16],['2025-06-11 14:04',12.14,12.14,12.14,12.14],['2025-06-11 14:12',12.15,12.15,12.15,12.15],
            ['2025-06-11 14:20',12.15,12.15,12.15,12.15],['2025-06-11 14:28',12.15,12.15,12.15,12.15],['2025-06-11 14:36',12.14,12.14,12.14,12.14],
            ['2025-06-11 14:44',12.14,12.14,12.14,12.14],['2025-06-11 14:52',12.14,12.14,12.14,12.14]]
        klines1 = pd.DataFrame(klines1, columns=['time', 'close', 'high', 'low', 'ma18'])
        klPad._klPad__stocks = {
            f'{code}': {
                'klines': {
                    8: klines1
                }
            }
        }
        klPad.calc_bss(code, 8, 18)
        


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
    # suite.addTest(TestStrategyGE('test_check_kline'))
    suite.addTest(TestklPadCache('test_calcbss'))
    runner = unittest.TextTestRunner()
    runner.run(suite)

    # unittest.main()
