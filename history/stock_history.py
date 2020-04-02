# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
import html
import os
import re
import time
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup

class AllStocks():
    """get all stocks' general info and save to db table allstoks"""
    def __init__(self, sqldb):
        self.sqldb = sqldb

        if not self.sqldb.isExistTable(gl_all_stocks_info_table):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_name:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(gl_all_stocks_info_table, attrs, constraint)

        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(gl_all_stocks_info_table, col):
            self.sqldb.addColumn(gl_all_stocks_info_table, col, tp)

    def getRequest(self, url):
        headers = {'Host': 'fund.eastmoney.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'}
        
        proxies=None

        rsp = requests.get(url, params=headers, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

    def loadInfo(self, code):
        url = "http://quote.eastmoney.com/" + code.lower() + ".html"
        c = self.getRequest(url)
        if not c:
            print("getRequest", url, "failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        hdr2 = soup.find('span',{'class':'quote_title_0 wryh'})
        if not hdr2:
            print("can not find html element with 'class':'header-title-h2 fl','id':'name'")

        code = code.upper()
        name = hdr2.get_text()
        stockinfo = self.sqldb.select(gl_all_stocks_info_table, "*", "%s = '%s'" % (column_code, code))
        if stockinfo:
            self.sqldb.update(gl_all_stocks_info_table, {column_name: name}, {column_code: code})
        else:
            self.sqldb.insert(gl_all_stocks_info_table, {column_name: name, column_code: code})
