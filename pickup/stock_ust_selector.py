# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *


class StockUstSelector(StockBaseSelector):
    ''' 摘帽股
    '''
    def __init__(self) -> None:
        super().__init__(True)

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_ust_pickupy'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'dates','type':'varchar(20) DEFAULT NULL'},
            {'col':'udate','type':'varchar(20) DEFAULT NULL'},
            {'col':'udates','type':'varchar(20) DEFAULT NULL'},
        ]
        self.sim_cutrate = 0.115
        self.sim_earnrate = None
        self._sim_ops = [
            # 申请买, 摘帽后卖出
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_ust_prepare'},
            # 摘帽后买入
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell1, 'post': self.sim_post_process, 'dtable': f'track_sim_ust_ust'},
            ]
        self.sim_ops = self._sim_ops

    def walk_prepare(self, date=None):
        self.wkselected = []
        self.wkstocks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, dates, id', 'udate is NULL or udates is NULL')
        self.wkstocks = sorted(self.wkstocks, key=lambda x: (x[0], x[1]))
        for i in range(len(self.wkstocks), 0, -1):
            if i > 1 and self.wkstocks[i-1][0] == self.wkstocks[i-2][0] and self.wkstocks[i-1][1].split()[0] == self.wkstocks[i-2][1].split()[0]:
                self.sqldb.delete(self.tablename, f'id="{self.wkstocks[i-1][3]}"')
                self.wkstocks.pop(i-1)
        date = self._max_date()
        if date is not None:
            date = (datetime.strptime(date.split()[0], '%Y-%m-%d')).strftime('%Y-%m-%d')
        self.sann = StockAnnoucements()
        conds = ['type_code="001002004003006"']
        if date is not None:
            conds.append(f'{column_date}>"{date}"')
        nstocks = self.sann.sqldb.select(self.sann.tablename, f'{column_code}, {column_date}', conds)
        nstocks = sorted(nstocks, key=lambda x: (x[0], x[1]))
        for i in range(len(nstocks), 0, -1):
            if i > 1 and nstocks[i-1][0] == nstocks[i-2][0] and nstocks[i-1][1].split()[0] == nstocks[i-2][1].split()[0]:
                nstocks.pop(i-1)
        for ns in nstocks:
            self.wkstocks.append(ns)
        self.wkstocks = sorted(self.wkstocks, key=lambda x: (x[0], x[1]))
        for i in range(len(self.wkstocks), 0, -1):
            if i > 1 and self.wkstocks[i-1][0] == self.wkstocks[i-2][0] and self.wkstocks[i-1][1].split()[0] == self.wkstocks[i-2][1].split()[0]:
                self.wkstocks.pop(i-1)

    def get_effect_date(self, allkl, ndate):
        if ' ' not in ndate:
            return ndate
        ddt, dtm = ndate.split()
        i = 0
        while i < len(allkl):
            if allkl[i].date >= ddt:
                break
            i += 1
        if i >= len(allkl):
            return None
        if allkl[i].date > ddt:
            return allkl[i].date
        if int(dtm.split(':')[0]) < 9:
            return allkl[i].date
        return allkl[i + 1].date if i + 1 < len(allkl) else None

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            orstks = self.get_begin_stock_records(self.wkstocks)

            for i in range(0, len(orstks)):
                wks = orstks[i]
                c = wks[0]
                d = wks[1]
                ud = self.sann.getUstDateAfter(c, d)
                ddt = d.split()[0]
                allkl = self.get_kd_data(c, ddt)
                ds = self.get_effect_date(allkl, d)

                if ud is None:
                    if len(wks) < 4:
                        self.wkselected.append([c, d, ds, None, None])
                    elif wks[2] is None and ds is not None:
                        self.sqldb.update(self.tablename,  {'dates': ds}, {'id': wks[-1]})
                    continue
                uds = self.get_effect_date(allkl, ud)
                if i+1 < len(orstks) and ud > orstks[i+1][1]:
                    if len(wks) == 4:
                        self.sqldb.delete(self.tablename, {'id': wks[-1]})
                    continue
                if len(wks) == 4:
                    self.sqldb.update(self.tablename, {'dates': ds, 'udate': ud, 'udates': uds}, {'id': wks[-1]})
                    continue
                self.wkselected.append([c, d, ds, ud, uds])

    def walk_post_process(self):
        if len(self.wkselected) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.wkselected)

    def updatePickUps(self):
        self.threads_num = 1
        self.walkOnHistory()

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, 'dates', 'udate', 'udates'])
    
    def getDumpCondition(self, date=None):
        return self._select_condition(f'dates is NULL or udates is NULL')

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, dates, udates', f'dates != udates')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, d, ud in orstks:
            if d is None:
                continue

            if kd is None:
                kd = self.get_kd_data(code, d)
            ki = 0
            while ki < len(kd) and kd[ki].date != d:
                ki += 1
            if ki >= len(kd):
                print(code, d, ud)
                continue
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 2:
                    continue

            kl0 = kd[0]
            if kl0.low == kl0.high:
                # 一字涨停 无法买进
                continue
            buy = kl0.open
            bdate = kl0.date
            sell = 0
            sdate = kl0.date
            j = 1
            cutl = buy * (1 - self.sim_cutrate)
            while j < len(kd):
                clp1 = kd[j-1].close
                klj = kd[j]
                clj = klj.close
                hij = klj.high
                loj = klj.low
                opj = klj.open
                zdf = 5
                if ud is not None and ud != '0' and klj.date >= ud:
                    zdf = 10
                if loj == hij and hij <= Utils.dt_priceby(clp1, zdf=zdf):
                    # 一字跌停，无法卖出
                    j += 1
                    continue
                if loj == hij and hij >= Utils.zt_priceby(clp1, zdf=zdf):
                    # 一字涨停，持股不动
                    if clp1 * 0.97 > buy:                         
                        cutl = clp1 * 0.97
                    j += 1
                    continue
                if opj < cutl:
                    if opj > Utils.dt_priceby(clp1, zdf=zdf):
                        sell = opj
                        sdate = klj.date
                        break
                if loj < cutl:
                    sell = cutl
                    sdate = klj.date
                    break
                if ud is None:
                    if j > 5:
                        cutl = klj.low if klj.low > buy else cutl
                if ud is not None and klj.date == ud:
                    sell = klj.open
                    sdate = klj.date
                    break
                j += 1
            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0
            else:
                print(code, d, ud)

    def sim_prepare1(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, udates', f'udates is not NULL')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell1(self, orstks):
        kd = None
        for code, d in orstks:
            if d is None or d == '0':
                continue

            if kd is None:
                kd = self.get_kd_data(code, d)
            ki = 0
            while ki < len(kd) and kd[ki].date != d:
                ki += 1
            if ki >= len(kd):
                print(code, d)
                continue
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 2:
                    continue

            kl0 = kd[0]
            if kl0.low == kl0.high:
                # 一字涨停 无法买进
                continue
            buy = kl0.open
            bdate = kl0.date
            sell = 0
            sdate = kl0.date
            j = 1
            cutl = buy * (1 - self.sim_cutrate)
            while j < len(kd):
                clp1 = kd[j-1].close
                klj = kd[j]
                clj = klj.close
                hij = klj.high
                loj = klj.low
                opj = klj.open
                if loj == hij and hij <= Utils.dt_priceby(clp1):
                    # 一字跌停，无法卖出
                    j += 1
                    continue
                if loj == hij and hij >= Utils.zt_priceby(clp1):
                    # 一字涨停，持股不动
                    if clp1 * 0.97 > buy:
                        cutl = clp1 * 0.97
                    j += 1
                    continue
                if opj < cutl:
                    if opj > Utils.dt_priceby(clp1):
                        sell = opj
                        sdate = klj.date
                        break
                if loj < cutl:
                    sell = cutl
                    sdate = klj.date
                    break
                if j > 50:
                    if cutl < buy and clj < buy:
                        sell = clj
                        sdate = klj.date
                        break
                if j > 10:
                    cutl = loj if loj > buy else cutl
                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0
            else:
                print(code, d)
