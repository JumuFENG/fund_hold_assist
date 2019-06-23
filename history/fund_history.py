# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
import html
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 

class AllFunds():
    """get all funds' general info and save to db table allfund"""
    def __init__(self, sqldb):
        self.sqldb = sqldb
            
    def loadInfo(self):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_name:"varchar(255) DEFAULT NULL",  column_url:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_all_funds_info_table, attrs, constraint)

        c = ""
        with open("allfund.html",'rb') as f:
            c = f.read()
        soup = BeautifulSoup(c, 'html.parser')
        tags = soup.select('.num_right > li')
        allfund = []
        for tag in tags:
            if tag.a:
                codename = tag.a.text[1:].split('）')
                allfund.append([codename[0],codename[1],tag.a.get('href')]) 
        self.sqldb.insertMany(gl_all_funds_info_table, [column_code, column_name, column_url], allfund)

    def getInfoOfFund(self, code, params=None, proxies=None):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return

        url = self.get_fund_url(code)
        if not url:
            print("url of", code, "not exist.")
            return
        #print(url)
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

    def updateInfoOfFund(self, code, infoDic):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return
        if not len(infoDic) == 6:
            print("len of infoDic should be 6")
            return

        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_type):
            self.sqldb.addColumn(gl_all_funds_info_table, column_type, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_risk_level):
            self.sqldb.addColumn(gl_all_funds_info_table, column_risk_level, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_amount):
            self.sqldb.addColumn(gl_all_funds_info_table, column_amount, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_setup_date):
            self.sqldb.addColumn(gl_all_funds_info_table, column_setup_date, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_star_level):
            self.sqldb.addColumn(gl_all_funds_info_table, column_star_level, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(gl_all_funds_info_table, column_summary_url):
            self.sqldb.addColumn(gl_all_funds_info_table, column_summary_url, 'varchar(255) DEFAULT NULL')

        self.sqldb.update(gl_all_funds_info_table, infoDic, {column_code: code})

    def loadInfo(self, code):
        c = self.getInfoOfFund(code)
        if not c:
            return

        soup = BeautifulSoup(c, 'html.parser')
        tds = soup.select('.infoOfFund > table td')
        #print(tds[0].get_text().replace(u'\xa0', u' '))
        td_type = tds[0].get_text().replace(u'\xa0', u'').split('：')[1].split('|')
        td_fund_type = td_type[0]
        td_risk_level = td_type[1]
        td_money_amount = tds[1].get_text().replace(u'\xa0', u'').split('：')[1].split('（')[0]
        td_setup_date = tds[3].get_text().replace(u'\xa0', u'').split('：')[1]
        td_star_level = tds[5].get_text().replace(u'\xa0', u'').split('：')[1]
        if not td_star_level:
            td_star_level = tds[5].div.get('class')[0][-1]

        fund_info_url = soup.select('.fundDetail-footer > ul > li')[1].a.get('href')

        infoDic = {column_type: td_fund_type, column_risk_level: td_risk_level, column_amount: td_money_amount, column_setup_date: td_setup_date, column_star_level: td_star_level, column_summary_url: fund_info_url}
        #print(infoDic)
        self.updateInfoOfFund(code, infoDic)

    def readSingleData(self, col, code, defVal = None):
        val = defVal
        if self.sqldb.isExistTable(gl_all_funds_info_table):
            v = self.sqldb.select(gl_all_funds_info_table, col, "%s = '%s'" % (column_code, code))
            if v:
                (v,), = v
                val = v if v else val
        return val

    def get_fund_name(self, code):
        return self.readSingleData(column_name, code, "name_" + code)

    def get_fund_url(self, code):
        return self.readSingleData(column_url, code)

class FundHistoryDataDownloader():
    """
    get all the history data a fund, or update the data.
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.base_url = f10DataApiUrl
        
    def setFundCode(self, code):
        self.code = code
        tbl_mgr = TableManager(self.sqldb, gl_fund_info_table, self.code)
        allfund = AllFunds(self.sqldb)

        self.name = tbl_mgr.GetTableColumnInfo(column_name, allfund.get_fund_name(self.code))
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
