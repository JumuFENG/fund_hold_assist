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
