# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from history.stock_history import *
from history.stock_dumps import *
from pickup.stock_base_selector import *


class StockZt1Selector(StockBaseSelector):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'上板强度','type':'float DEFAULT NULL'},
            {'col':'放量程度','type':'float DEFAULT NULL'} # 成交量/10日均量
        ]
        self._sim_ops = [
            # 首板次日买入, MA卖出
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_1'}
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)

            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-30)).strftime(r"%Y-%m-%d")
            allkl = self.get_kd_data(c, start=kdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].date == sdate:
                    break
                i += 1

            if i >= len(allkl) or sdate != allkl[i].date:
                continue

            zdf = 10 if c.startswith('SZ00') or c.startswith('SH60') else 20
            while i < len(allkl):
                if i < 2 or allkl[i-1].close == allkl[i-1].high and allkl[i-1].close >= Utils.zt_priceby(allkl[i-2].close, zdf=zdf):
                    i += 1
                    continue

                if allkl[i].close == allkl[i].high and allkl[i].close >= Utils.zt_priceby(allkl[i-1].close, zdf=zdf):
                    ztdate = allkl[i].date
                    st = KlList.get_zt_strengh(allkl, ztdate)
                    vs = KlList.get_vol_scale(allkl, ztdate)
                    self.wkselected.append([c, ztdate, st, vs])
                i += 1

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_thread(self):
        # 买入就大涨，尽快卖出
        # 买入之后不温不火，但又不满足卖出条件，遇到跌停/大幅低开，直接卖出
        orstks = []
        snum = 0
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
            bsdates = []
            snum += 1
            # if snum > 10:
            #     break
            for code, date in orstks:
                if len(bsdates) > 0:
                    mid_bs = False
                    for b,s in bsdates:
                        if date > b and date < s:
                            mid_bs = True
                            break
                    if mid_bs:
                        continue

                if kd is None:
                    kd = self.get_kd_data(code, date)
                ki = 0
                while kd[ki].date != date:
                    ki += 1

                if ki > 0:
                    kd = kd[ki:]
                    if kd is None or len(kd) < 3 :
                        continue

                kl0 = kd[0]
                assert kl0.date == date, 'wrong kl data'

                kl1 = kd[1]
                op0 = kl1.open
                hi0 = kl1.high
                lo0 = kl1.low
                cl0 = kl1.close

                if hi0 == lo0 and lo0 >= Utils.zt_priceby(kl0.close, zdf=10 if code.startswith('00') or code.startswith('60') else 20):
                    # 一字涨停 无法买进
                    continue

                buy = op0
                bdate = kl1.date
                sell = 0
                sdate = kl1.date
                kd = KlList.calc_kl_bss(kd)
                j = 2
                while j < len(kd):
                    if kd[j].bss18 == 's':
                        # 满足卖出条件
                        sell = kd[j].close
                        sdate = kd[j].date
                        break
                    # if j > 10:
                    #     if kd[j].open < kd[j - 1].close * 0.94 and kd[j].open > buy:
                    #         # 突然大幅低开，有盈利即卖出
                    #         sell = kd[j].open
                    #         sdate = kd[j].date
                    #         break
                    #     if kd[j].low < kd[j - 1].close * 0.92 and kd[j].low > buy:
                    #         # 突然大幅下杀，有盈利即卖出
                    #         sell = kd[j].low
                    #         sdate = kd[j].date
                    #         break
                    if j > 2 and kd[j].close - buy > buy * (1 + 0.06 * (j - 1)):
                        # 大幅上涨
                        sell = kd[j].close
                        sdate = kd[j].date
                        break
                    j += 1

                if sdate > bdate:
                    bsdates.append([bdate, sdate])
                    count = round(1000/buy)
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(buy, 2), 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(sell, 2), 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0

            orstks = []

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '上板强度', '放量程度'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'{column_date} = "{date}"')

    def dumpSelectedRecords(self):
        dmpkeys = self._select_keys([column_code, column_date])
        return self.sqldb.select(self.tablename, dmpkeys)
