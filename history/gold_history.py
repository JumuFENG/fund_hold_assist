# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
from datetime import datetime, timedelta
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

    def setGoldCode(self, code):
        self.code = code
        if self.sqldb.isExistTable(gl_gold_info_table):
            index_info = self.sqldb.select(gl_gold_info_table, fields = [column_name,column_table_history, column_table_history_goldk], conds = "%s = '%s'" % (column_code, self.code))
            if index_info:
                ((self.name, self.gold_history_table, self.goldk_history_table),) = index_info
                if self.name and self.gold_history_table and self.goldk_history_table:
                    self.gold_history_table_30 = self.gold_history_table + "_30"
                    return

        if not self.sqldb.isExistTable(gl_gold_info_table):
            attrs = {column_name:'varchar(64) DEFAULT NULL', column_code:'varchar(10) DEFAULT NULL',
            column_table_history:'varchar(20) DEFAULT NULL', column_table_history_goldk:'varchar(20) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_gold_info_table, attrs, constraint)

        self.name = gold_code_instid[self.code]
        self.gold_history_table = "g_his_" + self.code
        self.goldk_history_table = "g_k_his_" + self.code
        self.gold_history_table_30 = self.gold_history_table + "_30"
        params = {column_name:self.name, column_code:self.code, column_table_history:self.gold_history_table,column_table_history_goldk:self.goldk_history_table}
        self.sqldb.insert(gl_gold_info_table, params)
        
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
