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

class StockDumps(KdataDumps):
    def __init__(self):
        self.history = Stock_history()
        self.allstk = AllStocks()
        self.sqldb = self.allstk.sqldb
        self.infoList = self.allstk.readAll()

    def fetchAllEtf(self):
        self.allstk.loadAllFunds('ETF')
        self.infoList = self.allstk.readAll()

    def fetchAllLof(self):
        self.allstk.loadAllFunds('LOF')
        self.infoList = self.allstk.readAll()

    def get_km_table(self, code):
        sg = StockGeneral(self.sqldb, code)
        return sg.stockKmtable

    def get_kw_table(self, code):
        sg = StockGeneral(self.sqldb, code)
        return sg.stockKwtable

    def get_kd_table(self, code):
        sg = StockGeneral(self.sqldb, code)
        return sg.stockKdtable

    def get_his(self, codes = None):
        all_stock_obj = {}
        
        for (i,c,n,s,t,sn,sc,sd) in self.infoList:
            if codes is not None and not c in codes:
                continue

            stock_obj = {}
            stock_obj['name'] = n
            stock_obj['type'] = t
            stock_obj['sc'] = sc.replace('亿元', '')
            #stock_obj['sd'] = sd
            mdata = self.read_km_data(c)
            if mdata is None or len(mdata) < 10:
                continue
            mdata = self.process_kdata(mdata)
            stock_obj['mfluct_down'] = mdata['fluct_down']
            stock_obj['mfluct_up'] = mdata['fluct_up']
            stock_obj['mlen'] = mdata['data_len']
            stock_obj['mlasthigh'] = mdata['last_high']
            stock_obj['mlastlow'] = mdata['last_low']
            stock_obj['last_close'] = mdata['last_close']
            all_stock_obj[c] = stock_obj

        return all_stock_obj

    def check_khistory_table_exists(self):
        cnt = 0
        ocnt = 0
        for (i,c,n,s,t,sn,sc,sd) in self.infoList:
            sg = StockGeneral(self.sqldb, c)
            if not self.history.checkKtable(sg.stockKmtable):
                cnt += 1
                print(c, t, n, sn)
            else:
                ocnt += 1
        print(cnt, ocnt)

    def dump_all_stock_his(self):
        all_stock_obj = self.get_all_his()
        f = open("summary/json/etf_history_data.json", 'w')
        f.write("var all_candidate_stocks = " + json.dumps(all_stock_obj) + ";")
        f.close()
