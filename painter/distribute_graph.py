# Python 3
# -*- coding:utf-8 -*-

import matplotlib as mpl
import matplotlib.pyplot as plt
from utils import *

class Distribute():
    """
    Distribute of a fund or stock
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.rateCounts = {}
        self.netvalCounts = {}

    def readHistoryData(self):
        his_overviews = self.sqldb.select(gl_fund_info_table, [column_table_history, column_name], "%s='%s'" % (column_code, self.code))
        if his_overviews:
            (self.history_table, self.name), = his_overviews

        dataRead = self.sqldb.select(self.history_table, [column_growth_rate, column_net_value])
        self.rates = [round(r * 100, 2) for (r,v) in dataRead]
        self.netvalues = [v for (r,v) in dataRead]

    def processOriginalData(self):
        rates = [round(r, 1) for r in self.rates]
        for v in set(rates):
            self.rateCounts[v] = rates.count(v)
        
        netvalues = [round(v, 3) for v in self.netvalues]
        for x in set(netvalues):
            self.netvalCounts[x] = netvalues.count(x)

    def getMinMax(self, vallist):
        sortList = sorted(vallist)
        minVal = sortList[0]
        maxVal = sortList[-1]
        vlen = len(sortList)
        minMaxInfo = "min: " + str(minVal) + " max:" + str(maxVal)
        min1Val = sortList[int(vlen*0.01)]
        max1Val = sortList[-int(vlen*0.01)]
        min5Val = sortList[int(vlen*0.05)]
        max5Val = sortList[-int(vlen*0.05)]
        min10Val = sortList[int(vlen*0.1)]
        max10Val = sortList[-int(vlen*0.1)]
        min15Val = sortList[int(vlen*0.15)]
        max15Val = sortList[-int(vlen*0.15)]
        min20Val = sortList[int(vlen*0.2)]
        max20Val = sortList[-int(vlen*0.2)]
        minMaxInfo += "\n 1%: " + str(min1Val) + " < " + str(max1Val)
        minMaxInfo += "\n 5%: " + str(min5Val) + " < " + str(max5Val)
        minMaxInfo += "\n 10%: " + str(min10Val) + " < " + str(max10Val)
        minMaxInfo += "\n 15%: " + str(min15Val) + " < " + str(max15Val)
        minMaxInfo += "\n 20%: " + str(min20Val) + " < " + str(max20Val)

        return minMaxInfo

    def draw_distribute(self, code):
        self.code = code
        self.readHistoryData()
        rateInfo = self.getMinMax(self.rates)
        netvalInfo = self.getMinMax(self.netvalues)
        self.processOriginalData()
        plt.subplot(211)
        plt.bar(self.rateCounts.keys(), height=self.rateCounts.values(), width=0.1)#width=0.005, alpha=0.8,
        #plt.hist(self.rates, bins = len(set(self.rates)))
        plt.gca().text(0.01, 0.5, rateInfo, transform=plt.gca().transAxes, bbox=dict(facecolor='w', alpha=0.5))
        plt.xlabel("day increase rate: %")
        clen = len(set(self.rates))
        xlocator = mpl.ticker.MultipleLocator(1)#round((round(max(self.rates)) - round(min(self.rates)))/xticks)
        plt.gca().xaxis.set_major_locator(xlocator)
        plt.minorticks_on()

        plt.subplot(212)
        plt.bar(self.netvalCounts.keys(), height=self.netvalCounts.values(), width = 0.001)#len(set(self.rates))
        #plt.hist(self.netvalues, bins=len(set(self.netvalues)))
        plt.gca().text(0.01, 0.5, netvalInfo, transform=plt.gca().transAxes, bbox=dict(facecolor='w', alpha=0.5))
        plt.axvline(x=1.0, color="k", lw = 0.3)
        plt.gca().text(self.netvalues[-1], self.netvalues.count(self.netvalues[-1]), str(self.netvalues[-1]), color='r')
        plt.xlabel("day net value distribute")
        xlocator = mpl.ticker.MultipleLocator(0.04)#round((round(max(self.rates)) - round(min(self.rates)))/xticks)
        plt.gca().xaxis.set_major_locator(xlocator)
        plt.minorticks_on()

        plt.show()
