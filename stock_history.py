# Python 3
# -*- coding:utf-8 -*-

from commons import *
from _pwd import db_pwd
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 
from sql_helper import SqlHelper
import tushare as ts
from pandas import  *

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

    def csv163ToSql(self, csv):
        headers = [column_date, column_close, column_high, column_low, column_open, column_price_change, column_p_change, column_volume, column_amount]
        if not self.sqldb.isExistTable(self.index_full_his_db):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.index_full_his_db, attrs, constraint)

        df = pandas.read_csv(csv, encoding='gbk', usecols=[0, 3, 4, 5, 6, 8, 9, 10, 11], float_precision = "round_trip")
        values = []
        for x in df.values:
            values.append([str(v) for v in x]) 

        values.reverse()
        self.sqldb.insertMany(self.index_full_his_db, headers, values)#[x*10:(x+1)*10]

        

if __name__ == "__main__":
    sqldb = SqlHelper(password = db_pwd, database = "testdb")
    ih = Index_history(sqldb, 'sh')
    #ih.csv163ToSql("000001.csv")
    ih.indexHistoryTillToday()
