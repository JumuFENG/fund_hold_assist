# Python 3
# -*- coding:utf-8 -*-
from threading import Thread
from utils import *
from history import *
from pickup.stock_base_selector import *

class StockZdfRanks(StockBaseSelector):
    ''' 记录每日涨跌幅排名
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_day_zdf_ranks'
        self.rkarr = [5, 10, 20, 30, 60, 120, 250]
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}
        ]
        for n in self.rkarr:
            self.colheaders.append({'col':f'zdf{n}','type':'float DEFAULT NULL'})
            self.colheaders.append({'col':f'rank{n}','type':'int DEFAULT NULL'})

    def walk_prepare(self, date=None):
        stks = StockGlobal.all_stocks()
        self.rkdate = date
        self.rkstart = date
        self.rkend = date
        if date is None:
            self.wkstocks = [
                [s[1], s[7]]
                for s in stks if s[4] == 'ABStock' or s[4] == 'TSStock']
            self.tsdate = {s[1]: s[8] for s in stks if s[4] == 'TSStock'}
        else:
            date = (datetime.strptime(date, '%Y-%m-%d') - timedelta(500)).strftime('%Y-%m-%d')
            self.wkstocks = [
                [s[1], date]
                for s in stks if s[4] == 'ABStock']
        self.wkselected = []
        self.stockKlists = {}

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d = self.wkstocks.pop(0)
            allkl = self.get_kd_data(c, start=d, fqt=1)
            if allkl is None or len(allkl) < 5:
                continue

            j = 5
            if self.rkdate is not None:
                j = len(allkl) - 1
                while j > 0:
                    if allkl[j].date == self.rkdate:
                        break
                    j -= 1
            while j < len(allkl):
                for n in self.rkarr:
                    j0 = j-n if j>n else 0
                    setattr(allkl[j], f'zdf{n}', round((allkl[j].close - allkl[j0].close) / allkl[j0].close, 4))
                j += 1
            if len(allkl) > 5 and self.rkdate is None:
                if self.rkstart is None or allkl[5].date < self.rkstart:
                    self.rkstart = allkl[5].date
            if len(allkl) > 0:
                if self.rkend is None or allkl[-1].date > self.rkend:
                    self.rkend = allkl[-1].date
            self.stockKlists[c] = allkl

    def walk_post_process(self):
        if self.rkdate is None:
            self.rkdate = self.rkstart
        while self.rkdate <= self.rkend:
            dayrks = []
            for k, v in self.stockKlists.items():
                if v[0].date < self.rkdate:
                    while len(v) > 1 and v[1].date <= self.rkdate:
                        v.pop(0)
                    if len(v) == 1:
                        if v[0].date < self.rkdate:
                            continue
                if v[0].date > self.rkdate:
                    continue
                if hasattr(v[0], 'zdf5'):
                    dayrks.append([k, v[0]])
            for n in self.rkarr:
                dayrks = sorted(dayrks, key=lambda x: getattr(x[1], f'zdf{n}'), reverse=True)
                for i in range(0, len(dayrks)):
                    setattr(dayrks[i][1], f'rk{n}', i + 1)
            picked = set()
            for c, v in dayrks:
                for n in self.rkarr:
                    if getattr(v, f'rk{n}') <= 50 and c not in picked:
                        rksel = [c, self.rkdate]
                        for nn in self.rkarr:
                            rksel.append(getattr(v, f'zdf{nn}'))
                            rksel.append(getattr(v, f'rk{nn}'))
                        self.wkselected.append(rksel)
                        picked.add(c)
            nxrkdate = None
            for k, v in self.stockKlists.items():
                if v[0].date <= self.rkdate and len(v) > 1:
                    if nxrkdate is None or v[1].date < nxrkdate:
                        nxrkdate = v[1].date
            if nxrkdate is None:
                break
            self.rkdate = nxrkdate

        if len(self.wkselected) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.wkselected)

    def updatePickUps(self):
        mdate = self._max_date()
        ndate = TradingDate.nextTradingDate(mdate)
        if ndate == mdate:
            print('already updated to', ndate)
            return
        self.walkOnHistory(ndate)

    def getDumpKeys(self):
        k = [column_code]
        for n in self.rkarr:
            k.append(f'zdf{n}')
            k.append(f'rank{n}')
        return k

    def getDumpCondition(self, date=None):
        mdate = self._max_date()
        if date > mdate:
            date = mdate
        return f'{column_date}="{date}"'

    def dumpDataByCode(self, code, start):
        k = [column_date]
        for n in self.rkarr:
            k.append(f'zdf{n}')
            k.append(f'rank{n}')
        return self.sqldb.select(self.tablename, k, [f'{column_code}="{code}"', f'{column_date} >= "{start}"'])


class StockMainFlowSelector(StockBaseSelector):
    def __init__(self, bks=None):
        super().__init__(False)
        self.bks = bks

    def initConstrants(self):
        super().initConstrants()

    def walk_prepare(self, date=None):
        self.wkselected = []
        self.wkstocks = []
        stocks = []
        if self.bks is not None:
            stocks = StockBkMap.bk_stocks(self.bks)
        else:
            stocks = StockGlobal.all_stock_codes()
        stocks = [s for s in stocks if s.startswith('SH') or s.startswith('SZ') or s.startswith('BJ')]
        sdate = TradingDate.prevTradingDate(TradingDate.maxTradingDate(), 60)
        sch = StockChangesHistory()
        self.stock_changes = {}
        schgs = sch.sqldb.select(sch.tablename, conds=[f'{column_date}>="{sdate}"', f'({column_type}=4 or {column_type}=8193 or {column_type}=8194)'])
        for x,c,d,t,i in schgs:
            if c not in stocks: continue
            if c not in self.stock_changes:
                self.stock_changes[c] = []
            self.stock_changes[c].append([c, d.split()[0], t, i])
        for c, chg in self.stock_changes.items():
            date0 = chg[0][1]
            for c, d, t, i in chg:
                if t == 4 and d > date0:
                    date0 = d
            vchg = []
            for c, d, t, i in chg:
                if d >= date0:
                    vchg.append([c,d,t,i])
            self.stock_changes[c] = vchg
            self.wkstocks.append([c, date0])
        sfh = Stock_Fflow_History()
        self.stock_mainflow = {}
        s_zd_fd = []
        for c,d in self.wkstocks:
            sfh.setCode(c)
            if sfh._max_date() != TradingDate.maxTradingDate():
                sfh.getFflowFromEm(c)
            smf = sfh.dumpMainFlow(c, d)
            if smf is None or len(smf) == 0:
                Utils.log(f'no main flow found for {c}, {d}')
                continue
            if len([ch for ch in self.stock_changes[c] if ch[2] == 4]) == 0:
                mxout, modt = smf[0][2], smf[0][1]
                for s in smf:
                    if s[2] < mxout:
                        mxout = s[2]
                        modt = s[1]
                smf = [s for s in smf if s[1] > modt]
                if len(smf) == 0:
                    continue
                mxin,mxdt = smf[0][2], smf[0][1]
                for s in smf:
                    if s[2] > mxin:
                        mxin = s[2]
                        mxdt = s[1]
                smf = [s for s in smf if s[1]>=mxdt]
                s_zd_fd.append([c, None, mxdt])
            else:
                s_zd_fd.append([c, d, d])
            self.stock_mainflow[c] = smf
        self.wkstocks = s_zd_fd

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, zd, fd = self.wkstocks.pop(0)
            bcnt, scnt = 0, 0
            for chg in self.stock_changes[c]:
                if zd is not None and chg[1] <= TradingDate.nextTradingDate(zd, 2):
                    continue
                if chg[2] == 8193:
                    bcnt += 1
                elif chg[2] == 8194:
                    scnt += 1
            mf,mfp = 0,0
            for smf in self.stock_mainflow[c]:
                mf += smf[2]
                mfp += smf[7]

            # 3 日表现
            allkl = self.get_kd_data(c, min(fd, TradingDate.prevTradingDate(TradingDate.maxTradingDate(), 3)), fqt=1)
            zd3 = round((allkl[-1].close - allkl[-4].close) * 100 / allkl[-4].close, 2)
            minzd = round(min([(allkl[i].close - allkl[i-1].close) * 100 / allkl[i-1].close for i in range(-3, 0)]), 2)
            mf3 = 0
            minmf3 = self.stock_mainflow[c][-1][2]
            for i in range(1, 4):
                if len(self.stock_mainflow[c]) > i:
                    mf3 += self.stock_mainflow[c][-i][2]
                    if self.stock_mainflow[c][-i][2] < minmf3:
                        minmf3 = self.stock_mainflow[c][-i][2]
            self.wkselected.append([c, zd, fd, bcnt, scnt, mf, round(mfp, 2), zd3, minzd, mf3, minmf3])

    def check_stocks(self, stocks):
        self.wkstocks = [stocks]
        self.wkselected = []
        sch = StockChangesHistory()
        self.stock_changes = {}
        c, sdate, fdate = stocks
        schgs = sch.sqldb.select(sch.tablename, conds=[f'{column_date}>="{sdate}"', f'({column_type}=4 or {column_type}=8193 or {column_type}=8194)'])
        kstocks = [c for c,zd,fd in self.wkstocks]
        for x,c,d,t,i in schgs:
            if d < sdate or d > fdate: continue
            if c not in kstocks: continue
            if c not in self.stock_changes:
                self.stock_changes[c] = []
            self.stock_changes[c].append([c, d.split()[0], t, i])
        for c, chg in self.stock_changes.items():
            date0 = chg[0][1]
            for c, d, t, i in chg:
                if t == 4 and d > date0:
                    date0 = d
            vchg = []
            for c, d, t, i in chg:
                if d >= date0:
                    vchg.append([c,d,t,i])
            self.stock_changes[c] = vchg

        sfh = Stock_Fflow_History()
        self.stock_mainflow = {}
        for c, zd, fd in self.wkstocks:
            sfh.setCode(c)
            if sfh._max_date() != TradingDate.maxTradingDate():
                sfh.getFflowFromEm(c)
            smf = sfh.dumpMainFlow(c, zd)
            if smf is None or len(smf) == 0:
                Utils.log(f'no main flow found for {c}, {zd}')
                continue
            if len([ch for ch in self.stock_changes[c] if ch[2] == 4]) == 0:
                mxout, modt = smf[0][2], smf[0][1]
                for s in smf:
                    if s[2] < mxout:
                        mxout = s[2]
                        modt = s[1]
                smf = [s for s in smf if s[1] > modt]
                if len(smf) == 0:
                    continue
                mxin,mxdt = smf[0][2], smf[0][1]
                for s in smf:
                    if s[2] > mxin:
                        mxin = s[2]
                        mxdt = s[1]
                smf = [s for s in smf if s[1]>=mxdt and s[1] <= fdate]
            self.stock_mainflow[c] = smf

        self.walk_on_history_thread()
        for x in self.wkselected:
            print(x)


    def walk_post_process(self):
        cands = []
        self.wkselected = sorted(self.wkselected, key=lambda x: x[5], reverse=True)
        cands += self.wkselected[0:5]
        cancodes = [x[0] for x in cands]
        self.wkselected = sorted(self.wkselected, key=lambda x: x[3]-x[4], reverse=True)
        for wk in self.wkselected[0:5]:
            if wk[0] not in cancodes:
                cands.append(wk)

        cancodes = [x[0] for x in cands]
        for wk in self.wkselected:
            if wk[0] in cancodes:
                continue
            if wk[7] <= 15 and wk[8] > -3 and wk[9] > 5000000 and wk[10] > 0: # 3 日累计涨幅小于10
                cands.append(wk)

        for s in cands:
            print(s)
