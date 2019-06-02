# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 

class FundHistoryDataDownloader():
    """
    get all the history data a fund, or update the data.
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.base_url = f10DataApiUrl
        
    def setFundCode(self, code):
        self.code = code
        tbl_mgr = TableManager(self.sqldb, gl_gold_info_table, self.code)

        self.name = tbl_mgr.GetTableColumnInfo(column_name, "name_" + self.code)
        self.fund_db_table = tbl_mgr.GetTableColumnInfo(column_table_history, "f_his_" + self.code)


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
            params = {'type': 'lsjz', 'code': self.code, 'page': curpage, 'per': 49, 'sdate': start, 'edate': end}
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

    def fundHistoryTillToday(self, code):
        self.setFundCode(code)
        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.fund_db_table):
            ((maxDate,),) = self.sqldb.select(self.fund_db_table, "max(%s)" % column_date)  #order="ORDER BY date DESC" ASC
            if maxDate:
                sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                eDate = datetime.now().strftime("%Y-%m-%d")
                if sDate > eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y-%m-%d") - datetime.strptime(sDate, "%Y-%m-%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y-%m-%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return

        self.getFundHistory(sDate, eDate)
        if len(self.allRecords) > 0:
            self.addFundData()

    def addFundData(self):
        if not self.sqldb.isExistTable(self.fund_db_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'double(16,4) DEFAULT NULL','growth_rate':'double(8,4) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.fund_db_table, attrs, constraint)
        keys = [column_date, column_net_value, column_growth_rate]
        #print("======= start to insert", len(self.allRecords), "rows")
        self.allRecords.reverse()
        self.sqldb.insertMany(self.fund_db_table, keys, self.allRecords)
        for x in self.allRecords[-5:] : print(x)
        self.allRecords = []

    def reload_all_history(self):
        if self.sqldb.isExistTable(self.fund_db_table):
            self.sqldb.dropTable(self.fund_db_table)
        self.fundHistoryTillToday()
