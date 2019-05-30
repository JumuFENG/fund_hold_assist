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
    def __init__(self, sqldb, code):
        self.sqldb = sqldb
        self.code = code
        self.name = "name_" + self.code
        self.index_db_table = "i_his_" + self.code
        self.index_full_his_db = "i_ful_his_" + self.code

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

    def indexHistoryTillToday(self):
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
        if sDate == "" or eDate == "":
            df = ts.get_hist_data(self.code)
        else:
            df = ts.get_hist_data(self.code, start=sDate, end=eDate)

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
        
        #if self.sqldb.isExistTable(gl_index_info_table):
        #    ((self.fund_name, self.index_full_his_db),) = self.sqldb.select(gl_index_info_table, fields=[column_name, column_table_history], conds = "%s = '%s'" % (column_code, self.fund_code))
        #    if self.fund_name and self.index_full_his_db :
        #        return
        sDate = ""
        eDate = ""
        eDate = datetime.now().strftime("%Y%m%d")
        sDate = "20190525"
        params = {'code': code, 'start': sDate, 'end': eDate}
        response = self.getRequest(sohuApiUrl, params)
        jresp = json.loads(response)[0]["hq"]
        jresp.reverse()
        values = []
        for (d,o,c,pr,p,l,h,v,a,x) in jresp:
            values.append([d,c,h,l,o,pr,p.strip('%'),v,a])
        self.saveIndexHistoryData(values)

if __name__ == "__main__":
    sqldb = SqlHelper(password = db_pwd, database = "testdb")
    ih = Index_history(sqldb, 'sh')
    #ih.csv163ToSql("000001.csv")
    #ih.indexHistoryTillToday()
    ih.getHistoryFromSohu("zs_000001")
