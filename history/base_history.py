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
            attrs = {column_code:'varchar(20) UNIQUE NOT NULL', column_name:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(tablename, attrs, constraint)

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
        self.colheaders = [column_date, column_close, column_high, column_low, column_open, column_price_change, column_p_change, column_volume, column_amount]

    def getValidKltype(self, klt):
        if klt == 'd':
            return '101'
        if klt == 'w':
            return '102'
        if klt == 'm':
            return '103'
        return klt

    def checkKtable(self, ktable):
        return self.sqldb.isExistTable(ktable)

    def setupKtable(self, ktable):
        if not self.sqldb.isExistTable(ktable):
            attrs = {}
            for c in self.colheaders:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(ktable, attrs, constraint)

    def readKHistoryData(self, ktable, length = 0, start = None):
        if not self.checkKtable(ktable):
            return

        if start is not None:
            if '-' not in start:
                start = datetime.strptime(start, '%Y%m%d').strftime('%Y-%m-%d')
            return self.sqldb.select(ktable, conds=f'{column_date} >= "{start}"')

        if length > 0:
            return tuple(reversed(self.sqldb.select(ktable, order=f'order by {column_date} DESC limit {length}')))
            # return self.sqldb.select(ktable, f'* from (select * ', order=f'order by {column_date} DESC limit {length}) as tbl order by {column_date} ASC') # slower

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
        endDate = Utils.today_date()
        eDate = datetime.strptime(endDate, '%Y-%m-%d').strftime("%Y%m%d")
        sDate = None
        if not self.sqldb.isExistTable(ktable):
            return (sDate, eDate)

        maxDate = self.sqldb.selectOneValue(ktable, "max(%s)" % column_date)
        if maxDate is None:
            return (sDate, eDate)

        startDate = TradingDate.nextTradingDate(maxDate)
        sDate = datetime.strptime(startDate, '%Y-%m-%d').strftime("%Y%m%d")
        days = TradingDate.calcTradingDays(maxDate, endDate)
        if days > 1:
            return (sDate, eDate)

        if startDate == maxDate:
            # Already updated
            return

        if days == 1 and TradingDate.isTradingDate(startDate) and datetime.now().hour >= 15:
            return (sDate, eDate)

        # if datetime.strptime(eDate, "%Y%m%d") - datetime.strptime(sDate, "%Y%m%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y%m%d").weekday() >= 5:
        #     Utils.log("it is weekend, no data to update.", Utils.Warn)
        #     return

    def getSetupDate(self):
        pass

    def getSohuCode(self):
        pass

    def getEmSecCode(self):
        pass

    def getHistoryFailed(self):
        pass

    def getHistoryFromSohu(self, code, sDate, eDate, period = None):
        ''' get k history from sohu
        '''
        params = {'code': code}
        if sDate is not None:
            params['start'] = sDate
            params['end'] = eDate
        if period is not None:
            params['period'] = period

        try:
            response = json.loads(self.getRequest(sohuApiUrl, params))
            if not response or response[0]['status'] == 2:
                Utils.log(f'getHistoryFromSohu error, response: {response}. params: {params}', Utils.Err)
                return

            response = response[0]['hq']
            response.reverse()
            return response
        except requests.ConnectionError as ce:
            Utils.log(f'getHistoryFromSohu ConnectionError, params: {params}')
            return
        except Exception as e:
            Utils.log(f'getHistoryFromSohu Exception, params: {params}')
            return

    def isSamePeriod(self, d1, d2, period):
        if d1 == '' and d2 == '':
            return True

        if d1 == '' or d2 == '':
            return False

        if period == 'w' or period == '102' or period == 'm' or period == '103':
            dt1 = datetime.strptime(d1, '%Y-%m-%d')
            dt2 = datetime.strptime(d2, '%Y-%m-%d')
            if period == 'w' or period == '102':
                dt3 = dt1 + timedelta(days = 6 - dt1.timetuple().tm_wday)
                return dt1 <= dt2 and dt2 <= dt3
            if period == 'm' or period == '103':
                return dt1.timetuple().tm_mon == dt2.timetuple().tm_mon

        return d1 == d2

    def getLastRecDate(self, ktable, kdata, period):
        '''
        discard old data, update last on record, return new data
        '''
        lastRow = self.sqldb.select(ktable, ['id', column_date], order = ' ORDER BY %s DESC LIMIT 1' % column_date)
        if lastRow is None or len(lastRow) == 0:
            return ('', ''),
        return lastRow

    def saveSohuData(self, ktable, data, period):
        if len(data) < 1:
            return

        self.setupKtable(ktable)

        (lid, ldate), = self.getLastRecDate(ktable, data, period)
        values = []
        for i in range(0, len(data)):
            if data[i][0] < ldate:
                continue

            if len(data[i]) == 11:
                d,o,c,pr,p,l,h,v,a,_x,_y = data[i]
            elif len(data[i]) == 10:
                d,o,c,pr,p,l,h,v,a,_x = data[i]
            else:
                Utils.log(f'cannot parse data {data[i]}')
                continue

            if self.isSamePeriod(ldate, d, period) and d >= ldate:
                self.sqldb.update(ktable, {column_date: d, column_close: c, column_high: h, column_low: l, column_open: o, column_price_change: pr, column_p_change: p, column_volume: v, column_amount: a}, {'id': lid})
            else:
                values.append([d,c,h,l,o,pr,p.strip('%'),v,a])

        self.sqldb.insertMany(ktable, self.colheaders, values)

    def getKHistoryFromSohu(self, ktable, period):
        se = self.getStartEnd(ktable)
        if se is None:
            return
        (s, e) = se
        if s is None:
            s = self.getSetupDate()

        sohudata = self.getHistoryFromSohu(self.getSohuCode(), s, e, period)
        if sohudata is None:
            self.getHistoryFailed()
            return

        self.saveSohuData(ktable, sohudata, period)

    def getKHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.km_histable, 'm')
        self.getKHistoryFromSohu(self.kw_histable, 'w')
        self.getKHistoryFromSohu(self.k_histable, 'd')
        self.getKHistoryFromEm(self.k15_histable, '15')
        
    def getKdHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.k_histable, 'd')

    def getKwHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.kw_histable, 'w')

    def getKmHistoryFromSohuTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromSohu(self.km_histable, 'm')

    def getKHistoryFromEm(self, ktable, kltype, start=None):
        kltype = self.getValidKltype(kltype)

        # f51: date/time,f52:开盘,f53:收盘,f54:最高, f55:最低, f56: 成交量, f57: 成交额 ,f58: 振幅(%),f59:涨跌幅(%),f60:涨跌额,f61:换手率(%)
        try:
            emurl = f'''http://28.push2his.eastmoney.com/api/qt/stock/kline/get?secid={self.getEmSecCode()}&ut=fa5fd1943c7b386f172d6893dbfba10b'''
            emurl += f'''&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f59,f60&klt={kltype}&fqt=0&end=20500101'''
            if int(kltype) > 60 and start:
                emurl += f'&beg={start}'
            else:
                emurl += '&lmt=512'
            response = json.loads(self.getRequest(emurl))
            if not response or response['data'] is None or len(response['data']['klines']) == 0:
                Utils.log(f'getKHistoryFromEm error, response: {response}', Utils.Err)
                return

            response = response['data']['klines']
            self.saveEmData(ktable, response, kltype)
        except Exception as e:
            Utils.log(f'getKHistoryFromEm Exception: {e}', Utils.Err)

    def saveEmData(self, ktable, data, kltpye):
        if len(data) < 1:
            return

        self.setupKtable(ktable)

        (lid, ldate),  = self.getLastRecDate(ktable, data, kltpye)
        values = []
        for i in range(0, len(data)):
            kdata = data[i].split(',')
            if kdata[0] < ldate:
                continue

            if len(kdata) == 9:
                d,o,c,h,l,v,a,p,pr = kdata
            else:
                Utils.log(f'cannot parse data {data[i]}')
                continue

            a = float(a) / 10000
            if self.isSamePeriod(ldate, d, kltpye) and d >= ldate:
                self.sqldb.update(ktable, {column_date: d, column_close: c, column_high: h, column_low: l, column_open: o, column_price_change: pr, column_p_change: p, column_volume: v, column_amount: a}, {'id': lid})
            else:
                values.append([d,c,h,l,o,pr,p,v,a])

        if len(values) > 0:
            self.sqldb.insertMany(ktable, self.colheaders, values)

    def getK15HistoryFromEmTillToday(self, code):
        self.setCode(code)
        self.getKHistoryFromEm(self.k15_histable, '15')
