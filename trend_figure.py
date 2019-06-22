# Python 3
# -*- coding:utf-8 -*-

import os
from datetime import datetime, timedelta
from decimal import Decimal
from decimal import getcontext
from utils import *
from painter import *

if __name__ == "__main__":
    testdb = "fund_center"
    #testdb = "testdb"
    sqldb = SqlHelper(password = db_pwd, database = testdb)
    #painter = GoldHistoryGraph(sqldb, "AU9999", True)
    #painter.show_graph()
    painter = FundHistoryGraph(sqldb, "000217")
    #painter.show_graph()
    #painter = IndexHistoryGraph(sqldb, "000001", True)
    #painter.show_graph()
    #painter = FundTradeHistoryGraph(sqldb, "000217")
    #painter.show_graph()
    painter.show_distribute()
