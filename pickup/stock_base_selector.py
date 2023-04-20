# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from threading import Thread


class StockBaseSelector(TableBase):
    def __init__(self, autocreate=True) -> None:
        super().__init__(autocreate)

    def initConstrants(self):
        self.threads_num = 2
        self.dbname = stock_db_name

    def walk_prepare(self, date=None):
        stks = StockGlobal.all_stocks()
        self.wkstocks = [[s[1], s[7] if date is None else date] for s in stks if s[4] == 'ABStock' or s[4] == 'TSStock']
        self.tsdate = {s[1]: s[8] for s in stks if s[4] == 'TSStock'}
        self.wkselected = []

    def walk_on_history_thread(self):
        pass

    def walk_post_process(self):
        pass

    def walkOnHistory(self, date=None):
        self.walk_prepare(date)

        ctime = datetime.now()
        wk_thds = []
        for x in range(0, self.threads_num):
            t = Thread(target=self.walk_on_history_thread)
            t.start()
            wk_thds.append(t)

        for t in wk_thds:
            t.join()

        print('time used:', datetime.now() - ctime)
        self.walk_post_process()
