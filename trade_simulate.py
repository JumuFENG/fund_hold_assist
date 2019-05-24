# Python 3
# -*- coding:utf-8 -*-

from _pwd import db_pwd
from datetime import datetime, timedelta
from fund_trade import TradeFund
from commons import *
from decimal import *
from simulators import *

class SimulatorHost():
    """
    to simulate trading.
    """
    def __init__(self, fund_code, dbname, dbpws = db_pwd):
        self.fund_code = fund_code
        self.dbname = dbname
        self.dbpws = dbpws

    def sim(self, sDate, eDate, simulator):
        trade = TradeFund(self.fund_code, self.dbname, self.dbpws)
        self.sqldb = trade.sqldb
        self.allDays = self.sqldb.select(trade.fund_history_table, column_date)
        self.allDays = [x[0] for x in self.allDays]

        sIdx = self.allDays.index(sDate)
        eIdx = self.allDays.index(eDate)
        simulator.setup(self, trade)
        simulator.simulate(sIdx, eIdx)

        trade.print_summery()
        trade.reset_trade_data()

def continuely_buy(dbname, fund_code, sDate, eDate, cost_per_day):
    trade = TradeFund(fund_code, dbname, db_pwd)
    dateBegin = datetime.strptime(sDate, "%Y-%m-%d")
    dateEnd = datetime.strptime(eDate, "%Y-%m-%d")
    while True:
        trade.buy(cost_per_day, dateBegin.strftime("%Y-%m-%d"))
        dateBegin += timedelta(days=1)
        if dateBegin > dateEnd:
            break

if __name__ == "__main__":
    #testdb = "fund_center"
    testdb = "testdb"
    #sim = SimulatorHost("000217", dbname = testdb)
    #sDate = "2018-10-18"
    #eDate = "2019-05-16"
    #sim.sim(sDate, eDate, simulator_base()) 
    #sim.sim(sDate, eDate, simulator_decrease())
    #sim.sim(sDate, eDate, simulator_anti_lose())
    trade = TradeFund("110003", testdb, db_pwd)
    trade.buy(10,"2019-05-23")
    #trade.sell_by_day(["2019-04-02","2019-04-22"], "2019-05-15")#,
    #continuely_buy(testdb, "110003", "2019-04-03", "2019-05-20", 10)
