# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import requests
import html
import os
import re
import time
import json
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup

class StockDumps():
    def __init__(self):
        self.history = Stock_history()
        astk = AllStocks()
        self.sqldb = astk.sqldb
        self.infoList = astk.readAll()

    def process_kdata(self, kdata):
        proc_obj = {}
        delta_all = []
        for (i, d, c, h, l, o, pr, p, v, a) in kdata:
            delta = float(h) - float(l)
            delta_all.append(delta / float(h))
        proc_obj['aver_fluct'] = round(sum(delta_all)/len(delta_all), 4)
        proc_obj['last_close'] = kdata[-1][2]
        return proc_obj

    def get_all_stock_his(self):
        all_stock_obj = {}
        for (i,c,n,s,t,sn,sc,sd) in self.infoList:
            stock_obj = {}
            sg = StockGeneral(self.sqldb, c)
            stock_obj['name'] = n
            stock_obj['type'] = t
            stock_obj['sc'] = sc
            stock_obj['sd'] = sd
            mdata = self.process_kdata(self.history.readKHistoryData(sg.stockKmtable))
            stock_obj['maver_fluct'] = mdata['aver_fluct']
            stock_obj['last_close'] = mdata['last_close']
            all_stock_obj[c] = stock_obj

        f = open("summary/json/etf_history_data.json", 'w')
        f.write("var all_stocks = " + json.dumps(all_stock_obj) + ";")
        f.close()
