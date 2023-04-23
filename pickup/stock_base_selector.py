# Python 3
# -*- coding:utf-8 -*-
from threading import Thread
from utils import *
from history import *
from pickup.stock_track_deals import *


class StockBaseSelector(TableBase):
    def __init__(self, autocreate=True) -> None:
        super().__init__(autocreate)

    def initConstrants(self):
        self.threads_num = 2
        self.dbname = stock_db_name
        self.sim_ops = None
        self.simkey = 'base'

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

    def sim_prepare(self):
        self.sim_deals = []

    def simulate(self):
        # 用历史数据回测，生成买卖记录保存
        if self.sim_ops is None:
            self.sim_ops = [{'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_{self.simkey}'}]

        for so in self.sim_ops:
            simstart = datetime.now()
            so['prepare']()
            sim_ths = []
            for i in range(0, self.threads_num):
                t = Thread(target=so['thread'])
                sim_ths.append(t)
                t.start()

            for t in sim_ths:
                t.join()

            so['post'](so['dtable'])
            print('time used: ', datetime.now() - simstart)

    def simulate_thread(self):
        pass

    def sim_post_process(self, dtable):
        if len(self.sim_deals) > 0:
            strack = StockTrackDeals()
            strack.removeTrackDealsTable(dtable)
            strack.addDeals(dtable, self.sim_deals)

    def process_sim_deals(self, dtable):
        strack = StockTrackDeals()
        strack.dump_deals_summary(dtable)
