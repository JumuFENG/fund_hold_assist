import os
import sys
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
import unittest

from phon.data.history import IndexHistory, AllIndexes

class TestIndexHistory(unittest.TestCase):
    def test_update_index_daily(self):
        AllIndexes.update_kline_data('m')


    def test_read_index_monthly_klines(self):
        code = '000001'
        ihis = IndexHistory(code)
        klines = ihis.get_index_hist_data('m', 30, fmt='list')
        self.assertEqual(len(klines), 30)
        klines = ihis.get_index_hist_data('m', start='2024-06-01', fmt='list')
        self.assertTrue(klines[0][1] >= '2024-06-01')

if __name__ == '__main__':
    suite = unittest.TestSuite()
    suite.addTest(TestIndexHistory('test_read_index_monthly_klines'))
    runner = unittest.TextTestRunner()
    runner.run(suite)
