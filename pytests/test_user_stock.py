import pytest
from colorama import Fore

from history.stock_history import *
from history.stock_dumps import *
from history.stockzt_history import *
from history.stockdt_history import *
from history.stock_dfsorg import *
from user.user_stock import *
from user.models import *

# @pytest.mark.skip(reason=None)
class TestUserStock(object):
    def setup_class(self) -> None:
        self.umodel = UserModel()
        self.testuser = self.umodel.user_by_id(1)

    def __check_table_row(self, sqldb, tablename, conds, checks):
        assert sqldb.isExistTable(tablename), f'{tablename} not exists!'
        assert isinstance(checks, dict), 'checks should be a dict'
        sql = ','.join(checks.keys())
        if isinstance(conds, list):
            conds = ' AND '.join(conds)
        query = sqldb.select(tablename, sql, conds)
        assert len(query) == 1, f'{len(query)} rows got, expect 1 row!'
        vals = list(checks.values())
        for i in range(0, len(checks.keys())):
            assert query[0][i] == vals[i], f'{i}: expected value: {vals[i]}, but get: {query[0][i]}'

    def __cleanup_tables(self, sqldb, tables):
        if isinstance(tables, list):
            for t in tables:
                self.__cleanup_tables(sqldb, t)
            return

        assert isinstance(tables, str)
        tablename = tables
        if sqldb.isExistTable(tablename):
            sqldb.dropTable(tablename)

    def test_add_buy_deal(self):
        #  2022-06-08
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SH600497')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH600497"', {f'{column_cost_hold}':7092.0, f'{column_portion_hold}':1200, f'{column_averagae_price}':5.91})

        print(Fore.GREEN + 'PASS: test_add_buy_deal' + Fore.RESET)

    def test_add_buy_sell_deals(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SH600497')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"S","price":"5.990000","count":"1200"}])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH600497"', {f'{column_cost_hold}':0.0, f'{column_portion_hold}':0, f'{column_averagae_price}':0})

        print(Fore.GREEN + 'PASS: test_add_buy_sell_deals' + Fore.RESET)

    def test_add_buy_buy_deals(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SH600497')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"B","price":"5.390000","count":"1300"}])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH600497"', {f'{column_cost_hold}':14099.0, f'{column_portion_hold}':2500, f'{column_averagae_price}':5.6396})

        print(Fore.GREEN + 'PASS: test_add_buy_buy_deals' + Fore.RESET)

    def test_add_buy_buy_sell_deals(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SH600497')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"B","price":"5.390000","count":"1300"}])
        self.testuser.add_deals([{"time":"2022-06-10","sid":"s_003","code":"SH600497","tradeType":"S","price":"5.090000","count":"2500"}])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH600497"', {f'{column_cost_hold}':0.0, f'{column_portion_hold}':0, f'{column_averagae_price}':0})

        print(Fore.GREEN + 'PASS: test_add_buy_buy_sell_deals' + Fore.RESET)

    def test_buy_buy_sell_partial(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SZ002045')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2022-02-18","sid":"s_001","code":"SZ002045","tradeType":"B","price":"11.2700","count":"800"}])
        self.testuser.add_deals([{"time":"2022-02-28","sid":"s_002","code":"SZ002045","tradeType":"B","price":"10.1600","count":"900"}])
        self.testuser.add_deals([{"time":"2022-02-28","sid":"s_003","code":"SZ002045","tradeType":"B","price":"10.1700","count":"900"}])
        self.testuser.add_deals([{"time":"2022-03-01","sid":"s_004","code":"SZ002045","tradeType":"S","price":"10.3000","count":"900"}])
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="s_002"', {f'{column_portion}':900, f'{column_soldout}':0, f'{column_sold_portion}':100})

        self.testuser.add_deals([{"time":"2022-03-15","sid":"s_005","code":"SZ002045","tradeType":"B","price":"9.1090","count":"1000"}])
        self.testuser.add_deals([{"time":"2022-04-21","sid":"s_006","code":"SZ002045","tradeType":"B","price":"7.8300","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-02","sid":"s_007","code":"SZ002045","tradeType":"S","price":"8.9350","count":"1200"}])
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="s_002"', {f'{column_portion}':900, f'{column_soldout}':1, f'{column_sold_portion}':900})
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="s_003"', {f'{column_portion}':900, f'{column_soldout}':0, f'{column_sold_portion}':400})

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SZ002045"', {f'{column_cost_hold}':23590.0, f'{column_portion_hold}':2700, f'{column_averagae_price}':8.737})

        print(Fore.GREEN + 'PASS: test_buy_buy_sell_partial' + Fore.RESET)

    def test_archive_deals_1(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH588300')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" }])
        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "sid":"77329" }])
        self.__check_table_row(sqldb, us.sell_table, f'委托编号="77329"', {f'{column_portion}':5000, f'{column_money_sold}':4855, f'{column_fee}':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" }])
        self.__check_table_row(sqldb, us.sell_table, f'委托编号="77329"', {f'{column_portion}':5000, f'{column_money_sold}':4855, f'{column_fee}':0.58})

        self.testuser.archive_deals('2021-08')
        self.__check_table_row(sqldb, archivetable, f'委托编号="77329"', {f'{column_portion}':5000, f'{column_fee}':0.58})
        self.__check_table_row(sqldb, archivetable, f'委托编号="1410475"', {f'{column_portion}':1000})
        ssum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="S"')
        bsum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="B"')
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'

        print(Fore.GREEN + 'PASS: test_archive_deals_1' + Fore.RESET)

    def test_archive_deals_2(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH588300')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" },
            {"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" },
            {"code":"SH588300", "time":"2021-08-13", "tradeType":"B", "count":5300, "price":0.9320, "fee":0.59, "feeYh":0.00, "feeGh":0.00, "sid":"1428159" },
            {"code":"SH588300", "time":"2021-09-01", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"280527" },
            {"code":"SH588300", "time":"2021-09-17", "tradeType":"B", "count":5800, "price":0.8510, "fee":0.59, "feeYh":0.00, "feeGh":0.00, "sid":"966285" },
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87198" },
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87292" },
            {"code":"SH588300","time":"2021-09-24","count":5800,"price":0.8580,"tradeType":"B","sid":"87305","fee":0.60,"feeYh":0.00,"feeGh":0.00}])
        self.testuser.add_deals([{"code":"SH588300", "time":"2021-09-24", "tradeType":"S", "count":26900, "price":0.8600, "sid":"359963"}])
        self.__check_table_row(sqldb, us.sell_table, f'委托编号="359963"', {f'{column_portion}':26900, f'{column_money_sold}':23134, f'{column_fee}':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-09-24", "tradeType":"S", "count":26900, "price":0.8600, "fee":2.78, "feeYh":0.00, "feeGh":0.00, "sid":"359963" }])
        self.__check_table_row(sqldb, us.sell_table, f'委托编号="359963"', {f'{column_portion}':26900, f'{column_money_sold}':23134, f'{column_fee}':2.78})

        self.testuser.archive_deals('2021-10')
        self.__check_table_row(sqldb, archivetable, f'委托编号="359963"', {f'{column_portion}':26900, f'{column_fee}':2.78})
        self.__check_table_row(sqldb, archivetable, f'委托编号="1410475"', {f'{column_portion}':3000})
        self.__check_table_row(sqldb, archivetable, f'委托编号="966285"', {f'{column_portion}':5800})
        ssum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="S"')
        bsum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="B"')
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'

        print(Fore.GREEN + 'PASS: test_archive_deals_2' + Fore.RESET)

    def test_archive_deals_3(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH588300')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" },
            {"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" },
            {"code":"SH588300", "time":"2021-08-13", "tradeType":"B", "count":5300, "price":0.9320, "fee":0.59, "feeYh":0.00, "feeGh":0.00, "sid":"1428159" },
            {"code":"SH588300", "time":"2021-09-01", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"280527" },
            {"code":"SH588300", "time":"2021-09-17", "tradeType":"B", "count":5800, "price":0.8510, "fee":0.59, "feeYh":0.00, "feeGh":0.00, "sid":"966285" },
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87198" },
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87292" },
            {"code":"SH588300","time":"2021-09-24","count":5800,"price":0.8580,"tradeType":"B","sid":"87305","fee":0.60,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"S", "count":26900, "price":0.8600, "fee":2.78, "feeYh":0.00, "feeGh":0.00, "sid":"359963" }])

        self.__check_table_row(sqldb, us.buy_table, f'委托编号="1410475"', {f'{column_portion}':3000, f'{column_soldout}':1, f'{column_sold_portion}':3000})
        self.testuser.archive_deals('2021-08')
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="1410475"', {f'{column_portion}':2000, f'{column_soldout}':1, f'{column_sold_portion}':2000})
        ssum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="S"')
        bsum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="B"')

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" }])
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="1410475"', {f'{column_portion}':2000, f'{column_soldout}':1, f'{column_sold_portion}':2000})

        self.testuser.archive_deals('2021-10')
        ssum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="S"')
        bsum = sqldb.select(archivetable, f'sum({column_portion})', f'{column_type}="B"')
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'
        assert not sqldb.isExistTable(us.sell_table), 'sell tabgle should delete when archived with no sell records'

        print(Fore.GREEN + 'PASS: test_archive_deals_3' + Fore.RESET)

    def test_archive_deals_4(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH588300')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])
        self.testuser.add_deals([{"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87198" },
            {"code":"SH588300", "time":"2021-09-24", "tradeType":"B", "count":5800, "price":0.8580, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"87292" },
            {"code":"SH588300","time":"2021-09-24","count":5800,"price":0.8580,"tradeType":"B","sid":"87305","fee":0.60,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300", "time":"2021-11-19", "tradeType":"B", "count":5600, "price":0.8870, "fee":0.60, "feeYh":0.00, "feeGh":0.00, "sid":"527694" },
            {"code":"SH588300","time":"2022-01-04","count":7000,"price":0.8280,"tradeType":"B","sid":"840993","fee":0.70,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-01-06","count":5600,"price":0.7940,"tradeType":"B","sid":"822210","fee":0.53,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-01-06","count":10000,"price":0.7960,"tradeType":"B","sid":"330656","fee":1.19,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-01-07","count":12500,"price":0.7950,"tradeType":"B","sid":"232892","fee":1.49,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-01-26","count":12600,"price":0.7650,"tradeType":"B","sid":"172538","fee":1.45,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-01-26","count":5600,"price":0.7700,"tradeType":"B","sid":"718618","fee":0.52,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-02-08","count":12600,"price":0.7230,"tradeType":"B","sid":"115589","fee":1.37,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-02-15","count":5600,"price":0.7000,"tradeType":"B","sid":"72297","fee":0.47,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-03-02", "tradeType":"S", "count":5600, "price":0.7300, "fee":0.61, "feeYh":0.00, "feeGh":0.00, "sid":"173470" },
            {"code":"SH588300","time":"2022-03-07","count":14300,"price":0.6960,"tradeType":"B","sid":"111980","fee":1.49,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-04-12","count":15600,"price":0.6370,"tradeType":"B","sid":"25796","fee":1.49,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300","time":"2022-04-20","count":16400,"price":0.6070,"tradeType":"B","sid":"328715","fee":1.49,"feeYh":0.00,"feeGh":0.00},
            {"code":"SH588300", "time":"2022-05-16", "tradeType":"S", "count":16400, "price":0.6060, "sid":"192309" }])

        self.__check_table_row(sqldb, us.buy_table, f'委托编号="87198"', {f'{column_portion}':5800, f'{column_soldout}':1, f'{column_sold_portion}':5800})
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="527694"', {f'{column_portion}':5600, f'{column_soldout}':0, f'{column_sold_portion}':4600})

        self.testuser.add_deals([{"code":"SH588300", "time":"2022-05-16", "tradeType":"S", "count":16400, "price":0.6060, "fee":1.49, "feeYh":0.00, "feeGh":0.00, "sid":"192309" },
            {"code":"SH588300","time":"2022-06-09","count":15600,"price":0.6570,"tradeType":"S","sid":"189309"}])
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="527694"', {f'{column_portion}':5600, f'{column_soldout}':1, f'{column_sold_portion}':5600})
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="330656"', {f'{column_portion}':10000, f'{column_soldout}':0, f'{column_sold_portion}':2000})

        self.testuser.archive_deals('2022-06')
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH588300"', {f'{column_portion_hold}':103200,f'{column_averagae_price}':0.7086})
        assert sqldb.isExistTable(us.sell_table), 'sell table not found!'

        self.testuser.add_deals([{"code":"SH588300","time":"2022-06-09","count":15600,"price":0.6570,"tradeType":"S","sid":"189309","fee":0.00,"feeYh":0.00,"feeGh":0.00}])
        self.testuser.archive_deals('2022-07')
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH588300"', {f'{column_portion_hold}':103200,f'{column_averagae_price}':0.7086})
        assert not sqldb.isExistTable(us.sell_table), 'sell table should delete when archived with no buy records!'

        print(Fore.GREEN + 'PASS: test_archive_deals_4' + Fore.RESET)

    def test_update_archived_fee(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH588300')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" },
            {"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "sid":"77329" }])
        self.testuser.archive_deals('2021-08')
        self.__check_table_row(sqldb, archivetable, f'委托编号="77329"', {f'{column_portion}':5000, f'{column_price}':0.9710, f'{column_fee}':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" }])
        self.__check_table_row(sqldb, archivetable, f'委托编号="77329"', {f'{column_portion}':5000, f'{column_price}':0.9710, f'{column_fee}':0.58})

        print(Fore.GREEN + 'PASS: test_update_archived_fee' + Fore.RESET)

    def test_archive_update(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SH603726')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([
            {"time":"2021-12-15","sid":"90546","code":"SH603726","tradeType":"B","price":"16.2600","count":"300","fee":"5.00","feeYh":".00","feeGh":".10"},
            {"time":"2021-12-23","sid":"344117","code":"SH603726","tradeType":"S","price":"14.5060","count":"300","fee":"5.00","feeYh":"4.35","feeGh":".09"},
            {"time":"2021-12-31","sid":"1156657","code":"SH603726","tradeType":"B","price":"14.1900","count":"300","fee":"5.00","feeYh":".00","feeGh":".09"},
            {"time":"2022-01-05","sid":"1830500","code":"SH603726","tradeType":"S","price":"14.0800","count":"300","fee":"5.00","feeYh":"4.22","feeGh":".08"},
            {"time":"2022-01-06","sid":"1321420","code":"SH603726","tradeType":"B","price":"14.3100","count":"300","fee":"5.00","feeYh":".00","feeGh":".09"},
            {"time":"2022-04-01","sid":"344750","code":"SH603726","tradeType":"B","price":"13.1800","count":"400","fee":"5.00","feeYh":".00","feeGh":".12"},
            {"time":"2022-04-26","sid":"148257","code":"SH603726","tradeType":"B","price":"11.4000","count":"400","fee":"5.00","feeYh":".00","feeGh":".10"},
            {"time":"2022-05-27","sid":"1317012","code":"SH603726","tradeType":"S","price":"11.9100","count":"400","fee":"5.00","feeYh":"4.76","feeGh":".05"}
        ])

        self.testuser.archive_deals('2022-06')
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH603726"', {f'{column_portion_hold}':700,f'{column_averagae_price}':12.1629})
        self.testuser.add_deals([
            {"time":"2021-12-15","sid":"90546","code":"SH603726","tradeType":"B","price":"16.2600","count":"300","fee":"5.00","feeYh":".00","feeGh":".10"},
            {"time":"2021-12-23","sid":"344117","code":"SH603726","tradeType":"S","price":"14.5060","count":"300","fee":"5.00","feeYh":"4.35","feeGh":".09"},
            {"time":"2021-12-31","sid":"1156657","code":"SH603726","tradeType":"B","price":"14.1900","count":"300","fee":"5.00","feeYh":".00","feeGh":".09"},
            {"time":"2022-01-05","sid":"1830500","code":"SH603726","tradeType":"S","price":"14.0800","count":"300","fee":"5.00","feeYh":"4.22","feeGh":".08"},
            {"time":"2022-01-06","sid":"1321420","code":"SH603726","tradeType":"B","price":"14.3100","count":"300","fee":"5.00","feeYh":".00","feeGh":".09"},
            {"time":"2022-04-01","sid":"344750","code":"SH603726","tradeType":"B","price":"13.1800","count":"400","fee":"5.00","feeYh":".00","feeGh":".12"},
            {"time":"2022-04-26","sid":"148257","code":"SH603726","tradeType":"B","price":"11.4000","count":"400","fee":"5.00","feeYh":".00","feeGh":".10"},
            {"time":"2022-05-27","sid":"1317012","code":"SH603726","tradeType":"S","price":"11.9100","count":"400","fee":"5.00","feeYh":"4.76","feeGh":".05"}
        ])
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH603726"', {f'{column_portion_hold}':700,f'{column_averagae_price}':12.1629})

        print(Fore.GREEN + 'PASS: test_archive_update' + Fore.RESET)

    def test_archive_update_1(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        archivetable = self.testuser.stocks_archived_deals_table()
        earnedtable = self.testuser.stocks_earned_table()
        us = UserStock(self.testuser, 'SZ000055')

        self.__cleanup_tables(sqldb, [userstockstable, earnedtable, archivetable, us.buy_table, us.sell_table])

        self.testuser.add_deals([
            {"code":"SZ000055", "time": "2021-12-30", "tradeType":"B", "count":1000, "price":"4.8800", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"1003933"},
            {"code":"SZ000055", "time": "2022-01-27", "tradeType":"B", "count":1000, "price":"4.4200", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"246834"},
            {"code":"SZ000055", "time": "2022-04-26", "tradeType":"B", "count":1200, "price":"3.9100", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"210151"},
            {"code":"SZ000055", "time": "2022-05-12", "tradeType":"S", "count":1200, "price":"4.0900", "fee":"5.00", "feeYh":"4.91", "feeGh":0.00, "sid":"1265386"}
        ])

        self.testuser.archive_deals('2022-06')
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SZ000055"', {f'{column_portion_hold}':2000,f'{column_averagae_price}':4.114})
        self.testuser.add_deals([{"code":"SZ000055", "time": "2022-06-09", "tradeType":"S", "count":1000, "price":"4.2400", "fee":"5.00", "feeYh":"4.24", "feeGh":0.00, "sid":"884840"}])
        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SZ000055"', {f'{column_portion_hold}':1000,f'{column_averagae_price}':3.91})
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="246834"', {f'{column_portion}':800, f'{column_soldout}':1, f'{column_sold_portion}':800})
        self.__check_table_row(sqldb, us.buy_table, f'委托编号="210151"', {f'{column_portion}':1200, f'{column_soldout}':0, f'{column_sold_portion}':200})

        print(Fore.GREEN + 'PASS: test_archive_update_1' + Fore.RESET)

    def test_add_dividen_shares(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SZ002459')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table])

        self.testuser.add_deals([
            {"time":"2022-06-16 15:00:00","sid":"","code":"SZ002459","tradeType":"B","price":".0000","count":"40","fee":".00","feeYh":".00","feeGh":".00"}
        ])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SZ002459"', {f'{column_portion_hold}':40,f'{column_averagae_price}':0})
        self.__check_table_row(sqldb, us.buy_table, [f'委托编号="0"', f'{column_date}="2022-06-16"'], {f'{column_portion}':40})

        self.testuser.add_deals([
            {"time":"2022-06-16 15:00:00","sid":"","code":"SZ002459","tradeType":"B","price":".0000","count":"40","fee":".00","feeYh":".00","feeGh":".00"}
        ])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SZ002459"', {f'{column_portion_hold}':40,f'{column_averagae_price}':0})
        self.__check_table_row(sqldb, us.buy_table, [f'委托编号="0"', f'{column_date}="2022-06-16"'], {f'{column_portion}':40})

        print(Fore.GREEN + 'PASS: test_add_dividen_shares' + Fore.RESET)

    def test_add_buy_sell_margin_deals(self):
        sqldb = self.testuser.stock_center_db()
        userstockstable = self.testuser.stocks_info_table()
        us = UserStock(self.testuser, 'SH510050')

        self.__cleanup_tables(sqldb, [userstockstable, us.buy_table, us.sell_table])

        self.testuser.add_deals([{"time":"2023-05-26","sid":"s_001","code":"SH510050","tradeType":"B","price":"2.567","count":"3800"}])
        self.testuser.add_deals([{"time":"2023-05-26","sid":"s_002","code":"SH510050","tradeType":"S","price":"2.549","count":"4000"}])
        self.testuser.add_deals([{"time":"2022-06-07","sid":"s_003","code":"SH510050","tradeType":"B","price":"2.539","count":"4000"}])

        self.__check_table_row(sqldb, userstockstable, f'{column_code}="SH510050"', {f'{column_cost_hold}':9648.2, f'{column_portion_hold}':3800, f'{column_averagae_price}':2.539})

        print(Fore.GREEN + 'PASS: test_add_buy_buy_deals' + Fore.RESET)
