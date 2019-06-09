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
        self.dates = [d for (d,v) in dataRead]
        self.values = [Decimal(str(v)) for (d,v) in dataRead]
        if self.dates[0] == "1970-01-01":
            self.dates = self.dates[1:]
            self.values = self.values[1:]
        self.postProcessData()

    def draw_figure(self):
        plt.gca().get_figure().suptitle(self.name)
        xlocator = mpl.ticker.MultipleLocator(len(self.dates)/10)
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