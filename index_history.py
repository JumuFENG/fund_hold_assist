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

class Index_history():
    """
    get index history data
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb

    def setIndexCode(self, code):
        self.code = code
        if self.sqldb.isExistTable(gl_index_info_table):
            ((self.name, self.index_db_table, self.index_full_his_db),) = self.sqldb.select(gl_index_info_table, fields = [column_name,column_table_history, column_table_full_history], conds = "%s = '%s'" % (column_code, self.code))
            if self.name and self.index_db_table and self.index_full_his_db:
                return

        if not self.sqldb.isExistTable(gl_index_info_table):
            attrs = {column_name:'varchar(64) DEFAULT NULL', column_code:'varchar(10) DEFAULT NULL',
            column_table_history:'varchar(20) DEFAULT NULL', column_table_full_history:'varchar(20) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_index_info_table, attrs, constraint)

        self.name = index_code_name[self.code]
        self.index_db_table = "i_his_" + self.code
        self.index_full_his_db = "i_ful_his_" + self.code
        params = {column_name:self.name, column_code:self.code, column_table_history:self.index_db_table,column_table_full_history:self.index_full_his_db}
        self.sqldb.insert(gl_index_info_table, params)

    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

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
                if sDate >= eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y-%m-%d") - datetime.strptime(sDate, "%Y-%m-%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y-%m-%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return
        
        df = None
        tscode = "sh" + self.code
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

    def getHistoryFromSohu(self, code):
        self.setIndexCode(code)
        if not self.sqldb.isExistTable(self.index_full_his_db):
            print("full history db table not set for", self.code, self.name)
            return

        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.index_full_his_db):
            ((maxDate,),) = self.sqldb.select(self.index_full_his_db, "max(%s)" % column_date)
            if maxDate:
                sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y%m%d")
                eDate = datetime.now().strftime("%Y%m%d")
                if sDate >= eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y%m%d") - datetime.strptime(sDate, "%Y%m%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y%m%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return
                    
        sohu_code = "zs_" + self.code
        params = {'code': sohu_code, 'start': sDate, 'end': eDate}
        response = self.getRequest(sohuApiUrl, params)
        jresp = json.loads(response)[0]["hq"]
        jresp.reverse()
        values = []
        for (d,o,c,pr,p,l,h,v,a,x) in jresp:
            values.append([d,c,h,l,o,pr,p.strip('%'),v,a])
        self.saveIndexHistoryData(values)

if __name__ == "__main__":
    sqldb = SqlHelper(password = db_pwd, database = "testdb")
    ih = Index_history(sqldb)
    #ih.csv163ToSql("000001.csv")
    #ih.indexHistoryTillToday("000001")
    ih.getHistoryFromSohu("000001")
