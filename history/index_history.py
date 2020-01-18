# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 
import tushare as ts
from pandas import *
import json
import os

class Index_history():
    """
    get index history data
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb

    def setIndexCode(self, code):
        self.code = code
        tbl_mgr = TableManager(self.sqldb, gl_index_info_table, self.code)

        self.name = tbl_mgr.GetTableColumnInfo(column_name, index_code_name[self.code])
        self.index_db_table = tbl_mgr.GetTableColumnInfo(column_table_history, "i_his_" + self.code)
        self.index_full_his_db = tbl_mgr.GetTableColumnInfo(column_table_full_history, "i_ful_his_" + self.code)

    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def downloadFile(self, url, fname, params = None, proxies = None):
        rsp = requests.get(url,params=params, proxies=proxies,stream = True)
        rsp.raise_for_status()
        with open(fname,'wb') as f:
            f.write(rsp.content)

    def saveTSHistoryData(self, df):

        if not self.sqldb.isExistTable(self.index_db_table):
            attrs = {df.index.name:'varchar(20) DEFAULT NULL'}
            for c in df.columns:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.index_db_table, attrs, constraint)

        headers = [df.index.name]
        for c in df.columns:
            headers.append(c)
        values = []
        for x in range(0, len(df)):
            v = []
            v.append(df.iloc[x].name)
            for c in df.columns:
                v.append(str(df.iloc[x][c]))
            values.append(v)
        values.reverse()
        self.sqldb.insertMany(self.index_db_table, headers, values)

    def indexHistoryTillToday(self, code):
        self.setIndexCode(code)
        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.index_db_table):
            ((maxDate,),) = self.sqldb.select(self.index_db_table, "max(%s)" % column_date)
            if maxDate:
                sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                eDate = datetime.now().strftime("%Y-%m-%d")
                if sDate > eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y-%m-%d") - datetime.strptime(sDate, "%Y-%m-%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y-%m-%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return
        
        df = None
        tscode = "sh" + self.code if self.code[0] == '0' else "sz" + self.code
        if sDate == "" or eDate == "":
            df = ts.get_hist_data(tscode)
        else:
            df = ts.get_hist_data(tscode, start=sDate, end=eDate)

        self.saveTSHistoryData(df)

    def saveIndexHistoryData(self, values):
        headers = [column_date, column_close, column_high, column_low, column_open, column_price_change, column_p_change, column_volume, column_amount]
        if not self.sqldb.isExistTable(self.index_full_his_db):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.index_full_his_db, attrs, constraint)

        self.sqldb.insertMany(self.index_full_his_db, headers, values)

    def csv163ToSql(self, csv):
        df = pandas.read_csv(csv, encoding='gbk', usecols=[0, 3, 4, 5, 6, 8, 9, 10, 11], float_precision = "round_trip")
        values = []
        for x in df.values:
            values.append([str(v) for v in x]) 

        values.reverse()
        self.saveIndexHistoryData(values)

    def getStartEnd(self, code):
        self.setIndexCode(code)
        if not self.sqldb.isExistTable(self.index_full_his_db):
            print("full history db table not set for", self.code, self.name)
            return ("", "")

        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.index_full_his_db):
            ((maxDate,),) = self.sqldb.select(self.index_full_his_db, "max(%s)" % column_date)
            if maxDate:
                sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y%m%d")
                eDate = datetime.now().strftime("%Y%m%d")
                if sDate > eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y%m%d") - datetime.strptime(sDate, "%Y%m%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y%m%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return
        return (sDate, eDate)

    def getHistoryFromSohu(self, code):
        se = self.getStartEnd(code)
        if not se:
            return

        (sDate,eDate) = se
        sohu_code = "zs_" + self.code
        params = {'code':sohu_code}
        if not sDate == "":
            params['start'] = sDate
            params['end'] = eDate
        response = self.getRequest(sohuApiUrl, params)
        jresp = json.loads(response)
        if not jresp:
            print('getHistoryFromSohu get response: ', response)
            return
        jresp = jresp[0]["hq"]
        jresp.reverse()
        values = []
        for (d,o,c,pr,p,l,h,v,a,x) in jresp:
            values.append([d,c,h,l,o,pr,p.strip('%'),v,a])
        self.saveIndexHistoryData(values)

    def getHistoryFrom163(self, code):
        se = self.getStartEnd(code)
        if not se:
            return

        (sDate,eDate) = se
        code_163 = "0" + self.code if self.code[0] == '0' else "1" + self.code
        params = {'code':code_163}
        if not sDate == "":
            params['start'] = sDate
            params['end'] = eDate
        params['fields'] = 'TCLOSE;HIGH;LOW;TOPEN;LCLOSE;CHG;PCHG;VOTURNOVER;VATURNOVER'
        fname = code + '.csv'
        self.downloadFile(apiUrl_163, fname, params)
        self.csv163ToSql(fname)
        os.remove(fname)

