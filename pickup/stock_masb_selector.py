# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *


class StockMasbSelector(StockBaseSelector):
    '''
    MA买卖, 主跌浪之后不再新低买入, MA突破买卖.
    '''
    def __init__(self) -> None:
        super().__init__(False)

    def initConstrants(self):
        super().initConstrants()
        self.simkey = 'masb'

    def sim_prepare(self):
        super().sim_prepare()
        stks = StockGlobal.all_stocks()
        self.sim_stks = [
            [s[1], (s[7] if s[7] > '1996-12-16' else '1996-12-16')]
            for s in stks if s[4] == 'ABStock' or s[4] == 'TSStock']

    def simulate_thread(self):
        sd = StockDumps()
        while len(self.sim_stks) > 0:
            code, date = self.sim_stks.pop(0)
            kd = sd.read_kd_data(code, fqt=0, start=date)
            if kd is None:
                continue
            kdbs = KlList.calc_kl_bss(kd, 18)
            serial = KlList.calc_sb_serial(kdbs)
            deals = self.sim_buy_sell(serial, kdbs)
            for d in deals:
                d['code'] = code
            self.sim_deals += deals

    def sim_buy_sell(self, serial, kdbs):
        while len(serial) > 0 and serial[0]['state'] != 'S':
            serial.pop(0)

        if len(serial) == 0:
            return []

        # 1st S
        serial.pop(0)
        if len(serial) == 0:
            return []
        # b/B following S
        bs = serial.pop(0)
        if bs['state'] == 'B':
            return self.sim_buy_sell(serial, kdbs)

        mins1price = bs['hlprice']
        cutprice = 0
        buy = {}
        deals = []
        while len(serial) > 1:
            s2 = serial.pop(0)
            b2 = serial.pop(0)
            if 'date' not in buy and s2['eprice'] < mins1price:
                mins1price = s2['eprice']
                continue
            if 'date' not in buy:
                buy['price'] = b2['price']
                buy['date'] = b2['date']
                cutprice = b2['hlprice']
                if cutprice - mins1price < mins1price * 0.05:
                    cutprice = mins1price
            if s2['eprice'] < cutprice:
                # cut
                count = round(1000/buy['price']) * 100
                cutdate = KlList.get_first_price_lower_than(kdbs, cutprice, s2['sdate']).date
                if s2['state'] == 'S':
                    serial.insert(0, b2)
                    serial.insert(0, s2)
                    return deals + [{'time': buy['date'], 'code': 'code', 'sid': 0, 'tradeType': 'B', 'price': round(buy['price'], 2), 'count': count},
                            {'time': cutdate, 'code': 'code', 'sid': 0, 'tradeType': 'S', 'price': round(cutprice, 2), 'count': count}] + self.sim_buy_sell(serial, kdbs)
                else:
                    deals += [{'time': buy['date'], 'code': 'code', 'sid': 0, 'tradeType': 'B', 'price': round(buy['price'], 2), 'count': count},
                            {'time': cutdate, 'code': 'code', 'sid': 0, 'tradeType': 'S', 'price': round(cutprice, 2), 'count': count}]
                    mins1price = s2['eprice']
                    buy = {}
                    continue
            if s2['state'] == 'S':
                serial.insert(0, b2)
                serial.insert(0, s2)
                return deals + self.sim_buy_sell(serial, kdbs)
            if b2['state'] == 'B':
                # sell
                count = round(1000/buy['price']) * 100
                if len(serial) == 0:
                    continue
                s3 = serial[0]
                return deals + [{'time': buy['date'], 'code': 'code', 'sid': 0, 'tradeType': 'B', 'price': round(buy['price'], 2), 'count': count},
                        {'time': s3['date'], 'code': 'code', 'sid': 0, 'tradeType': 'S', 'price': round(s3['price'], 2), 'count': count}] + self.sim_buy_sell(serial, kdbs)
        return deals


class StockMaConvergenceSelector(StockBaseSelector):
    '''
    MA 收敛 连续3次上穿过程中形成低点抬高 且每次b点价格高于s点价格
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_ma_conv_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'dl0','type':'varchar(20) DEFAULT NULL'},
            {'col':'dh0','type':'varchar(20) DEFAULT NULL'},
            {'col':'l0','type':'float DEFAULT NULL'},
            {'col':'h0','type':'float DEFAULT NULL'},
            {'col':'sd1','type':'varchar(20) DEFAULT NULL'},
            {'col':'dl1','type':'varchar(20) DEFAULT NULL'},
            {'col':'dh1','type':'varchar(20) DEFAULT NULL'},
            {'col':'l1','type':'float DEFAULT NULL'},
            {'col':'h1','type':'float DEFAULT NULL'},
            {'col':'sd2','type':'varchar(20) DEFAULT NULL'},
            {'col':'dl2','type':'varchar(20) DEFAULT NULL'},
            {'col':'l2','type':'float DEFAULT NULL'},
            {'col':'bdate', 'type':'varchar(20) DEFAULT NULL'}
        ]
        self._sim_ops = [
            # 三次MA收敛突破买入
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_maconv'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_prepare(self, date=None):
        # self.wkstocks = [['SZ000559', '2023-03-09']]
        # self.tsdate = {}
        # self.wkselected = []
        # self.wkinprogress = {'SZ000559': self.sqldb.selectOneRow(self.tablename, conds=[f'{column_code}="SZ000559"', f'bdate is NULL'])}
        # self.threads_num = 1
        super().walk_prepare()
        self.wkinprogress = {}
        rows = self.sqldb.selectOneValue(self.tablename, 'count(*)')
        if rows is not None and rows > 0:
            cds = self.sqldb.select(self.tablename, f'{column_code}, max({column_date})', order=f'group by {column_code}')
            cdbd = {}
            for c,d in cds:
                bd = self.sqldb.selectOneValue(self.tablename, 'bdate', [f'{column_code}="{c}"', f'{column_date}="{d}"'])
                cdbd[c] = [d, bd]
            for i in reversed(range(0, len(self.wkstocks))):
                code, date = self.wkstocks[i]
                if code in cdbd:
                    if cdbd[code][1] is not None:
                        self.wkstocks[i][1] = cdbd[code][1]
                    else:
                        self.wkstocks[i][1] = cdbd[code][0]
                        self.wkinprogress[code] = self.sqldb.selectOneRow(self.tablename, conds=[f'{column_code}="{code}"', f'bdate is NULL'])
                if code in self.tsdate:
                    self.wkstocks.pop(i)

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop(0)

            allkl = self.get_kd_data(c, start=sdate, fqt=1)
            if allkl is None or len(allkl) == 0:
                continue

            allkl = KlList.calc_kl_bss(allkl)
            sbserial = []
            i = 0
            for i in range(0, len(allkl)):
                if len(sbserial) == 0 and allkl[i].bss18 != 's':
                    continue
                if allkl[i].bss18 == 's':
                    sbserial.append({'s':allkl[i].date, 'low': allkl[i].low, 'ldate':allkl[i].date, 'li': i})
                    continue
                if allkl[i].bss18 == 'w':
                    if sbserial[-1]['low'] > allkl[i].low:
                        sbserial[-1]['low'] = allkl[i].low
                        sbserial[-1]['ldate'] = allkl[i].date
                        sbserial[-1]['li'] = i
                    continue
                if allkl[i].bss18 == 'b':
                    sbserial[-1]['b'] = allkl[i].date
                    sbserial[-1]['high'] = allkl[i].high
                    sbserial[-1]['hdate'] = allkl[i].date
                    sbserial[-1]['hi'] = i
                    continue
                if allkl[i].bss18 == 'h':
                    if sbserial[-1]['high'] < allkl[i].high:
                        sbserial[-1]['high'] = allkl[i].high
                        sbserial[-1]['hdate'] = allkl[i].date
                        sbserial[-1]['hi'] = i
                    continue
            self.check_convergence(c, sbserial)

    def check_convergence(self, code, sbserial):
        if len(sbserial) < 3:
            if code in self.wkinprogress:
                self.sqldb.delete(self.tablename, {'id': self.wkinprogress[code][0]})
            return

        for i in range(2, len(sbserial)):
            sbs0 = sbserial[i-2]
            sbs1 = sbserial[i-1]
            sbs2 = sbserial[i]
            if code in self.wkinprogress:
                xid, c, sd0, dl0, dh0, l0, h0, sd1, dl1, dh1, l1, h1, sd2, dl2, l2, bd = self.wkinprogress[code]
                if 'b' in sbs2:
                    buymatch = False
                    if l0 < l2 and l2 < h0:
                        k1 = (l1 - l0) / (sbs1['li'] - sbs0['li'])
                        k2 = (l2 - l1) / (sbs2['li'] - sbs1['li'])
                        k3 = (l2 - l0) / (sbs2['li'] - sbs0['li'])
                        kh = (h1 - h0) / (sbs1['hi'] - sbs0['hi'])
                        if kh < min(k1, k2, k3):
                            buymatch = True
                    if buymatch:
                        self.sqldb.update(self.tablename, {'dl2': sbs2['ldate'], 'l2': sbs2['low'], 'bdate': sbs2['b']}, {'id': xid})
                    else:
                        self.sqldb.delete(self.tablename, {'id': xid})
                else:
                    if dl2 != sbs2['ldate'] or l2 != sbs2['low']:
                        self.sqldb.update(self.tablename, {'dl2': sbs2['ldate'], 'l2': sbs2['low']}, {'id': xid})
                return

            if sbs0['high'] < sbs0['low'] * 1.15 and sbs1['high'] < sbs1['low'] * 1.15:
                if sbs0['low'] < sbs2['low'] and sbs2['low'] < sbs0['high']:
                    k1 = (sbs1['low'] - sbs0['low']) / (sbs1['li'] - sbs0['li'])
                    k2 = (sbs2['low'] - sbs1['low']) / (sbs2['li'] - sbs1['li'])
                    k3 = (sbs2['low'] - sbs0['low']) / (sbs2['li'] - sbs0['li'])
                    kh = (sbs1['high'] - sbs0['high']) / (sbs1['hi'] - sbs0['hi'])
                    if kh < min(k1, k2, k3):
                        self.wkselected.append([
                            code, sbs0['s'], sbs0['ldate'], sbs0['hdate'], sbs0['low'], sbs0['high'],
                            sbs1['s'], sbs1['ldate'], sbs1['hdate'], sbs1['low'], sbs1['high'],
                            sbs2['s'], sbs2['ldate'], sbs2['low'], sbs2['b'] if 'b' in sbs2 else None])

    def updatePickUps(self):
        self.walkOnHistory()

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date])

    def getDumpCondition(self, date=None):
        return 'bdate is NULL'

    def dumpDataByDate(self, date=None):
        maconvs = super().dumpDataByDate(date)
        picked = []
        for c, sd0 in maconvs:
            kd = self.get_kd_data(c, start=sd0, fqt=1)
            kd = KlList.calc_kl_bss(kd)
            if kd[-2].close == kd[-2].high and kd[-2].close >= Utils.zt_priceby(kd[-3].close, zdf=20 if c.startswith('SZ30') or c.startswith('SH68') else 10):
                continue
            if kd[-1].close == kd[-1].high and kd[-1].close >= Utils.zt_priceby(kd[-2].close, zdf=20 if c.startswith('SZ30') or c.startswith('SH68') else 10):
                continue
            if kd[-1].bss18 == 'w' and kd[-1].low > kd[-1].ma18:
                picked.append([c, sd0])

        return picked

    def sim_prepare(self):
        if not self.sqldb:
            self._check_or_create_table()
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, bdate', 'bdate is not NULL')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, dt, bdt in orstks:
            if kd is None:
                kd = self.get_kd_data(code, dt)
                kd = KlList.calc_kl_bss(kd)
            ki = 0
            while kd[ki].date != dt:
                ki += 1

            low = kd[ki].low
            while kd[ki].date != bdt:
                if kd[ki].low < low:
                    low = kd[ki].low
                ki += 1
            if ki > 0 and ki + 3 >= len(kd):
                continue

            klb = kd[ki]
            assert klb.date == bdt, 'wrong kl data!'

            zdf = 20 if code.startswith('30') or code.startswith('68') else 10
            buy = klb.close
            bdate = klb.date
            sell = 0
            sdate = klb.date
            j = ki + 1
            ztin3day = False
            for z in range(0, 3):
                pclose = kd[ki - z - 1].close
                kl = kd[ki - z]
                if kl.close == kl.high and kl.high >= Utils.zt_priceby(pclose, zdf=zdf):
                    ztin3day = True

            if ztin3day:
                continue

            if low < buy * 0.885:
                low = buy * 0.885

            while j < len(kd):
                clp3 = kd[j-1].close
                klj = kd[j]
                cl3 = klj.close
                hi3 = klj.high
                lo3 = klj.low
                op3 = klj.open
                if lo3 == hi3 and hi3 <= Utils.dt_priceby(clp3, zdf=zdf):
                    # 一字跌停，无法卖出
                    j += 1
                    continue
                if lo3 == hi3 and hi3 >= Utils.zt_priceby(clp3, zdf=zdf):
                    j += 1
                    continue
                if op3 < low:
                    if op3 > Utils.dt_priceby(clp3, zdf=zdf):
                        sell = op3
                        sdate = klj.date
                        break
                if lo3 < low:
                    sell = low
                    sdate = klj.date
                    break
                if klj.bss18 == 's' and cl3 > buy:
                    sell = cl3
                    sdate = klj.date
                    break
                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0
