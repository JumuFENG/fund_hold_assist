import os
import sys
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
import unittest

from phon.data.history import IndexHistory, AllIndexes, AllStocks, StockHistory, read_context

class TestIndexHistory(unittest.TestCase):
    def test_update_index_daily(self):
        # AllIndexes.update_kline_data('w')
        # AllStocks.update_kline_data('d')
        with read_context(AllStocks.db):
            codequery = AllStocks.db.select(AllStocks.db.code, AllStocks.db.type).where(AllStocks.db.quit_date == None)
            stocks = [r.code[-6:] for r in codequery if r.code.startswith(('SH', 'SZ', 'BJ')) and r.type in ('ABStock', 'BJStock')]
        fc = AllStocks.update_klines_by_code(stocks, 'd')
        print(fc)
        # AllIndexes.count_bars_to_updated('000001')


    def test_read_index_monthly_klines(self):
        code = '000001'
        ihis = IndexHistory(code)
        klines = ihis.get_index_hist_data('m', 30, fmt='list')
        self.assertEqual(len(klines), 30)
        klines = ihis.get_index_hist_data('m', start='2024-06-01', fmt='list')
        self.assertTrue(klines[0][1] >= '2024-06-01')

    def test_read_mxdate(self):
        x = AllStocks.read_all()
        x = [_x for _x in x if _x[3] == 'ABStock']
        import time
        d = time.time()
        for i in x[:100]:
            # StockHistory(i[1]).count_bars_to_updated()
            m = AllStocks.count_bars_to_updated(i[1])
        print(time.time() - d)

    def test_save_full_history(self):
        code = '600770'
        import stockrt as srt
        srt.set_array_format('dict')
        klines = srt.klines([code], 'w', 10, 0)
        AllStocks.save_kline_data_todb(code, 'w', klines[code])

    def test_update_stock_kdata(self):
        # code = ['SZ002243']
        code = ['SZ002098', 'SH600816', 'SH600109', 'SZ000739', 'SH600869', 'SH603016', 'SH600837', 'SZ000795', 'SH600225']
        # AllStocks.update_klines_by_code(code)
        AllStocks.remove_and_download_klines(code)

if __name__ == '__main__':
    suite = unittest.TestSuite()
    suite.addTest(TestIndexHistory('test_update_index_daily'))
    runner = unittest.TextTestRunner()
    runner.run(suite)
