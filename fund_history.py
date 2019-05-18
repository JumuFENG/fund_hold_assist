# Python 3
# -*- coding:utf-8 -*-

from commons import *
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 
from sql_helper import SqlHelper

class FundHistoryDataDownloader():
    """
    get all the history data a fund, or update the data.
    """
    def __init__(self, fund_code, dbname, dbpws):
        self.fund_code = fund_code
        self.base_url = f10DataApiUrl
        self.dbpws = dbpws
        self.dbname = dbname
        self.fund_name = ""
        self.fund_db_table = ""

        self.connectToSql()
        self.getBasicInfo()

    def connectToSql(self):
        self.sqldb = SqlHelper(password = self.dbpws, database = self.dbname)
        
    def getBasicInfo(self):
        #self.sqldb.dropTable(gl_all_info_table)
        if self.sqldb.isExistTable(gl_all_info_table):
            basicInfo = self.sqldb.select(gl_all_info_table, fields=[column_name, column_table_history], conds = "%s = '%s'" % (column_code, self.fund_code))
            if basicInfo :
                if basicInfo[0]:
                    self.fund_name = basicInfo[0][0]
                    self.fund_db_table = basicInfo[0][1]
                    print("basic info of", self.fund_name, "exists, no need to save")
                    return
        self.fund_name = "name_" + self.fund_code
        self.fund_db_table = "f_his_" + self.fund_code
        self.saveBasicInfo()

    def saveBasicInfo(self):
        if not self.sqldb.isExistTable(gl_all_info_table):
            attrs = {column_name:'varchar(200) DEFAULT NULL',column_code:'varchar(10) DEFAULT NULL',column_table_history:'varchar(64) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_all_info_table, attrs, constraint)
        params = {column_name : self.fund_name, column_code : self.fund_code, column_table_history : self.fund_db_table}
        self.sqldb.insert(gl_all_info_table, params)

    def getRequest(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def paraseFundRecords(self, records):
        soup = BeautifulSoup(records, 'html.parser')
        tab = soup.findAll('tbody')[0]
        for tr in tab.findAll('tr'):
            if tr.findAll('td') and len((tr.findAll('td'))) == 7:
                rdate = str(tr.select('td:nth-of-type(1)')[0].getText().strip())
                rVal = Decimal(tr.select('td:nth-of-type(2)')[0].getText().strip())
                strRate = tr.select('td:nth-of-type(4)')[0].getText().strip()
                rGrRate = Decimal('0')
                if len(strRate) > 0:
                    rGrRate = (Decimal(strRate.strip('%'))/Decimal(100)).quantize(Decimal('0.0000'))
                record = [rdate, rVal, rGrRate]
                self.allRecords.append(record)

    def getFundHistory(self, start = "", end = ""):
        curpage = 1
        self.allRecords = []

        while True:
            params = {'type': 'lsjz', 'code': self.fund_code, 'page': curpage, 'per': 49, 'sdate': start, 'edate': end}
            response = self.getRequest(self.base_url, params)
            content = str(response[13:-2])
            content_split = content.split(',')
            # obtain the info of data, curpage, pages, records
            records = content_split[0].split(':')[-1]
            self.paraseFundRecords(records)
            curpage = int(content_split[-1].split(':')[-1])
            pages = int(content_split[-2].split(':')[-1])
            print(curpage,'pages in', pages, 'GOT!')
            if curpage >= pages:
                break
            curpage += 1

    def fundHistoryTillToday(self):
        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.fund_db_table):
            maxDate = self.sqldb.select(self.fund_db_table, "max(%s)" % column_date)  #order="ORDER BY date DESC" ASC
            if maxDate:
                sDate = (datetime.strptime(maxDate[0][0], "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                eDate = datetime.now().strftime("%Y-%m-%d")
                if sDate > eDate:
                    print("Already updated to %s" % maxDate[0][0])
                    return
                if datetime.strptime(eDate, "%Y-%m-%d") - datetime.strptime(sDate, "%Y-%m-%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y-%m-%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return

        self.getFundHistory(sDate, eDate)
        if len(self.allRecords) > 0:
            self.addFundData()

    def addFundData(self):
        if not self.sqldb.isExistTable(self.fund_db_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'double(8,4) DEFAULT NULL','growth_rate':'double(8,4) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.fund_db_table, attrs, constraint)
        keys = [column_date, column_net_value, column_growth_rate]
        #print("======= start to insert", len(self.allRecords), "rows")
        self.allRecords.reverse()
        self.sqldb.insertMany(self.fund_db_table, keys, self.allRecords)
        for x in self.allRecords[-5:] : print(x)
        self.allRecords = []
