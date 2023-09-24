# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *

class StockEuSelector(StockBaseSelector):
    '''
    选股： 阳包阴 尾盘买入
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_eu_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'edate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'ebody', 'type':'float DEFAULT NULL'},
            {'col':'udate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'ubody', 'type':'float DEFAULT NULL'},
            {'col':'iszt', 'type':'tinyint DEFAULT NULL'}
        ]
        self.sim_lowbound = None
        self.sim_upbound = None
        self.sim_cutrate = 0.125
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 阴+涨停
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt'},
            # 阳包阴 尾盘买入 下引线低点止损 低点抬高法卖出
            {'prepare': self.sim_prepare1, 'thread': self.simulate_thread1, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt_ul0_uu0_01'},
            ]
        self.sim_ops = self._sim_ops[1:2]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            # if not c.startswith('SZ00') and not c.startswith('SH60'):
            #     continue

            allkl = self.get_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 1
            while i < len(allkl) - 1:
                kl1 = allkl[i]
                if kl1.open <= kl1.close:
                    i += 1
                    continue
                kl2 = allkl[i+1]
                if kl2.open >= kl2.close:
                    i += 1
                    continue
                if kl2.close > kl1.open and kl2.open < kl1.close:
                    kl0 = allkl[i-1]
                    ebody = round((kl1.open - kl1.close) / kl0.close, 4)
                    ubody = round((kl2.close - kl2.open) / kl1.close, 4)
                    iszt = 1 if kl2.close >= Utils.zt_priceby(kl1.close) else 0
                    self.wkselected.append([c, kl0.date, kl1.date, ebody, kl2.date, ubody, iszt])
                i += 1

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, edate, udate', f'iszt = 1')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

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

            kd = None
            for code, dt, edt, udt in orstks:
                if not code.startswith('SZ00') and not code.startswith('SH60'):
                    continue
                if kd is None:
                    kd = self.get_kd_data(code, dt)
                ki = 0
                while kd[ki].date != edt:
                    ki += 1
                if ki > 0:
                    kd = kd[ki:]
                    if kd is None or len(kd) < 4:
                        continue

                kldt = kd[0]
                assert kldt.date == edt, 'wrong kl data!'

                klzt = kd[1]
                i = 2
                kl1 = kd[i]
                op0 = kl1.open
                hi0 = kl1.high
                lo0 = kl1.low
                cl0 = kl1.close
                if hi0 == lo0 and cl0 >= Utils.zt_priceby(klzt.close):
                    # 一字涨停 无法买进
                    continue
                if self.sim_lowbound is not None and op0 < klzt.close * (1 + self.sim_lowbound):
                    # 低开 不买
                    continue
                if self.sim_upbound is not None and op0 > klzt.close * (1 + self.sim_upbound):
                    continue

                buy = op0
                bdate = kl1.date
                sell = 0
                sdate = kl1.date
                j = i + 1
                cutl = buy * (1 - self.sim_cutrate)
                earnl = buy * (1 + self.sim_earnrate)
                while j < len(kd):
                    clp3 = kd[j-1].close
                    klj = kd[j]
                    cl3 = klj.close
                    hi3 = klj.high
                    lo3 = klj.low
                    op3 = klj.open
                    if lo3 == hi3 and hi3 <= Utils.dt_priceby(clp3):
                        # 一字跌停，无法卖出
                        j += 1
                        continue
                    if lo3 == hi3 and hi3 >= Utils.zt_priceby(clp3):
                        # 一字涨停，持股不动
                        cutl = cl3 * 0.97
                        earnl = hi3
                        j += 1
                        continue
                    if op3 < cutl:
                        if op3 > Utils.dt_priceby(clp3):
                            sell = op3
                            sdate = klj.date
                            break
                    if lo3 < cutl:
                        sell = cutl
                        sdate = klj.date
                        break
                    if hi3 >= earnl:
                        sell = (hi3 + earnl) / 2
                        sdate = klj.date
                        break
                    j += 1

                if sdate != bdate:
                    count = round(1000/buy) * 100
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(buy, 2), 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(sell, 2), 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0

            orstks = []

    def sim_prepare1(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, edate, udate, ubody', f'iszt = 0')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.sim_ubody_lbound = None
        self.sim_ubody_ubound = 0.01
        self.sim_cutrate = 0.115
        self.sim_earnrate = 0.06

    def simulate_thread1(self):
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

            kd = None
            for code, dt, edt, udt, ubody in orstks:
                if kd is None:
                    kd = self.get_kd_data(code, dt)
                ki = 0
                while kd[ki].date != edt:
                    ki += 1
                if ki > 0:
                    kd = kd[ki:]
                    if kd is None or len(kd) < 4:
                        continue

                kldt = kd[0]
                assert kldt.date == edt, 'wrong kl data!'

                klzt = kd[1]
                assert klzt.date == udt, 'wrong kl data!'
                if self.sim_ubody_lbound is not None and ubody < self.sim_ubody_lbound:
                    continue
                if self.sim_ubody_ubound is not None and ubody > self.sim_ubody_ubound:
                    continue
                if max(klzt.high, kldt.high) - min(klzt.low, kldt.low) > 4 * (klzt.close - klzt.open):
                    continue
                if kldt.high - kldt.low > 1.3 * (klzt.high - klzt.low):
                    continue

                buy = klzt.close
                bdate = klzt.date
                sell = 0
                sdate = klzt.date
                cutl = min(kldt.low, klzt.low, buy * (1 - self.sim_cutrate))
                earnl = buy * (1 + self.sim_earnrate)
                j = 2
                while j < len(kd):
                    clp3 = kd[j-1].close
                    klj = kd[j]
                    cl3 = klj.close
                    hi3 = klj.high
                    lo3 = klj.low
                    op3 = klj.open
                    if lo3 == hi3 and hi3 <= Utils.dt_priceby(clp3):
                        # 一字跌停，无法卖出
                        j += 1
                        continue
                    if lo3 == hi3 and hi3 >= Utils.zt_priceby(clp3):
                        # 一字涨停，持股不动
                        cutl = cl3 * 0.97
                        cutl = hi3
                        j += 1
                        continue
                    if lo3 > cutl and earnl is not None and hi3 < earnl:
                        j += 1
                        continue
                    if earnl is not None and hi3 > earnl and lo3 > buy:
                        earnl = None
                        cutl = lo3
                        j += 1
                        continue
                    if op3 < cutl:
                        if op3 > Utils.dt_priceby(clp3):
                            sell = op3
                            sdate = klj.date
                            break
                    if lo3 < cutl:
                        sell = cutl
                        sdate = klj.date
                        break
                    if lo3 > cutl and earnl is None:
                        cutl = lo3
                    j += 1

                if sdate != bdate:
                    count = round(1000/buy)
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(buy, 2), 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(sell, 2), 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0

            orstks = []

    def simulate_bound(self):
        self.sim_prepare1()
        simstks = [s for s in self.sim_stks]
        for l in range(0, 10):
            self.sim_ubody_lbound = l / 100
            self.sim_ubody_ubound = (l + 1) / 100
            self.sim_stks = [s for s in simstks]
            self.sim_ops = [{'prepare': None, 'thread': self.simulate_thread1, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt_bound_l{l}_u{l+1}'}]
            self.simulate()
            self.sim_deals = []
