import pytest
from colorama import Fore
from peewee import fn
from phon.data.user import User, lazy_property, UserDb, UserStockBuy, UserStockSell, UserStocks, classproperty
from phon.data.user import UserDeals, UserEarned, UserEarning, UserStrategy, UserOrders
from phon.data.db import create_model, get_database, write_context, read_context, check_table_columns


class MockUser(User):
    @classproperty
    def db(cls):
        return create_model(UserDb, None, get_database('testdb'))

    @classmethod
    def from_dict(cls, **data):
        return MockUser(**data)

    @lazy_property
    def stocks_info_table(self):
        return create_model(UserStocks, f'u{self.id}_stocks', get_database('testdb'))

    @lazy_property
    def buy_table(self):
        return create_model(UserStockBuy, f'u{self.id}_buy', get_database('testdb'))

    @lazy_property
    def sell_table(self):
        return create_model(UserStockSell, f'u{self.id}_sell', get_database('testdb'))

    @lazy_property
    def stocks_earned_table(self):
        return create_model(UserEarned, f'u{self.id}_earned', get_database('testdb'))

    @lazy_property
    def stocks_earning_table(self):
        return create_model(UserEarning, f'u{self.id}_earning', get_database('testdb'))

    @lazy_property
    def archived_deals(self):
        return create_model(UserDeals, f'u{self.id}_archived_deals', get_database('testdb'))

    @lazy_property
    def unknown_deals_table(self):
        return create_model(UserDeals, f'u{self.id}_unknown_deals', get_database('testdb'))
    
    @lazy_property
    def stock_strategy_table(self):
        return create_model(UserStrategy, f'u{self.id}_strategy', get_database('testdb'))
    
    @lazy_property
    def stock_order_table(self):
        return create_model(UserOrders, f'u{self.id}_orders', get_database('testdb'))

    @lazy_property
    def stock_fullorder_table(self):
        return create_model(UserOrders, f'u{self.id}_fullorders', get_database('testdb'))

# @pytest.mark.skip(reason=None)
class TestUserStock(object):
    def setup_class(self) -> None:
        with read_context(MockUser.db):
            exist = MockUser.db.select().where(MockUser.db.id == 1).exists()
        if not exist:
            MockUser.add_user('test1', 'test1', 'test1@test.com')
        self.testuser = MockUser.user_by_id(1)

    def __check_table_row(self, tablename, conds, checks):
        assert isinstance(checks, dict), 'checks should be a dict'
        conditons = [getattr(tablename, key) == value for key, value in conds.items()]
        with read_context(tablename):
            query = tablename.get_or_none(*conditons)

        assert query, f'None value got, expect 1 row!'

        for k,v in checks.items():
            assert getattr(query, k) == v, f'expected value: {v}, but get: {getattr(query, k)}'

    def __clear_table(self, table):
        with write_context(table):
            table.delete().execute()

    def __cleanup_tables(self, tables):
        if not isinstance(tables, list):
            tables = [tables]
        for t in tables:
            self.__clear_table(t)

    def test_add_buy_deal(self):
        #  2022-06-08
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])

        self.__check_table_row(userstockstable, {'code': "SH600497"}, {'cost_hold':7092.0, 'portion_hold':1200, 'aver_price':5.91})

        print(Fore.GREEN + 'PASS: test_add_buy_deal' + Fore.RESET)

    def test_add_buy_sell_deals(self):
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([userstockstable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"S","price":"5.990000","count":"1200"}])

        self.__check_table_row(userstockstable, {'code': "SH600497"}, {'cost_hold':0.0, 'portion_hold':0, 'aver_price':0})

        print(Fore.GREEN + 'PASS: test_add_buy_sell_deals' + Fore.RESET)

    def test_add_buy_buy_deals(self):
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([userstockstable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"B","price":"5.390000","count":"1300"}])
        self.testuser.add_deals([
            {"time":"2025-03-14 09:25:00","sid":"71947","code":"SZ002693","tradeType":"B","price":"10.9900","count":"400","fee":"5.00","feeYh":"0.00","feeGh":"0.00"},
            {"time":"2025-03-14 09:25:00","sid":"71953","code":"SZ000701","tradeType":"B","price":"5.9400","count":"1100","fee":"5.00","feeYh":"0.00","feeGh":"0.00"},])
        self.__check_table_row(userstockstable, {'code': "SH600497"}, {'cost_hold':14099.0, 'portion_hold':2500, 'aver_price':5.6396})
        self.__check_table_row(userstockstable, {'code': "SZ002693"}, {'cost_hold':4396.0, 'portion_hold':400, 'aver_price':10.9900})


        print(Fore.GREEN + 'PASS: test_add_buy_buy_deals' + Fore.RESET)

    def test_add_buy_buy_sell_deals(self):
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([userstockstable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2022-06-08","sid":"s_001","code":"SH600497","tradeType":"B","price":"5.910000","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-09","sid":"s_002","code":"SH600497","tradeType":"B","price":"5.390000","count":"1300"}])
        self.testuser.add_deals([{"time":"2022-06-10","sid":"s_003","code":"SH600497","tradeType":"S","price":"5.090000","count":"2500"}])

        self.__check_table_row(userstockstable, {'code': "SH600497"}, {'cost_hold':0.0, 'portion_hold':0, 'aver_price':0})

        print(Fore.GREEN + 'PASS: test_add_buy_buy_sell_deals' + Fore.RESET)

    def test_buy_buy_sell_partial(self):
        
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([userstockstable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2022-02-18","sid":"s_001","code":"SZ002045","tradeType":"B","price":"11.2700","count":"800"}])
        self.testuser.add_deals([{"time":"2022-02-28","sid":"s_002","code":"SZ002045","tradeType":"B","price":"10.1600","count":"900"}])
        self.testuser.add_deals([{"time":"2022-02-28","sid":"s_003","code":"SZ002045","tradeType":"B","price":"10.1700","count":"900"}])
        self.testuser.add_deals([{"time":"2022-03-01","sid":"s_004","code":"SZ002045","tradeType":"S","price":"10.3000","count":"900"}])
        self.__check_table_row(self.testuser.buy_table, {'委托编号': "s_002"}, {'portion':900, 'soldout':0, 'soldptn':100})

        self.testuser.add_deals([{"time":"2022-03-15","sid":"s_005","code":"SZ002045","tradeType":"B","price":"9.1090","count":"1000"}])
        self.testuser.add_deals([{"time":"2022-04-21","sid":"s_006","code":"SZ002045","tradeType":"B","price":"7.8300","count":"1200"}])
        self.testuser.add_deals([{"time":"2022-06-02","sid":"s_007","code":"SZ002045","tradeType":"S","price":"8.9350","count":"1200"}])
        self.__check_table_row(self.testuser.buy_table, {'委托编号': "s_002"}, {'portion':900, 'soldout':1, 'soldptn':900})
        self.__check_table_row(self.testuser.buy_table, {'委托编号': "s_003"}, {'portion':900, 'soldout':0, 'soldptn':400})

        self.__check_table_row(userstockstable, {'code': "SZ002045"}, {'cost_hold':23590.0, 'portion_hold':2700, 'aver_price':8.737})

        print(Fore.GREEN + 'PASS: test_buy_buy_sell_partial' + Fore.RESET)

    def test_archive_deals_1(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" }])
        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "sid":"77329" }])
        self.__check_table_row(self.testuser.sell_table, {'委托编号': "77329"}, {'portion':5000, 'money_sold':4855, '手续费':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" }])
        self.__check_table_row(self.testuser.sell_table, {'委托编号': "77329"}, {'portion':5000, 'money_sold':4855, '手续费':0.58})

        self.testuser.archive_deals('2021-08')
        self.__check_table_row(archivetable, {'委托编号': '77329'}, {'portion':5000, '手续费':0.58})
        self.__check_table_row(archivetable, {'委托编号': '1410475'}, {'portion':1000})
        with read_context(archivetable):
            ssum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'S').scalar()
            bsum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'B').scalar()
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'

        print(Fore.GREEN + 'PASS: test_archive_deals_1' + Fore.RESET)

    def test_archive_deals_2(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

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
        self.__check_table_row(self.testuser.sell_table, {'委托编号':"359963"}, {'portion':26900, 'money_sold':23134, '手续费':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-09-24", "tradeType":"S", "count":26900, "price":0.8600, "fee":2.78, "feeYh":0.00, "feeGh":0.00, "sid":"359963" }])
        self.__check_table_row(self.testuser.sell_table, {'委托编号':"359963"}, {'portion':26900, 'money_sold':23134, '手续费':2.78})

        self.testuser.archive_deals('2021-10')
        self.__check_table_row(archivetable, {'委托编号': "359963"}, {'portion':26900, '手续费':2.78})
        self.__check_table_row(archivetable, {'委托编号': "1410475"}, {'portion':3000})
        self.__check_table_row(archivetable, {'委托编号': "966285"}, {'portion':5800})
        with read_context(archivetable):
            ssum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'S').scalar()
            bsum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'B').scalar()
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'

        print(Fore.GREEN + 'PASS: test_archive_deals_2' + Fore.RESET)

    def test_archive_deals_3(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

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

        self.__check_table_row(self.testuser.buy_table, {'委托编号':"1410475"}, {'portion':3000, 'soldout':1, 'soldptn':3000})
        self.testuser.archive_deals('2021-08')
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"1410475"}, {'portion':2000, 'soldout':1, 'soldptn':2000})
        with read_context(archivetable):
            ssum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'S').scalar()
            bsum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'B').scalar()

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" }])
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"1410475"}, {'portion':2000, 'soldout':1, 'soldptn':2000})

        self.testuser.archive_deals('2021-10')
        with read_context(archivetable):
            ssum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'S').scalar()
            bsum = archivetable.select(fn.SUM(archivetable.portion)).where(archivetable.type == 'B').scalar()
        assert ssum == bsum, 'buy portion NOT Equals to sell portion!'
        with read_context(self.testuser.sell_table):
            srec = self.testuser.sell_table.select().where(self.testuser.sell_table.code == 'SH588300').exists()
        assert not srec, 'sell records should delete when archived '

        print(Fore.GREEN + 'PASS: test_archive_deals_3' + Fore.RESET)

    def test_archive_deals_4(self):
        
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])
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

        self.__check_table_row(self.testuser.buy_table, {'委托编号':"87198"}, {'portion':5800, 'soldout':1, 'soldptn':5800})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"527694"}, {'portion':5600, 'soldout':0, 'soldptn':4600})

        self.testuser.add_deals([{"code":"SH588300", "time":"2022-05-16", "tradeType":"S", "count":16400, "price":0.6060, "fee":1.49, "feeYh":0.00, "feeGh":0.00, "sid":"192309" },
            {"code":"SH588300","time":"2022-06-09","count":15600,"price":0.6570,"tradeType":"S","sid":"189309"}])
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"527694"}, {'portion':5600, 'soldout':1, 'soldptn':5600})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"330656"}, {'portion':10000, 'soldout':0, 'soldptn':2000})

        self.testuser.archive_deals('2022-06')
        self.__check_table_row(userstockstable, {'code': "SH588300"}, {'portion_hold':103200,'aver_price':0.7086})
        with read_context(self.testuser.sell_table):
            srec = self.testuser.sell_table.select().where(self.testuser.sell_table.code == 'SH588300').exists()
        assert srec, 'sell records not found!'

        self.testuser.add_deals([{"code":"SH588300","time":"2022-06-09","count":15600,"price":0.6570,"tradeType":"S","sid":"189309","fee":0.00,"feeYh":0.00,"feeGh":0.00}])
        self.testuser.archive_deals('2022-07')
        self.__check_table_row(userstockstable, {'code': "SH588300"}, {'portion_hold':103200,'aver_price':0.7086})
        with read_context(self.testuser.sell_table):
            srec = self.testuser.sell_table.select().where(self.testuser.sell_table.code == 'SH588300').exists()
        assert not srec, 'sell records should be delete when archived with no buy records!'

        print(Fore.GREEN + 'PASS: test_archive_deals_4' + Fore.RESET)

    def test_update_archived_fee(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-05", "tradeType":"B", "count":900, "price":0.9790, "fee":0.22, "feeYh":0.00, "feeGh":0.00, "sid":"192270" },
            {"code":"SH588300", "time":"2021-07-06", "tradeType":"B", "count":3100, "price":0.9530, "fee":0.74, "feeYh":0.00, "feeGh":0.00, "sid":"243715" },
            {"code":"SH588300", "time":"2021-07-16", "tradeType":"B", "count":3000, "price":0.9820, "fee":0.35, "feeYh":0.00, "feeGh":0.00, "sid":"1410475" },
            {"code":"SH588300", "time":"2021-07-19", "tradeType":"B", "count":2000, "price":0.9740, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"1154776" },
            {"code":"SH588300", "time":"2021-07-26", "tradeType":"B", "count":3000, "price":0.9540, "fee":0.34, "feeYh":0.00, "feeGh":0.00, "sid":"664918" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":900, "price":0.9000, "fee":0.10, "feeYh":0.00, "feeGh":0.00, "sid":"353493" },
            {"code":"SH588300", "time":"2021-07-28", "tradeType":"B", "count":2100, "price":0.9300, "fee":0.23, "feeYh":0.00, "feeGh":0.00, "sid":"821612" },
            {"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "sid":"77329" }])
        self.testuser.archive_deals('2021-08')
        self.__check_table_row(archivetable, {'委托编号':"77329"}, {'portion':5000, 'price':0.9710, '手续费':0})

        self.testuser.add_deals([{"code":"SH588300", "time":"2021-07-30", "tradeType":"S", "count":5000, "price":0.9710, "fee":0.58, "feeYh":0.00, "feeGh":0.00, "sid":"77329" }])
        self.__check_table_row(archivetable, {'委托编号':"77329"}, {'portion':5000, 'price':0.9710, '手续费':0.58})

        print(Fore.GREEN + 'PASS: test_update_archived_fee' + Fore.RESET)

    def test_archive_update(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

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
        self.__check_table_row(userstockstable, {'code': "SH603726"}, {'portion_hold':700,'aver_price':12.1629})
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
        self.__check_table_row(userstockstable, {'code': "SH603726"}, {'portion_hold':700,'aver_price':12.1629})

        print(Fore.GREEN + 'PASS: test_archive_update' + Fore.RESET)

    def test_archive_update_1(self):
        userstockstable = self.testuser.stocks_info_table
        archivetable = self.testuser.archived_deals
        earnedtable = self.testuser.stocks_earned_table

        self.__cleanup_tables([userstockstable, earnedtable, archivetable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([
            {"code":"SZ000055", "time": "2021-12-30", "tradeType":"B", "count":1000, "price":"4.8800", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"1003933"},
            {"code":"SZ000055", "time": "2022-01-27", "tradeType":"B", "count":1000, "price":"4.4200", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"246834"},
            {"code":"SZ000055", "time": "2022-04-26", "tradeType":"B", "count":1200, "price":"3.9100", "fee":"5.00", "feeYh":"0.00", "feeGh":0.00, "sid":"210151"},
            {"code":"SZ000055", "time": "2022-05-12", "tradeType":"S", "count":1200, "price":"4.0900", "fee":"5.00", "feeYh":"4.91", "feeGh":0.00, "sid":"1265386"}
        ])

        self.testuser.archive_deals('2022-06')
        self.__check_table_row(userstockstable, {'code': "SZ000055"}, {'portion_hold':2000,'aver_price':4.114})
        self.testuser.add_deals([{"code":"SZ000055", "time": "2022-06-09", "tradeType":"S", "count":1000, "price":"4.2400", "fee":"5.00", "feeYh":"4.24", "feeGh":0.00, "sid":"884840"}])
        self.__check_table_row(userstockstable, {'code': "SZ000055"}, {'portion_hold':1000,'aver_price':3.91})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"246834"}, {'portion':800, 'soldout':1, 'soldptn':800})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"210151"}, {'portion':1200, 'soldout':0, 'soldptn':200})

        print(Fore.GREEN + 'PASS: test_archive_update_1' + Fore.RESET)

    def test_add_dividen_shares(self):
        userstockstable = self.testuser.stocks_info_table

        self.__cleanup_tables([userstockstable, self.testuser.buy_table])

        self.testuser.add_deals([
            {"time":"2022-06-16 15:00:00","sid":"","code":"SZ002459","tradeType":"B","price":".0000","count":"40","fee":".00","feeYh":".00","feeGh":".00"}
        ])

        self.__check_table_row(userstockstable, {'code': "SZ002459"}, {'portion_hold':40,'aver_price':0})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"0", 'date': "2022-06-16"}, {'portion':40})

        self.testuser.add_deals([
            {"time":"2022-06-16 15:00:00","sid":"","code":"SZ002459","tradeType":"B","price":".0000","count":"40","fee":".00","feeYh":".00","feeGh":".00"}
        ])

        self.__check_table_row(userstockstable, {'code': "SZ002459"}, {'portion_hold':40,'aver_price':0})
        self.__check_table_row(self.testuser.buy_table, {'委托编号':"0", 'date': "2022-06-16"}, {'portion':40})

        print(Fore.GREEN + 'PASS: test_add_dividen_shares' + Fore.RESET)

    def test_add_buy_sell_margin_deals(self):
        userstockstable = self.testuser.stocks_info_table
        self.__cleanup_tables([userstockstable, self.testuser.buy_table, self.testuser.sell_table])

        self.testuser.add_deals([{"time":"2023-05-26","sid":"s_001","code":"SH510050","tradeType":"B","price":"2.567","count":"3800"}])
        self.testuser.add_deals([{"time":"2023-05-26","sid":"s_002","code":"SH510050","tradeType":"S","price":"2.549","count":"4000"}])
        self.testuser.add_deals([{"time":"2022-06-07","sid":"s_003","code":"SH510050","tradeType":"B","price":"2.539","count":"4000"}])

        self.__check_table_row(userstockstable, {'code': "SH510050"}, {'cost_hold':9648.2, 'portion_hold':3800, 'aver_price':2.539})

        print(Fore.GREEN + 'PASS: test_add_buy_buy_deals' + Fore.RESET)

    def test_save_strategy(self):
        code = 'SZ000096'
        strobj = {
            "grptype":"GroupStandard","strategies":
            {"0":{"key":"StrategyGE","enabled":True,"stepRate":0.075,"kltype":"30","guardPrice":"1.342","inCritical":False}},
            "transfers":{"0":{"transfer":"-1"}},
            "buydetail":[{"date":"0","count":7800,"price":"1.444","type":"B"},{"date":"2024-11-29","count":"7400","price":"1.336000","sid":"390813","type":"B"}],
            "buydetail_full":[{"date":"0","count":7800,"price":"1.444","type":"B"},{"date":"2024-11-29","count":"7400","price":"1.336000","sid":"390813","type":"B"}],
            "count0":7400,"amount":10000
        }
        strategy_table = self.testuser.stock_strategy_table
        ord_table = self.testuser.stock_order_table
        ordful_table = self.testuser.stock_fullorder_table
        self.__cleanup_tables([strategy_table, ord_table, ordful_table])

        self.testuser.save_strategy(code, strobj)
        self.__check_table_row(strategy_table, {'code': code}, {'id': 0, 'skey': 'StrategyGE', 'trans': -1})
        self.__check_table_row(ord_table, {'code': code, "sid":"390813"}, {"date":"2024-11-29","count":7400})
        self.__check_table_row(ordful_table, {'code': code, "sid":"390813"}, {"date":"2024-11-29","count":7400})

    def test_load_strategy(self):
        code = 'SZ000096'
        strobj = {
            "grptype":"GroupStandard","strategies":
            {"0":{"key":"StrategyGE","enabled":True,"stepRate":0.075,"kltype":"30","guardPrice":"1.342","inCritical":False}},
            "transfers":{"0":{"transfer":"-1"}},
            "buydetail":[{"date":"0","count":7800,"price":"1.444","type":"B"},{"date":"2024-11-29","count":"7400","price":"1.336000","sid":"390813","type":"B"}],
            "buydetail_full":[{"date":"0","count":7800,"price":"1.444","type":"B"},{"date":"2024-11-29","count":"7400","price":"1.336000","sid":"390813","type":"B"}],
            "count0":7400,"amount":10000
        }

        strategy_table = self.testuser.stock_strategy_table
        ord_table = self.testuser.stock_order_table
        ordful_table = self.testuser.stock_fullorder_table
        self.__cleanup_tables([strategy_table, ord_table, ordful_table])

        self.testuser.save_strategy(code, strobj)
        strdata = self.testuser.load_strategy(code)
        assert strdata['grptype'] == 'GroupStandard', 'grptype wrong!'
        assert 0 in strdata['strategies'], 'strategy id error'
        assert 'StrategyGE' == strdata['strategies'][0]['key'], 'strategy key error'
        assert 'buydetail' in strdata, 'no buydetail'
        assert 'buydetail_full' in strdata, 'no buydetail_full'
        assert 10000 == strdata['amount'], f'''amount is not expected: 10000, actual: {strdata['amount']}'''

    def test_update_strategy(self):
        code = 'SZ000096'
        strobj = {
            "grptype": "GroupStandard", 
            "strategies": {"0": {"key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype": "all", "topprice": 19.76, "guardPrice": 17.88}},
            "transfers": {"0": {"transfer": "-1"}}, "amount": "5000"
        }

        strategy_table = self.testuser.stock_strategy_table
        ord_table = self.testuser.stock_order_table
        ordful_table = self.testuser.stock_fullorder_table
        self.__cleanup_tables([strategy_table, ord_table, ordful_table])

        self.testuser.save_strategy(code, strobj)
        strobj2 = {
            "grptype":"GroupStandard",
            "strategies":{
                "0":{"key":"StrategySellELS","enabled":True,"cutselltype":"all","selltype":"all","topprice":"5.25","guardPrice":4.9},
                "1":{"key":"StrategySellBE","enabled":True,"upRate":-0.03,"selltype":"single","sell_conds":"4"}},
            "transfers":{"0":{"transfer":"-1"},"1":{"transfer":"-1"}},
            "buydetail":[{"date":"2025-03-14","count":"1300","price":"4.990000","sid":"35329","type":"B"}],
            "buydetail_full":[{"date":"2025-03-14","count":"1300","price":"4.990000","sid":"35329","type":"B"}],"count0":1300,
            "amount":"5000",
            "uramount":{"key":"hotrank0","id":69}
        }

        self.testuser.save_strategy(code, strobj2)
        strdata = self.testuser.load_strategy(code)
        assert strdata['grptype'] == 'GroupStandard', 'grptype wrong!'
        assert 1 in strdata['strategies'], 'strategy id error'
        assert 'StrategySellBE' == strdata['strategies'][1]['key'], 'strategy key error'
        assert strdata['strategies'][0]['enabled'], 'strategy key error'
        assert 'uramount' in strdata, 'uramount not exists'
        assert 'hotrank0' == strdata['uramount']['key'], 'uramount key wrong!'
        assert 1 == len(strdata['buydetail']), 'buydetail length wrong'

    def test_delete_strategies(self):
        code = 'SZ000096'
        strobj = {
            "grptype": "GroupStandard", 
            "strategies": {"0": {"key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype": "all", "topprice": 19.76, "guardPrice": 17.88}},
            "transfers": {"0": {"transfer": "-1"}}, "amount": "5000"
        }

        strategy_table = self.testuser.stock_strategy_table
        ord_table = self.testuser.stock_order_table
        ordful_table = self.testuser.stock_fullorder_table
        self.__cleanup_tables([strategy_table, ord_table, ordful_table])
        self.testuser.save_strategy(code, strobj)
        self.testuser.remove_strategy(code)

        with read_context(strategy_table):
            sex = strategy_table.select().where(strategy_table.code == code).exists()
        assert not sex, 'strategy remove failed'
        with read_context(ord_table):
            oex = ord_table.select().where(ord_table.code == code).exists()
        assert not oex, 'orders remove failed'
        with read_context(ordful_table):
            foex = ord_table.select().where(ord_table.code == code).exists()
        assert not foex, 'full orders remove failed'

    def test_column_check(self):
        with write_context(User.db):
            check_table_columns(User.db)

    def test_add_user(self):
        ueml = 'test2@test.com'
        with write_context(self.testuser.db):
            if self.testuser.db.select().where(self.testuser.db.email == ueml).exists():
                self.testuser.db.delete().where(self.testuser.db.email == ueml).execute()
        u2 = self.testuser.sub_account('test2', True)
        assert u2.parent == self.testuser.id, 'parent_account not updated'

    def test_user_get_deals(self):
        deals = self.testuser.get_deals()
        assert len(deals) > 0, 'deals not found'
