# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import requests
from datetime import datetime, timedelta
import time
from decimal import Decimal
import json

class AllGolds(InfoList):
    def __init__(self):
        self.checkInfoTable(fund_db_name, gl_gold_info_table)


class Gold_history(HistoryDowloaderBase):
    """
    get gold history from dyhjw
    """
    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getJijinHaoRequest(self, url, params):
        headers = { 'Host': 'api.jijinhao.com',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
            'Accept': '*/*',
            'Referer': 'http://www.cngold.org/quote/',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9'
            }
        rsp = requests.get(url, params=params, headers=headers)
        return rsp.text

    def setGoldCode(self, code):
        self.code = code
        allgold = AllGolds()

        gg = GoldGeneral(allgold.sqldb, self.code)
        self.name = gg.name
        self.gold_history_table = gg.gold_history_table
        self.gold_history_table_30 = gg.gold_history_table_30
        self.gold_rt_history_table = gg.gold_rt_history_table
        self.goldk_history_table = gg.goldk_history_table
        self.goldkweek_history_table = gg.goldkweek_history_table
        self.goldkmonth_history_table = gg.goldkmonth_history_table

    def getDataRowsNeedUpdate(self, code, table, rowsPerDay):
        if not self.sqldb.isExistTable(table):
            print("history db table not set for", self.code, self.name)
            return 0

        days = 0
        if self.sqldb.isExistTable(table):
            maxDate = self.sqldb.selectOneValue(table, "max(%s)" % column_date)
            if maxDate:
                sDate = datetime.strptime(maxDate, "%Y-%m-%d")
                eDate = datetime.now()
                days = (eDate - sDate).days
                if sDate >= eDate:
                    # print("Already updated to %s" % maxDate)
                    return -1
                if days <= 2 and sDate.weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return -1
        return days * rowsPerDay

    def goldHistoryTillToday(self, code):
        self.setGoldCode(code)
        rows = self.getDataRowsNeedUpdate(code, self.gold_history_table, 23)
        if rows < 0:
            return
        params = {'code':self.code,'interval':'30'}
        if not rows == 0:
            params['rows'] = str(rows)
        response = self.getRequest(apiUrl_dyhjw, params)
        jresp = json.loads(response)
        values = []
        for r in jresp:
            if r['TS'].endswith("15:30"):
                date = datetime.strptime(r['TS'], "%Y-%m-%d %H:%M").strftime("%Y-%m-%d")
                values.append([date,r['P']])

        headers = [column_date, column_close]
        if not self.sqldb.isExistTable(self.gold_history_table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.gold_history_table, attrs, constraint)

        self.sqldb.insertMany(self.gold_history_table, headers, values)

        values = []
        maxTime = None
        if self.sqldb.isExistTable(self.gold_history_table_30):
            maxTime = self.sqldb.selectOneValue(self.gold_history_table_30, "max(%s)" % column_date)
            if maxTime:
                maxTime = datetime.strptime(maxTime, "%Y-%m-%d %H:%M")
        for r in jresp:
            if not maxTime or datetime.strptime(r['TS'], "%Y-%m-%d %H:%M") > maxTime:
                values.append([r['TS'],r['P'],r['H'],r['L'],r['O']])

        headers = [column_date, column_close, column_high, column_low, column_open]
        if not self.sqldb.isExistTable(self.gold_history_table_30):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.gold_history_table_30, attrs, constraint)

        self.sqldb.insertMany(self.gold_history_table_30, headers, values)
        
    def goldKHistoryTillToday(self, code):
        self.setGoldCode(code)
        rows = self.getDataRowsNeedUpdate(code, self.goldk_history_table, 1)

        if rows < 0:
            return
        params = {'code':self.code,'interval':'30'}
        if not rows == 0:
            params['rows'] = str(rows)
        response = self.getRequest(apiUrl_dyhjw, params)
        jresp = json.loads(response)
        values = []
        for r in jresp:
            if r['TS'].endswith("00:00"):
                date = (datetime.strptime(r['TS'], "%Y-%m-%d %H:%M")).strftime("%Y-%m-%d")
                values.append([date,r['P'],r['H'],r['L'],r['O']])

        headers = [column_date, column_close, column_high, column_low, column_open]
        if not self.sqldb.isExistTable(self.goldk_history_table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.goldk_history_table, attrs, constraint)

        self.sqldb.insertMany(self.goldk_history_table, headers, values)

    def saveJijinhaoHistory(self, datas, table):
        headers = [column_date, column_close, column_high, column_low, column_open, column_volume]
        if not self.sqldb.isExistTable(table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(table, attrs, constraint)

        maxDate = self.sqldb.selectOneValue(table, "max(%s)" % column_date)
        if not maxDate:
            maxDate = ""

        values = []
        for x in datas:
            date = (datetime.strptime(x['day'], "%Y/%m/%d")).strftime("%Y-%m-%d")
            if date > maxDate:
                values.append([date, x['open'], x['high'], x['low'], x['close'], x['volume']])

        self.sqldb.insertMany(table, headers, values)

    def getJijinhaoHistory(self, code):
        self.setGoldCode(code)
        if self.sqldb.isExistTable(self.goldk_history_table):
            maxDate = self.sqldb.selectOneValue(self.goldk_history_table, "max(%s)" % column_date)
            if not maxDate:
                maxDate = ""
            if maxDate:
                sDate = datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)
                eDate = datetime.strptime(datetime.now().strftime("%Y-%m-%d"), "%Y-%m-%d")
                if sDate >= eDate:
                    # print("Already updated to %s" % maxDate)
                    return
                if (eDate - sDate).days <= 2 and sDate.weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return

        try:
            params={'code':gold_code_jjb[self.code],'pageSize':'100'}
            response = self.getJijinHaoRequest(apiUrl_jijinhao_kdata, params)
            rsp = response[len("var  KLC_KL = "):]
            jresp = json.loads(rsp)
            self.saveJijinhaoHistory(jresp['data'][0][0:-1], self.goldk_history_table)
            self.saveJijinhaoHistory(jresp['data'][2][0:-1], self.goldkweek_history_table)
            self.saveJijinhaoHistory(jresp['data'][1][0:-1], self.goldkmonth_history_table)
        except Exception as e:
            print('getJijinhaoHistory exception:', e)

    def saveJijinhaoRtHistory(self, values):
        headers = [column_date, column_price, column_averagae_price, column_volume]
        if not self.sqldb.isExistTable(self.gold_rt_history_table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.gold_rt_history_table, attrs, constraint)

        self.sqldb.insertMany(self.gold_rt_history_table, headers, values)

    def getJijinhaoRtHistory(self, code):
        self.setGoldCode(code)
        maxDate = None
        if self.sqldb.isExistTable(self.gold_rt_history_table):
            maxDate = self.sqldb.selectOneValue(self.gold_rt_history_table, "max(%s)" % column_date)
        if not maxDate:
            maxDate = ""

        try:
            params = {'code':gold_code_jjb[self.code]}
            response = self.getJijinHaoRequest(apiUrl_jijinhao_fourDays, params)
            rsp = response[len("var KLC_ML = "):]
            jresp = json.loads(rsp)
            values = []
            for x in jresp[0:-1]:
                for d in x:
                    if not d['volume'] == 0:
                        date = datetime.fromtimestamp(d['date']/1000).strftime("%Y-%m-%d %H:%M")
                        if date > maxDate:
                            values.append([date, d['price'], d['avg_price'], d['volume']])
            self.saveJijinhaoRtHistory(values)
            self.pickupDayPrice()
        except Exception as e:
            print('getJijinhaoRtHistory Exception', e)

    def getJijinhaoRealtime(self, code):
        self.setGoldCode(code)
        curTime = datetime.now()
        stamp = time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond
        try:
            params = {'code':gold_code_jjb[self.code]}#, '_':str(int(stamp))
            response = self.getJijinHaoRequest(apiUrl_jijinhao_realtime, params)
            rsp = response[len("var hq_str = "):].split(',')
            print(rsp)
        except Exception as e:
            print('getJijinhaoRealtime Exception', e)

    def getJijinhaoTodayMin(self, code):
        self.setGoldCode(code)

        try:
            params = {'code':gold_code_jjb[self.code]}
            response = self.getJijinHaoRequest(apiUrl_jijinhao_today, params)
            rsp = response[len("var hq_str_ml = "):]
            jresp = json.loads(rsp)
            values = []
            maxDate = ""
            for d in jresp['data']:
                if not d['volume'] == 0:
                    date = datetime.fromtimestamp(d['date']/1000).strftime("%Y-%m-%d %H:%M")
                    if date > maxDate and not d['price'] == -1:
                        values.append([date, d['price'], d['avg_price'], d['volume']])
            self.gold_rt_history_table = "g_rt_day_min_au9999"
            self.saveJijinhaoRtHistory(values)
        except Exception as e:
            print('getJijinhaoTodayMin Exception', e)

    def pickupDayPrice(self):
        if not self.sqldb.isExistTable(self.gold_rt_history_table):
            print("real time gold history %s is not exists." % self.gold_rt_history_table)
            return

        headers = [column_date, column_close, column_price]
        if not self.sqldb.isExistTable(self.gold_history_table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.gold_history_table, attrs, constraint)
        if not self.sqldb.isExistTableColumn(self.gold_history_table, column_close):
            self.sqldb.addColumn(self.gold_history_table, column_close, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(self.gold_history_table, column_price):
            self.sqldb.addColumn(self.gold_history_table, column_price, 'varchar(20) DEFAULT NULL')

        maxDate = self.sqldb.selectOneValue(self.gold_history_table, "max(%s)" % column_date)
        if not maxDate:
            maxDate = ""

        goldk_data = self.sqldb.select(self.goldk_history_table, [column_date, column_close], "%s > '%s'" % (column_date, maxDate))
        if goldk_data:
            self.sqldb.insertMany(self.gold_history_table, [column_date, column_close], goldk_data)

        minTime = self.sqldb.selectOneValue(self.gold_rt_history_table, "min(%s)" % column_date)
        if not minTime:
            minTime = ""
        else:
            minTime = datetime.strptime(minTime, "%Y-%m-%d %H:%M").strftime("%Y-%m-%d")

        maxDate = self.sqldb.selectOneValue(self.gold_history_table, "max(%s)" % column_date, "%s is not NULL" % column_price)
        if not maxDate:
            maxDate = ""
        maxDate = max(maxDate, minTime)

        datesToUpdate = self.sqldb.select(self.gold_history_table, column_date, "%s > '%s'" % (column_date, maxDate))
        for (maxDate,) in datesToUpdate:
            nightTime = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(hours=20)).strftime("%Y-%m-%d %H:%M")
            closeTime = self.sqldb.selectOneValue(self.gold_rt_history_table, "max(%s)" % column_date, ["%s > '%s'" % (column_date, maxDate), "%s < '%s'" % (column_date, nightTime)])
            dayprice = self.sqldb.select(self.gold_rt_history_table, [column_date, column_price], "%s = '%s'" % (column_date, closeTime))
            if dayprice:
                ((daytime, price),) = dayprice
                if daytime and price:
                    daytime = datetime.strptime(daytime, "%Y-%m-%d %H:%M").strftime("%Y-%m-%d")
                    self.sqldb.update(self.gold_history_table, {column_price:str(price)}, {column_date:daytime})
