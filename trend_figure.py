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
        self.info_text = ""
        self.cursXidx = 0
        self.moving_on_figure = False
        self.dates_buy = None
        self.dates_buy_sold = None
        self.dates_sell = None

    def getHistoryData(self, fund_code, sDate = ""):
        fund_overviews = self.sqldb.select(gl_all_info_table, [column_table_history, column_name, column_buy_table, column_sell_table, column_averagae_price], "%s='%s'" % (column_code, fund_code))
        if not fund_overviews:
            print("can not find history db table")
            return
        ((his_db_table, name, buytable, selltable, average),) = fund_overviews
        self.average = 0 if not average else self.ppg * Decimal(str(average))
        self.name = "" if not name else name

        if not his_db_table:
            print("history db table name is None")
            return

        if not self.sqldb.isExistTable(his_db_table):
            print("history db table not exists.")
            return

        dataRead = self.sqldb.select(his_db_table, [column_date, column_net_value], "%s >= '%s'" % (column_date, sDate))
        self.dates = [d for (d,v) in dataRead]
        self.values = [Decimal(str(v * self.ppg)).quantize(Decimal('0.0000')) for (d,v) in dataRead]
        self.info_text = ""

        if self.sqldb.isExistTable(buytable):
            dates_buy = self.sqldb.select(buytable, [column_date], ["%s >= '%s'" % (column_date, sDate), "%s = 0" % column_soldout])
            self.dates_buy = [d for (d,) in dates_buy]
            dates_buy_sold = self.sqldb.select(buytable, [column_date], ["%s >= '%s'" % (column_date, sDate), "%s = 1" % column_soldout])
            self.dates_buy_sold = [d for (d,) in dates_buy_sold]

        if self.sqldb.isExistTable(selltable):
            dates_sell = self.sqldb.select(selltable, [column_date], "%s >= '%s'" % (column_date, sDate))
            self.dates_sell = [d for (d,) in dates_sell]
        #print(self.dates[0], self.dates_buy_sold[0])

    def draw_graph(self, x, y):
        plt.gca().get_figure().suptitle(self.name)
        xlocator = mpl.ticker.MultipleLocator(10)
        plt.gca().xaxis.set_major_locator(xlocator)
        info_posx = self.dates[self.cursXidx]
        plt.gca().text(info_posx, self.values[self.cursXidx], self.info_text)

        plt.xlabel(column_date)
        plt.ylabel(column_net_value)
        plt.minorticks_on()
        plt.grid(True, axis = 'y', linestyle='--', alpha=0.8)
        self.line, = plt.gca().plot(x, y, 'r-', label = self.fund_code)
        cursY = 0
        if info_posx:
            plt.axvline(x=info_posx, ls = '-.', lw = 0.5, color='b', alpha = 0.8)
            cursY = self.values[self.cursXidx]
            plt.axhline(y = cursY, ls = '-.', lw = 0.5, color='b', alpha = 0.8)
        if not self.average == 0:
            plt.axhline(y=self.average, ls = '-', lw = 0.75, color = 'r', alpha = 0.5)
            plt.gca().text(self.dates[0], self.average, str(self.average))
            plt.axhline(y=self.values[-1], ls = '-', lw = 0.75, color = 'r', alpha = 0.5)
            plt.axvline(x=self.dates[-1], ls = '-.', lw = 0.5, color='r', alpha = 0.8)
            plt.gca().text(self.dates[-1], (self.average + self.values[-1])/2, str(((self.values[-1] - self.average) * 100/self.average).quantize(Decimal("0.0000"))) + "%")
        if not self.average == 0 and not cursY == 0:
            plt.gca().text(info_posx, (Decimal(cursY) + self.average)/2, str((((Decimal(cursY) - self.average) * 100/self.average)).quantize(Decimal("0.0000"))) + "%")
            if not self.values[-1] == cursY:
                plt.gca().text(info_posx, (Decimal(cursY) + self.values[-1])/2, str(((self.values[-1] - Decimal(cursY)) * 100/Decimal(cursY)).quantize(Decimal("0.0000"))) + "%")
        if self.dates_buy:
            plt.scatter(self.dates_buy, [self.values[self.dates.index(d)] for d in self.dates_buy], c = 'r')
        if self.dates_buy_sold:
            plt.scatter(self.dates_buy_sold, [self.values[self.dates.index(d)] for d in self.dates_buy_sold], c = 'w', edgecolors = 'r')
        if self.dates_sell:
            plt.scatter(self.dates_sell, [self.values[self.dates.index(d)] for d in self.dates_sell], c = 'k')
        plt.legend()

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

    def gen_data_onclick(self):
        if not self.moving_on_figure:
            yield None,None
            return
        yield self.dates, self.values

    def update_onclick(self, data):
        x,y = data
        if x and y:
            plt.gca().clear()
            self.draw_graph(x, y)
            self.moving_on_figure = False
        return self.line,

    def on_motion(self, event):
        if not event.xdata:
            self.info_text = ""
            return
        xIdx = int(round(event.xdata))
        if xIdx < 0 or xIdx >= len(self.dates):
            self.info_text = ""
            return

        self.info_text = "%s\n%s" % (self.dates[xIdx], str(self.values[xIdx]))
        self.cursXidx = xIdx
        self.moving_on_figure = True

    def enter_figure(self, event):
        self.cidmotion = plt.gca().get_figure().canvas.mpl_connect('motion_notify_event', self.on_motion)

    def leave_figure(self, event):
        self.info_text = ""
        plt.gca().get_figure().canvas.mpl_disconnect(self.cidmotion)

    def show_history_graph(self, fund_code, sDate):
        self.fund_code = fund_code
        self.ppg = 1 if not ppgram.__contains__(self.fund_code) else ppgram[self.fund_code]
        self.getHistoryData(fund_code, sDate)
        mpl.rcParams['font.sans-serif'] = ['SimHei'] #指定默认字体 SimHei为黑体
        self.draw_graph(self.dates, self.values)
        plt.gca().get_figure().canvas.mpl_connect('figure_enter_event', self.enter_figure)
        plt.gca().get_figure().canvas.mpl_connect('figure_leave_event', self.leave_figure)
        #plt.gca().get_figure().canvas.mpl_connect('axes_enter_event', self.enter_figure)
        #plt.gca().get_figure().canvas.mpl_connect('axes_leave_event', self.leave_figure)
        ani = animation.FuncAnimation(plt.gca().get_figure(), self.update_onclick, self.gen_data_onclick, interval=100)
        plt.show()


if __name__ == "__main__":
    testdb = "fund_center"
    #testdb = "testdb"
    drawer = FundDataDrawer(testdb)
    #drawer.show_history_graph("110003", "2019-04-01")
    drawer.show_history_graph("000217", "2019-04-01")
