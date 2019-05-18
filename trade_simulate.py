# Python 3
# -*- coding:utf-8 -*-

from _pwd import db_pwd
from datetime import datetime, timedelta
from fund_history import FundHistoryDataDownloader
from fund_trade import TradeFund
from commons import *
from decimal import *

if __name__ == "__main__":
    testdb = "testdb"
    tf = TradeFund("000217", dbname = testdb, dbpws = db_pwd)
    tf.reset_trade_data()
    for x in range(18, 30):
        tf.buy(1000, "2019-04-%02d" %(x))
    tf.print_summery()
    portion_sell = tf.portions_available_to_sell(7,"2019-04-30")#
    print(portion_sell)
    tf.sell(portion_sell, "2019-05-16")
    tf.print_summery()
    portion_sell = tf.portions_available_to_sell(7)#,"2019-04-30"
    print(portion_sell)
    tf.sell(portion_sell, "2019-05-16")
    tf.print_summery()


