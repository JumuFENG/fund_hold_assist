# Python 3
# -*- coding:utf-8 -*-

from _pwd import db_pwd
from datetime import datetime, timedelta
from fund_history import FundHistoryDataDownloader
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

if __name__ == "__main__":
    testdb = "testdb"
    #fh = FundHistoryDataDownloader("000217", dbname = testdb, dbpws = db_pwd)
    #fh.reload_all_history()
    sim = SimulatorHost("000217", dbname = testdb)
    sDate = "2018-10-18"
    eDate = "2019-05-16"
    sim.sim(sDate, eDate, simulator_base()) 
    sim.sim(sDate, eDate, simulator_decrease())
    sim.sim(sDate, eDate, simulator_anti_lose())
