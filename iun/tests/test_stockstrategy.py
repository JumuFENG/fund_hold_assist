import os,sys
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../../iun'))
import unittest
import asyncio
from functools import lru_cache
from app.intrade_base import Watcher_Once, Watcher_Cycle, Stock_Rt_Watcher
from app.stock_strategy import *
from app.strategy_factory import StrategyFactory
from app.intrade_base import iunCloud


class klineDataForTests:
    klarr = {}
    @classmethod
    def getklines(self, code):
        klarr = [[x[0], float(x[1]), float(x[2]), float(x[3]), float(x[4]), int(x[5]), float(x[6]), float(x[7])/100] for x in self.klarr[code]]
        return pd.DataFrame(klarr, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'amount', 'change'])

class MockWatcherKlineday(Watcher_Once, Stock_Rt_Watcher):
    def __init__(self):
        super().__init__('14:56:55', True)
        Stock_Rt_Watcher.__init__(self)

    async def execute_task(self):
        chgklt = {}
        for c in self.codes:
            chgklt[c] = klPad.cache(c, klineDataForTests.getklines(c), kltype=101)
        await self.notify_change(chgklt)


@lru_cache(maxsize=None)
def mock_get_watcher(w):
    if w == 'klineday':
        return MockWatcherKlineday()


@lru_cache(maxsize=None)
def validating_strategy(k, formkt=''):
    s = None
    if k == StrategyBuySellBeforeEnd.key:
        s = StrategyBuySellBeforeEnd()

    if s:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(s.start_strategy_tasks())
        else:
            loop.call_soon(asyncio.ensure_future, s.start_strategy_tasks())

    return s


class TestStrategy_BSBE(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        iunCloud.get_watcher = mock_get_watcher
        return super().setUp()

    async def inialize_test(self, code, strategy, klarr, watcher):
        IunCache.cache_strategy_data('test', code, strategy)
        klineDataForTests.klarr[code] = klarr

        for sobj in strategy['strategies']['strategies'].values():
            if not sobj['enabled']:
                continue
            s = validating_strategy(sobj['key'])
            if s:
                s.add_stock('test', code)

        w = iunCloud.get_watcher(watcher)
        await asyncio.wait_for(w.execute_task(), timeout=1.0)

    async def test_bsbe_buy(self):
        code = '002172'
        strategy = {
            "holdCost": 3.82, "holdCount": 400,
            "strategies": {
                "grptype": "GroupStandard", "transfers": {"0": {"transfer": -1}}, "amount": 2000,
                "strategies": {"0": {"key": "StrategyBSBE", "enabled": True, "guardPrice": 5.71, "selltype": "xsingle", "disable_sell": False}},
                "buydetail": [{"id": 772, "code": "SZ002172", "date": "2025-06-16", "count": 400, "price": 4.88, "sid": "67419", "type": "B"}],
                "buydetail_full": [{"id": 795, "code": "SZ002172", "date": "2025-06-16", "count": 400, "price": 5.09, "sid": "67419", "type": "B"}]}}
        klarr = [
            ['2025-06-23', '3.7100', '3.8100', '3.7100', '3.8100', '46751110', '176917093.2000', '1.600000'],
            ['2025-06-24', '3.8000', '3.8800', '3.7900', '3.8500', '47931450', '184666858.0000', '1.049900'],
            ['2025-06-25', '3.9600', '3.9800', '3.8000', '3.8500', '56627807', '218372715.6700', '0.000000'],
            ['2025-06-26', '3.8400', '3.8700', '3.7800', '3.8200', '44664700', '171112013.0000', '-0.779200'],
            ['2025-06-27', '3.8200', '3.9100', '3.8100', '3.8700', '46283317', '178979726.8900', '1.308900'],
            ['2025-06-30', '3.8500', '3.9000', '3.8200', '3.9000', '34641900', '133918553.0000', '0.775200'],
            ['2025-07-01', '3.8900', '3.9700', '3.8700', '3.9600', '56192810', '220577824.2000', '1.538500'],
            ['2025-07-02', '3.9300', '3.9900', '3.9000', '3.9200', '52277983', '205514132.0200', '-1.010100'],
            ['2025-07-03', '3.9100', '3.9600', '3.8800', '3.9100', '33093133', '129294687.8700', '-0.255100'],
            ['2025-07-04', '3.9100', '3.9900', '3.8600', '3.8700', '38746600', '151452864.0000', '-1.023000'],
            ['2025-07-07', '3.8500', '3.9000', '3.8100', '3.8900', '28249500', '109332195.0000', '0.516800'],
            ['2025-07-08', '3.8700', '3.9300', '3.8700', '3.9300', '32247683', '125931994.0400', '1.028300'],
            ['2025-07-09', '3.9200', '3.9800', '3.9000', '3.9000', '41873601', '164853080.9500', '-0.763400'],
            ['2025-07-10', '3.9100', '3.9700', '3.8700', '3.9400', '38160000', '152000000.0000', '-1.03000'],
            ['2025-07-11', '4.000', '4.0800', '3.9200', '3.9500', '40000000', '160000000.0000', '0.900000'],]

        await self.inialize_test(code, strategy, klarr, 'klineday')
        smeta = IunCache.get_strategy_meta('test', code, 'StrategyBSBE')
        self.assertEqual(smeta['guardPrice'], 4.27)

    async def test_bsbe_sell(self):
        code = '603316'
        strategy = {
            "holdCost": 10.66, "holdCount": 1000, "strategies": {
                "grptype": "GroupStandard", "transfers": {}, "amount": 2000,
                "strategies": {
                    "0": {"key": "StrategyBSBE", "enabled": True, "guardPrice": 10.66, "selltype": "xsingle", "disable_sell": False}
                },
                "buydetail": [
                    {"id": 1008, "code": "SH603316", "date": "2025-07-04", "count": 200, "price": 12.2, "sid": "66894", "type": "B"},
                    {"id": 1021, "code": "SH603316", "date": "2025-07-07", "count": 200, "price": 11.28, "sid": "63540", "type": "B"},
                    {"id": 1022, "code": "SH603316", "date": "2025-07-07", "count": 200, "price": 10.46, "sid": "787507", "type": "B"},
                    {"id": 1039, "code": "SH603316", "date": "2025-07-09", "count": 400, "price": 9.63, "sid": "374389", "type": "B"}]
                }
            }
        klarr = [
            ['2025-06-23', '6.3900', '6.6300', '6.3200', '6.5900', '7425300', '48604197.0000', '2.170500'],
            ['2025-06-24', '6.5800', '6.8300', '6.5800', '6.8100', '6114100', '41267113.0000', '3.338400'],
            ['2025-06-25', '7.1900', '7.4900', '6.7200', '6.7500', '27036390', '191138356.1000', '-0.881100'],
            ['2025-06-26', '6.7300', '7.4300', '6.6800', '7.4300', '30822990', '220778827.8000', '10.074100'],
            ['2025-06-27', '7.5000', '8.1700', '7.5000', '8.1700', '25221090', '197096627.8000', '9.959600'],
            ['2025-06-30', '8.9900', '8.9900', '8.9900', '8.9900', '3493220', '31404047.8000', '10.036700'],
            ['2025-07-01', '9.8900', '9.8900', '9.8900', '9.8900', '7870455', '77838799.9500', '10.011100'],
            ['2025-07-02', '10.8500', '10.8800', '10.5300', '10.8800', '75412515', '817728004.6200', '10.010100'],
            ['2025-07-03', '11.1000', '11.9700', '10.1500', '11.9700', '93411051', '1050670835.3100', '10.018400'],
            ['2025-07-04', '12.2000', '13.1700', '10.8300', '11.6200', '106309893', '1321687939.6400', '-2.924000'],
            ['2025-07-07', '11.2800', '11.4800', '10.4600', '10.4600', '86387282', '943035708.1300', '-9.982800'],
            ['2025-07-08', '10.0100', '10.4400', '9.8200', '10.0400', '66786586', '673873741.4000', '-4.015300'],
            ['2025-07-09', '9.8300', '9.8600', '9.3100', '9.3700', '64535990', '616650933.7400', '-6.673300'],
            ['2025-07-10', '9.3800', '9.3900', '9.0900', '9.1100', '39742321', '364199129.4000', '-2.774800']]

        await self.inialize_test(code, strategy, klarr, 'klineday')
        smeta = IunCache.get_strategy_meta('test', code, 'StrategyBSBE')
        self.assertEqual(smeta['guardPrice'], 16.86)


if __name__ == '__main__':
    # suite = unittest.TestSuite()
    # suite.addTest(TestStrategy_BSBE('test_bsbe_buy'))
    # runner = unittest.TextTestRunner()
    # runner.run(suite)
    unittest.main()
