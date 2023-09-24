# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from pickup.stock_base_selector import *
from pickup.stock_track_deals import *


class StockDt3Selector(StockBaseSelector):
    '''跌停3进4买入
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dt3_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'date3','type':'varchar(20) DEFAULT NULL'},
            {'col':'date4','type':'varchar(20) DEFAULT NULL'},
            {'col':'buy','type':'tinyint DEFAULT NULL'},
        ]
        self.simkey = 'dt3'

    def walk_prepare(self, date=None):
        dtsql = SqlHelper(password=db_pwd, database=history_db_name)
        cds = []
        if date is not None:
            cds.append(f'{column_date} > "{date}"')
        self.dthis = dtsql.select('day_dt_maps', conds=cds)
        self.wkstocks = [[d, c] for _,d,s,c,suc in self.dthis if s == 3 and suc == 1]
        self.wkselected = []

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            d3, code = self.wkstocks.pop()
            if d3 == Utils.today_date():
                continue
            dates = [d for _,d,s,c,suc in self.dthis if s == 1 and code == c and d < d3]
            if len(dates) == 0:
                continue
            d1 = max(dates)
            self.wkselected.append([code, d1, d3])

    def walk_post_process(self):
        values = []
        for c, d1, d3 in self.wkselected:
            id = self.sqldb.selectOneValue(self.tablename, f'id', f'{column_date} = "{d1}" and {column_code} = "{c}"')
            if id is None:
                values.append([c, d1, d3])
            else:
                self.sqldb.update(self.tablename, {'date3': d3}, {'id': id})
        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [self.colheaders[i]['col'] for i in range(0, 3)], values)

    def sim_prepare(self):
        stks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, date3', conds=['date3 is not NULL', 'date4 is NULL'])
        self.sim_stks = sorted(stks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.wkselected = []

    def simulate_thread(self):
        # 3 进 4 成功买入, 否则不买. 止损/止盈卖出
        # 跌停数增加则加仓一次, 后续开盘价大于买入均价则低点抬高法卖出, 持仓时间>5天则收盘价卖出(止损)
        sd = StockDumps()
        dtsql = SqlHelper(password=db_pwd, database=history_db_name)
        while len(self.sim_stks) > 0:
            c, d1, d3 = self.sim_stks.pop(0)
            stks = []
            while len(self.sim_stks) > 0 and self.sim_stks[0][0] == c:
                stks.append(self.sim_stks.pop(0))
            stks.insert(0, [c, d1, d3])
            for i in range(0, len(stks)):
                c, d1, d3 = stks[i]
                conds = [f'date>"{d3}"', f'step>3', f'success=1', f'{column_code}="{c}"']
                if i + 1 < len(stks):
                    cx, d1x, d3x = stks[i+1]
                    conds.append(f'date<"{d1x}"')
                ds = dtsql.select('day_dt_maps', f'{column_date}, step', conds=conds)
                kd = sd.read_kd_data(c, start=d1)
                deals = []
                if ds is None:
                    i += 1
                    continue

                for d, s in ds:
                    if s <= 5:
                        knd = KlList.get_kldata_by_time(kd, d)
                        if knd is None:
                            continue
                        deals.append([c, d, 'B', knd.low])
                    else:
                        knd = KlList.get_kldata_by_time(kd, d)
                        if knd.high > knd.low:
                            # 连续跌停, 开板止损卖出
                            deals.append([c, d, 'S', knd.low])
                            break

                if len(deals) == 0:
                    ki = 0
                    waitdays = 0
                    while ki < len(kd):
                        if KNode(kd[ki]).date <= d3:
                            ki += 1
                            continue
                        waitdays += 1
                        ki += 1
                        if waitdays > 10:
                            break
                    if waitdays > 10 or (datetime.now() - datetime.strptime(kd[-1][1], '%Y-%m-%d')).days > 20:
                        self.wkselected.append([c, d1, d3, '', 0])
                        i += 1
                        continue

                if len(deals) > 0 and len([d for d in deals if d[2] == 'S']) == 0:
                    ki = 0
                    bdate = ''
                    average = 0
                    for d in deals:
                        if d[1] > bdate:
                            bdate = d[1]
                        average += d[3]
                    average /= len(deals)
                    holddays = 0
                    while ki < len(kd):
                        if KNode(kd[ki]).date <= bdate:
                            ki += 1
                            continue
                        kdi = KNode(kd[ki])
                        if kdi.open > average:
                            deals.append([c, kdi.date, 'S', kdi.open])
                            break
                        elif kdi.high > average:
                            deals.append([c, kdi.date, 'S', kdi.high])
                            break
                        holddays += 1
                        if holddays >= 5:
                            deals.append([c, kdi.date, 'S', kdi.close])
                            break

                if len([d for d in deals if d[2] == 'S']) == 0:
                    i += 1
                    continue

                if deals[0][2] == 'B' and deals[-1][2] == 'S':
                    self.wkselected.append([c, d1, d3, deals[0][1], 1])
                    self.sim_deals += deals
                i += 1

    def sim_post_process(self, dtable):
        if len(self.wkselected) > 0:
            for c, d1, d3, d4, b in self.wkselected:
                self.sqldb.update(self.tablename, {'date4': d4, 'buy': b}, [f'{column_code}="{c}"', f'{column_date}="{d1}"', f'date3="{d3}"'])
        strack = StockTrackDeals()
        strack.addDeals(dtable, [{'time': deal[1], 'code': deal[0], 'sid': 0, 'tradeType': deal[2], 'price': deal[3], 'count': 0} for deal in self.sim_deals])

    def updateDt3(self):
        date = self._max_date()
        self.walkOnHistory(date)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '交易记录','实盘'])

    def getDumpCondition(self, date):
        return self._select_condition('清仓日期 is NULL' if date is None else f'清仓日期 > "{date}" or 清仓日期 is NULL')

    def dumpFinishedRecords(self):
        dmpkeys = self._select_keys([column_code, column_date, 'date3', 'date4', 'buy'])
        recs = self.sqldb.select(self.tablename, dmpkeys)
        if recs is None or len(recs) == 0:
            return ''
        return recs

