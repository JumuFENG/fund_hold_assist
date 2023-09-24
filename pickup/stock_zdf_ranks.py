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
