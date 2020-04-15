# Python 3
# -*- coding:utf-8 -*-
from utils import *

class HistoryDowloaderBase():
    def __init__(self):
        self.sqldb = SqlHelper(password = db_pwd, database = "history_db")
        