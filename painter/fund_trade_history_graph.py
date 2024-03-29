# Python 3
# -*- coding:utf-8 -*-

from utils import *
from user import *
from painter import FundHistoryGraph
from decimal import Decimal
import matplotlib.pyplot as plt

class FundTradeHistoryGraph(FundHistoryGraph):
    """draw fund trade history graph"""
    def __init__(self, sqldb, userfund, allTrade = False):
        super(FundTradeHistoryGraph, self).__init__(sqldb, userfund.code)
        self.ppg = 1 if not ppgram.__contains__(self.code) else ppgram[self.code]
        self.userfund = userfund
        self.allTrade = allTrade
        self.dates_buy = None
        self.dates_buy_sold = None
        self.dates_sell = None
        
    def postProcessData(self):
        self.average = 0 if not self.userfund.average else Decimal(str(self.userfund.average))

        buytable = self.userfund.buy_table
        sDate = None
        if self.sqldb.isExistTable(buytable):
            sDate = self.sqldb.selectOneValue(buytable, "min(%s)" % column_date, "%s = 0" % column_soldout if not self.allTrade else "")
        if not sDate:
            sDate = ""

        if self.dates.__contains__(sDate):
            sDateIdx = self.dates.index(sDate)
            self.dates = self.dates[sDateIdx:]
            self.values = self.values[sDateIdx:]

        if not self.ppg == 1:
            self.values = [self.ppg * v for v in self.values]
            self.average = self.ppg * Decimal(str(self.average))

        if not self.average == 0:
            self.earn_percent = str(((Decimal(str(self.values[-1])) - self.average) * 100/self.average).quantize(Decimal("0.0000"))) + "%"

        if self.sqldb.isExistTable(buytable):
            dates_buy = self.sqldb.select(buytable, [column_date], ["%s >= '%s'" % (column_date, sDate), "%s = 0" % column_soldout])
            self.dates_buy = [d for (d,) in dates_buy]
            self.values_buy = [self.values[self.dates.index(d)] for d in self.dates_buy]

            dates_buy_sold = self.sqldb.select(buytable, [column_date], ["%s >= '%s'" % (column_date, sDate), "%s = 1" % column_soldout])
            self.dates_buy_sold = [d for (d,) in dates_buy_sold]
            self.values_buy_sold = [self.values[self.dates.index(d)] for d in self.dates_buy_sold]

        selltable = self.userfund.sell_table
        if self.sqldb.isExistTable(selltable):
            dates_sell = self.sqldb.select(selltable, [column_date], "%s >= '%s'" % (column_date, sDate))
            self.dates_sell = [d for (d,) in dates_sell]
            self.values_sell = [self.values[self.dates.index(d)] for d in self.dates_sell]

    def drawAdditionalLines(self):
        info_posx = self.dates[self.cursXidx]
        latestVal = Decimal(str(self.values[-1]))
        if not self.average == 0:
            plt.axhline(y=self.average, ls = '-', lw = 0.75, color = 'r', alpha = 0.5)
            plt.gca().text(self.dates[0], self.average, str(self.average))
            plt.axhline(y=self.values[-1], ls = '-', lw = 0.75, color = 'r', alpha = 0.5)
            plt.axvline(x=self.dates[-1], ls = '-.', lw = 0.5, color='r', alpha = 0.8)
            plt.gca().text(self.dates[-1], (self.average + latestVal)/2, self.earn_percent)
        cursY = self.values[self.cursXidx]
        if not self.average == 0 and not cursY == 0:
            plt.gca().text(info_posx, (Decimal(cursY) + self.average)/2, str((((Decimal(cursY) - self.average) * 100/self.average)).quantize(Decimal("0.0000"))) + "%")
            if not self.values[-1] == cursY:
                plt.gca().text(info_posx, (Decimal(cursY) + latestVal)/2, str(((latestVal - Decimal(cursY)) * 100/Decimal(cursY)).quantize(Decimal("0.0000"))) + "%")
        if self.dates_buy:
            plt.scatter(self.dates_buy, self.values_buy, c = 'r')
        if self.dates_buy_sold:
            plt.scatter(self.dates_buy_sold, self.values_buy_sold, c = 'w', edgecolors = 'r')
        if self.dates_sell:
            plt.scatter(self.dates_sell, self.values_sell, c = 'k')

    def show_distribute(self):
        print("call FundHistoryGraph.show_distribute")
