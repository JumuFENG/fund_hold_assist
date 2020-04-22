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
        dhl = []
        for (i, d, c, h, l, o, pr, p, v, a) in kdata:
            dhl.append((d,float(h), float(l)))
        down_all = []
        up_all = []
        for i in range(0, len(dhl) - 1):
            (d1, h1, l1) = dhl[i]
            (d2, h2, l2) = dhl[i + 1]
            down_all.append((h1 - l2) / h1)
            up_all.append((h2 - l1) / l1)
        proc_obj['fluct_down'] = round(100 * sum(down_all)/len(down_all), 2)
        proc_obj['fluct_up'] = round(100 * sum(up_all)/len(up_all), 2)
        proc_obj['data_len'] = len(kdata)
        proc_obj['last_close'] = kdata[-1][2]
        lastHigh = float(kdata[-1][3]) if float(kdata[-1][3]) > float(kdata[-2][3]) else float(kdata[-2][3])
        proc_obj['last_high'] = lastHigh
        return proc_obj

    def get_all_stock_his(self):
        self.get_stocks_his()

    def get_stocks_his(self, codes = None):
        all_stock_obj = {}
        for (i,c,n,s,t,sn,sc,sd) in self.infoList:
            if codes is not None and not c in codes:
                continue

            stock_obj = {}
            sg = StockGeneral(self.sqldb, c)
            stock_obj['name'] = n
            stock_obj['type'] = t
            stock_obj['sc'] = sc.replace('亿元', '')
            #stock_obj['sd'] = sd
            mdata = self.history.readKHistoryData(sg.stockKmtable)
            if len(mdata) < 10:
                continue
            mdata = self.process_kdata(mdata)
            stock_obj['mfluct_down'] = mdata['fluct_down']
            stock_obj['mfluct_up'] = mdata['fluct_up']
            stock_obj['mlen'] = mdata['data_len']
            stock_obj['mlasthigh'] = mdata['last_high']
            stock_obj['last_close'] = mdata['last_close']
            all_stock_obj[c] = stock_obj

        return all_stock_obj

    def dump_all_stock_his(self):
        all_stock_obj = self.get_all_stock_his()
        f = open("summary/json/etf_history_data.json", 'w')
        f.write("var all_candidate_stocks = " + json.dumps(all_stock_obj) + ";")
        f.close()
