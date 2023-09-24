# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from pickup.stock_base_selector import *


class StockCentsSelector(StockBaseSelector):
    '''
    选股： 股价低于1元的股票
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_cents_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'end','type':'varchar(20) DEFAULT NULL'},
        ]

    def walk_prepare(self, date=None):
        super().walk_prepare(date)

        cents = self._dump_data(f'{column_code},{column_date}', f'end=""')
        centcode = [c for c,d in cents]
        cents = {c:d for c,d in cents}
        for i in range(0, len(self.wkstocks)):
            if self.wkstocks[i][0] in centcode:
                self.wkstocks[i][1] = cents[self.wkstocks[i][0]]

    def walk_on_history_thread(self):
        sd = StockDumps()
        while len(self.wkstocks) > 0:
            c,sdate = self.wkstocks.pop()
            kd = sd.read_kd_data(c, start=sdate)
            if kd is None:
                continue

            lowkls = []
            for i in range(0, len(kd)):
                kl = KNode(kd[i])
                if kl.close < 1:
                    if len(lowkls) == 0 or 'end' in lowkls[-1]:
                        lowkls.append({'start': kl, 'code': c})
                if kl.close > 1:
                    if len(lowkls) > 0 and 'end' not in lowkls[-1]:
                        lowkls[-1]['end'] = kl

            if len(lowkls) == 0:
                continue

            for i in range(1, len(lowkls)):
                if datetime.strptime(lowkls[-i]['start'].date, '%Y-%m-%d') - datetime.strptime(lowkls[-i-1]['end'].date, '%Y-%m-%d') > timedelta(days=30):
                    self.wkselected.append(lowkls[-i])
                else:
                    lowkls[-i-1]['end'] = lowkls[-i]['end'] if 'end' in lowkls[-i] else None
            if len(lowkls) > 0:
                self.wkselected.append(lowkls[0])

    def walk_post_process(self):
        values = []
        for lkl in self.wkselected:
            lcode = lkl['code']
            ldate = lkl['start'].date
            lend = ''
            if 'end' in lkl and lkl['end'] is not None:
                lend = lkl['end'].date
            elif lcode in self.tsdate:
                lend = self.tsdate[lcode]
            ct = self.sqldb.selectOneValue(self.tablename, 'count(*)', [f'{column_code}="{lcode}"', f'{column_date}="{ldate}"'])
            if ct is not None and ct == 1:
                self.sqldb.update(self.tablename, {'end': lend}, {'date': ldate, 'code': lcode})
                continue
            ex = self.sqldb.select(self.tablename, conds=[f'{column_code}="{lcode}"'])
            if ex is not None and len(ex) > 0:
                exdate = ex[-1][3]
                if datetime.strptime(ldate, '%Y-%m-%d') - datetime.strptime(exdate, '%Y-%m-%d') < timedelta(days=30):
                    self.sqldb.update(self.tablename, {'end': lend}, {'date': ex[-1][2], 'code': lcode})
                    continue

            values.append([lcode, ldate, lend])

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def updatePickUps(self):
        self.walkOnHistory(Utils.today_date())

    def dumpFinishedRecords(self):
        recs = self._dump_data(self._select_keys([column_code, column_date, 'end']), self._select_condition(['end != ""','end is not NULL']))
        if recs is None or len(recs) == 0:
            return ''
        return recs
