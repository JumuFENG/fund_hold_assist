# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from datetime import datetime, timedelta
from decimal import Decimal

class KdataDumps():
    """dump kdata to json or some other tasks."""
    def __init__(self):
        pass        

    def get_km_table(self, code):
        pass

    def get_kw_table(self, code):
        pass

    def get_kd_table(self, code):
        pass

    def get_k15_table(self, code):
        pass

    def get_his(self, codes = None):
        pass

    def get_all_his(self):
        return self.get_his()

    def read_k15_data(self, code, fqt = 0, length = 512, start = None):
        k15table = self.get_k15_table(code)
        if self.history.checkKtable(k15table):
            return self.history.readKHistoryData(k15table, length, start)

    def read_kd_data(self, code, fqt = 0, length = 200, start = None):
        kdtable = self.get_kd_table(code)
        if self.history.checkKtable(kdtable):
            return self.history.readKHistoryData(kdtable, length, start)

    def read_kw_data(self, code, fqt = 0, length = 100, start = None):
        kwtable = self.get_kw_table(code)
        if self.history.checkKtable(kwtable):
            return self.history.readKHistoryData(kwtable, length, start)

    def get_khl_m_his(self, code):
        mdata = self.read_km_data(code)
        khl_m = []
        if mdata is None or len(mdata) == 0:
            self.history.getKHistoryFromSohuTillToday(code)
            mdata = self.read_km_data(code)
            if mdata is None or len(mdata) == 0:
                return khl_m

        for (i, d, c, h, l, o, pr, p, v, a) in mdata:
            khl_m.append([DateConverter.days_since_2000(d), h, l])
        return khl_m

    def is_same_month(self, d1, d2):
        dt1 = datetime.strptime(d1, '%Y-%m-%d')
        dt2 = datetime.strptime(d2, '%Y-%m-%d')
        return dt1.timetuple().tm_mon == dt2.timetuple().tm_mon and dt1.timetuple().tm_year == dt2.timetuple().tm_year

    def read_km_data(self, code, fqt = 0, length = 60, start = None):
        kmtable = self.get_km_table(code)
        if self.history.checkKtable(kmtable):
            return self.history.readKHistoryData(kmtable, length, start)

        kdtable = self.get_kd_table(code)
        if not self.history.checkKtable(kdtable):
            return

        ddata = self.history.readKHistoryData(kdtable)
        sd = ddata[0][1]
        alldmdata = []
        dmdata = []
        for x in ddata:
            if self.is_same_month(x[1], sd):
                dmdata.append(x)
            else:
                alldmdata.append(dmdata)
                dmdata = []
                sd = x[1]
        if len(dmdata) > 0:
            alldmdata.append(dmdata)
        
        mdata = []
        for k in range(0, len(alldmdata)):
            mh = alldmdata[k][0][3]
            ml = alldmdata[k][0][4]
            mv = 0
            ma = 0
            for (i, d, c, h, l, o, pr, p, v, a) in alldmdata[k]:
                if float(h) > float(mh):
                    mh = h
                if float(l) < float(ml):
                    ml = l
                mv += Decimal(v)
                ma += Decimal(a)
            md = alldmdata[k][-1][1]
            mc = alldmdata[k][-1][2]
            mo = alldmdata[k][0][5]
            mpr = 0
            mp = 0
            mdata.append((k, md, mc, mh, ml, mo, mpr, mp, mv, ma))

        if start is None and length <= 0:
            return mdata

        if start is not None:
            return tuple(filter(lambda d : d[1] >= start, mdata))

        if len(mdata) <= length:
            return mdata

        return mdata[-length, -1]

    def process_kdata(self, kdata):
        proc_obj = {}
        dhl = []
        for (i, d, c, h, l, o, pr, p, v, a) in kdata:
            dhl.append((d, float(h), float(l)))
        down_all = []
        up_all = []
        for i in range(0, len(dhl) - 1):
            (d1, h1, l1) = dhl[i]
            (d2, h2, l2) = dhl[i + 1]
            down_all.append((h1 - l2) / h1)
            up_all.append((h2 - l1) / l1)
        proc_obj['fluct_down'] = round(100 * sum(down_all)/len(down_all), 2)
        proc_obj['fluct_up'] = round(100 * sum(up_all)/len(up_all), 2)
        proc_obj['data_len'] = len(kdata)
        proc_obj['last_close'] = kdata[-1][2]
        lastHigh = float(kdata[-1][3]) if float(kdata[-1][3]) > float(kdata[-2][3]) else float(kdata[-2][3])
        proc_obj['last_high'] = lastHigh
        lastLow = float(kdata[-1][4]) if float(kdata[-1][4]) < float(kdata[-2][4]) else float(kdata[-2][4])
        proc_obj['last_low'] = lastLow
        return proc_obj
        
    def get_kl_data(self, code, klt, fqt = 0, length = 60, start = None):
        # {klt:'1', text:'1分钟'}, {klt:'15', text:'15分钟'}, {klt:'101', text:'1日'}, {klt:'102', text:'1周'}, {klt:'103', text:'1月'}, {klt:'104', text:'1季度'}, {klt:'105', text:'半年'}, {klt:'106', text:'年'}
        # fqt: 复权 1: 前复权 2: 后复权 0: 不复权

        if not code:
            print('get kline data error, invalid code', code)
            return

        if not klt:
            print('get kline data error, invalid klt', klt)
            return

        if klt == '103' or klt == 'm':
            if length is None:
                length = 200
            return self.read_km_data(code, fqt, length, start)

        if klt == '102' or klt == 'w':
            if length is None:
                length = 100
            return self.read_kw_data(code, fqt, length, start)

        if klt == '101' or klt == 'd':
            if length is None:
                length = 60
            return self.read_kd_data(code, fqt, length, start)

        if klt == '15':
            if length is None:
                length = 512
            return self.read_k15_data(code, fqt, length, start)

        print('not implemented klt', klt)
