# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from pickup.stock_base_selector import *


class StockAqkSelector(StockBaseSelector):
    ''' 'A' 字快速杀跌反弹选股
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_aqk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}, # 入选日期
            {'col':'前低日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'高点日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'上涨比率','type':'float DEFAULT NULL'},
            {'col':'下跌比率','type':'float DEFAULT NULL'}, 
            {'col':'建仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'清仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'实盘',   'type':'tinyint DEFAULT 0'},
            {'col':'交易记录','type':'varchar(255) DEFAULT NULL'}
        ]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            code, d = self.wkstocks.pop(0)
            klines = self.get_kd_data(code, d)
            i = 0
            minlist = list()
            picked = list()
            while i < len(klines):
                minlist.append([klines[i].low, i, klines[i].high, i])
                # 最小值队列
                ej = 30
                for j in range(1, 30):
                    if i + j >= len(klines):
                        ej = j
                        break
                    while len(minlist) > 0 and klines[i+j].low <= minlist[-1][0]:
                        minlist.pop()
                    minlist.append([klines[i+j].low, i+j, klines[i+j].high, i+j])
                i += ej

                while len(minlist) > 0:
                    k = minlist[0][3]
                    # 查找最小值之后30日内的最大值
                    for j in range(1, 30):
                        if k + j < len(klines) and klines[k + j].high > minlist[0][2]:
                            minlist[0][2] = klines[k + j].high
                            minlist[0][3] = k + j
                    # 查找继续上涨的最高点
                    k = minlist[0][3] + 1
                    while k < len(klines):
                        if klines[k].high < minlist[0][2]:
                            break
                        minlist[0][2] = klines[k].high
                        minlist[0][3] = k
                        k += 1
                    i = k

                    # 最小值到最大值的涨幅小于50%则丢弃
                    if minlist[0][2] - minlist[0][0] < minlist[0][0] * 0.5:
                        minlist.pop(0)
                        continue

                    # 查找最大值之后30日内最小值
                    k = minlist[0][3]
                    minlist[0].append(klines[k].low)
                    minlist[0].append(k)
                    for j in range(1, 30):
                        if k + j >= len(klines) or klines[k + j].high >= minlist[0][2]:
                            break
                        if klines[k + j].low < minlist[0][4]:
                            minlist[0][4] = klines[k + j].low
                            minlist[0][5] = k + j

                    # 查找继续下跌的最低点
                    k = minlist[0][5] + 1
                    while k < len(klines):
                        if klines[k].low > minlist[0][4]:
                            break
                        minlist[0][4] = klines[k].low
                        minlist[0][5] = k
                        k += 1

                    # 最大值到最小值的跌幅小于28%则丢弃
                    if minlist[0][2] - minlist[0][4] < minlist[0][2] * 0.28:
                        minlist.pop(0)
                        continue

                    # 最大值相同时选择起涨点更靠后者
                    if len(picked) == 0 or minlist[0][3] != picked[-1][3]:
                        picked.append(minlist[0])
                    elif minlist[0][1] > picked[-1][1]:
                        if minlist[0][1] - picked[-1][1] > picked[-1][3] - minlist[0][1] or minlist[0][0] <= picked[-1][0]:
                            picked.pop()
                            picked.append(minlist[0])

                    if i < minlist[0][3]:
                        i = minlist[0][3] + 1
                    minlist.pop(0)

            for i in range(0, len(picked)):
                # code, 前低 高 后低
                print(code, klines[picked[i][1]].date, picked[i][0], klines[picked[i][3]].date, picked[i][2], klines[picked[i][5]].date, picked[i][4])


class StockAmkSelector(StockBaseSelector):
    ''' 闷杀: 
    1, 涨停之后快速跌停+一字跌停 大幅低开不跌停买入 前期密集成交区附近买入
    2, 一字跌停, 忽略前方是否涨停
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_amk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}, # 首板涨停日期
            {'col':'ddate','type':'varchar(20) DEFAULT NULL'}, # 首次跌停/不涨停日期
            {'col':'zdays', 'type':'tinyint DEFAULT 0'}, # 连续涨停天数
            {'col':'ddays', 'type':'tinyint DEFAULT 0'}, # 连续跌停天数
            {'col':'bdate','type':'varchar(20) DEFAULT NULL'}, # 买入日期
        ]
        self.sim_upbound = -0.05
        self.sim_cutrate = 0.105
        self.sim_earnrate = 0.065
        self._sim_ops = [
            # 大幅低开 不跌停或跌停打开时买入
            # 卖出条件，止损/止盈/买入次日大幅低开
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_amk_1'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_history_thread_bk(self):
        # 方式1 
        while len(self.wkstocks) > 0:
            c, d = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=d)
            if allkl is None or len(allkl) < 5:
                continue

            j = 1
            while j < len(allkl):
                t = j
                j += 1
                if allkl[t].high == allkl[t].close and allkl[t].pchange > 9:
                    d0 = t
                    t += 1
                    if t >= len(allkl):
                        break
                    # 查找第一个不涨停的k线
                    while t < len(allkl):
                        if allkl[t].close != allkl[t].high or allkl[t].close < Utils.zt_priceby(allkl[t-1].close):
                            break
                        t += 1
                    # if t >= len(allkl) or allkl[t].close != allkl[t].low or allkl[t].close > Utils.dt_priceby(allkl[t-1].close):
                    #     break
                    # # 第一天跌停
                    if t >= len(allkl):
                        break
                    d1 = t
                    t += 1
                    if t >= len(allkl):
                        break
                    while t < len(allkl):
                        # 首次跌停之后一字跌停
                        if allkl[t].low != allkl[t].high or allkl[t].close > Utils.dt_priceby(allkl[t-1].close):
                            break
                        t += 1
                    if t == d1 + 1:
                        # 次日不是一字跌停
                        continue
                    d2 = t

                    j = t
                    if d0 == 0:
                        continue
                    self.wkselected.append([c, allkl[d0].date, allkl[d1].date, d1 - d0, d2 - d1, allkl[d2].date])

    def walk_prepare(self, date=None):
        super().walk_prepare(date)
        self.threads_num = 1

    def walk_on_history_thread(self):
        # 方式2
        while len(self.wkstocks) > 0:
            c, d = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=d)
            if allkl is None or len(allkl) < 5:
                continue

            j = 1
            while j < len(allkl):
                t = j
                j += 1
                if allkl[t].low == allkl[t].high and allkl[t].close <= Utils.dt_priceby(allkl[t-1].close):
                    # 第一个一字跌停的k线
                    t0 = t - 1
                    t += 1
                    if t >= len(allkl):
                        break
                    while t < len(allkl):
                        # 连续一字跌停
                        if allkl[t].close != allkl[t].high or allkl[t].close > Utils.dt_priceby(allkl[t-1].close):
                            break
                        t += 1
                    if t >= len(allkl):
                        break
                    while t0 > 0:
                        # 
                        if allkl[t0].close > Utils.dt_priceby(allkl[t0 - 1].close):
                            break
                        t0 -= 1
                    # t0: 一字跌停之前第一天不跌停 t: 一字跌停之后第一个不一字跌停
                    if t0 == 0:
                        j = t + 1
                        continue
                    zt2 = t0
                    if t0 > 0 and allkl[t0].close < Utils.zt_priceby(allkl[t0-1].close):
                        zt2 = t0 - 1
                        if zt2 > 0 and allkl[zt2].close < Utils.zt_priceby(allkl[zt2-1].close):
                            zt2 = None
                    zt1 = None
                    if zt2 is not None:
                        zt1 = zt2
                        while zt1 > 0:
                            if allkl[zt1].close < Utils.zt_priceby(allkl[zt1-1].close):
                                break
                            zt1 -= 1
                    if zt2 is not None and zt1 > 0:
                        zt1 += 1

                    j = t + 1
                    if zt1 is not None and zt1 == 0:
                        continue
                    self.wkselected.append([c, None if zt2 is None else allkl[zt1].date, allkl[t0+1].date if t0==zt1 else allkl[t0].date, 0 if zt2 is None else zt2-zt1+1, t-t0-1, allkl[t].date])

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ddate, zdays, ddays, bdate', f'{column_date} is not NULL')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[2]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        for i in range(0, len(orstks)):
            code, d, ddate, zd, dd, bdate = orstks[i]
            allkl = self.get_kd_data(code, ddate if d is None else d)
            ki = 0
            while allkl[ki].date != bdate:
                ki += 1
            if ki > 0:
                if len(allkl) < ki + 3:
                    continue

            cl0 = allkl[ki - 1].close
            # if self.sim_upbound is not None and allkl[ki].open - (1+self.sim_upbound) * cl0 > 0:
            #     continue
            if allkl[ki].low == allkl[ki].high and allkl[ki].low <= Utils.dt_priceby(cl0):
                continue
            buy = allkl[ki].open
            if allkl[ki].open <= Utils.dt_priceby(cl0):
                buy = min(allkl[ki].open * 1.02, (allkl[ki].high + allkl[ki].open) / 2)
            sell = 0
            sdate = bdate
            j = ki + 1
            cutl = buy * (1 - self.sim_cutrate)
            earnl = buy * (1 + self.sim_earnrate)
            if allkl[ki].close - buy > self.sim_cutrate * buy:
                # 买入当日大阳线反包
                cutl = max(allkl[ki].close * (1 - self.sim_earnrate), buy)
                earnl = allkl[ki].close * (1 + self.sim_earnrate)
            # elif allkl[ki].high - buy > self.sim_cutrate * buy:
            #     # 买入当日冲高回落
            #     cutl = min(allkl[ki].high * (1 - self.sim_earnrate), buy)
            #     earnl = max(allkl[ki].high, allkl[ki].close * (1 + self.sim_earnrate))
            elif buy - allkl[ki].close > self.sim_cutrate * buy:
                # 买入当日亏损
                cutl = allkl[ki].close * (1 - self.sim_cutrate)
                earnl = max(allkl[ki].close * (1 + self.sim_earnrate), buy)
            while j < len(allkl):
                clp0 = allkl[j-1].close
                if allkl[j].high == allkl[j].low and allkl[j].high <= Utils.dt_priceby(clp0):
                    # 一字跌停，无法卖出
                    j += 1
                    continue
                if allkl[j].low == allkl[j].high and allkl[j].low >= Utils.zt_priceby(clp0):
                    # 一字涨停，持股不动
                    cutl = allkl[j].close * 0.97
                    earnl = allkl[j].close * (1 + self.sim_earnrate)
                    j += 1
                    continue
                if allkl[j].open < cutl:
                    if allkl[j].open > Utils.dt_priceby(clp0):
                        sell = allkl[j].open
                        sdate = allkl[j].date
                        break
                if allkl[j].low < cutl:
                    sell = cutl
                    sdate = allkl[j].date
                    break
                if allkl[j].high >= earnl:
                    sell = (allkl[j].high + earnl) / 2
                    sdate = allkl[j].date
                    break
                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def simulate_all(self):
        # for ub in range(20, 80, 5):
        for er in range(30, 80, 5):
            for ce in range(80, 120, 5):
                self.sim_cutrate = ce / 1000
                self.sim_earnrate = er / 1000
                # self.sim_upbound = -ub / 1000
                self.sim_ops = [{'prepare': self.sim_prepare,
                                 'thread': self.simulate_buy_sell,
                                 'post': self.sim_post_process,
                                 'dtable': f'track_sim_amk_c{ce}_e{er}'},]#_e{er}u{ub}
                self.simulate()
        self.simulate()


class StockNewIpoSelector(StockBaseSelector):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}, # 上市日期
            {'col':'ddate','type':'varchar(20) DEFAULT NULL'}, # 首次开板日期
            {'col':'bdate','type':'varchar(20) DEFAULT NULL'}, # 买入日期
        ]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=d)
            if allkl is None or len(allkl) < 5:
                continue

            j = 0
            while j < len(allkl):
                t = j
                j += 1
                if allkl[t].high == allkl[t].close and allkl[t].pchange > 9:
                    # 查找第一个不涨停的k线
                    d0 = t
                    t += 1
                    if t >= len(allkl):
                        break
                    while t < len(allkl):
                        if allkl[t].close != allkl[t].high or allkl[t].close < Utils.zt_priceby(allkl[t-1].close):
                            break
                        t += 1
                    # if t >= len(allkl) or allkl[t].close != allkl[t].low or allkl[t].close > Utils.dt_priceby(allkl[t-1].close):
                    #     break
                    # # 第一天跌停
                    if t >= len(allkl):
                        break
                    d1 = t
                    t += 1
                    if t >= len(allkl):
                        break
                    while t < len(allkl):
                        # 首次跌停之后一字跌停
                        if allkl[t].low != allkl[t].high or allkl[t].close > Utils.dt_priceby(allkl[t-1].close):
                            continue
                        t += 1
                    if t == d1 + 1:
                        # 次日不是一字跌停
                        break
                    if allkl[t].low > allkl[t-1].close * 0.95 or allkl[t].open <= Utils.dt_priceby(allkl[t-1].close):
                        # 首次跌停开板最低价必须打到较低位置 不是跌停开盘
                        break
                    d2 = t

                    j = t
                    if d0 == 0:
                        continue
                    self.wkselected.append([c, allkl[d0].date, allkl[d1].date, d1 - d0 + 1, d2 - d1 + 1, allkl[d2].date])


class StockLShapeSelector(StockBaseSelector):
    '''大跌之后中阴线买入, 网格法买入加仓, L型反弹'''
    '''破位阴不建仓, 横盘超过10交易日止损, 加仓3次之后再下跌5%止损, 胜率98%'''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_qk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}, # 入选日期
            {'col':'bdate','type':'varchar(20) DEFAULT NULL'},
            {'col':'bmatch','type':'tinyint DEFAULT NULL'}
        ]
        self.grate = 0.05   # 网格幅度, 热门股5% 大盘股/ETF基金2%-3% 宽基指数1.5%
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_qk_ls'}
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_prepare(self, date=None):
        super().walk_prepare(date)
        ufstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}', 'bdate is NULL')
        ufdic = {c: d for c,d in ufstks}
        for stk in self.wkstocks:
            if stk[0] in ufdic:
                stk[1] = ufdic[stk[0]]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=d)
            if allkl is None:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].pchange > -9:
                    i += 1
                    continue

                wkstk = [c, allkl[i].date, None, None]
                j = i + 1
                top = allkl[i].high
                if j < len(allkl):
                    if top < allkl[j].high:
                        top = allkl[j].high
                btm = allkl[j].low if j < len(allkl) else allkl[i].close
                while j < len(allkl):
                    if allkl[j].pchange <= -5 and allkl[j].pchange > -9 and allkl[j].close < allkl[j].open:
                        wkstk[2] = allkl[j].date
                        wkstk[3] = 1
                        break
                    if allkl[j].high > top:
                        wkstk[2] = allkl[j].date
                        wkstk[3] = 0
                        break
                    if j - i > 3 and allkl[j].close > (top + btm) / 2:
                        wkstk[2] = allkl[j].date
                        wkstk[3] = 0
                        break
                    if j - i > 15:
                        wkstk[2] = allkl[j].date
                        wkstk[3] = 0
                        break
                    if allkl[j].low < btm:
                        btm = allkl[j].low
                    if allkl[j].high > top:
                        top = allkl[j].high
                    j += 1
                self.wkselected.append(wkstk)
                i = j

    def walk_post_process(self):
        values = []
        for c, d, ed, m in self.wkselected:
            if ed is None and c in self.tsdate:
                ed = '0'
                m = 0
            cid = self.sqldb.selectOneValue(self.tablename, f'id', {column_code: c, column_date: d})
            if cid is None:
                values.append([c, d, ed, m])
                continue
            if ed is None:
                continue
            self.sqldb.update(self.tablename, {'bdate': ed, 'bmatch': m}, {'id': cid})
        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def updatePickUps(self):
        mdate = self.sqldb.selectOneValue(self.tablename, f'max({column_date})', 'bdate is NULL')
        self.walkOnHistory(mdate)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, 'bdate', 'bmatch'])

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'bdate is NULL or bdate = "{date}"'

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code},{column_date}, bdate, bmatch')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for c, d, bd, bm in orstks:
            if bm == 0 or bd is None:
                continue

            if kd is None:
                kd = self.get_kd_data(c, d)

            ki = 0
            st = False
            while ki < len(kd) and kd[ki].date != bd:
                if kd[ki].high == kd[ki].low and (round(kd[ki].pchange) == 5 or round(kd[ki].pchange) == -5):
                    st = True
                    break
                ki += 1
            if ki == len(kd) or st:
                continue

            # while ki < len(kd):
            while kd[ki].pchange > -self.grate*100 or kd[ki].pchange <= -9:
                ki += 1
                if ki >= len(kd):
                    break
            if ki >= len(kd):
                break
            buypd = [[kd[ki].close, kd[ki].date]]
            sell = 0
            sdate = None

            j = ki + 1
            while j < len(kd):
                if kd[j].pchange > -9 and kd[j].high - buypd[-1][0] > self.grate * buypd[0][0]:
                    sell = max(buypd[-1][0] + self.grate * buypd[0][0], (kd[j].high + kd[j].close) / 2)
                    sdate = kd[j].date
                    break
                elif len(buypd) < 4:
                    n = 2 if len(buypd) == 1 else 1
                    if kd[j].high == kd[j].low and (round(kd[j].pchange) == 5 or round(kd[j].pchange) == -5):
                        break
                    if buypd[-1][0] - kd[j].close >= n * self.grate * buypd[0][0]:
                        buypd.append([kd[j].close,kd[j].date])
                else:
                    if buypd[-1][0] - kd[j].low >= self.grate * buypd[0][0]:
                        sell = kd[j].close
                        sdate = kd[j].date
                        break
                j += 1

            if sell != 0 and sdate is not None:
                self.sim_add_deals(c, buypd, (sell, sdate), 1000, 2, self.grate)
