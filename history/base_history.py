# Python 3
# -*- coding:utf-8 -*-
from utils import *
import requests
import json

class InfoList():
    def checkInfoTable(self, dbname, tablename):
        self.infoTable = tablename
        self.sqldb = SqlHelper(password = db_pwd, database = dbname)
        if not self.sqldb.isExistTable(tablename):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_name:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(tablename, attrs, constraint)

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.infoTable, col):
            self.sqldb.addColumn(self.infoTable, col, tp)
            
    def readAll(self):
        return self.sqldb.select(self.infoTable)

    def getRequest(self, url):
        headers = {'Host': 'fund.eastmoney.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'}
        
        proxies=None

        rsp = requests.get(url, params=headers, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

class HistoryDowloaderBase():
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        
    def checkKtable(self, ktable):
        return self.sqldb.isExistTable(ktable)

    def readKHistoryData(self, ktable):
        if not self.checkKtable(ktable):
            return
        return self.sqldb.select(ktable)

class HistoryFromSohu(HistoryDowloaderBase):
    """get history data from sohu api."""

    def setCode(self, code):
        self.code = code

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

    def getSetupDate(self):
        pass

    def getSohuCode(self):
        pass

    def getHistoryFromSohu(self, code, sDate, eDate, period = None):
        # get fund k history from sohu
        params = {'code': code}
        if sDate is not None:
            params['start'] = sDate
            params['end'] = eDate
        if period is not None:
            params['period'] = period
        response = json.loads(self.getRequest(sohuApiUrl, params))
        if not response or response[0]['status'] == 2:
            print('getHistoryFromSohu error, response: ', response)
            print('params', params)
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
            s = self.getSetupDate()

        sohudata = self.getHistoryFromSohu(self.getSohuCode(), s, e, period)
        if sohudata is None:
            return

        self.saveSohuData(ktable, sohudata, period)

    def getKHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.km_histable, 'm')
        self.getKHistoryFromSohu(self.kw_histable, 'w')
        self.getKHistoryFromSohu(self.k_histable, 'd')
        
    def getKdHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.k_histable, 'd')

    def getKwHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.kw_histable, 'w')

    def getKmHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.km_histable, 'm')
