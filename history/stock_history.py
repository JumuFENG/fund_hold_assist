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

class AllStocks(InfoList):
    """get all stocks' general info and save to db table allstoks"""
    def __init__(self):
        self.checkInfoTable(stock_db_name, gl_all_stocks_info_table)
        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')

    def loadInfo(self, code):
        url = "http://quote.eastmoney.com/" + code.lower() + ".html"
        c = self.getRequest(url)
        if c is None:
            print("getRequest", url, "failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        hdr2 = soup.find('span',{'class':'quote_title_0 wryh'})
        if not hdr2:
            print("can not find html element with 'class':'header-title-h2 fl','id':'name'")

        code = code.upper()
        name = hdr2.get_text()
        self.updateStockCol(code, column_name, name)

    def updateStockCol(self, code, col, val):
        stockinfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, col], "%s = '%s'" % (column_code, code))
        if stockinfo is None or len(stockinfo) == 0:
            self.sqldb.insert(gl_all_stocks_info_table, {col: val, column_code: code})
        else:
            (c, l), = stockinfo
            if l == val:
                return
            self.sqldb.update(gl_all_stocks_info_table, {col: val}, {column_code: code})

    def getTimeStamp(self):
        curTime = datetime.now()
        stamp = time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond
        return int(stamp)

    def requestEtfListData(self, pz):
        # data src: http://quote.eastmoney.com/center/gridlist.html#fund_etf
        timestamp = self.getTimeStamp()
        cbstr = 'etfcb_' + str(timestamp)
        etfListUrl = 'http://36.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = self.getRequest(etfListUrl)
        if c is None:
            print("get etf list failed")
            return

        etflist = json.loads(c[len(cbstr) + 1 : -2])
        if etflist is None:
            print('load ETF Data wrong!')
            return

        if etflist['data']['total'] > pz:
            print('total more than', pz, 'retry')
            return requestEtfListData(etflist['data']['total'])

        return etflist['data']['diff']

    def loadAllFunds(self, ftype):
        self.check_table_column(column_type, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_short_name, 'varchar(255) DEFAULT NULL')
        self.check_table_column(column_assets_scale, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_setup_date, 'varchar(20) DEFAULT NULL')

        fundList = None
        if ftype == 'ETF':
            fundList = self.requestEtfListData(1000)
        elif ftype == 'LOF':
            fundList = self.requestLofListData(1000)
        if fundList is None:
            return

        attrs = [column_name, column_type, column_short_name, column_setup_date, column_assets_scale]
        conds = [column_code]
        allFundInfo = []
        for e in fundList:
            tp = e['f13']
            code = ('SH' if e['f13'] == 1 else 'SZ') + e['f12']
            name = e['f14']
            fundInfo = self.getFundInfo(code)
            if fundInfo is None:
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, ftype)
                continue
            (short_name, setup_date, assets_scale) = fundInfo                
            allFundInfo.append([name, ftype, short_name, setup_date, assets_scale, code])
        self.sqldb.insertUpdateMany(gl_all_stocks_info_table, attrs, conds, allFundInfo)

    def getFundInfo(self, code):
        ucode = code
        if ucode.startswith('SZ') or ucode.startswith('SH'):
            ucode = ucode[2:]
        url = 'http://fund.eastmoney.com/f10/' + ucode + '.html'

        c = self.getRequest(url)
        if c is None:
            print("getRequest", url, "failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        infoTable = soup.find('table', {'class':'info'})
        if infoTable is None:
            return

        rows = infoTable.find_all('tr')
        tr0 = rows[0].find_all('td')
        short_name = tr0[1].get_text()
        tr2 = rows[2].find_all('td')
        setup_date = tr2[1].get_text().split()[0]
        setup_date = setup_date.replace('年', '-')
        setup_date = setup_date.replace('月', '-')
        setup_date = setup_date.replace('日', '')
        tr3 = rows[3].find_all('td')
        assets_scale = tr3[0].get_text().split('（')[0]
        return (short_name, setup_date, assets_scale)

    def loadFundInfo(self, code):
        fundInfo = self.getFundInfo(code)
        if fundInfo is None:
            return

        (short_name, setup_date, assets_scale) = fundInfo
        self.updateStockCol(code, column_setup_date, setup_date)
        self.updateStockCol(code, column_assets_scale, assets_scale)
        self.updateStockCol(code, column_short_name, short_name)

    def requestLofListData(self, pz):
        # data src: http://quote.eastmoney.com/center/gridlist.html#fund_lof
        timestamp = self.getTimeStamp()
        cbstr = 'lofcb_' + str(timestamp)
        lofListUrl = 'http://40.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0404,b:MK0405,b:MK0406,b:MK0407&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = self.getRequest(lofListUrl)
        if c is None:
            print("get lof list failed")
            return

        loflist = json.loads(c[len(cbstr) + 1 : -2])
        if loflist is None:
            print('load LOF Data wrong!')
            return

        if loflist['data']['total'] > pz:
            print('total more than', pz, 'retry')
            return requestLofListData(loflist['data']['total'])

        return loflist['data']['diff']

class Stock_history(HistoryFromSohu):
    """
    get stock history data
    """
    def setCode(self, code):
        super().setCode(code)
        allstocks = AllStocks()
        self.sg = StockGeneral(allstocks.sqldb, self.code)
        self.km_histable = self.sg.stockKmtable
        self.kw_histable = self.sg.stockKwtable
        self.k_histable = self.sg.stockKtable

    def getSetupDate(self):
        return (datetime.strptime(self.sg.setupdate, "%Y-%m-%d")).strftime("%Y%m%d")

    def getSohuCode(self):
        return self.sg.sohucode
