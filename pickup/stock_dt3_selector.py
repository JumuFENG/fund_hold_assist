# Python 3
# -*- coding:utf-8 -*-

from utils import *

class StockDt3Selector(TableBase):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        self.dbname = stock_db_name
        self.tablename = 'stock_zt1_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'建仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'清仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'实盘',   'type':'tinyint DEFAULT 0'},
            {'col':'交易记录','type':'varchar(255) DEFAULT NULL'}
        ]

    def dumpDataByDate(self, date=None):
        return super().dumpDataByDate(date)
