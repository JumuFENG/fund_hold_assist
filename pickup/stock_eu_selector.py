# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *
from pickup.stock_zt_lead_selector import StockZtDaily

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
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt'},
            # 阳包阴 尾盘买入 下引线低点止损 低点抬高法卖出
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell1, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt_ul0_uu0_01'},
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

    def simulate_buy_sell(self, orstks):
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
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def sim_prepare1(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, edate, udate, ubody', f'iszt = 0')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.sim_ubody_lbound = None
        self.sim_ubody_ubound = 0.01
        self.sim_cutrate = 0.115
        self.sim_earnrate = 0.06

    def simulate_buy_sell1(self, orstks):
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
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def simulate_bound(self):
        self.sim_prepare1()
        simstks = [s for s in self.sim_stks]
        for l in range(0, 10):
            self.sim_ubody_lbound = l / 100
            self.sim_ubody_ubound = (l + 1) / 100
            self.sim_stks = [s for s in simstks]
            self.sim_ops = [{'prepare': None, 'thread': self.simulate_buy_sell1, 'post': self.sim_post_process, 'dtable': f'track_sim_euzt_bound_l{l}_u{l+1}'}]
            self.simulate()
            self.sim_deals = []


class StockTrippleBullSelector(StockBaseSelector):
    '''三阳买入
    选股条件; 连续3根阳线价升量涨 以突破此3根阳线的最高价为买入点 以第一根阳线到买入日期之间的最低价为止损价 止盈设置5%
    '''
    def __init__(self):
        super().__init__()
        self.erate = 0.05
        self.crate = 0.05

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_tripple_bull_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'预选','type':'tinyint DEFAULT 1'},
            {'col':'bdate','type':'varchar(20) DEFAULT NULL'}, # 开始日期
            {'col':'fdate','type':'varchar(20) DEFAULT NULL'}, # 结束日期 买入或者放弃跟踪
        ]
        self._sim_ops = [
            {'prepare': self.sim_preparema, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b_ma'},
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b1_ma'},
            # {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b2x'},
            # {'prepare': self.sim_prepare3, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b3x'},
            # {'prepare': self.sim_prepare4, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b4x'},
            {'prepare': self.sim_prepare5, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b5_ma'},
            {'prepare': self.sim_prepare5xma, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_3b5x_ma'},
            ]
        self.sim_ops = self._sim_ops

    def walk_prepare(self, date=None):
        self.nonefdates = {}
        self.maxfdates = {}
        self.wkstocks_que = queue.Queue()
        dfdates = self.sqldb.select(self.tablename, [column_code, column_date, 'fdate'])
        if dfdates is None or len(dfdates) == 0:
            super().walk_prepare()
            [self.wkstocks_que.put([c, '2020-01-01' if d < '2020' else d]) for c, d in self.wkstocks]
            return
        ncodes = {c: d for c,d,f in dfdates if f is None}
        xcodes = {}
        for c,d,f in dfdates:
            if f is None:
                continue
            if c not in xcodes:
                xcodes[c] = []
            xcodes[c].append(f)
        xcodes = {c:max(d) for c, d in xcodes.items()}
        pops = []
        for c in ncodes.keys():
            if c in xcodes and xcodes[c] > ncodes[c]:
                self.sqldb.delete(self.tablename, {column_code: c, column_date: ncodes[c]})
                pops.append(c)
        [ncodes.pop(c) for c in pops]
        self.nonefdates = ncodes
        super().walk_prepare(max(xcodes.values()))
        wkstocks = []
        for c,d in self.wkstocks:
            if c in ncodes:
                fdate = self.check_nonfinished(c, ncodes[c])
                if fdate is not None:
                    wkstocks.append([c, fdate])
                    xcodes[c] = fdate
                else:
                    wkstocks.append([c, ncodes[c]])
            elif c in xcodes:
                wkstocks.append([c, xcodes[c]])
            else:
                wkstocks.append([c, d])
        self.maxfdates = xcodes
        [self.wkstocks_que.put([c, d]) for c,d in wkstocks]
        self.upstocks = []
        bkdb = StockEmBk('BK0511')
        self.blockedst = bkdb.dumpDataByDate()

    def check_nonfinished(self, code, date):
        if code not in self.nonefdates:
            return
        kdate = (datetime.strptime(self.nonefdates[code], r'%Y-%m-%d') + timedelta(days=-12)).strftime(r"%Y-%m-%d")
        allkl = self.get_kd_data(code, start=kdate)
        if allkl is None or len(allkl) == 0:
            return
        i = 0
        while i < len(allkl) and allkl[i].date <= self.nonefdates[code]:
            i += 1
        if i >= len(allkl):
            return

        updatefdate = False
        if i >= 3 and allkl[i-1].date == self.nonefdates[code]:
            uprice = max(allkl[i-1].high, allkl[i-2].high, allkl[i-3].high)
            support = min(allkl[i-1].low, allkl[i-2].low, allkl[i-3].low)
            j = i
            while j < len(allkl) and allkl[j].date < date:
                j += 1
            while j < len(allkl):
                if allkl[j].high > uprice:
                    updatefdate = True
                    break
                if allkl[j].close < support and j - i > 10:
                    updatefdate = True
                    break
                j += 1
        if updatefdate:
            self.sqldb.update(self.tablename, {'fdate': allkl[j].date}, {column_code: code, column_date: self.nonefdates[code]})
            self.nonefdates.pop(code)
            if j > i:
                return allkl[j].date
            while j < len(allkl):
                if not (allkl[j].close > allkl[j-1].close and allkl[j].vol > allkl[j-1].vol and allkl[j].close > allkl[j].open):
                    break
                j += 1
            return allkl[j if j < len(allkl) else -1].date

    def walk_on_history_thread(self):
        while self.wkstocks_que.qsize() > 0:
            c, sdate = self.wkstocks_que.get()
            if c in self.blockedst:
                continue
            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-12)).strftime(r"%Y-%m-%d")
            allkl = self.get_kd_data(c, start=kdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl) and allkl[i].date < sdate:
                i += 1

            if i >= len(allkl):
                continue

            while i < len(allkl):
                if i < 2:
                    i += 1
                    continue
                if allkl[i].close < allkl[i].open or allkl[i-1].close < allkl[i-1].open or allkl[i-2].close < allkl[i-2].open:
                    i += 1
                    continue
                if allkl[i].close < allkl[i - 1].close or allkl[i-1].close < allkl[i - 2].close:
                    i += 1
                    continue
                if allkl[i].vol < allkl[i-1].vol or allkl[i-1].vol < allkl[i-2].vol:
                    i += 1
                    continue
                if allkl[i].pchange > 8 or allkl[i-1].pchange > 8 or allkl[i-2].pchange > 8:
                    i += 1
                    continue
                j = i + 1
                uprice = max(allkl[i].high, allkl[i-1].high, allkl[i-2].high)
                support = min(allkl[i].low, allkl[i-1].low, allkl[i-2].low)
                fdate = None
                while j < len(allkl):
                    if allkl[j].high > uprice or allkl[j].pchange < -5:
                        fdate = allkl[j].date
                        break
                    lowest = min([kl.low for kl in allkl[i-2 : j+1]])
                    if (uprice - lowest) / uprice > 0.1:
                        fdate = allkl[j].date
                        break
                    if allkl[j].close < support and j - i > 10:
                        fdate = allkl[j].date
                        break
                    j += 1

                if fdate is not None:
                    if c in self.nonefdates:
                        if self.nonefdates[c] == allkl[i].date:
                            self.upstocks.append([fdate, c, self.nonefdates[c]])
                        else:
                            self.upstocks.append([allkl[i-2].date, c, self.nonefdates[c]])
                            self.wkselected.append([c, allkl[i].date, 1, allkl[i-2].date, fdate])
                        self.maxfdates[c] = fdate
                        i = j
                        continue
                if c not in self.maxfdates or allkl[i-2].date > self.maxfdates[c]:
                    if fdate is not None and (c not in self.maxfdates or self.maxfdates[c] < fdate):
                        self.maxfdates[c] = fdate
                    if c in self.nonefdates and self.nonefdates[c] != allkl[i].date:
                        self.upstocks.append([allkl[i-2].date, c, self.nonefdates[c]])
                    self.wkselected.append([c, allkl[i].date, 1, allkl[i-2].date, fdate])
                i = j

    def walk_post_process(self):
        # self.sqldb.update(self.tablename, {'fdate': fdate}, {column_code: c, column_date: self.nonefdates[c]})
        self.sqldb.updateMany(self.tablename, ['fdate', column_code, column_date], [column_code, column_date], self.upstocks)
        return super().walk_post_process()

    def getDumpKeys(self):
        return [column_code, 'bdate', column_date]

    def getDumpCondition(self, date=None):
        return [f'fdate is NULL', '预选=1'] if date is None else [f'{column_date}="{date}"', f'fdate is NULL', '预选=1']

    def getLatestCandidatesHighLow(self, fullcode=False):
        cdb = self.sqldb.select(self.tablename, [column_code, column_date, 'bdate'], ['预选=1', 'fdate is NULL'])
        chl = []
        for c, d, b in cdb:
            allkl = self.get_kd_data(c, b, fqt=1)
            high = allkl[0].high
            i = 1
            while i < len(allkl) and allkl[i].date <= d:
                if allkl[i].high > high:
                    high = allkl[i].high
                i += 1
            low = min([kl.low for kl in allkl])
            chl.append([c if fullcode else c[2:], high, low])
        return chl

    def getDaysCandidatesHighLow(self, days = 5, fullcode=False):
        date = TradingDate.maxTradingDate()
        i = 1
        while i < days:
            date = TradingDate.prevTradingDate(date)
            i += 1
        cdb = self.sqldb.select(self.tablename, [column_code, column_date, 'bdate'], [f'{column_date}<"{date}"', '预选=1', 'fdate is NULL'])
        chl = []
        for c, d, b in cdb:
            allkl = self.get_kd_data(c, b, fqt=1)
            high = allkl[0].high
            i = 1
            while i < len(allkl) and allkl[i].date <= d:
                if allkl[i].high > high:
                    high = allkl[i].high
                i += 1
            low = min([kl.low for kl in allkl])
            chl.append([c if fullcode else c[2:], high, low])
        return chl

    def setFdate(self, code, date=None):
        code = StockGlobal.full_stockcode(code)
        if date is None:
            date = TradingDate.maxTradingDate()
        self.sqldb.update(self.tablename, {'fdate': date}, {column_code: code, 'fdate': None})

    def unsetCandidates(self, stks):
        cds = self.sqldb.select(self.tablename, [column_code, column_date], 'fdate is NULL')
        cds = {c: d for c, d in cds}
        self.sqldb.updateMany(self.tablename, [column_code, column_date, '预选'], [column_code, column_date], [[c, cds[c], 0] for c in stks])

    def sim_prepare(self):
        super().sim_prepare()
        cdbf = self.sqldb.select(self.tablename, [c['col'] for c in self.colheaders], 'fdate is not NULL')
        self.sim_stks = [[c,d,b,f] for c,d,x,b,f in cdbf]
        self.simkey = 'tribull'

    def checkfdate(self, di, fi):
        return True

    def check_market_ma(self, code, date):
        return True

    def check_market_ma1(self, code, date):
        return TradingDate.isKlAboveMa(date, code)

    def sim_preparema(self):
        self.sim_prepare()
        self.check_market_ma = self.check_market_ma1
    def sim_prepare1(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi == di + 1
        self.check_market_ma = self.check_market_ma1

    def sim_prepare2(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi >= di + 2
    def sim_prepare3(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi >= di + 3
    def sim_prepare4(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi >= di + 4
    def sim_prepare5(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi == di + 5
        self.check_market_ma = self.check_market_ma1
    def sim_prepare6(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi >= di + 6
        self.check_market_ma = self.check_market_ma1
    def sim_prepare5xma(self):
        self.sim_prepare()
        self.checkfdate = lambda di, fi: fi >= di + 5
        self.check_market_ma = self.check_market_ma1

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date, b, fdate in orstks:
            if kd is None or len(kd) == 0:
                kd = self.get_kd_data(code, b)
                if kd is None:
                    continue
            ki = 0
            while ki < len(kd) and kd[ki].date < b:
                ki += 1
            kd = kd[ki:]

            i = 0
            bi, di, fi = 0,0,0
            while i < len(kd):
                if kd[i].date == b:
                    bi =i
                if kd[i].date == date:
                    di =i
                if kd[i].date == fdate:
                    fi = i
                    break
                i += 1

            if not self.checkfdate(di, fi):
                continue

            uprice = max([kl.high for kl in kd[bi: di+1]])
            support = min([kl.low for kl in kd[bi: di+1]])
            if kd[fi].close < support or support * (1 + self.crate) < uprice:
                continue
            buy,bdate,sell,sdate = 0,None,0,None
            if kd[fi].open > uprice:
                if kd[fi].open < uprice * (1 + self.erate):
                    buy = kd[fi].open
                    bdate = kd[fi].date
                else:
                    continue
            elif kd[fi].high > uprice:
                buy = uprice
                bdate = kd[fi].date
            else:
                continue
            support = min([x.low for x in kd[di:fi+1]])
            if support * (1 + self.crate) < uprice:
                buy,bdate,sell,sdate = 0,None,0,None
                continue

            if not self.check_market_ma(code, TradingDate.prevTradingDate(bdate)):
                continue

            kk = fi + 1
            while kk < len(kd):
                if kd[kk].open < support:
                    sell = kd[kk].open
                    sdate = kd[kk].date
                elif kd[kk].low < support:
                    sell = support
                    sdate = kd[kk].date
                elif kd[kk].high > buy * (1 + self.erate):
                    sell = (kd[kk].high + kd[kk].close) / 2
                    sdate = kd[kk].date
                else:
                    kk += 1
                    continue
                break
            if sdate is not None:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                buy,bdate,sell,sdate = 0,None,0,None


class StockTrippleBullBjSelect(StockTrippleBullSelector):
    def walk_prepare(self, date=None):
        self.nonefdates = {}
        self.maxfdates = {}
        self.wkstocks_que = queue.Queue()
        stks = StockGlobal.all_stocks()
        self.wkstocks = []
        for s in stks:
            if s[4] == 'BJStock':
                self.wkstocks.append([s[1], '2024-09-24'])

        [self.wkstocks_que.put([c, '2020-01-01' if d < '2020' else d]) for c, d in self.wkstocks]
        self.upstocks = []
        self.blockedst = []
        self.wkselected = []

    def walk_post_process(self):
        for wk in self.wkselected:
            if wk[-1] is None or wk[-1] > '2024-10-25':
                print(wk)


class StockEndVolumeSelector(StockBaseSelector):
    ''' 尾盘竞价爆量 竞价成交量>0.04*全天成交量 换手>1% 成交额>1000万 30日内有涨停
    '''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_end_volume_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_volume,'type':'float DEFAULT 0'},
            {'col':column_amount,'type':'float(20,4) DEFAULT NULL'},
            {'col':'换手','type':'float DEFAULT 0'},
            {'col':'vol0','type':'float DEFAULT 0'},
            {'col':'vol1','type':'float DEFAULT 0'},
            {'col':'ztindays','type':'tinyint DEFAULT 0'},
            {'col':'竞价占比','type':'float DEFAULT 0'},
            {'col':'uvol','type':'float DEFAULT 0'}, # 未匹配量
            {'col': column_price,'type':'float DEFAULT 0'},
            {'col':'topprice','type':'float DEFAULT 0'},
            {'col':'预选','type':'tinyint DEFAULT 0'},
        ]
        self.ztdict30 = None
        self.blacked_stocks = None
        self.sim_zdays = 4
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d4'},
            {'prepare': self.sim_prepare3, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d3'},
            {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d2'},
            {'prepare': self.sim_prepare5, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d5'},
            # {'prepare': self.sim_prepare4, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d4'},
            # {'prepare': self.sim_prepare5, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d4'},
            # {'prepare': self.sim_prepare5xma, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_evol_d4'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_prepare(self, date=None):
        if self.ztdict30 is None:
            szt = StockZtDaily()
            self.ztdict30 = szt.dumpZtStockDictInDays(30)
        if self.blacked_stocks is None:
            stbk = StockEmBk('BK0511')
            self.blacked_stocks = stbk.dumpDataByDate()
        szdf = StockGlobal.getStocksZdfRank()
        self.wkstocks = queue.Queue()
        stocks_not_match = []
        stocks_match = []
        for rkobj in szdf:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            ze = rkobj['f4']  # 涨跌额
            cj = rkobj['f5']  # 成交量（手）
            ce = rkobj['f6']  # 成交额
            name = rkobj['f14'] # 名称
            if name.startswith('退市') or name.endswith('退'):
                continue
            if c == '-' or cj == '-' or ce == '-' or zd == '-' or ze == '-':
                continue
            if float(ce) < 10000000:
                continue
            hsl = rkobj['f8'] # 换手率
            if hsl < 1:
                continue
            cd = rkobj['f12'] # 代码
            code = StockGlobal.full_stockcode(cd)
            if code in self.ztdict30 and self.ztdict30[code] > 1 and code not in self.blacked_stocks:
                self.wkstocks.put([code, hsl, self.ztdict30[code]])
                stocks_match.append(code)
            else:
                stocks_not_match.append(code)
        self.wkselected = []
        self.trend_date = None
        if len(stocks_match) == 0:
            Utils.log(f'StockEndVolumeSelector szdf {len(szdf)}, ztdict30 {self.ztdict30}')

    def get_stock_trend(self, stock_code):
        secid = Utils.convert_stock_code_to_secid(stock_code)
        trends_url = f'http://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbfba10b&secid={secid}&ndays=1&iscr=1&iscca=0'
        trends_data = Utils.get_em_request(trends_url, 'push2his.eastmoney.com')
        data = json.loads(trends_data)

        if data["rc"] == 0:
            trends = data["data"]["trends"]
            trend_data_list = []

            for trend in trends:
                trend_data = trend.split(",")
                trend_data_list.append(trend_data)

            return trend_data_list

        else:
            print("请求失败，错误码:", data["rc"])
            return None

    def walk_on_history_thread(self):
        while self.wkstocks.qsize() > 0:
            code, hsl, zdays = self.wkstocks.get()
            trends = self.get_stock_trend(code)
            if trends is None:
                continue
            trends = [t for t in trends if int(t[5]) > 0]
            if len([t for t in trends if t[3] == t[4]]) >= 60:
                # 封板(涨停/跌停) 累计时间大于1小时
                continue
            vol = 0
            amt = 0
            for t in trends:
                vol += int(t[5])
                amt += float(t[6])
            vol0 = int(trends[0][5]) # 开盘成交量
            vol1 = int(trends[-1][5]) # 收盘成交量
            if amt - float(trends[-1][6]) < 10000000 or vol1/vol < 0.04:
                continue
            amt /= 10000
            if self.trend_date is None:
                self.trend_date = trends[0][0].split()[0]
            snapshot = Utils.get_em_snapshot(code[2:])
            cur_price = float(snapshot['realtimequote']['currentPrice'])
            top_price = float(snapshot['topprice'])
            buy1 = float(snapshot['fivequote']['buy1'])
            sell1 = float(snapshot['fivequote']['sale1'])
            uvol = 0
            if buy1 == sell1:
                buy2_count = snapshot['fivequote']['buy2_count']
                sell2_count = snapshot['fivequote']['sale2_count']
                uvol = buy2_count if buy2_count > 0 else -sell2_count
            else:
                if cur_price == buy1:
                    uvol = snapshot['fivequote']['buy1_count']
                elif cur_price == sell1:
                    uvol = -snapshot['fivequote']['sale1_count']
            self.wkselected.append([code, self.trend_date, vol, amt, hsl, vol0, vol1, zdays, round(vol1/vol, 4), uvol, cur_price, top_price, 0])

    def getDumpKeys(self):
        return [column_code, column_date, column_volume, column_amount, '换手', 'vol0', 'vol1', 'uvol', '竞价占比', 'ztindays']

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return [f'{column_date}="{date}"', '预选=0']

    def setCandidates(self, date, candidates):
        self.sqldb.updateMany(self.tablename, [column_code, column_date, '预选'], [column_code, column_date], [[code, date, 1] for code in candidates])

    def dumpLatesetCandidates(self, date=None, fullcode=True):
        if date is None:
            date = self._max_date()
        candidates = self.sqldb.select(self.tablename, f'{column_code}, 预选', [f'{column_date} = "{date}"'])
        picklen = len([c for c, p in candidates if p == 1])
        if picklen > 0:
            candidates = [c for c, p in candidates if p == 1]
        else:
            candidates = [c for c, p in candidates]
        return [c if fullcode else c[2:] for c in candidates]

    def dumpLatesetD4Candidates(self, date=None, fullcode=True):
        if date is None:
            date = self._max_date()
        candidates = self.sqldb.select(self.tablename, f'{column_code}', [f'{column_date} = "{date}"', 'ztindays=4'])
        return [c if fullcode else c[2:] for c, in candidates]

    def dumpDataWithRecents(self, date=None):
        if date is None:
            date = self._max_date()
        tdata = self.dumpDataByDate(date)
        rdata = []
        for td in tdata:
            c, d, zd = td[0], td[1], td[9]
            cdata = self.sqldb.select(self.tablename, self.getDumpKeys(), [f'{column_code}="{c}"', f'{column_date}<"{date}"'])
            cdata = sorted(cdata, key=lambda x: x[1], reverse=True)
            rdata.append(td)
            for cd in cdata:
                d1 = cd[1]
                zd1 = cd[9]
                if TradingDate.calcTradingDays(d1, d) == zd - zd1 + 1:
                    rdata.append(cd)
        if len(rdata) == len(tdata):
            Utils.log(f'no recents data, {date}')
        return rdata

    def updatePickUps(self):
        self.walkOnHistory()

    def sim_prepare(self):
        super().sim_prepare()
        evlist = self.sqldb.select(self.tablename, f'{column_code}, {column_date}', f'ztindays={self.sim_zdays}')
        self.sim_stks = sorted(evlist, key=lambda s: (s[0], s[1]))

    def sim_prepare3(self):
        self.sim_zdays = 3
        self.sim_prepare()
    def sim_prepare2(self):
        self.sim_zdays = 2
        self.sim_prepare()
    def sim_prepare5(self):
        self.sim_zdays = 5
        self.sim_prepare()

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date in orstks:
            if kd is None or len(kd) == 0:
                kd = self.get_kd_data(code, date)
                if kd is None:
                    continue
            ki = 0
            while ki < len(kd) and kd[ki].date < date:
                ki += 1
            kd = kd[ki+1:]
            if len(kd) == 0:
                continue
            self.sim_quick_sell(kd, code, kd[0].date, kd[0].open, 0.05, 0.08, mxdays=5)

    def dumpTrainingData(self, date=None):
        conds = f'{column_date}>="{date}"' if date is not None else ''
        evlist = self.sqldb.select(self.tablename, conds=conds)
        rdata, ry, tdata = [], [], []
        for i,c,d,v,a,hs,v0,v1,zdi,jz,uv,pr,top,pk in evlist:
            kdate = d
            for i in range(0, 20):
                kdate = TradingDate.prevTradingDate(kdate)
            allkl = self.get_kd_data(c, kdate, fqt=1)
            if allkl[0].date != kdate:
                print('kl data not valid', c, d)
                continue

            allkl = KlList.calc_kl_ma(allkl, 10)
            allkl = KlList.calc_vol_ma(allkl, 5)
            allkl = KlList.calc_amt_ma(allkl, 5)

            j = 0
            while j < len(allkl) and allkl[j].date < d:
                j += 1
            if allkl[j].date != d:
                print('kl data not valid', c, d)
                continue

            kl = allkl[j]
            raw0 = [c, d]
            v5 = (v-getattr(kl, 'vol5'))/getattr(kl, 'vol5')
            if v5 > 1:
                v5 = 1
            raw0.append(v5)
            a5 = (a-getattr(kl, 'amt5'))/getattr(kl, 'amt5')
            if a5 > 1:
                a5 = 1
            raw0.append(a5)
            raw0.append(hs/100)
            raw0.append(v0/v)
            raw0.append(v1/v)
            raw0.append(uv/v)
            raw0.append(jz)
            raw0.append(zdi/30)
            o = (kl.open-getattr(kl, 'ma10'))/getattr(kl, 'ma10')
            if o > 1:
                o = 1
            raw0.append(o)
            h = (kl.high-getattr(kl, 'ma10'))/getattr(kl, 'ma10')
            if h > 1:
                h = 1
            raw0.append(h)
            l = (kl.low-getattr(kl, 'ma10'))/getattr(kl, 'ma10')
            if l > 1:
                l = 1
            raw0.append(l)
            cl = (kl.close-getattr(kl, 'ma10'))/getattr(kl, 'ma10')
            if cl > 1:
                cl = 1
            raw0.append(cl)
            lcl = allkl[j-1].close
            raw0.append((kl.close - lcl)/lcl)

            if j + 2 < len(allkl):
                ztcount = 0
                for ki in range(j+1, j+3):
                    if allkl[ki].high >= Utils.zt_priceby(allkl[ki - 1].close, zdf=8):
                        ztcount += 1

                if ztcount > 0 and allkl[j+2].close >= 1.05 * allkl[j+1].open:
                    ry.append(1)
                else:
                    ry.append(0)
                rdata.append(raw0)
            else:
                tdata.append(raw0)

        return rdata, ry, tdata
