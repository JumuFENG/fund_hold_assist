# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *


class StockGapztSelector(StockBaseSelector):
    '''
    选股： 跳空涨停 回踩买入
    跳空涨停缺口一般出现在上涨末期，回踩基本不再破前高，支撑作用小
    跳空跌停缺口一般出现在下跌初期，突破成功概率低，压力作用大
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_gapzt_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'gapl', 'type':'float DEFAULT NULL'},
            {'col':'tdate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'tprice', 'type':'float DEFAULT NULL'},
            {'col':'edate', 'type':'varchar(20) DEFAULT NULL'}
        ]

    # def walk_prepare(self, date=None):
    #     super().walk_prepare(date)
    #     self.wkstocks = [['SH601012','2012-04-11']]
    #     self.threads_num = 1

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 1
            while i < len(allkl):
                kl0 = allkl[i - 1]
                kl1 = allkl[i]
                if kl1.high != kl1.close or kl1.close < Utils.zt_priceby(kl0.close) or kl1.pchange < 9:
                    i += 1
                    continue

                if kl0.high >= kl1.low:
                    i += 1
                    continue

                gapl = kl0.high
                tprice = kl1.high
                tdate = kl1.date
                j = i + 1
                while j < len(allkl):
                    if allkl[j].high < tprice:
                        break
                    if allkl[j].high > tprice:
                        tprice = allkl[j].high
                        tdate = allkl[j].date
                        j += 1
                        continue
                    j += 1
                edate = allkl[j].date if j < len(allkl) else None
                while j < len(allkl):
                    if allkl[j].high >= tprice:
                        edate = allkl[j].date
                        break
                    if allkl[j].low <= gapl:
                        edate = None
                        break
                    j += 1

                self.wkselected.append([c, kl1.date, gapl, tdate, tprice, edate])
                i += 1

    def double_gap(self):
        gaps = self.sqldb.select(self.tablename)
        cgaps = {}
        for _,c,d,g,t,tp,e in gaps:
            if not c in cgaps:
                cgaps[c] = []
            if t not in cgaps[c]:
                cgaps[c].append(t)
            else:
                print(c, t)


class StockGapdtSelector(StockBaseSelector):
    '''
    选股： 跳空跌停 反弹做空卖出
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_gapdt_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'gaph', 'type':'float DEFAULT NULL'},
            {'col':'ldate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'lprice', 'type':'float DEFAULT NULL'},
            {'col':'edate', 'type':'varchar(20) DEFAULT NULL'}
        ]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 1
            while i < len(allkl):
                kl0 = allkl[i - 1]
                kl1 = allkl[i]
                if kl1.low != kl1.close or kl1.close < Utils.dt_priceby(kl0.close) or kl1.pchange > -9:
                    i += 1
                    continue

                if kl0.low <= kl1.high:
                    i += 1
                    continue

                gaph = kl0.low
                lprice = kl1.low
                ldate = kl1.date
                j = i + 1
                while j < len(allkl):
                    if allkl[j].low > lprice:
                        break
                    if allkl[j].low < lprice:
                        lprice = allkl[j].low
                        ldate = allkl[j].date
                        j += 1
                        continue
                    j += 1
                edate = allkl[j].date if j < len(allkl) else None
                while j < len(allkl):
                    if allkl[j].low <= lprice:
                        edate = allkl[j].date
                        break
                    if allkl[j].high >= gaph:
                        edate = None
                        break
                    j += 1

                self.wkselected.append([c, kl1.date, gaph, ldate, lprice, edate])
                i += 1

