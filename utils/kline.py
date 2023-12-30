# Python 3
# -*- coding:utf-8 -*-

class KNode():
    '''
    单个K线数据
    '''
    def __init__(self, kl) -> None:
        self.date = kl[1]
        self.close = float(kl[2])
        self.high = float(kl[3])
        self.low = float(kl[4])
        self.open = float(kl[5])
        self.prcchange = float(kl[6])
        self.pchange = float(kl[7])
        self.vol = int(kl[8])
        self.amount = float(kl[9])

class KlList():
    @classmethod
    def get_kldata_by_time(self, klist, date):
        # type: (list/tuple, str) -> KNode
        for kl in klist:
            if isinstance(kl, KNode):
                if kl.date == date:
                    return kl
            elif kl[1] == date:
                return KNode(kl)

    @classmethod
    def calc_kl_ma(self, klist, mlen=18):
        if isinstance(klist[0], (list, tuple)):
            klist = [KNode(kl) for kl in klist]

        csum = 0
        klen = 0
        for i in range(0, len(klist)):
            csum += klist[i].close
            if klen < mlen:
                klen += 1
            else:
                if i >= mlen:
                    csum -= klist[i - mlen].close
            setattr(klist[i], f'ma{mlen}', round(csum/klen, 2))
        return klist

    @classmethod
    def get_next_kl_bss(self, pkl, kl, mlen=18):
        bss = 'u'
        pbss = getattr(pkl, f'bss{mlen}')
        ma = getattr(kl, f'ma{mlen}')
        if kl.low > ma and pkl.low > getattr(pkl, f'ma{mlen}'):
            if pbss == 'u':
                bss = 'b'
            else:
                bss = 'b' if pbss == 'w' else 'h'
        elif kl.high < ma and pkl.high < getattr(pkl, f'ma{mlen}'):
            if pbss == 'u':
                bss = 's'
            else:
                bss = 's' if pbss == 'h' else 'w'
        else:
            bss = pbss
            if pbss == 'b':
                bss = 'h'
            elif pbss == 's':
                bss = 'w'
        return bss

    @classmethod
    def calc_kl_bss(self, klist, mlen=18):
        klist = self.calc_kl_ma(klist, mlen)
        if len(klist) < 2:
            for kl in klist:
                setattr(kl, f'bss{mlen}', 'u')
            return klist

        setattr(klist[0], f'bss{mlen}', 'u')
        setattr(klist[1], f'bss{mlen}', 'u')
        for i in range(2, len(klist)):
            setattr(klist[i], f'bss{mlen}', self.get_next_kl_bss(klist[i-1], klist[i], mlen))

        if getattr(klist[0], f'bss{mlen}') == 'u':
            i = 1
            bss = 'u'
            while i < len(klist):
                bss = getattr(klist[i], f'bss{mlen}')
                if bss != 'u':
                    break
                i += 1
            i -= 1
            while i >= 0:
                setattr(klist[i], f'bss{mlen}', 'h' if bss == 's' else 'w')
                i -= 1
        return klist

    @classmethod
    def single_td(self, kl, kl4, td):
        # type: (KNode, KNode, int) -> int
        rtd = td
        if kl.close - kl4.close > 0:
            rtd = 0 if td < 0 else td + 1
        elif kl.close - kl4.close < 0:
            rtd = 0 if td > 0 else td - 1
        return rtd

    @classmethod
    def calc_td(self, klist):
        ''' 计算TD值 (神奇九转)
        '''
        if len(klist) == 0:
            return
        setattr(klist[0], 'td', 0)
        for i in range(1, min(len(klist), 4)):
            setattr(klist[i], 'td', self.single_td(klist[i], klist[0], klist[i - 1].td))

        if len(klist) < 4:
            return

        for i in range(4, len(klist)):
            setattr(klist[i], 'td', self.single_td(klist[i], klist[i-4], klist[i - 1].td))

    @classmethod
    def get_next_bss_sell(self, klist, date, mlen=18):
        ''' 获取{date}之后的bss卖出点
        '''
        pass

    @classmethod
    def calc_sb_serial(self, kdbs):
        serial = []
        bs = {'state':'', 'date':'', 'price':0, 'sdate':'','hlprice':0, 'edate':'', 'eprice': 0}
        for i in range(0, len(kdbs)):
            if kdbs[i].bss18 == 'h':
                if bs['state'] == 'b':
                    if kdbs[i].high - bs['price'] > 2 * (bs['price'] - bs['hlprice']):
                        bs['state'] = "B"
                if bs['state'].lower() == 'b':
                    if kdbs[i].high > bs['eprice']:
                        bs['edate'] = kdbs[i].date
                        bs['eprice'] = kdbs[i].high
                continue
            if kdbs[i].bss18 == 'w':
                if bs['state'] == 's':
                    if bs['price'] - kdbs[i].low > 2 * (bs['hlprice'] - bs['price']) or bs['hlprice'] * 0.65 > kdbs[i].low:
                        bs['state'] = "S"
                if bs['state'].lower() == 's':
                    if kdbs[i].low < bs['eprice']:
                        bs['edate'] = kdbs[i].date
                        bs['eprice'] = kdbs[i].low
                continue
            if kdbs[i].bss18 == 'b':
                if bs['state'] != 'b':
                    serial.append({k:v for k,v in bs.items()})
                bs['state'] = 'b'
                bs['hlprice'] = kdbs[i].low
                j = i - 1
                while j >= 0:
                    if kdbs[j].low < bs['hlprice']:
                        bs['hlprice'] = kdbs[j].low
                        bs['sdate'] = kdbs[j].date
                    if j + 5 < i and kdbs[j+5].bss18 == 's':
                        break
                    j -= 1
                bs['price'] = kdbs[i].close
                bs['date'] = kdbs[i].date
                bs['edate'] = kdbs[i].date
                bs['eprice'] = kdbs[i].close
            elif kdbs[i].bss18 == 's':
                if bs['state'] != 's':
                    serial.append({k:v for k,v in bs.items()})
                bs['state'] = 's'
                bs['hlprice'] = kdbs[i].high
                j = i - 1
                while j >= 0:
                    if kdbs[j].high > bs['hlprice']:
                        bs['hlprice'] = kdbs[j].high
                        bs['sdate'] = kdbs[j].date
                    if j + 5 < i and kdbs[j+5].bss18 == 'b':
                        break
                    j -= 1
                bs['price'] = kdbs[i].close
                bs['date'] = kdbs[i].date
                bs['edate'] = kdbs[i].date
                bs['eprice'] = kdbs[i].close
        if bs['state'] != '':
            serial.append({k:v for k,v in bs.items()})
        return serial[1:]

    @classmethod
    def get_first_price_lower_than(self, klist, price, start=None):
        i = 0
        while i < len(klist):
            if klist[i].date >= start:
                break
            i += 1
        while i < len(klist):
            if klist[i].low < price:
                return klist[i]
            i += 1
        return

    @classmethod
    def max_fall_down(self, klist, start, mlen):
        if isinstance(klist[0], (list, tuple)):
            klist = [KNode(kl) for kl in klist]

        i = 0
        while i < len(klist):
            if klist[i].date == start:
                break
            i += 1

        left = min(i, i + mlen)
        if left < 0:
            left = 0
        right = max(i, i + mlen)
        h = klist[left].high
        l = klist[right].low
        while left < right:
            left += 1
            right -= 1
            if left > right:
                break
            if klist[left].high > h:
                h = klist[left].high
            if klist[right].low < l:
                l = klist[right].low

        return (h - l) / h

    @classmethod
    def max_speed_up(self, klist, start, mlen):
        if isinstance(klist[0], (list, tuple)):
            klist = [KNode(kl) for kl in klist]

        i = 0
        while i < len(klist):
            if klist[i].date == start:
                break
            i += 1

        left = min(i, i + mlen)
        if left < 0:
            left = 0
        right = max(i, i + mlen)
        l = klist[left].low
        h = klist[right].high
        while left < right:
            left += 1
            right -= 1
            if left > right:
                break
            if klist[right].high > h:
                h = klist[right].high
            if klist[left].low < l:
                l = klist[left].low

        return (h - l) / l

    @classmethod
    def get_vol_scale(self, klist, date, n = 10):
        ''' 放量程度, {date}日成交量/{n}日均量
        '''
        assert isinstance(klist, (list, tuple))
        if isinstance(klist[0], (list, tuple)):
            klist = [KNode(kl) for kl in klist]

        vd = None
        idx = None
        for i in range(1, len(klist)):
            if klist[-i].date == date:
                vd = int(klist[-i].vol)
                idx = i
                break

        if idx is None:
            return 1

        vsum = 0
        nc = n
        for i in range(1, n + 1):
            if idx + i > len(klist):
                nc -= 1
                continue
            vsum += int(klist[-idx - i].vol)
        return round(vd * 10 / vsum, 2)

    @classmethod
    def get_zt_strengh(self, klist, date):
        '''涨停强度, 当日(涨停价(收盘价) - 最低价) / 昨日收盘价
        '''
        assert isinstance(klist, (list, tuple))
        if isinstance(klist[0], (list, tuple)):
            klist = [KNode(kl) for kl in klist]

        l = None
        c = None
        idx = None
        for i in range(1, len(klist)):
            if klist[-i].date == date:
                l = klist[-i].low
                c = klist[-i].close
                idx = i
                break

        if idx is None:
            if l is None or c is None:
                return 0
            return round(100 * (c - l) / l, 2)

        return round(100 * (c - l) / klist[-idx - 1].close, 2)
