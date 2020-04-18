# Python 3
# -*- coding:utf-8 -*-
from utils import *
import requests

class InfoList():
    def checkInfoTable(self, dbname, tablename):
        self.infoTable = tablename
        self.sqldb = SqlHelper(password = db_pwd, database = dbname)
        if not self.sqldb.isExistTable(tablename):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_name:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(tablename, attrs, constraint)

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.infoTable, col):
            self.sqldb.addColumn(self.infoTable, col, tp)

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

class HistoryDowloaderBase():
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        