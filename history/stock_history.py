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

    def requsetEtfListData(self, pz):
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
            return requsetEtfListData(etflist['data']['total'])

        return etflist['data']['diff']

    def loadAllETFFunds(self):
        self.check_table_column(column_type, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_short_name, 'varchar(255) DEFAULT NULL')
        self.check_table_column(column_assets_scale, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_setup_date, 'varchar(20) DEFAULT NULL')

        etflist = self.requsetEtfListData(1000)
        if etflist is None:
            return

        attrs = [column_name, column_type, column_short_name, column_setup_date, column_assets_scale]
        conds = [column_code]
        allEtfInfo = []
        for e in etflist:
            tp = e['f13']
            code = ('SH' if e['f13'] == 1 else 'SZ') + e['f12']
            name = e['f14']
            etfInfo = self.getEtfInfo(code)
            if etfInfo is None:
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, 'ETF')
                continue
            (short_name, setup_date, assets_scale) = etfInfo
            allEtfInfo.append([name, 'ETF', short_name, setup_date, assets_scale, code])
        self.sqldb.insertUpdateMany(gl_all_stocks_info_table, attrs, conds, allEtfInfo)

    def getEtfInfo(self, code):
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

    def loadEtfInfo(self, code):
        etfInfo = self.getEtfInfo(code)
        if etfInfo is None:
            return

        (short_name, setup_date, assets_scale) = etfInfo
        self.updateStockCol(code, column_setup_date, setup_date)
        self.updateStockCol(code, column_assets_scale, assets_scale)
        self.updateStockCol(code, column_short_name, short_name)

class Stock_history(HistoryDowloaderBase):
    """
    get stock history data
    """
    def setCode(self, code):
        self.code = code
        allstocks = AllStocks()
        self.sg = StockGeneral(allstocks.sqldb, self.code)

    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getStartEnd(self, ktable):
        eDate = datetime.now().strftime("%Y%m%d")
        sDate = None
        if not self.sqldb.isExistTable(ktable):
            return (sDate, eDate)

        maxDate = self.sqldb.select(ktable, "max(%s)" % column_date)
        if maxDate is None or not len(maxDate) == 1:
            return (sDate, eDate)

        (maxDate,), = maxDate
        if maxDate is None:
            return (sDate, eDate)

        sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y%m%d")
        if sDate > eDate:
            print("Already updated to %s" % maxDate)
            return

        if datetime.strptime(eDate, "%Y%m%d") - datetime.strptime(sDate, "%Y%m%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y%m%d").weekday() >= 5:
            print("it is weekend, no data to update.")
            return

        return (sDate, eDate)

    def getHistoryFromSohu(self, code, sDate, eDate, period = None):
        # get fund k history from sohu
        parans = {'code': code, 'start': sDate, 'end': eDate}
        if period is not None:
            parans['period'] = period
        response = json.loads(self.getRequest(sohuApiUrl, parans))
        if not response or response[0]['status'] == 2:
            print('getHistoryFromSohu error, response: ', response)
            print('parans', parans)
            return

        response = response[0]['hq']
        response.reverse()
        return response

    def isSamePeriod(self, d1, d2, period):
        if period == 'd':
            return d1 == d2
        dt1 = datetime.strptime(d1, '%Y-%m-%d')
        dt2 = datetime.strptime(d2, '%Y-%m-%d')
        if period == 'w':
            dt3 = dt1 + timedelta(days = 6 - dt1.timetuple().tm_wday)
            return dt1 <= dt2 and dt2 <= dt3
        if period == 'm':
            return dt1.timetuple().tm_mon == dt2.timetuple().tm_mon

        return False

    def samePeriodWithLastRec(self, ktable, kdata, period):
        lastRow = self.sqldb.select(ktable, ['id', column_date], order = ' ORDER BY %s DESC LIMIT 1' % column_date)
        if lastRow is None or len(lastRow) == 0:
            return False
        (lid, ldate), = lastRow
        (d,o,c,pr,p,l,h,v,a,x) = kdata
        if self.isSamePeriod(ldate, d, period) and d >= ldate:
            self.sqldb.update(ktable, {column_date: d, column_close: c, column_high: h, column_low: l, column_open: o, column_price_change: pr, column_p_change: p, column_volume: v, column_amount: a}, {'id': lid})
            return True
        return False

    def saveSohuData(self, ktable, data, period):
        headers = [column_date, column_close, column_high, column_low, column_open, column_price_change, column_p_change, column_volume, column_amount]
        if not self.sqldb.isExistTable(ktable):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(ktable, attrs, constraint)

        if len(data) < 1:
            return

        if self.samePeriodWithLastRec(ktable, data[0], period):
            data = data[1:]

        values = []
        for (d,o,c,pr,p,l,h,v,a,x) in data:
            values.append([d,c,h,l,o,pr,p.strip('%'),v,a])
        self.sqldb.insertMany(ktable, headers, values)

    def getKHistoryFromSohu(self, ktable, period):
        se = self.getStartEnd(ktable)
        if se is None:
            return
        (s, e) = se
        if s is None:
            s = (datetime.strptime(self.sg.setupdate, "%Y-%m-%d")).strftime("%Y%m%d")

        sohudata = self.getHistoryFromSohu(self.sg.sohucode, s, e, period)
        if sohudata is None:
            return

        self.saveSohuData(ktable, sohudata, period)

    def getKHistoryTillToday(self, code):
        # get fund k history from sohu
        self.setCode(code)
        self.getKHistoryFromSohu(self.sg.stockKtable, 'd')
        self.getKHistoryFromSohu(self.sg.stockKwtable, 'w')
        self.getKHistoryFromSohu(self.sg.stockKmtable, 'm')

    def getKmHistoryTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.sg.stockKmtable, 'm')

    def readKHistoryData(self, ktable):
        return self.sqldb.select(ktable)
