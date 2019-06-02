# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
from datetime import datetime, timedelta
import time
from decimal import Decimal
import json

class Gold_history():
    """
    get gold history from dyhjw
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb

    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getJijinHaoRequest(self, url, params):
        headers = { 'Host': 'api.jijinhao.com',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.186 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'http://www.cngold.org/quote/',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9'
            }
        rsp = requests.get(url, params=params, headers=headers)
        return rsp.text

    def createGoldInfoTable(self, code):
        self.code = code
        if self.sqldb.isExistTable(gl_gold_info_table):
            gold_info = self.sqldb.select(gl_gold_info_table, fields = [column_name], conds = "%s = '%s'" % (column_code, self.code))
            if gold_info:
                ((self.name,),) = gold_info
                return

        if not self.sqldb.isExistTable(gl_gold_info_table):
            attrs = {column_name:'varchar(64) DEFAULT NULL', column_code:'varchar(10) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_gold_info_table, attrs, constraint)

        self.name = gold_code_instid[self.code]
        params = {column_name:self.name, column_code:self.code}
        self.sqldb.insert(gl_gold_info_table, params)

    def getGoldInfoColumn(self, col, defval):
        if not self.sqldb.isExistTable(gl_gold_info_table):
            print("gold info table not exists!")
            return
        if not self.sqldb.isExistTableColumn(gl_gold_info_table, col):
            self.sqldb.addColumn(gl_gold_info_table, col, 'varchar(64) DEFAULT NULL')
        gold_info = self.sqldb.select(gl_gold_info_table, fields=[col], conds = "%s = '%s'" % (column_code, self.code))

        colval = None
        if gold_info:
            ((colval,),) = gold_info
        if not colval:
            colval = defval
            self.sqldb.update(gl_gold_info_table, {col:colval}, {column_code:"%s" % self.code})

        return colval

    def setGoldCode(self, code):
        self.createGoldInfoTable(code)

        self.gold_history_table = self.getGoldInfoColumn(column_table_history, "g_his_" + self.code)
        self.gold_history_table_30 = self.gold_history_table + "_30"
        self.gold_rt_history_table = self.getGoldInfoColumn(column_table_history_realtime, "g_rt_his_" + self.code)
        self.goldk_history_table = self.getGoldInfoColumn(column_table_history_goldk, "g_k_his_" + self.code)
        self.goldkweek_history_table = self.getGoldInfoColumn(column_table_history_goldkweek, "g_kweek_his_" + self.code)
        self.goldkmonth_history_table = self.getGoldInfoColumn(column_table_history_goldkmonth, "g_kmonth_his_" + self.code)
        
    def getDataRowsNeedUpdate(self, code, table, rowsPerDay):
        if not self.sqldb.isExistTable(table):
            print("history db table not set for", self.code, self.name)
            return 0

        days = 0
        if self.sqldb.isExistTable(table):
            ((maxDate,),) = self.sqldb.select(table, "max(%s)" % column_date)
            if maxDate:
                sDate = datetime.strptime(maxDate, "%Y-%m-%d")
                eDate = datetime.now()
                days = (eDate - sDate).days
                if sDate >= eDate:
                    print("Already updated to %s" % maxDate)
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
            self.sqldb.creatTable(self.gold_history_table, attrs, constraint)

        self.sqldb.insertMany(self.gold_history_table, headers, values)

        values = []
        maxTime = None
        if self.sqldb.isExistTable(self.gold_history_table_30):
            ((maxTime,),) = self.sqldb.select(self.gold_history_table_30, "max(%s)" % column_date)
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
            self.sqldb.creatTable(self.gold_history_table_30, attrs, constraint)

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
            self.sqldb.creatTable(self.goldk_history_table, attrs, constraint)

        self.sqldb.insertMany(self.goldk_history_table, headers, values)

    def saveJijinbaoHistory(self, datas, table):
        headers = [column_date, column_close, column_high, column_low, column_open, column_volume]
        if not self.sqldb.isExistTable(table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(table, attrs, constraint)

        maxDate = self.sqldb.select(table, "max(%s)" % column_date)
        if maxDate:
            ((maxDate,),) = maxDate
        if not maxDate:
            maxDate = ""

        values = []
        for x in datas:
            date = (datetime.strptime(x['day'], "%Y/%m/%d")).strftime("%Y-%m-%d")
            if date > maxDate:
                values.append([date, x['open'], x['high'], x['low'], x['close'], x['volume']])

        self.sqldb.insertMany(table, headers, values)

    def getJijinbaoHistory(self, code):
        self.setGoldCode(code)
        if self.sqldb.isExistTable(self.goldk_history_table):
            maxDate = self.sqldb.select(self.goldk_history_table, "max(%s)" % column_date)
            if maxDate:
                ((maxDate,),) = maxDate
            if not maxDate:
                maxDate = ""
            if maxDate:
                sDate = datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)
                eDate = datetime.strptime(datetime.now().strftime("%Y-%m-%d"), "%Y-%m-%d")
                if sDate >= eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if (eDate - sDate).days <= 2 and sDate.weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return

        params={'code':gold_code_jjb[self.code],'pageSize':'100'}
        response = self.getJijinHaoRequest(apiUrl_jijinhao_kdata, params)
        rsp = response[len("var  KLC_KL = "):]
        jresp = json.loads(rsp)
        self.saveJijinbaoHistory(jresp['data'][0][0:-1], self.goldk_history_table)
        self.saveJijinbaoHistory(jresp['data'][2][0:-1], self.goldkweek_history_table)
        self.saveJijinbaoHistory(jresp['data'][1][0:-1], self.goldkmonth_history_table)

    def saveJijinbaoRtHistory(self, values):
        headers = [column_date, column_price, column_averagae_price, column_volume]
        if not self.sqldb.isExistTable(self.gold_rt_history_table):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.gold_rt_history_table, attrs, constraint)

        self.sqldb.insertMany(self.gold_rt_history_table, headers, values)

    def getJijinbaoRtHistory(self, code):
        self.setGoldCode(code)
        maxDate = None
        if self.sqldb.isExistTable(self.gold_rt_history_table):
            maxDate = self.sqldb.select(self.gold_rt_history_table, "max(%s)" % column_date)
            if maxDate:
                ((maxDate,),) = maxDate
        if not maxDate:
            maxDate = ""

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
        self.saveJijinbaoRtHistory(values)
