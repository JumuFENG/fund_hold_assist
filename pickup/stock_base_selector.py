# Python 3
# -*- coding:utf-8 -*-
from threading import Thread
import queue
from utils import *
from history import *
from pickup.stock_track_deals import *


class StockBaseSelector(MultiThrdTableBase):
    def __init__(self, autocreate=True) -> None:
        self.sqldb = None
        super().__init__(autocreate)
        self.stockdumps = None

    def initConstrants(self):
        self.threads_num = 2
        self.dbname = stock_db_name
        self.constraint = None
        self.tablename = 'stock_base_pickup'
        self.sim_ops = None
        self.simkey = 'base'
        self.simed_kd = {}
        self.simlock = Lock()
        self.dblock = Lock()

    def walk_prepare(self, date=None):
        stks = StockGlobal.all_stocks()
        self.wkstocks = []
        for s in stks:
            if date is None:
                if s[4] == 'ABStock' or s[4] == 'TSStock':
                    self.wkstocks.append([s[1], s[7] if s[7] > '1996-12-16' else '1996-12-16'])
            else:
                if s[4] == 'ABStock':
                    self.wkstocks.append([s[1], date])
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
        if not TradingDate.isTradingDate(start):
            start = TradingDate.nextTradingDate(start)
        if code in self.simed_kd and len(self.simed_kd[code]) > 0 and start >= self.simed_kd[code][0].date:
            n = 0
            while self.simed_kd[code][n].date < start:
                n += 1
                if n >= len(self.simed_kd[code]):
                    print('error kline data for', code, start)
                    return None
            return self.simed_kd[code][n:]
        elif code in self.simed_kd:
            self.simed_kd.pop(code)
            return self.get_kd_data(code, start, fqt)
        if self.stockdumps is None:
            self.stockdumps = StockDumps()
        self.dblock.acquire()
        kd = self.stockdumps.read_kd_data(code, start=start, fqt=fqt)
        self.dblock.release()
        if kd is None:
            return None
        self.simed_kd[code] = [KNode(kl) for kl in kd]
        return self.simed_kd[code]

    def sim_prepare(self):
        self.sim_stks = []
        self.sim_deals = []

    def simulate(self):
        # 用历史数据回测，生成买卖记录保存
        if self.sim_ops is None:
            self.sim_ops = [{'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_{self.simkey}'}]

        for so in self.sim_ops:
            simstart = datetime.now()
            if callable(so['prepare']):
                so['prepare']()
            sim_ths = []
            self.simulate_buy_sell = so['thread']
            for i in range(0, self.threads_num):
                t = Thread(target=self.simulate_thread)
                sim_ths.append(t)
                t.start()

            for t in sim_ths:
                t.join()

            so['post'](so['dtable'])
            print('time used: ', datetime.now() - simstart)

    def simulate_thread(self):
        orstks = []
        while len(self.sim_stks) > 0:
            self.simlock.acquire()
            if len(self.sim_stks) == 0:
                self.simlock.release()
                break
            while len(orstks) == 0 or self.sim_stks[0][0] == orstks[0][0]:
                orstks.append(self.sim_stks.pop(0))
                if len(self.sim_stks) == 0:
                    break
            self.simlock.release()

            self.simulate_buy_sell(orstks)
            orstks = []

    def simulate_buy_sell(self, orstks):
        pass

    def sim_add_deals(self, code, buypds, spd, cost, costadding=0, addinfo=None):
        '''
         costadding: 0 - 每次买入相同仓位
                     1 - 买入仓位递增, 增加额度addinfo (为None则增加cost)
                     2 - 买入仓位按浮亏/期望盈利率(addinfo)
        '''
        tcount = 0
        pdc = []
        bcost = cost
        if costadding == 0:
            for p, d in buypds:
                count = round(bcost/(100 * p)) * 100
                pdc.append([p, d, count])
                tcount += count
        elif costadding == 1:
            if addinfo is None:
                addinfo = cost
            for i, pd in enumerate(buypds):
                p, d = pd
                bcost = cost + i * addinfo
                count = round(bcost/(100 * p)) * 100
                pdc.append([p, d, count])
                tcount += count
        elif costadding == 2:
            count = round(bcost/(buypds[0][0]))
            tcount = count
            bcost = buypds[0][0] * count
            pdc.append([buypds[0][0], buypds[0][1], count])
            for i in range(1, len(buypds)):
                amount = (bcost - buypds[i][0] * count) / addinfo
                ncount = round((amount - buypds[i][0] * count) / buypds[i][0])
                pdc.append([buypds[i][0], buypds[i][1], ncount])
                tcount += ncount
                bcost += ncount * buypds[i][0]

        deals = []
        for p,d,c in pdc:
            deals.append({'time': d, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(p, 2), 'count': c})
        p, d = spd
        deals.append({'time': d, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(p, 2), 'count': tcount})
        self.sim_deals += deals
        return deals

    def sim_quick_sell(self, allkl, code, bdate, buy, erate, crate=None, cutl=None, zdf=None, mxdays=1):
        '''快速卖出, 涨停不卖出, mxdays日之内满足止盈止损卖出, 否则mxdays后尾盘卖出
        '''
        assert allkl[0].date == bdate, 'make sure the first kl data is the kl data of buy date'
        assert crate is not None or cutl is not None, 'crate or cutl should be set one of each'

        if allkl[0].low == allkl[0].high:
            # 买入当日为1字板,忽略
            return

        ki = 1
        sell, sdate = 0, None
        if cutl is None and crate is not None:
            cutl = buy * (1 - crate)
        earnl = buy * (1 + erate)
        if zdf is None:
            zdf = Utils.zdf_from_code(code)

        while ki < len(allkl) and ki <= mxdays:
            if allkl[ki].open < cutl:
                sell = allkl[ki].open
                sdate = allkl[ki].date
                break
            if allkl[ki].low < cutl:
                sell = cutl
                sdate = allkl[ki].date
                break
            if allkl[ki].high > earnl:
                if allkl[ki].close > earnl:
                    sell = (allkl[ki].high + allkl[ki].close) / 2
                else:
                    sell = earnl
                sdate = allkl[ki].date
                break
            if allkl[ki].high == allkl[ki].low and allkl[ki].high >= Utils.zt_priceby(allkl[ki-1].close, zdf=zdf):
                # 一字涨停则设置新的止盈止损位为+-5%
                cutl = allkl[ki].close * (1 - 0.05)
                earnl = allkl[ki].close * (1 + 0.05)
            elif allkl[ki].high == allkl[ki].low and allkl[ki].high <= Utils.dt_priceby(allkl[ki-1].close, zdf=zdf):
                # 一字跌停 次日再卖
                cutl = allkl[ki].close * (1 - 0.05)
                earnl = buy
            elif ki == mxdays:
                sell = allkl[ki].close
                sdate = allkl[ki].date
                break

            ki += 1
        if sdate is None and ki == len(allkl):
            sdate = allkl[-1].date
            sell = allkl[-1].close
        if len(allkl) == 1 and allkl[0].date < TradingDate.maxTradingDate():
            sdate = TradingDate.nextTradingDate(allkl[0].date)
            sell = 0
        if sdate is not None:
            self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
            return [sell, sdate]

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

