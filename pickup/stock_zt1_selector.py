# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from history.stock_history import *
from history.stock_dumps import *
from pickup.stock_base_selector import *
from pickup.stock_zt_lead_selector import StockZtDailyMain, StockZtDailyKcCy, StockZtDailyST, StockZtDailyBJ
import stockrt as srt


class StockZt0Selector(StockBaseSelector):
    '''首板打板买入，验胜率'''
    def __init__(self):
        super().__init__(False)

    def initConstrants(self):
        super().initConstrants()
        self.chghis = StockChangesHistory()

    def walk_prepare(self, date=None):
        self.wkselected = []
        ztstks = self.chghis.sqldb.select(self.chghis.tablename, f'{column_code}, {column_date}, info', f'{column_type}="4"')
        self.wkstocks = []
        dupsd = set()
        for c,d,i in ztstks:
            if not c.startswith('SH') and not c.startswith('SZ'):
                continue
            ddate = d.split(' ')[0]
            if (c, ddate) in dupsd:
                continue
            self.wkstocks.append([c,ddate, i])
            dupsd.add((c, ddate))

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d, i = self.wkstocks.pop(0)
            d0 = TradingDate.prevTradingDate(d)
            d0 = TradingDate.prevTradingDate(d0)
            d0 = TradingDate.prevTradingDate(d0)
            d0 = TradingDate.prevTradingDate(d0)
            allkl = self.get_kd_data(c, d0)
            if allkl is None or len(allkl) < 2:
                continue
            n = 1
            ztn = 0
            while allkl[n].date < d:
                zdf = 10 if c.startswith('SZ00') or c.startswith('SH60') else 20
                if allkl[n].close >= Utils.zt_priceby(allkl[n - 1].close, zdf=zdf):
                    ztn += 1
                n += 1
            if ztn > 0:
                continue
            allkl = allkl[n:]
            # allkl = self.get_kd_data(c, d)
            if allkl is None or len(allkl) < 2 or d != allkl[0].date:
                continue
            p0 = allkl[0].high
            o1 = allkl[1].open
            h1 = allkl[1].high
            l1 = allkl[1].low
            self.wkselected.append([c, d, (h1 - p0)*100/p0])

    def walk_post_process(self):
        suc5 = [[c,d,e] for c, d, e in self.wkselected if e > 5]
        suc3 = [[c,d,e] for c, d, e in self.wkselected if e > 3]
        suc = [[c,d,e] for c, d, e in self.wkselected if e > 0]
        print(len(suc5), len(suc3), len(suc), len(self.wkselected))
        for s in [suc5, suc3, suc]:
            print(len(s) * 100 / len(self.wkselected))


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
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_1'},
            # 首板3阴买入，
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell3, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1d3'}
            ]
        self.sim_ops = self._sim_ops[1:2]

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

    def check_3bear_kl(self, allkl, start=0, zdf=10):
        if len(allkl) <= start + 2:
            return False
        for i in range(0, 3):
            if allkl[start+i].close >= Utils.zt_priceby(allkl[start+i-1].close, zdf=zdf):
                return False
            if allkl[start+i].close > allkl[start+i].open:
                return False
        for i in range(1, 3):
            if allkl[start+i].vol > allkl[start+i-1].vol:
                return False
        return True

    def simulate_buy_sell3(self, orstks):
        kd = None
        for code, date in orstks:
            if kd is None or len(kd) == 0:
                kd = self.get_kd_data(code, date)
                if kd is None:
                    continue
            ki = 0
            while ki < len(kd) and kd[ki].date < date:
                ki += 1
            if ki+4 >= len(kd):
                continue
            if kd[ki].open < kd[ki].high: # 一字涨停或T字涨停
                continue
            zdf = 10
            if code.startswith('SH68') or code.startswith('SZ30'):
                zdf = 20
            elif code.startswith('BJ'):
                zdf = 30
            if not self.check_3bear_kl(kd, ki+1, zdf):
                continue

            kd = kd[ki+4:]
            self.sim_quick_sell(kd, code, kd[0].date, kd[0].open, 0.05, 0.08, zdf)



    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '上板强度', '放量程度'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'{column_date} = "{date}"')

    def dumpSelectedRecords(self):
        dmpkeys = self._select_keys([column_code, column_date])
        return self.sqldb.select(self.tablename, dmpkeys)


class StockZtFailSelector(StockBaseSelector):
    '''炸板尾盘买入, 次日开盘卖出'''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1_ztf_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'zshadow', 'type':'float DEFAULT NULL'},
            {'col':'close0', 'type':'float DEFAULT NULL'},
            {'col':'open1', 'type':'float DEFAULT NULL'},
            {'col':'date1', 'type':'varchar(20) DEFAULT NULL'},
        ]
        self._sim_ops = [
            # 上影线最小
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_ztf'}
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_on_history_thread(self):
        while(len(self.wkstocks) > 0):
            c, sdate = self.wkstocks.pop(0)
            if c.startswith('SZ30') or c.startswith('SH68'):
                continue

            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-15)).strftime(r"%Y-%m-%d")
            allkl = self.get_kd_data(c, start=kdate, fqt=1)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].date == sdate:
                    break
                i += 1

            if i >= len(allkl) or i <= 1 or sdate != allkl[i].date:
                continue

            zdf = 10
            while i < len(allkl) - 1:
                if allkl[i].high < Utils.zt_priceby(allkl[i-1].close, zdf=zdf) or allkl[i].close >= allkl[i].high:
                    i += 1
                    continue

                if allkl[i].close < allkl[i].open:
                    i += 1
                    continue
                if allkl[i].low <= 0 or allkl[i+1].low <= 0:
                    i += 1
                    continue

                self.wkselected.append([c, allkl[i].date, round((allkl[i].high - allkl[i].close) * 100 / allkl[i].close, 2), allkl[i].close, allkl[i+1].open, allkl[i+1].date])
                i += 1

    def walk_post_process(self):
        daystks = {}
        for x in self.wkselected:
            if x[1] not in daystks:
                daystks[x[1]] = []
            daystks[x[1]].append(x)

        self.wkselected = []
        for k in daystks.keys():
            sstks = sorted(daystks[k], key=lambda x: x[2])[:20]
            self.wkselected += sstks
        super().walk_post_process()

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, zshadow, close0, open1, date1')
        days = []
        daystks = []
        for x in orstks:
            if x[1] < '2020':
                continue
            if x[1] not in days:
                daystks.append(x)
                days.append(x[1])
        self.sim_stks = sorted(daystks, key=lambda s: (s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        for code, date, zs, c0, o1, d1 in orstks:
            self.sim_add_deals(code, [[c0, date]], [o1, d1], 100000)


class StockZtYzbSelector(StockBaseSelector):
    '''
    涨停首板一字买入, 不考虑能否买到
    '''
    def __init__(self):
        super().__init__(False)

    def initConstrants(self):
        super().initConstrants()
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb'},
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb_tz'},
            {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb_yz'},
            {'prepare': self.sim_prepare3, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb_fai'},
            {'prepare': self.sim_prepare4, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb_mb'},
            {'prepare': self.sim_prepare5, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb_tzfai'},
            ]
        self.sim_ops = self._sim_ops[5:]
        self.crate = 0.08
        self.erate = 0.05

    def sim_prepare(self):
        super().sim_prepare()
        self.changes = StockChangesHistory()
        ztchanges = self.changes.sqldb.select(self.changes.tablename, [column_code, column_date, 'info'], f'{column_type}=4')
        ztcdp = {}
        ztime = '0'
        self.ztreached = {}
        for c, d, i in ztchanges:
            if not c.startswith('SH') and not c.startswith('SZ'):
                continue
            p1, v, p2, pr = i.split(',')
            if round(float(pr) * 100) < 10:
                continue
            zd, zt = d.split()
            if c not in self.ztreached:
                self.ztreached[c] = set()
            self.ztreached[c].add(zd)
            if not self.check_zt_time(zt):
                continue
            if zt > ztime:
                ztime = zt
            if c not in ztcdp:
                ztcdp[c] = []
            ztcdp[c].append([zd, i])

        print(ztime)
        for c, di in ztcdp.items():
            di = sorted(di, key=lambda x: x[0])
            for d, i in di:
                self.sim_stks.append([c, d, i])

    def check_buy(self, kl):
        return True
    
    def check_zt_time(self, ztm):
        return ztm < '09:30'

    def sim_prepare1(self):
        self.sim_prepare()
        self.check_buy = lambda kl: kl.open == kl.close and kl.high == kl.close and kl.low < kl.high

    def sim_prepare2(self):
        self.sim_prepare()
        self.check_buy = lambda kl: kl.low == kl.high

    def sim_prepare3(self):
        self.sim_prepare()
        self.check_buy = lambda kl: kl.open == kl.high and kl.close < kl.high

    def sim_prepare5(self):
        self.sim_prepare()
        self.check_buy = lambda kl: kl.open == kl.high and kl.low < kl.high

    def sim_prepare4(self):
        self.check_zt_time = lambda ztm: ztm >= '09:30' and ztm <= '09:31'
        self.sim_prepare()

    def zt_reached_in(self, code, date, n):
        if code not in self.ztreached:
            return False
        zdate = date
        for i in range(0, n):
            zdate = TradingDate.prevTradingDate(zdate)
            if zdate in self.ztreached[code]:
                return True
        return False

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date, zinfo in orstks:
            if self.zt_reached_in(code, date, 2) or date == '2023-12-08':
                continue

            kd = self.get_kd_data(code, date)
            if kd is None:
                continue

            ki = 0
            while ki < len(kd) and kd[ki].date < date:
                ki += 1

            kd = kd[ki:]
            if not self.check_buy(kd[0]):
                continue
            zdf = 10 if code.startswith('SH60') or code.startswith('SZ00') else 20
            self.sim_quick_sell(kd, code, kd[0].date, kd[0].high, self.erate, self.crate, zdf)

    def sim_post_process(self, dtable):
        return super().sim_post_process(dtable)


class StockZtYzb1Selector(StockZtYzbSelector):
    ''' 涨停价开盘, 但未封板
    '''
    def initConstrants(self):
        super().initConstrants()
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_yzb1'},
            ]
        self.sim_ops = self._sim_ops[0:]
        self.crate = 0.08
        self.erate = 0.05

    def sim_prepare(self):
        self.sim_stks = []
        self.sim_deals = []
        self.changes = StockChangesHistory()
        ztchanges = self.changes.sqldb.select(self.changes.tablename, [column_code, column_date, 'info'], f'{column_type}=4')
        ztcdp = {}
        ztime = '0'
        self.ztreached = {}
        for c, d, i in ztchanges:
            if not c.startswith('SH') and not c.startswith('SZ'):
                continue
            p1, v, p2, pr = i.split(',')
            if round(float(pr) * 100) < 10:
                continue
            zd, zt = d.split()
            if c not in self.ztreached:
                self.ztreached[c] = set()
            self.ztreached[c].add(zd)
            if not self.check_zt_time(zt):
                continue
            if zt > ztime:
                ztime = zt
            if c not in ztcdp:
                ztcdp[c] = []
            ztcdp[c].append(zd)

        stocks = StockGlobal.all_stocks()
        pztcdp = {}
        for id, c, n, n1, t, *x in stocks:
            if t != "ABStock" and c != "TSStock":
                continue
            allkl = self.get_kd_data(c, '2023-12-08')
            if allkl is None or len(allkl) == 0:
                continue
            zdf = 10 if c.startswith('SH60') or c.startswith('SZ00') else 20
            for i in range(1, len(allkl)):
                if allkl[i].open == allkl[i].high and allkl[i].high >= Utils.zt_priceby(allkl[i-1].close, zdf=zdf):
                    if c not in ztcdp or allkl[i].date not in ztcdp[c]:
                        if c not in pztcdp:
                            pztcdp[c] = []
                        pztcdp[c].append(allkl[i].date)
        for c, dd in pztcdp.items():
            dd = sorted(dd)
            for d in dd:
                self.sim_stks.append([c, d, ''])


class StockZt1BkSeletor(StockBaseSelector):
    ''' 板块首日大涨且资金净流入时，对该板块当日首板股打板买入'''
    def __init__(self):
        super().__init__(False)

    def initConstrants(self):
        super().initConstrants()

    def get_d1bks(self, chgHist):
        d1bks = []
        hisdates = chgHist.sqldb.select(chgHist.tablename, column_date)
        dates = set()
        for d, in hisdates:
            dates.add(d.split(' ')[0])

        dbks = {}
        for d in dates:
            bks = chgHist.dumpTopBks(d)
            for bk in bks:
                if bk not in dbks:
                    dbks[bk] = []
                dbks[bk].append(d)

        for bk, ds in dbks.items():
            d1bks.append([ds[0], bk])
            for i in range(1, len(ds)):
                if TradingDate.calcTradingDays(ds[i-1], ds[i]) > 5:
                    continue
                d1bks.append([ds[i], bk])
        return d1bks

    def simulate(self):
        self.sim_prepare()
        self.wkselected = []
        bkchgHist = StockBkChangesHistory()
        bkclschgHist = StockClsBkChangesHistory()
        d1bks = self.get_d1bks(bkchgHist)
        d1bks += self.get_d1bks(bkclschgHist)
        dbkdict = {}
        for d, bk in d1bks:
            if d not in dbkdict:
                dbkdict[d] = []
            dbkdict[d].append(bk)

        dstockcandi = {d: StockBkMap.bk_stocks(bks) for d, bks in dbkdict.items()}
        for d, candi in dstockcandi.items():
            self.get_tracking_deals('track_zt1bk', d, candi)

        self.sim_post_process('track_sim_zt1bk')

    def get_tracking_bds(self, track_table, date, candidates):
        cbds = []
        for c in candidates:
            deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c}"', f'{column_date}>={date}'])
            if deals is None or len(deals) == 0:
                deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c[2:]}"', f'{column_date}>={date}'])
            if deals is None or len(deals) == 0:
                continue
            bcount = 0
            bds = []
            sds = []
            for dl in deals:
                if dl[3] == 'B':
                    bds.append([dl[5], dl[1]])
                    bcount += dl[6]
                else:
                    bcount -= dl[6]
                    sds = [dl[5], dl[1]]
                    if bcount == 0:
                        break
            if len(bds) > 0 and bds[0][1] == date:
                cbds.append([c, bds[0][1]])
        return cbds

    def get_tracking_deals(self, track_table, date, candidates):
        for c in candidates:
            deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c}"', f'{column_date}>={date}'])
            if deals is None or len(deals) == 0:
                deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c[2:]}"', f'{column_date}>={date}'])
            if deals is None or len(deals) == 0:
                continue
            bcount = 0
            bds = []
            sds = []
            for dl in deals:
                if dl[3] == 'B':
                    bds.append([dl[5], dl[1]])
                    bcount += dl[6]
                else:
                    bcount -= dl[6]
                    sds = [dl[5], dl[1]]
                    if bcount == 0:
                        break
            if len(bds) > 0 and bds[0][1] == date:
                self.sim_add_deals(c, bds, sds, 100000)


class StockHbullSelector(StockBaseSelector):
    '''光头大阳尾盘买入, 次日开盘卖出'''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt_zbull_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'zshadow', 'type':'float DEFAULT NULL'},
            {'col':'close0', 'type':'float DEFAULT NULL'},
            {'col':'open1', 'type':'float DEFAULT NULL'},
            {'col':'date1', 'type':'varchar(20) DEFAULT NULL'},
        ]
        self._sim_ops = [
            # 光头大阳线买入
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_zbull'}
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_on_history_thread(self):
        while(len(self.wkstocks) > 0):
            c, sdate = self.wkstocks.pop(0)
            if c.startswith('SZ30') or c.startswith('SH68'):
                continue

            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-15)).strftime(r"%Y-%m-%d")
            allkl = self.get_kd_data(c, start=kdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].date == sdate:
                    break
                i += 1

            if i >= len(allkl) or i <= 1 or sdate != allkl[i].date:
                continue

            zdf = 10
            while i < len(allkl) - 1:
                if allkl[i].high >= Utils.zt_priceby(allkl[i-1].close, zdf=zdf) or allkl[i].close < allkl[i].open or allkl[i].close < allkl[i-1].close:
                    i += 1
                    continue
                if allkl[i].low <= 0 or allkl[i+1].low <= 0:
                    i += 1
                    continue
                if allkl[i].pchange < 5.5:
                    i += 1
                    continue

                zshadow = (allkl[i].high - allkl[i].close) * 100/ allkl[i].close
                if zshadow < 3:
                    self.wkselected.append([c, allkl[i].date, zshadow, allkl[i].close, allkl[i+1].open, allkl[i+1].date])
                i += 1

    def walk_post_process(self):
        daystks = {}
        for x in self.wkselected:
            if x[1] not in daystks:
                daystks[x[1]] = []
            daystks[x[1]].append(x)

        self.wkselected = []
        for k in daystks.keys():
            sstks = sorted(daystks[k], key=lambda x: x[2])[:5]
            self.wkselected += sstks
        super().walk_post_process()

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, zshadow, close0, open1, date1')
        days = []
        daystks = []
        for x in orstks:
            if x[1] < '2011':
                continue
            daystks.append(x)
            if x[1] not in days:
                daystks.append(x)
                days.append(x[1])
        self.sim_stks = sorted(daystks, key=lambda s: (s[0], s[1]))
        # self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        for code, date, zs, c0, o1, d1 in orstks:
            self.sim_add_deals(code, [[c0, date]], [o1, d1], 100000)


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

            kdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=-120)).strftime(r"%Y-%m-%d")
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
        candidates = self.sqldb.select(self.tablename, f'{column_code}, 预选', [f'{column_date} = "{date}"'])
        picklen = len([c for c, p in candidates if p == 1])
        if picklen > 0:
            candidates = [c for c, p in candidates if p == 1]
        else:
            candidates = [c for c, p in candidates]
        return [c if fullcode else c[2:] for c in candidates]

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


class StockZt1HotrankSelector(StockBaseSelector):
    '''首板,人气榜前20买入'''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1hr_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'changetime','type':'varchar(20) DEFAULT NULL'},
            {'col':'changetype','type':'int DEFAULT NULL'},
            {'col':'排名','type':'int DEFAULT 0'},
            {'col':'排名TH','type':'int DEFAULT 0'},
            {'col':'newfans','type':'float DEFAULT 0'},
            {'col':'changeinfo','type':'varchar(255) DEFAULT NULL'},
        ]
        self.sim_cutrate = 0.08
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 首板 次日人气排行前20
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_htrk'},
            # 首板 次日人气排行最前
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_zt1_htrk1'},
            ]
        self.sim_ops = self._sim_ops[1:2]

    def setChanges(self, changes):
        today = Utils.today_date()
        self.wkselected = []
        for chg in changes:
            vr = chg if isinstance(chg, list) else list(chg)
            if len(self.colheaders) == len(vr) + 1:
                vr.insert(1, today)
            elif len(self.colheaders) != len(vr):
                raise ValueError('wrong number')
            self.wkselected.append(vr)
        if self.sqldb is None:
            self._check_or_create_table()
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date, 'changetype'], self.wkselected)

    def sim_prepare(self):
        super().sim_prepare()
        shr = StockHotRank()
        hrk = shr.sqldb.select(shr.tablename, shr.getDumpKeys(), shr.getDumpCondition('2023-05-19'))
        hrk = {(c,d.split(' ')[0]):r for c,d,r in hrk if r <= 20 and d.split(' ')[1] < '10'}
        szdm = StockZtDailyMain()
        zt1 = szdm.sqldb.select(szdm.tablename, 'code, date', ['连板数="1"', '总天数="1"', 'date>"2023-05-17"'])
        orstks = []
        for c, d in zt1:
            nd = TradingDate.nextTradingDate(d)
            if (c,nd) in hrk:
                 orstks.append([c, nd, hrk[(c,nd)]])
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))

    def sim_prepare1(self):
        self.sim_prepare()
        dstks = {}
        for c, d, rk in self.sim_stks:
            if d not in dstks:
                dstks[d] = []
            dstks[d].append([c, rk])
        mcrk = []
        for d, crk in dstks.items():
            c = crk[0][0]
            rk = crk[0][1]
            for i in range(1, len(crk)):
                if crk[i][1] < rk:
                    c = crk[i][0]
                    rk = crk[i][1]
            mcrk.append([c, d, rk])
        self.sim_stks = sorted(mcrk, key=lambda s: (s[0], s[1]))

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date, rk in orstks:
            if kd is None or len(kd) == 0:
                kd = self.get_kd_data(code, date)
            ki = 0
            while ki < len(kd) and kd[ki].date != date:
                ki += 1

            if ki > 0:
                kd = kd[ki:]
            if kd is None or len(kd) < 2:
                print('error kl for', code, date)
                continue

            if kd[0].open == kd[0].high and kd[0].low == kd[0].high:
                continue

            buy = kd[0].open
            bdate = kd[0].date
            sell = 0
            sdate = kd[0].date
            j = 1
            cutl = kd[0].close * (1 - self.sim_cutrate)
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


class StockZt1j2Selector(StockBaseSelector):
    '''首板次日, 1进2人气榜前20买入前5支'''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1j2_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'预选','type':'tinyint DEFAULT 0'},
            {'col':'bdate','type':'varchar(20) DEFAULT NULL'},
            {'col':'买成','type':'tinyint DEFAULT 0'},
            {'col':'排名','type':'int DEFAULT 0'},
            {'col':'排名TH','type':'int DEFAULT 0'},
            {'col':'newfans','type':'float DEFAULT 0'},
        ]
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_predict_zt_1j2_ww7_3'},
            ]
        self.sim_ops = self._sim_ops

    def setCandidates(self, date, candidates):
        self.sqldb.updateMany(self.tablename, [column_code, column_date, '预选'], [column_code, column_date], [[code, date, 1] for code in candidates])

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return self._select_condition(f'{column_date} = "{date}"')

    def getCandidates(self, date=None):
        pool = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, 预选', self.getDumpCondition(date))
        if pool is None or len(pool) == 0:
            return []
        kdate = pool[0][1]
        for i in range(0, 20):
            kdate = TradingDate.prevTradingDate(kdate)
        for i in range(0, len(pool)):
            allkl = self.get_kd_data(pool[i][0], start=kdate, fqt=1)
            allkl = KlList.calc_kl_ma(allkl, 10)
            allkl = KlList.calc_vol_ma(allkl, 5)
            allkl = KlList.calc_amt_ma(allkl, 5)
            kl = allkl[-1]
            if kl.date != pool[i][1]:
                continue
            v5 = (kl.vol - getattr(kl, 'vol5'))/getattr(kl, 'vol5')
            if v5 > 1:
                v5 = 1
            a5 = (kl.amount - getattr(kl, 'amt5'))/getattr(kl, 'amt5')
            if a5 > 1:
                a5 = 1
            lclose = kl.lclose if hasattr(kl, 'lclose') else allkl[-2].close
            o = (kl.open - lclose) / lclose
            l = (kl.low - lclose) / lclose
            h = (kl.close - lclose) / lclose
            zdf = 0.1 if pool[i][0].startswith('SH60') or pool[i][0].startswith('SZ00') else 0.2
            pool[i] += (zdf, v5, a5, o, l, h)
        return pool
    
    def updateRanks(self, ranks):
        self.sqldb.updateMany(self.tablename, [column_code, column_date, '排名', '排名TH', 'newfans'], [column_code, column_date], ranks)

    def updateBuyInfo(self, bi):
        self.sqldb.updateMany(self.tablename, [column_code, column_date, 'bdate', '买成'], [column_code, column_date], bi)

    def updatePickUps(self):
        szi = StockZtDailyMain()
        zt = szi.dumpDataByDate()
        mdate = self._max_date()
        if mdate is None or zt['date'] > mdate:
            szi = StockZtDailyKcCy()
            ztkc = szi.dumpDataByDate(zt['date'])
            zt['pool'] += ztkc['pool']
            self.sqldb.insertMany(self.tablename, [column_code, column_date], [[x[0], zt['date']] for x in zt['pool']])

    def dumpTrainingData(self, date=None):
        conds = f'{column_date}>="{date}"' if date is not None else ''
        z1j2data = self.sqldb.select(self.tablename, [column_code, column_date, '排名', '排名TH', 'newfans'], conds)
        rdata, ry, tdata = [], [], []
        for c, d, p, pt, f in z1j2data:
            kdate = d
            for i in range(0, 20):
                kdate = TradingDate.prevTradingDate(kdate)
            allkl = self.get_kd_data(c, start=kdate, fqt=1)
            allkl = KlList.calc_kl_ma(allkl, 10)
            allkl = KlList.calc_vol_ma(allkl, 5)
            allkl = KlList.calc_amt_ma(allkl, 5)
            if p == 0:
                p = 100
            if pt == 0:
                pt = 100
            f = f / 100
            kl = allkl[0]
            i = 1
            while i < len(allkl) and allkl[i].date < d:
                i += 1
            if allkl[i].date == d:
                kl = allkl[i]
            v5 = (kl.vol - getattr(kl, 'vol5'))/getattr(kl, 'vol5')
            if v5 > 1:
                v5 = 1
            a5 = (kl.amount - getattr(kl, 'amt5'))/getattr(kl, 'amt5')
            if a5 > 1:
                a5 = 1
            lclose = kl.lclose if hasattr(kl, 'lclose') else allkl[i-1].close
            o = (kl.open - lclose) / lclose
            l = (kl.low - lclose) / lclose
            h = (kl.close - lclose) / lclose
            zdf = 0.1 if c.startswith('SH60') or c.startswith('SZ00') else 0.2
            zprice = kl.close
            if i + 2 < len(allkl):
                if allkl[i+1].close >= Utils.zt_priceby(zprice, zdf=zdf*100) and allkl[i + 2].close >= Utils.zt_priceby(allkl[i+1].close, zdf=zdf*100):
                    ry.append(1)
                else:
                    ry.append(0)
                rdata.append([c, d, p/100, pt/100, f, zdf, v5, a5, o, l, h])
            elif i + 1 < len(rdata):
                tdata.append([c, d, p/100, pt/100, f, zdf, v5, a5, o, l, h])
        return rdata, ry, tdata

    def sim_prepare(self):
        super().sim_prepare()
        stks = [['SH600855', '2024-06-25'],
['SZ002963', '2024-07-12'],
['SH605090', '2024-06-06'],
['SH600624', '2024-07-17'],
['SZ002168', '2024-07-17'],
['SH603679', '2024-06-05'],
['SH603679', '2024-06-17'],
['SZ301183', '2024-06-14'],
['SH600693', '2024-07-03'],
['SH603586', '2024-06-20'],
['SZ002789', '2024-07-10'],
['SZ002883', '2024-07-16'],
['SZ300311', '2024-07-02'],
['SH603155', '2024-07-04'],
['SZ002549', '2024-07-18'],
['SZ002654', '2024-06-11'],
['SH601133', '2024-06-12'],
['SH600297', '2024-07-11'],
['SH600676', '2024-07-16'],
['SH600386', '2024-07-16'],
['SH603528', '2024-06-05'],
['SH600686', '2024-07-12'],
['SZ000042', '2024-07-12'],
['SH603803', '2024-06-18'],
['SH600889', '2024-06-19'],
['SH600084', '2024-07-15'],
['SH600491', '2024-06-19'],
['SZ300834', '2024-06-19'],
['SZ300778', '2024-06-21'],
['SH603887', '2024-06-26'],
['SH603863', '2024-06-24'],
['SZ002178', '2024-06-27'],
['SH603577', '2024-07-15'],
['SZ001258', '2024-06-26'],
['SZ300546', '2024-06-19'],
['SZ000679', '2024-06-12'],
['SZ003008', '2024-06-05'],
['SZ000859', '2024-06-07'],
['SH605277', '2024-07-09'],
['SH600355', '2024-06-12'],
['SZ301279', '2024-06-25'],
['SH600192', '2024-06-13'],
['SZ300386', '2024-06-21'],
['SZ000692', '2024-06-04'],
['SH603991', '2024-06-11'],
['SH603320', '2024-06-07'],
['SH600421', '2024-06-25'],
['SZ002857', '2024-06-26'],
['SZ300899', '2024-07-17'],
['SZ002713', '2024-07-02'],
['SH600178', '2024-06-25'],
['SZ002279', '2024-07-02'],
['SZ002015', '2024-07-11'],
['SH600302', '2024-06-07'],
['SH600811', '2024-07-02'],
['SZ002584', '2024-07-09'],
['SZ002429', '2024-07-09'],
['SH600518', '2024-07-04'],
['SH600421', '2024-07-02'],
['SH603685', '2024-06-13'],
['SZ002636', '2024-07-16'],
['SZ001208', '2024-06-28'],
['SH600830', '2024-06-04'],
['SZ002199', '2024-06-12'],
['SZ002793', '2024-07-05'],
['SZ002861', '2024-06-26'],
['SH600345', '2024-06-14'],
['SH605258', '2024-06-03'],
['SH603171', '2024-06-25'],
['SZ002823', '2024-07-08'],
['SZ001217', '2024-07-08'],
['SZ002829', '2024-07-09'],
['SH603150', '2024-07-15'],
['SZ002741', '2024-07-03'],
['SH603055', '2024-07-15'],
['SH601236', '2024-07-09'],
['SZ300462', '2024-06-17'],
['SH605189', '2024-07-12'],
['SH600822', '2024-07-17'],
['SH600076', '2024-06-28'],
['SZ002766', '2024-06-17'],
['SZ300262', '2024-06-05'],
['SZ001298', '2024-06-11'],
['SH600881', '2024-07-01'],
['SZ002869', '2024-06-17'],
['SZ002823', '2024-06-25'],]

        track_table = 'track_zt1j2'
        for c, d in stks:
            dt = TradingDate.nextTradingDate(d)
            deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c}"', f'{column_date}>={dt}'])
            if deals is None or len(deals) == 0:
                deals = self.sqldb.select(track_table, conds=[f'{column_code}="{c[2:]}"', f'{column_date}>={dt}'])
            if deals is None or len(deals) == 0:
                self.sim_stks.append([c, d])
                continue
            bcount = 0
            bds = []
            sds = []
            for dl in deals:
                if dl[3] == 'B':
                    bds.append([dl[5], dl[1]])
                    bcount += dl[6]
                else:
                    bcount -= dl[6]
                    sds.append([dl[5], dl[1]])
                    if bcount == 0:
                        break
            if len(bds) > 0:
                self.sim_add_deals(c, bds, sds, 100000)

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date in orstks:
            kd = self.get_kd_data(code, date)
            if kd is None:
                continue

            ki = 0
            while ki < len(kd) and kd[ki].date <= date:
                ki += 1

            kd = kd[ki:]
            zdf = 10 if code.startswith('SH60') or code.startswith('SZ00') else 20
            self.sim_quick_sell(kd, code, kd[0].date, kd[0].open, 0.05, 0.08, zdf)


class StockZt1WbSelector(StockBaseSelector):
    '''首板烂板'''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1wb_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
        ]

    def updatePickUps(self):
        date = self._max_date()
        szi = StockZtDailyMain()
        zt = szi.dumpDataByDate()
        if zt['date'] <= date:
            return
        stocks = [x[0] for x in zt['pool']]
        # szi = StockZtDailyKcCy()
        # ztkc = szi.dumpDataByDate(zt['date'])
        # stocks += [x[0] for x in ztkc['pool']]
        # szj = StockZtDailyBJ()
        # ztbj = szj.dumpDataByDate(zt['date'])
        # stocks += [x[0] for x in ztbj['pool']]
        stocks = [s.lower() for s in stocks]
        tlines = srt.tlines(stocks)
        picked = []
        for c, tls in tlines.items():
            high = max([tl[1] for tl in tls])
            firstidx = next((idx for idx, tl in enumerate(tls) if tl[1] == high), None)
            countless = len([tl for tl in tls[firstidx + 1:] if tl[1] < high])
            if firstidx > 215 or countless > 5:
                picked.append(c.upper())
        self.addZt1WbStocks(zt['date'], picked)

    def addZt1WbStocks(self, date, stocks):
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date], [[c, date] for c in stocks])

    def getDumpKeys(self):
        return [column_code, column_date]

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'{column_date}="{date}"'


class StockZt1BkSelector(StockBaseSelector):
    '''首板,净买入板块打板买入'''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt1bk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'changetime','type':'varchar(20) DEFAULT NULL'},
            {'col':'changetype','type':'int DEFAULT NULL'},
            {'col':'changeinfo','type':'varchar(255) DEFAULT NULL'},
        ]

    def setChanges(self, changes):
        today = Utils.today_date()
        self.wkselected = []
        for chg in changes:
            vr = chg if isinstance(chg, list) else list(chg)
            if len(self.colheaders) == len(vr) + 1:
                vr.insert(1, today)
            elif len(self.colheaders) != len(vr):
                raise ValueError('wrong number')
            self.wkselected.append(vr)
        if self.sqldb is None:
            self._check_or_create_table()
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date, 'changetype'], self.wkselected)


class StockDfsorgSelector(StockBaseSelector):
    '''
    游资机构龙虎榜 撞车/跟随 胜率分析
    '''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'}, # 营业部代码
            {'col': '上榜次数', 'type': 'int DEFAULT 0'}, #
            {'col': '同车高开', 'type': 'int DEFAULT 0'}, #同车次日开盘>5%的次数
            {'col': '同车高盈', 'type': 'int DEFAULT 0'}, #同车次日最高价>5%的次数
            {'col': '跟随高开', 'type': 'int DEFAULT 0'}, #跟随买入,第三日开盘>5%的次数
            {'col': '跟随高盈', 'type': 'int DEFAULT 0'}, #跟随买入,第三日最高价>5%的次数
            {'col': '上榜次数1', 'type': 'int DEFAULT 0'}, #首板上榜次数
            {'col': '同车高开1', 'type': 'int DEFAULT 0'}, #首板同车次日开盘>5%的次数
            {'col': '同车高盈1', 'type': 'int DEFAULT 0'}, #首板同车次日最高价>5%的次数
            {'col': '跟随高开1', 'type': 'int DEFAULT 0'}, #首板跟随买入,第三日开盘>5%的次数
            {'col': '跟随高盈1', 'type': 'int DEFAULT 0'}, #首板跟随买入,第三日最高价>5%的次数
        ]
        self.tablename = 'stock_dfsorg_op_earn'
        self.dfsorg_bs_table = None
        self.zt1stocks = []

    def walk_prepare(self, date=None):
        self.wkstocks = []
        self.wkselected = []
        self.opdict = {}
        if date is None:
            date = TradingDate.maxTradingDate()
        if self.dfsorg_bs_table is None:
            self.dfsorg_bs_table = StockDfsorgBuySellDetails()
        ops = self.dfsorg_bs_table.sqldb.select(self.dfsorg_bs_table.tablename, '营业部', f'{column_date}="{date}"')
        ops = set([op for op, in ops])
        for op in ops:
            bsdetails = self.dfsorg_bs_table.sqldb.select(self.dfsorg_bs_table.tablename, '*', f'营业部="{op}"')
            self.opdict[op] = sorted([[bs[1], bs[2]] for bs in bsdetails if bs[-1] > 0], key=lambda x: (x[0], x[1]))
        zttable = [StockZtDailyMain(), StockZtDailyKcCy(), StockZtDailyST()]
        for zttbl in zttable:
            ztinfo = zttbl.sqldb.select(zttbl.tablename, [column_code, column_date], ['连板数=1', '总天数=1'])
            for c, d in ztinfo:
                self.zt1stocks.append((c, d))

    def walk_on_history_thread(self):
        while len(self.opdict.keys()) > 0:
            op, stocks = self.opdict.popitem()
            earnarr = []
            z1arr = []
            while len(stocks) > 0:
                orstks = self.get_begin_stock_records(stocks)
                for i in range(0, len(orstks)):
                    wks = orstks[i]
                    c = wks[0]
                    d = wks[1]
                    alkl = self.get_kd_data(c, d)
                    if alkl is None or len(alkl) < 3:
                        continue
                    kl0 = alkl[0]
                    kl1 = alkl[1]
                    kl2 = alkl[2]
                    earnrow = [c, d, (kl1.open - kl0.close)/kl0.close, (kl1.high - kl0.close)/kl0.close, (kl2.open - kl1.open)/kl1.open, (kl2.high - kl1.open)/kl1.open]
                    earnarr.append(earnrow)
                    if (c,d) in self.zt1stocks:
                        z1arr.append(earnrow)
            e1ocnt, e1hcnt, e2ocnt, e2hcnt = 0,0,0,0
            for c,d,e1o, e1h, e2o, e2h in earnarr:
                if e1o >= 0.05:
                    e1ocnt += 1
                if e1h >= 0.05:
                    e1hcnt += 1
                if e2o >= 0.05:
                    e2ocnt += 1
                if e2h >= 0.05:
                    e2hcnt += 1
            ze1ocnt, ze1hcnt, ze2ocnt, ze2hcnt = 0,0,0,0
            for c,d,e1o, e1h, e2o, e2h in z1arr:
                if e1o >= 0.05:
                    ze1ocnt += 1
                if e1h >= 0.05:
                    ze1hcnt += 1
                if e2o >= 0.05:
                    ze2ocnt += 1
                if e2h >= 0.05:
                    ze2hcnt += 1
            self.wkselected.append([op, len(earnarr), e1ocnt, e1hcnt, e2ocnt, e2hcnt, len(z1arr), ze1ocnt, ze1hcnt, ze2ocnt, ze2hcnt])

    def erate_calc(self, ecnt):
        return round(ecnt * 100 / len(self.wkselected), 2)

    def walk_post_process(self):
        if self.sqldb is None:
            self._check_or_create_table()
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code], self.wkselected)

    def updatePickUps(self):
        self.walkOnHistory()
