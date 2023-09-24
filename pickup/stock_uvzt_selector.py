# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *

class StockUvztSelector(StockBaseSelector):
    '''
    选股： U/V 型反转 次日涨幅>8%
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_uvzt_pickup'
        self.colheaders = [
            {'col': column_code, 'type':'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type':'varchar(20) DEFAULT NULL'},
            {'col':'dwnpercent', 'type':'float DEFAULT NULL'},
            {'col':'udays', 'type':'tinyint unsigned DEFAULT NULL'},
            {'col':'ztdate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'ztpercent', 'type':'float DEFAULT NULL'},
            {'col':'zshadow', 'type':'float DEFAULT NULL'},
            {'col':'iszt', 'type':'tinyint DEFAULT NULL'}
        ]
        self._sim_ops = [
            # uv+涨停
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_uvzt'},
            ]
        self.sim_ops = self._sim_ops

    def walk_on_history_thread(self):
        sd = StockDumps()
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = sd.read_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            allkl = [KNode(k) for k in allkl]
            i = 0
            while i < len(allkl):
                kl = allkl[i]
                if kl.pchange < 8:
                    i += 1
                    continue
                if i > 0 and allkl[i-1].pchange >= 8:
                    i += 1
                    continue

                j = i-1
                low = kl.low
                while j >= 0:
                    if allkl[j].low < low:
                        low = allkl[j].low
                    if kl.close > 1.2 * low or allkl[j].high >= kl.close * 0.98:
                        break
                    j -= 1
                if kl.close > 1.2 * low or allkl[j].high < kl.close * 0.98:
                    i += 1
                    continue
                dkl = None
                udays = i - j
                if j - 1 >= 0 and allkl[j-1].high > allkl[j].high and allkl[j-1].high * 0.98 < kl.close and allkl[j-1].high > kl.close * 0.98:
                    dkl = allkl[j - 1]
                    udays += 1
                elif allkl[j].high * 0.98 < kl.close:
                    dkl = allkl[j]
                elif j + 1 < i and allkl[j+1].high * 0.98 < kl.close and allkl[j+1].high > kl.close * 0.98:
                    dkl = allkl[j + 1]
                    udays -= 1
                if udays > 255:
                    print(c, dkl.date, kl.date, udays)
                    i += 1
                    continue

                if dkl is not None and udays > 1:
                    iszt = 0
                    if i > 0 and kl.close >= Utils.zt_priceby(allkl[i-1].close):
                        iszt = 1
                    elif kl.high == kl.close:
                        iszt = 1
                    self.wkselected.append([
                        c, dkl.date, round((dkl.high - low) / dkl.high, 4), udays,
                        kl.date, kl.pchange, round((kl.high - kl.close) / kl.close, 4), iszt])
                i += 1

    def walk_post_process(self):
        values = []
        for uvzt in self.wkselected:
            uvid = self.sqldb.selectOneValue(self.tablename, 'id', [f'{column_code}="{uvzt[0]}"', f'ztdate="{uvzt[4]}"', f'udays="{uvzt[3]}"'])
            if uvid is None:
                values.append(uvzt)
            else:
                self.sqldb.update(self.tablename, {
                    f'{column_date}': uvzt[1],
                    'dwnpercent': uvzt[2],
                    'udays': uvzt[3],
                    'ztpercent': uvzt[5],
                    'zshadow': uvzt[6],
                    'iszt': uvzt[7]
                }, f'id={uvid}')

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate, udays', f'iszt=1')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.sim_lowbound = None
        self.sim_upbound = None
        self.sim_cutrate = 0.055
        # self.threads_num = 1

    def simulate_thread(self):
        orstks = []
        while len(self.sim_stks) > 0:
            while len(orstks) == 0 or self.sim_stks[0][0] == orstks[0][0]:
                orstks.append(self.sim_stks.pop(0))
                if len(self.sim_stks) == 0:
                    break

            kd = None
            for code, dt, zt, ud in orstks:
                if kd is None:
                    sd = StockDumps()
                    kd = sd.read_kd_data(code, start=dt)
                    if kd is None or len(kd) < ud + 3:
                        break
                ki = 0
                while kd[ki][1] != dt:
                    ki += 1
                if ki > 0:
                    kd = kd[ki:]
                    if kd is None or len(kd) < ud + 3:
                        continue
                
                kldt = KNode(kd[0])
                assert kldt.date == dt, 'wrong kl data'

                klzt = KNode(kd[ud])
                i = ud + 1
                kl1 = KNode(kd[i])
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
                earnl = buy * (1 + self.sim_cutrate)
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
                    if lo3 == hi3 and lo3 >= Utils.zt_priceby(clp3):
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
                    if hi3 > earnl:
                        sell = hi3 * 0.99
                        sdate = klj.date
                        break
                    j += 1
                if sdate != bdate:
                    count = round(1000/buy)
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(buy, 2), 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(sell, 2), 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0
            orstks = []
    
