# Python 3
# -*- coding:utf-8 -*-

from utils import *
from .kdata_dumps import *
from .stock_history import *
from .stock_announcements import *
import json


class StockDumps(KdataDumps):
    def __init__(self):
        self.history = Stock_history()

    def get_km_table(self, code):
        return StockGlobal.stock_general(code).stockKmtable

    def get_kw_table(self, code):
        return StockGlobal.stock_general(code).stockKwtable

    def get_kd_table(self, code):
        return StockGlobal.stock_general(code).stockKtable

    def get_k15_table(self, code):
        return StockGlobal.stock_general(code).stockK15table

    def get_his(self, codes = None):
        all_stock_obj = {}
        allstk = AllStocks()
        infoList = allstk.readAll()
        for (i,c,n,s,t,sn,sc,sd) in infoList:
            if codes is not None and not c in codes:
                continue

            stock_obj = {}
            stock_obj['name'] = n
            stock_obj['type'] = t
            stock_obj['sc'] = sc.replace('亿元', '')
            #stock_obj['sd'] = sd
            mdata = self.read_km_data(c)
            if mdata is None or len(mdata) < 2:
                continue
            mdata = self.process_kdata(mdata)
            stock_obj['mfluct_down'] = mdata['fluct_down']
            stock_obj['mfluct_up'] = mdata['fluct_up']
            stock_obj['mlen'] = mdata['data_len']
            stock_obj['mlasthigh'] = mdata['last_high']
            stock_obj['mlastlow'] = mdata['last_low']
            stock_obj['last_close'] = mdata['last_close']
            all_stock_obj[c] = stock_obj

        return all_stock_obj

    def dump_all_stock_his(self):
        all_stock_obj = self.get_all_his()
        f = open("summary/json/etf_history_data.json", 'w')
        f.write("var all_candidate_stocks = " + json.dumps(all_stock_obj) + ";")
        f.close()

    def read_k15_data(self, code, fqt = 0, length = 512, start = None):
        f0data = super().read_k15_data(code, fqt, length, start)
        if f0data is None or fqt == 0:
            return f0data

        return self.fixPrice(code, f0data, fqt)

    def read_kd_data(self, code, fqt = 0, length = 200, start = None):
        if start == '0' or start == '':
            start = None
            length = 0
        f0data = super().read_kd_data(code, fqt, length, start)
        if f0data is None or len(f0data) == 0 or fqt == 0:
            return f0data

        return self.fixPrice(code, f0data, fqt)

    def read_kw_data(self, code, fqt = 0, length = 100, start = None):
        f0data = super().read_kw_data(code, fqt, length, start)
        if f0data is None or fqt == 0:
            return f0data

        return self.fixPrice(code, f0data, fqt)

    def read_km_data(self, code, fqt = 0, length = 60, start = None):
        f0data = super().read_km_data(code, fqt, length, start)
        if f0data is None or fqt == 0:
            return f0data

        return self.fixPrice(code, f0data, fqt)

    def fixSinglePre(self, p, gx):
        for i in range(-1, -len(gx) - 1, -1):
            if gx[i][0] == 0 and gx[i][1] == 0:
                continue
            if gx[i][0] == 0:
                p -= gx[i][1]
                continue
            p = (p - gx[i][1]) / (1 + gx[i][0])
        return round(p, 3)

    def fixPricePre(self, f0data, bndata):
        # 前复权
        fid = len(f0data) - 1
        gx = (0, 0),
        l0data = list(f0data)
        while len(bndata) > 0 and bndata[-1][2] > l0data[-1][1]:
            bndata.pop()
        for bi in range(-1, -len(bndata) - 1, -1):
            while fid >= 0:
                if (l0data[fid][1] >= bndata[bi][2]):
                    fdid = list(l0data[fid])
                    fdid[2] = self.fixSinglePre(float(fdid[2]), gx)
                    fdid[3] = self.fixSinglePre(float(fdid[3]), gx)
                    fdid[4] = self.fixSinglePre(float(fdid[4]), gx)
                    fdid[5] = self.fixSinglePre(float(fdid[5]), gx)
                    l0data[fid] = tuple(fdid)
                    fid -= 1
                    continue
                if bndata[bi][4] is None or bndata[bi][4] == '0':
                    gx += (0, float(bndata[bi][7]) / 10),
                elif bndata[bi][7] is None or bndata[bi][7] == '0':
                    gx += (float(bndata[bi][4]) / 10, 0),
                else:
                    gx += (float(bndata[bi][4]) / 10, float(bndata[bi][7]) / 10),
                break
        while fid >= 0:
            fdid = list(l0data[fid])
            fdid[2] = self.fixSinglePre(float(fdid[2]), gx)
            fdid[3] = self.fixSinglePre(float(fdid[3]), gx)
            fdid[4] = self.fixSinglePre(float(fdid[4]), gx)
            fdid[5] = self.fixSinglePre(float(fdid[5]), gx)
            l0data[fid] = tuple(fdid)
            fid -= 1
        return tuple(l0data)

    def fixSinglePost(self, p, gx):
        for i in range(0, len(gx)):
            if gx[i][0] == 0 and gx[i][1] == 0:
                continue
            if gx[i][0] == 0:
                p += gx[i][1]
                continue
            p = p * (1 + gx[i][0]) + gx[i][1]
        return round(p, 3)

    def fixPricePost(self, f0data, bndata):
        # 后复权
        l0data = list(f0data)
        gx = (0, 0),
        fid = 0
        for bi in range(0, len(bndata)):
            while fid < len(l0data):
                if (l0data[fid][1] < bndata[bi][2]):
                    fdid = list(l0data[fid])
                    fdid[2] = self.fixSinglePost(float(fdid[2]), gx)
                    fdid[3] = self.fixSinglePost(float(fdid[3]), gx)
                    fdid[4] = self.fixSinglePost(float(fdid[4]), gx)
                    fdid[5] = self.fixSinglePost(float(fdid[5]), gx)
                    l0data[fid] = tuple(fdid)
                    fid += 1
                    continue
                if bndata[bi][4] is None or bndata[bi][4] == '0':
                    gx += (0, float(bndata[bi][7]) / 10),
                elif bndata[bi][7] is None or bndata[bi][7] == '0':
                    gx += (float(bndata[bi][4]) / 10, 0),
                else:
                    gx += (float(bndata[bi][4]) / 10, float(bndata[bi][7]) / 10),
                break
        while fid < len(l0data):
            fdid = list(l0data[fid])
            fdid[2] = self.fixSinglePost(float(fdid[2]), gx)
            fdid[3] = self.fixSinglePost(float(fdid[3]), gx)
            fdid[4] = self.fixSinglePost(float(fdid[4]), gx)
            fdid[5] = self.fixSinglePost(float(fdid[5]), gx)
            l0data[fid] = tuple(fdid)
            fid += 1
        return l0data

    def fixPrice(self, code, f0data, fqt):
        sg = StockGlobal.stock_general(code)
        bn = None
        if hasattr(sg, 'type'):
            if sg.type == 'ABStock' or sg.type == 'BJStock':
                bn = StockShareBonus()
            elif sg.type == 'LOF' or sg.type == 'ETF':
                bn = FundShareBonus()
        if bn is None:
            return f0data

        bndata = bn.getBonusHis(code)
        if bndata is None or len(bndata) == 0:
            return f0data

        if fqt == 1:
            return self.fixPricePre(f0data, bndata)
        if fqt == 2:
            return self.fixPricePost(f0data, bndata)
        return f0data

