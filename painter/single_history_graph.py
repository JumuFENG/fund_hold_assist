# Python 3
# -*- coding:utf-8 -*-

import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.animation as animation
from decimal import Decimal
from utils import *
from painter import Painter

class SingleHistoryGraph(Painter):
    """show history graph for single history."""
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = code
        self.info_text = ""
        self.cursXidx = 0

    def getGlobalInfoTableName(self):
        pass

    def getHisTableNameToRead(self):
        return column_table_history
       
    def getColsToRead(self):
        pass

    def postProcessData(self):
        pass

    def drawAdditionalLines(self):
        pass

    def unpackDataRead(self, dataRead):
        pass

    def readHistoryData(self):
        tablename = self.getGlobalInfoTableName()
        historytablecolname = self.getHisTableNameToRead()
        his_overviews = self.sqldb.select(tablename, [historytablecolname, column_name], "%s='%s'" % (column_code, self.code))
        if his_overviews:
            (self.history_table, self.name), = his_overviews

        if not self.history_table:
            print("history db table name is None")
            return

        if not self.sqldb.isExistTable(self.history_table):
            print("history db table not exists.")
            return

        cols = self.getColsToRead()

        dataRead = self.sqldb.select(self.history_table, cols, "%s is not NULL" % cols[1], order = " ORDER BY %s ASC" % column_date)

        self.unpackDataRead(dataRead)

        if self.dates[0] == "1970-01-01":
            self.dates = self.dates[1:]
            self.values = self.values[1:]
            self.rates = self.rates[1:] if len(self.rates) > 0 else self.rates
        self.postProcessData()

    def draw_figure(self):
        plt.suptitle(self.name, fontproperties="Microsoft YaHei")
        xlocator = mpl.ticker.MultipleLocator(len(self.dates)/10 if len(self.dates) > 50 else 10)
        plt.gca().xaxis.set_major_locator(xlocator)

        info_posx = self.dates[self.cursXidx]
        plt.gca().text(info_posx, self.values[self.cursXidx], self.info_text)

        plt.xlabel(column_date)

        plt.minorticks_on()
        plt.grid(True, axis = 'y', linestyle='--', alpha=0.8)
        self.line, = plt.gca().plot(self.dates, self.values, 'r-', label = self.code)
        cursY = 0
        if info_posx:
            plt.axvline(x=info_posx, ls = '-.', lw = 0.5, color='b', alpha = 0.8)
            cursY = self.values[self.cursXidx]
            plt.axhline(y = cursY, ls = '-.', lw = 0.5, color='b', alpha = 0.8)

        self.drawAdditionalLines()

        plt.legend()

    def on_motion(self, event):
        self.moving_on_figure = True
        if not event.xdata:
            self.info_text = ""
            return
        xIdx = int(round(event.xdata))
        if xIdx < 0 or xIdx >= len(self.dates):
            self.info_text = ""
            return

        self.info_text = "%s\n%s" % (self.dates[xIdx], str(self.values[xIdx]))
        self.cursXidx = xIdx

    def getMinMaxInfo(self, vallist, saveAsRate = False):
        sortList = sorted(vallist)
        minVal = sortList[0]
        maxVal = sortList[-1]
        vlen = len(sortList)
        minMaxInfo = "min: " + str(minVal) + " max:" + str(maxVal)
        min1Val = sortList[int(vlen*0.005)]
        max1Val = sortList[-int(vlen*0.005)]
        min5Val = sortList[int(vlen*0.025)]
        max5Val = sortList[-int(vlen*0.025)]
        min10Val = sortList[int(vlen*0.05)]
        max10Val = sortList[-int(vlen*0.05)]
        min15Val = sortList[int(vlen*0.1)]
        max15Val = sortList[-int(vlen*0.1)]
        min20Val = sortList[int(vlen*0.2)]
        max20Val = sortList[-int(vlen*0.2)]
        minMaxInfo += "\n 99%: (" + str(min1Val) + ", " + str(max1Val) + ")"
        minMaxInfo += "\n 95%: (" + str(min5Val) + ", " + str(max5Val) + ")"
        minMaxInfo += "\n 90%: (" + str(min10Val) + ", " + str(max10Val) + ")"
        minMaxInfo += "\n 80%: (" + str(min15Val) + ", " + str(max15Val) + ")"
        minMaxInfo += "\n 60%: (" + str(min20Val) + ", " + str(max20Val) + ")"

        if saveAsRate and self.sqldb.isExistTable(gl_all_funds_info_table):
            if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_shortterm_rate):
                self.sqldb.addColumn(gl_all_funds_info_table, column_shortterm_rate, 'varchar(10) DEFAULT NULL')
            short_term_rate = max5Val
            if maxVal - minVal >= 10:
                short_term_rate = max10Val
            short_term_rate = round(short_term_rate/100, 4)
            self.sqldb.update(gl_all_funds_info_table, {column_shortterm_rate:str(short_term_rate)}, {column_code: self.code})

        return minMaxInfo

    def getOriginalNetVal(self):
        pass

    def getNetValTickWidth(self):
        pass

    def getNetValBarWidth(self):
        pass

    def getRoundedValues(self, values):
        pass

    def getRateTickWidth(self):
        return 1

    def getRateBarWidth(self):
        return 0.075

    def getRoundedRates(self, values):
        return [round(r, 1) for r in values]

    def drawDistribute(self, vallist, barw, xOriginal, info_text, xlabel, tickWidth):
        valCounts = {}
        for v in set(vallist):
            valCounts[v] = vallist.count(v)
        plt.bar(valCounts.keys(), height=valCounts.values(), width=barw)
        #plt.hist(vallist, bins = len(set(vallist)))
        plt.gca().text(0.01, 0.5, info_text, transform=plt.gca().transAxes, bbox=dict(facecolor='w', alpha=0.5))
        if xOriginal or xOriginal == 0:
            plt.axvline(x=xOriginal, color="k", lw = 0.5)
        plt.gca().text(vallist[-1], vallist.count(vallist[-1]), str(vallist[-1]), color='r')
        plt.xlabel(xlabel)
        xlocator = mpl.ticker.MultipleLocator(tickWidth)
        plt.gca().xaxis.set_major_locator(xlocator)
        plt.minorticks_on()

    def show_distribute(self):
        self.readHistoryData()

        plt.subplot(211)
        if len(self.rates) > 0:
            rateInfo = self.getMinMaxInfo(self.rates, True)
            rates = self.getRoundedRates(self.rates)
            lblText = str(len(self.rates)) + " day growth rate: %"
            tickWidth = self.getRateTickWidth()
            barWidth = self.getRateBarWidth()
            self.drawDistribute(rates, barWidth, 0, rateInfo, lblText, tickWidth)

        netvalInfo = self.getMinMaxInfo(self.values)
        netvalues = self.getRoundedValues(self.values)
        plt.subplot(212)
        lblText = str(len(netvalues)) + " days net value distribute"
        netOriginal = self.getOriginalNetVal()
        tickWidth = self.getNetValTickWidth()
        barWidth = self.getNetValBarWidth()
        self.drawDistribute(netvalues, barWidth, netOriginal, netvalInfo, lblText, tickWidth)

        plt.suptitle(self.name + "(" + self.code + ")", fontproperties="Microsoft YaHei")
        plt.show()
