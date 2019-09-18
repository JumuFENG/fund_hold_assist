# Python 3
# -*- coding:utf-8 -*-

from utils import *
from datetime import datetime, timedelta
from fund_trade import TradeFund
from decimal import *
from simulators import *

class SimulatorHost():
    """
    to simulate trading.
    """
    def __init__(self, user, fund_code, dbname, dbpws = db_pwd):
        self.user = user
        self.fund_code = fund_code
        self.dbname = dbname
        self.dbpws = dbpws

    def sim(self, sDate, eDate, simulator):
        trade = TradeFund(self.user, self.fund_code, self.dbname, self.dbpws)
        self.sqldb = trade.sqldb
        allData = self.sqldb.select(trade.fund_history_table, [column_date, column_net_value], order = " ORDER BY %s ASC" % column_date)
        self.allDays = [x[0] for x in allData]
        self.allValues = [x[1] for x in allData]

        sIdx = self.allDays.index(sDate)
        eIdx = self.allDays.index(eDate)
        simulator.setup(self, trade)
        simulator.simulate(sIdx, eIdx)

        trade.print_summery()
        trade.reset_trade_data()

def continuely_buy(user, dbname, fund_code, sDate, eDate, cost_per_day):
    trade = TradeFund(user, fund_code, dbname, db_pwd)
    dateBegin = datetime.strptime(sDate, "%Y-%m-%d")
    dateEnd = datetime.strptime(eDate, "%Y-%m-%d")
    while True:
        trade.buy(cost_per_day, dateBegin.strftime("%Y-%m-%d"))
        dateBegin += timedelta(days=1)
        if dateBegin > dateEnd:
            break

if __name__ == "__main__":
    testdb = "fund_center"
    testdb = "testdb"
    gendb = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gendb)
    user = usermodel.user_by_id(1)
    sim = SimulatorHost(user, "000217", dbname = testdb)
    #sDate = "2016-07-20"
    #eDate = "2018-10-17"
    sDate = "2018-10-24"
    eDate = "2019-05-16"
    sim.sim(sDate, eDate, simulator_base())
    #sim.sim(sDate, eDate, simulator_roll_over())
    #sim.sim(sDate, eDate, simulator_decrease())
    #sim.sim(sDate, eDate, simulator_anti_lose())
    sim.sim(sDate, eDate, simulator_keep_market())
    sim.sim(sDate, eDate, simulator_moving_average())
    sim.sim(sDate, eDate, simulator_keepmarket_movingaverage())
    #continuely_buy(user, testdb, "000217", "2019-04-03", "2019-05-20", 1000)
