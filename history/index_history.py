# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 
import pandas
import json
import os

class AllIndexes(InfoList):
    """
    manage index info table
    """
    def __init__(self):
        self.checkInfoTable(fund_db_name, gl_index_info_table)

    def loadInfo(self, code):
        url = "http://quote.eastmoney.com/zs" + code + ".html"
        c = self.getRequest(url)
        if not c:
            print("getRequest", url, "failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        hdr2 = soup.find('h2',{'class':'header-title-h2 fl','id':'name'})
        if not hdr2:
            print("can not find html element with 'class':'header-title-h2 fl','id':'name'")

        name = hdr2.get_text()
        idxinfo = self.sqldb.select(gl_index_info_table, "*", "%s = '%s'" % (column_code, code))
        if idxinfo is not None and len(idxinfo) > 0:
            self.sqldb.update(gl_index_info_table, {column_name: name}, {column_code: code})
        else:
            self.sqldb.insert(gl_index_info_table, {column_name: name, column_code: code,})

class Index_history(HistoryFromSohu):
    """
    get index history data
    """
    def setCode(self, code):
        super().setCode(code)
        allindex = AllIndexes()
        ig = IndexGeneral(allindex.sqldb, self.code)
        self.name = ig.name
        self.index_db_table = ig.histable
        self.index_full_his_db = ig.khistable
        self.k_histable = ig.khistable
        self.kw_histable = ig.kwhistable
        self.km_histable = ig.kmhistable

    def getSetupDate(self):
        return None

    def getSohuCode(self):
        return "zs_" + self.code

    def downloadFile(self, url, fname, params = None, proxies = None):
        rsp = requests.get(url,params=params, proxies=proxies,stream = True)
        rsp.raise_for_status()
        with open(fname,'wb') as f:
            f.write(rsp.content)

    def saveIndexHistoryData(self, values):
        headers = [column_date, column_close, column_high, column_low, column_open, column_price_change, column_p_change, column_volume, column_amount]
        if not self.sqldb.isExistTable(self.index_full_his_db):
            attrs = {}
            for c in headers:
                attrs[c] = 'varchar(20) DEFAULT NULL'
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.index_full_his_db, attrs, constraint)

        self.sqldb.insertMany(self.index_full_his_db, headers, values)

    def csv163ToSql(self, csv):
        df = pandas.read_csv(csv, encoding='gbk', usecols=[0, 3, 4, 5, 6, 8, 9, 10, 11], float_precision = "round_trip")
        values = []
        for x in df.values:
            values.append([str(v) for v in x]) 

        values.reverse()
        self.saveIndexHistoryData(values)

    def getHistoryFrom163(self, code):
        self.setCode(code)
        se = self.getStartEnd(self.index_full_his_db)
        if not se:
            return

        (sDate,eDate) = se
        code_163 = "0" + self.code if self.code[0] == '0' else "1" + self.code
        params = {'code':code_163}
        if sDate is not None:
            params['start'] = sDate
            params['end'] = eDate
        params['fields'] = 'TCLOSE;HIGH;LOW;TOPEN;LCLOSE;CHG;PCHG;VOTURNOVER;VATURNOVER'
        fname = os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/' + code + '.csv')
        self.downloadFile(apiUrl_163, fname, params)
        self.csv163ToSql(fname)
        os.remove(fname)

