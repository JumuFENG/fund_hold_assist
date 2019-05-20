# Python 3
# -*- coding:utf-8 -*-

import os
from datetime import datetime, timedelta
from decimal import Decimal
from decimal import getcontext
import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.animation as animation
from fund_history import FundHistoryDataDownloader
from sql_helper import SqlHelper
from _pwd import db_pwd
import numpy as np
from commons import *

def filterBiggerThan(aList, num1, num2):
    biggerThan = [x["Inc2Day"] for x in aList if x["Inc2Day"] > num1 or x["Inc2Day"] < num2 ]
    print("not between",num1,"and",num2,len(biggerThan), len(biggerThan)/len(aList))

def calcMax2dayIncreasRate(fund_code):
    records = readHistoryData(fund_code)
    records[0]["Inc2Day"] = Decimal(0)
    for i in range(len(records) - 1):
        records[i + 1]["Inc2Day"] = records[i]["IncRate"] + records[i + 1]["IncRate"]
    inc2DayRate = [x["Inc2Day"] for x in records]
    inc2DayRate.sort()
    print("total: ", len(inc2DayRate) - 1)
    print("max: ", max(inc2DayRate))
    print("min: ", min(inc2DayRate))
    filterBiggerThan(records, Decimal(1), Decimal(-1))
    filterBiggerThan(records, Decimal(2), Decimal(-2))

def MaxMinVal(fund_code):
    records = readHistoryData(fund_code) 
    valList = [x["Val"] for x in records]
    latestVal = records[-1]["Val"]
    valList.sort()
    listLen = len(valList)
    print("max:",max(valList),"min:", min(valList), "delta:", max(valList) - min(valList))
    print("cur:", latestVal, "under:", len([x["Val"] for x in records if x["Val"] > latestVal]) / len(records))
    print("5%:", valList[int(listLen*0.05)], "95%:", valList[int(listLen*0.95)])
    print("10%:", valList[int(listLen*0.1)], "90%:", valList[int(listLen*0.9)])
    print("20%:", valList[int(listLen*0.2)], "80%:", valList[int(listLen*0.8)])

class FundDataDrawer():
    """
    read fund data from data base
    """
    def __init__(self, dbname, pwd = db_pwd):
        self.dbname = dbname
        self.pwd = pwd
        self.sqldb = SqlHelper(password = self.pwd, database = self.dbname)
    
    def getHistoryData(self, fund_code, sDate = ""):
        his_db_table = self.sqldb.select(gl_all_info_table, column_table_history, "%s='%s'" % (column_code, fund_code))
        if not his_db_table:
            print("can not find history db table")
            return
        his_db_table = his_db_table[0][0]
        if not his_db_table:
            print("history db table name is None")
            return
        dataRead = self.sqldb.select(his_db_table, [column_date, column_net_value], "%s >= '%s'" % (column_date, sDate))
        self.dates = [d[0] for d in dataRead]
        self.values = [Decimal(str(d[1] * 270)).quantize(Decimal('0.0000')) for d in dataRead]

    def draw_graph(self, x, y):
        plt.gca().get_figure().suptitle(self.fund_code)
        xlocator = mpl.ticker.MultipleLocator(20)
        plt.gca().xaxis.set_major_locator(xlocator)

        plt.xlabel(column_date)
        plt.ylabel(column_net_value)
        plt.minorticks_on()
        plt.grid(True, axis = 'y', linestyle='--', alpha=0.8)
        self.line, = plt.gca().plot(x, y, 'r-', label = self.fund_code)
        plt.legend()

    def show_history_graph(self, fund_code, sDate):
        self.fund_code = fund_code
        self.getHistoryData(fund_code, sDate)
        self.offset = 0

        #for label in plt.gca().xaxis.get_ticklabels():   
        #    label.set_rotation(45)
        #fig.autofmt_xdate(rotation = -45)

        self.draw_graph(self.dates[0:150], self.values[0:150])
        ani = animation.FuncAnimation(plt.gca().get_figure(), self.update, self.gen_data, interval=300)
        plt.show()

    def gen_data(self):
        if self.offset < 0:
            yield None,None
            return

        self.offset +=10

        endIdx = self.offset + 150
        if endIdx >= len(self.dates):
            self.offset = -1
            endIdx = len(self.dates)
            yield None,None
            return

        x = self.dates[self.offset: endIdx]
        y = self.values[self.offset: endIdx]
        yield x,y

    def update(self, data):
        x, y = data
        if x and y:
            plt.gca().clear()
            self.draw_graph(x, y)
        return self.line,

if __name__ == "__main__":
    testdb = "testdb"
    drawer = FundDataDrawer(testdb)
    drawer.show_history_graph("000217", "2016-03-01")
