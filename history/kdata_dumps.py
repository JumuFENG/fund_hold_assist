# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import time
import json
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

    def get_his(self, codes = None):
        pass

    def get_all_his(self):
        return self.get_his()
        
    def get_khl_m_his(self, code):
        mdata = self.read_km_data(code)
        khl_m = []
        date_conv = DateConverter()
        for (i, d, c, h, l, o, pr, p, v, a) in mdata:
            khl_m.append([date_conv.days_since_2000(d), h, l])
        return khl_m

    def is_same_month(self, d1, d2):
        dt1 = datetime.strptime(d1, '%Y-%m-%d')
        dt2 = datetime.strptime(d2, '%Y-%m-%d')
        return dt1.timetuple().tm_mon == dt2.timetuple().tm_mon and dt1.timetuple().tm_year == dt2.timetuple().tm_year

    def read_km_data(self, code):
        kmtable = self.get_km_table(code)
        if self.history.checkKtable(kmtable):
            return self.history.readKHistoryData(kmtable)

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

        return mdata

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
        