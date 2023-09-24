# Python 3
# -*- coding:utf-8 -*-
from threading import Thread
from utils import *
from history import *
from pickup.stock_track_deals import *


class StockBaseSelector(MultiThrdTableBase):
    def __init__(self, autocreate=True) -> None:
        self.sqldb = None
        super().__init__(autocreate)

    def initConstrants(self):
        self.threads_num = 2
        self.dbname = stock_db_name
        self.tablename = 'stock_base_pickup'
        self.sim_ops = None
        self.simkey = 'base'
        self.simed_kd = {}
        self.simlock = Lock()

    def walk_prepare(self, date=None):
        stks = StockGlobal.all_stocks()
        self.wkstocks = [
            [s[1], (s[7] if s[7] > '1996-12-16' else '1996-12-16') if date is None else date]
            for s in stks if s[4] == 'ABStock' or s[4] == 'TSStock']
        self.tsdate = {s[1]: s[8] for s in stks if s[4] == 'TSStock'}
        self.wkselected = []

    def task_prepare(self, date=None):
        self.walk_prepare(date)

    def get_begin_stock_records(self, wsstocks):
        # type: (list) -> list
        orstks = []
        self.simlock.acquire()
        if len(wsstocks) > 0:
            while len(orstks) == 0 or wsstocks[0][0] == orstks[0][0]:
                orstks.append(wsstocks.pop(0))
                if len(wsstocks) == 0:
                    break
        self.simlock.release()
        return orstks

    def walk_on_history_thread(self):
        pass

    def task_processing(self):
        self.walk_on_history_thread()

    def walk_post_process(self):
        if self.sqldb is None:
            self._check_or_create_table()
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date], self.wkselected)

    def post_process(self):
        self.walk_post_process()

    def walkOnHistory(self, date=None):
        self.start_multi_task(date)

    def get_kd_data(self, code, start, fqt=0):
        # type: (str, str, int) -> list(KNode)
        if code in self.simed_kd:
            return self.simed_kd[code]
        sd = StockDumps()
        kd = sd.read_kd_data(code, start=start, fqt=fqt)
        if kd is None:
            return None
        self.simed_kd[code] = [KNode(kl) for kl in kd]
        return self.simed_kd[code]

    def sim_prepare(self):
        self.sim_deals = []

    def simulate(self):
        # 用历史数据回测，生成买卖记录保存
        if self.sim_ops is None:
            self.sim_ops = [{'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_{self.simkey}'}]

        for so in self.sim_ops:
            simstart = datetime.now()
            if callable(so['prepare']):
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

    def updatePickUps(self):
        mdate = self._max_date()
        if mdate == TradingDate.maxTradingDate():
            print(self.__class__.__name__, 'updatePickUps already updated to latest!')
            return
        self.walkOnHistory(mdate)
