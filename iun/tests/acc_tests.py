import os,sys
sys.path.insert(0, os.path.realpath(os.path.dirname(__file__) + '/../../iun'))
import unittest
from app.guang import guang
from app.accounts import accld
from app.intrade_base import iunCloud
import asyncio


class TestAcc(unittest.TestCase):
    def test_set_acc_strategy(self):
        code = '000001'
        price = 1.0
        iuncfg = {'amount': 2000, 'account': 'test'}
        strategy = guang.generate_strategy_json({'code': code, 'price': price, 'strategies': {'StrategyBuyDTBoard': {}}}, iuncfg)
        async def call_set_strategy():
            acount = iunCloud.get_hold_account(code, iuncfg['account'])
            iunCloud.strFac.add_stock_strategy(acount, code, strategy)
        loop = asyncio.get_event_loop()
        loop.run_until_complete(call_set_strategy())

    def test_disable_acc_strategy(self):
        self.test_set_acc_strategy()
        code = '000001'
        iuncfg = {'amount': 2000, 'account': 'test'}
        async def call_disable_strategy():
            acount = iunCloud.get_hold_account(code, iuncfg['account'])
            iunCloud.strFac.disable_stock_strategy(acount, code, 'StrategyBuyDTBoard')
        loop = asyncio.get_event_loop()
        loop.run_until_complete(call_disable_strategy())


if __name__ == '__main__':
    # unittest.main()
    suite = unittest.TestSuite()
    suite.addTest(TestAcc('test_disable_acc_strategy'))
    runner = unittest.TextTestRunner()
    runner.run(suite)
    