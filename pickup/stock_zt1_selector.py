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
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_1'}
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

    def simulate_buy_sell(self, orstks):
        # 买入就大涨，尽快卖出
        # 买入之后不温不火，但又不满足卖出条件，遇到跌停/大幅低开，直接卖出
        kd = None
        bsdates = []
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
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '上板强度', '放量程度'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'{column_date} = "{date}"')

    def dumpSelectedRecords(self):
        dmpkeys = self._select_keys([column_code, column_date])
        return self.sqldb.select(self.tablename, dmpkeys)


class StockZt1BreakupSelector(StockBaseSelector):
    '''3日内无涨停, 60日内有涨停, 当日涨停突破60日最高价打板买入, 不创新高卖出'''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1_brk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'ztdate','type':'varchar(20) DEFAULT NULL'},
            {'col':'iszt','type':'tinyint DEFAULT NULL'},
            {'col':'预选','type':'tinyint DEFAULT 0'}
        ]
        self.sim_cutrate = 0.08
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 首板突破前高打板买入
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_brk_os'}
            ]
        self.sim_ops = self._sim_ops[0:1]

    def ztindays(self, klist, days=1, zdf=10):
        # type: (list, int, int) -> bool
        ''' 前 days 内有涨停返回True
        '''
        if len(klist) <= days:
            return False
        for i in range(1, days+1):
            if klist[-i].high >= Utils.zt_priceby(klist[- i - 1].close, zdf=zdf) and klist[-i].high == klist[-i].close:
                return True
        return False

    def walk_on_history_thread(self):
        while(len(self.wkstocks) > 0):
            c, sdate = self.wkstocks.pop(0)
            if c.startswith('SZ30') or c.startswith('SH68'):
                continue

            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-100)).strftime(r"%Y-%m-%d")
            allkl = self.get_kd_data(c, start=kdate, fqt=1)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].date == sdate:
                    break
                i += 1

            if i >= len(allkl) or i <= 60 or sdate != allkl[i].date:
                continue

            zdf = 10
            while i < len(allkl):
                if self.ztindays(allkl[0: i], 2, zdf):
                    i += 1
                    continue

                if not self.ztindays(allkl[0: i], 61, zdf):
                    i += 1
                    continue

                # if i == len(allkl) - 1 and allkl[i].close < Utils.zt_priceby(allkl[i-1].close, zdf=zdf):
                #     if Utils.zt_priceby(allkl[i].close, zdf=zdf) > max([kl.high for kl in allkl[i-60:]]):
                #         self.wkselected.append([c, allkl[i].date, None, None, 0])

                if allkl[i].high < Utils.zt_priceby(allkl[i-1].close, zdf=zdf) or allkl[i].high <= max([kl.high for kl in allkl[i-60: i]]):
                    i += 1
                    continue

                self.wkselected.append([c, allkl[i-1].date, allkl[i].date, 1 if allkl[i].high == allkl[i].close else 0, 0])
                i += 1

            i = len(allkl) - 1
            if self.ztindays(allkl[0: i], 1, zdf):
                continue
            if not self.ztindays(allkl[0:i], 60, zdf):
                continue
            if allkl[i].close < Utils.zt_priceby(allkl[i-1].close, zdf=zdf):
                if Utils.zt_priceby(allkl[i].close, zdf=zdf) > max([kl.high for kl in allkl[i-60:]]):
                    self.wkselected.append([c, allkl[i].date, None, None, 0])

    def walk_post_process(self):
        if self.sqldb is None:
            self._check_or_create_table()

        values = []
        for c, d, zd, izt, isel in self.wkselected:
            cid = self.sqldb.selectOneValue(self.tablename, f'id', {column_code: c, 'ztdate': None, 'iszt': None})
            updz = {column_date: d, 'ztdate': zd, 'iszt': izt}
            if zd is None:
                updz['预选'] = isel
            if cid is None:
                ex = self.sqldb.selectOneRow(self.tablename, f'id, ztdate, iszt', {column_code:c, column_date: d})
                if ex is not None:
                    eid, ezd, eizt = ex
                    if ezd != zd or eizt != izt:
                        self.sqldb.update(self.tablename, updz , {'id', eid})
                    continue
                values.append([c, d, zd, izt, isel])
            else:
                self.sqldb.update(self.tablename, updz, {'id': cid})

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'{column_date} = "{date}"')

    def dumpLatesetCandidates(self, date=None, fullcode=True):
        if date is None:
            date = self._max_date()
        candidates = self.sqldb.select(self.tablename, column_code, [f'{column_date} = "{date}"'])
        return [c if fullcode else c[2:] for c, in candidates]

    def setCandidates(self, date, candidates):
        self.sqldb.updateMany(self.tablename, [column_date, column_code, '预选'], [column_date, column_code], [[date, code, 1] for code in candidates])

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate, iszt', ['ztdate is not NULL', 'date > "2020"'])
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date, zd, izt in orstks:
            if kd is None:
                kd = self.get_kd_data(code, date)
            ki = 0
            while kd[ki].date != zd:
                ki += 1

            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 2:
                    continue

            op0 = kd[0].open
            hi0 = kd[0].high
            lo0 = kd[0].low
            cl0 = kd[0].close

            buy = hi0
            bdate = kd[0].date
            sell = 0
            sdate = kd[0].date

            j = 1
            cutl = cl0 * (1 - self.sim_cutrate)
            earnl = buy * (1 + self.sim_earnrate)
            while j < len(kd):
                clp0 = kd[j-1].close
                cl1 = kd[j].close
                hi1 = kd[j].high
                lo1 = kd[j].low
                op1 = kd[j].open

                if lo1 == hi1 and hi1 <= Utils.dt_priceby(clp0):
                    # 一字跌停，无法卖出
                    j += 1
                    continue

                if lo1 == hi1 and hi1 >= Utils.zt_priceby(clp0):
                    # 一字涨停，持股不动
                    cutl = cl1 * (1 - self.sim_cutrate)
                    earnl = hi1
                    j += 1
                    continue

                if op1 < cutl:
                    if op1 > Utils.dt_priceby(clp0):
                        sell = op1
                        sdate = kd[j].date
                        break

                if lo1 < cutl:
                    sell = cutl
                    sdate = kd[j].date
                    break

                if hi1 >= earnl:
                    sell = (hi1 + earnl) / 2
                    sdate = kd[j].date
                    break

                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0
