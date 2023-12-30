# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *
from pickup.stock_zt_lead_selector import StockZtDailyST


class StockDztSelector(StockBaseSelector):
    '''
    选股： 前一日跌幅>8% 次日涨幅>8%
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dzt_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'dtpercent', 'type':'float DEFAULT NULL'},
            {'col':'dshadow', 'type':'float DEFAULT NULL'},
            {'col':'isdt', 'type':'tinyint DEFAULT NULL'},
            {'col':'ztdate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'ztpercent', 'type':'float DEFAULT NULL'},
            {'col':'zshadow', 'type':'float DEFAULT NULL'},
            {'col':'iszt', 'type':'tinyint DEFAULT NULL'}
        ]
        self.zdf = 10
        self.uplmt = 8
        self.sim_lowbound = -0.05
        self.sim_upbound = 0.03
        self.sim_cutrate = 0.115
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 大阴+涨停
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_dzt'},
            # 大阴+大阳
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell1, 'post': self.sim_post_process, 'dtable': f'track_sim_dzt0'},
            # 连续暴跌+大阴+涨停
            {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_dzt_fdwn'},
            # 连续暴涨+大阴+涨停
            {'prepare': self.sim_prepare3, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_dzt_spdup'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i + 1 < len(allkl):
                kl = allkl[i]
                kl2 = allkl[i+1]
                lcl = allkl[i-1].close if i > 0 else kl.open
                if kl.pchange < -self.uplmt and kl2.pchange > self.uplmt:
                    isdt = 1 if kl.close <= Utils.dt_priceby(lcl, zdf=self.zdf) else 0
                    iszt = 1 if kl2.close >= Utils.zt_priceby(kl.close, zdf=self.zdf) else 0
                    self.wkselected.append([
                        c, kl.date, kl.pchange, round((kl.close - kl.low) / lcl, 4), isdt,
                        kl2.date, kl2.pchange, round((kl2.high - kl2.close) / kl.close, 4), iszt
                    ])
                    i += 1
                i += 1

    def walk_post_process(self):
        completed = []
        for dzt in self.wkselected:
            dtid = self.sqldb.selectOneValue(self.tablename, f'id', f'{column_date} = "{dzt[1]}" and {column_code} = "{dzt[0]}"')
            if len(dzt) == 9:
                if dtid is None:
                    completed.append(dzt)
                else:
                    self.sqldb.update(self.tablename, {
                        'dtpercent': dzt[2], 'dshadow': dzt[3], 'isdt': dzt[4],'ztdate': dzt[5], 
                        'ztpercent': dzt[6], 'zshadow': dzt[7], 'iszt': dzt[8]
                    }, {'id': dtid})

        if len(completed) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], completed)

    def updatePickUps(self):
        # 更新涨跌停数据
        mdate = self.sqldb.selectOneValue(self.tablename, f"max(ztdate)")
        if mdate == TradingDate.maxTradingDate():
            print('StockDztSelector.updatePickUps already updated to latest!')
            return

        nxdate = self._max_date()
        self.walkOnHistory(nxdate)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, 'dtpercent', 'ztdate', 'ztpercent'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'ztdate = "{date}"')

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'iszt = 1')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, dt, zt in orstks:
            if kd is None:
                kd = self.get_kd_data(code, dt)
            ki = 0
            while kd[ki].date != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 4:
                    continue

            kldt = kd[0]
            assert kldt.date == dt, 'wrong kl data!'

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
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'iszt = 0')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.sim_cutrate = 0.055
        self.sim_earnrate = 0.055

    def simulate_buy_sell1(self, orstks):
        kd = None
        for code, dt, zt in orstks:
            if kd is None:
                sd = StockDumps()
                kd = sd.read_kd_data(code, start=dt)
                if kd is None or len(kd) < 4:
                    break
            ki = 0
            while kd[ki][1] != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 4:
                    continue

            kldt =  KNode(kd[0])
            assert kldt.date == dt, 'wrong kl data!'

            klzt = KNode(kd[1])
            buy = klzt.close
            bdate = klzt.date
            sell = 0
            sdate = klzt.date
            j = 2
            cutl = buy * (1 - self.sim_cutrate)
            earnl = buy * (1 + self.sim_earnrate)
            while j < len(kd):
                clp3 = KNode(kd[j-1]).close
                klj = KNode(kd[j])
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
                    sell = hi3 * 0.99
                    sdate = klj.date
                    break
                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def sim_prepare2(self):
        self.sim_deals = []
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'iszt = 1')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        costks = {}
        for s in self.sim_stks:
            if s[0] not in costks:
                costks[s[0]] = []
            costks[s[0]].append(s)

        sd = StockDumps()
        ddstks = []
        for c, stks in costks.items():
            start = (datetime.strptime(stks[0][1], '%Y-%m-%d') - timedelta(days=30)).strftime('%Y-%m-%d')
            kd = sd.read_kd_data(c, start=start)
            for stk in stks:
                if KlList.max_fall_down(kd, stk[1], -5) > 0.3:
                    ddstks.append(stk)

        self.sim_stks = ddstks
        self.sim_upbound = None
        self.sim_lowbound = None
        self.sim_cutrate = 0.055
        self.sim_earnrate = 0.055

    def sim_prepare3(self):
        self.sim_deals = []
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'iszt = 1')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        costks = {}
        for s in self.sim_stks:
            if s[0] not in costks:
                costks[s[0]] = []
            costks[s[0]].append(s)

        sd = StockDumps()
        ddstks = []
        for c, stks in costks.items():
            start = (datetime.strptime(stks[0][1], '%Y-%m-%d') - timedelta(days=30)).strftime('%Y-%m-%d')
            kd = sd.read_kd_data(c, start=start)
            for stk in stks:
                if KlList.max_speed_up(kd, stk[1], -5) > 0.4:
                    ddstks.append(stk)

        self.sim_stks = ddstks
        self.sim_lowbound = -0.05
        self.sim_upbound = 0.03
        self.sim_cutrate = 0.055
        self.sim_earnrate = 0.055


class StockDztStSelector(StockDztSelector):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dzt_st_pickup'
        self.sim_lowbound = -0.05
        self.sim_upbound = 0.03
        self.sim_cutrate = 0.06
        self.sim_earnrate = 0.03
        self.zdf = 5
        self.uplmt = 4

    def walk_prepare(self, date=None):
        self.threads_num = 1
        self.wkselected = []
        if date is None:
            dailySt = StockZtDailyST()
            self.wkstocks = dailySt.sqldb.select(dailySt.tablename, f'{column_code}, min({column_date})', order=f'group by {column_code}')
        else:
            stbk = StockEmBk('BK0511')
            ststocks = stbk.dumpDataByDate()
            self.wkstocks = [[c, date] for c in ststocks]


class StockHelvenSelector(StockBaseSelector):
    '''
    选股：地天板
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_helven_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}
        ]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop()
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            for i in range(1, len(allkl)):
                kl = allkl[i]
                lcl = allkl[i-1].close
                if kl.low <= Utils.dt_priceby(lcl) and kl.high == kl.close and kl.close >= Utils.zt_priceby(lcl):
                    self.wkselected.append([
                        c, kl.date
                    ])


class StockDztBoardSelector(StockBaseSelector):
    '''前一日跌停，次日涨停打板买入'''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dt_bd_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'dtpercent', 'type':'float DEFAULT NULL'},
            {'col':'dshadow', 'type':'float DEFAULT NULL'},
            {'col':'isdt', 'type':'tinyint DEFAULT NULL'}
        ]
        self.zdf = 10
        self.uplmt = 8
        self.sim_cutrate = 0.115
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 大阴 次日涨停打板
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_dt_bd'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = self.get_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                kl = allkl[i]
                lcl = allkl[i-1].close if i > 0 else kl.open
                if kl.pchange < -self.uplmt:
                    isdt = 1 if kl.close <= Utils.dt_priceby(lcl, zdf=self.zdf) else 0
                    self.wkselected.append([
                        c, kl.date, kl.pchange, round((kl.close - kl.low) / lcl, 4), isdt
                    ])
                i += 1

    def walk_post_process(self):
        completed = []
        for dzt in self.wkselected:
            dtid = self.sqldb.selectOneValue(self.tablename, f'id', f'{column_date} = "{dzt[1]}" and {column_code} = "{dzt[0]}"')
            if dtid is None:
                completed.append(dzt)

        if len(completed) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], completed)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, 'dtpercent', 'isdt'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'{column_date} = "{date}"')

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, dt in orstks:
            if kd is None:
                kd = self.get_kd_data(code, dt)
            ki = 0
            while kd[ki].date != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 3:
                    continue

            kldt = kd[0]
            assert kldt.date == dt, 'wrong kl data!'

            i = 1
            kl1 = kd[i]
            op0 = kl1.open
            hi0 = kl1.high
            lo0 = kl1.low
            cl0 = kl1.close
            if hi0 == lo0 and cl0 >= Utils.zt_priceby(kldt.close):
                # 一字涨停 无法买进
                continue

            if hi0 < Utils.zt_priceby(kldt.close):
                # 没有涨停
                continue

            buy = hi0
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

    def simulate_bound(self):
        self.sim_prepare()
        simstks = [s for s in self.sim_stks]
        for c in range(70, 150, 5):
            for e in range(55, 130, 5):
                self.sim_cutrate = c / 1000
                self.sim_earnrate = e / 1000
                self.sim_stks = [s for s in simstks]
                self.sim_ops = [{'prepare': None, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_dt_bd_c{c}_e{e}'}]
                self.simulate()
                self.sim_deals = []


class StockDztStBoardSelector(StockDztBoardSelector):
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dt_st_bd_pickup'
        self.sim_cutrate = 0.06
        self.sim_earnrate = 0.03
        self.uplmt = 4
        self.zdf = 5

    def walk_prepare(self, date=None):
        self.threads_num = 1
        self.wkselected = []
        if date is None:
            dailySt = StockZtDailyST()
            self.wkstocks = dailySt.sqldb.select(dailySt.tablename, f'{column_code}, min({column_date})', order=f'group by {column_code}')
        else:
            stbk = StockEmBk('BK0511')
            ststocks = stbk.dumpDataByDate()
            self.wkstocks = [[c, date] for c in ststocks]
