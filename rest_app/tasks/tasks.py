import os
import logging
from datetime import datetime
import json
from utils import Utils, TradingDate
from history import StockGlobal
from history import StockBkAllChangesHistory, StockBkMap, StockMarkerStats
from pickup import StockZtDaily


class StockMarket_Stats_Task():
    '''股市概况, 早盘竞价结束自动执行一次, 早上9:40自动执行一次, 收盘执行一次'''
    # ['9:25:05', '9:40', '15:01']
    topbks = None
    hotstocks = None

    @staticmethod
    def to_secucode(code):
        return Utils.to_cls_secucode(code)

    @classmethod
    def get_topbks(self):
        sbkchg = StockBkAllChangesHistory()
        self.topbks = sbkchg.get_topbks()
        self.bkstocklist = {}
        for bk in self.topbks:
            self.bkstocklist[bk] = [self.to_secucode(c) for c in StockBkMap.bk_stocks(bk)]

        kickdate = TradingDate.prevTradingDate(TradingDate.maxTradedDate(), 3) if len(self.topbks.values()) == 0 else min([bk['kickdate'] for bk in self.topbks.values()])
        szt = StockZtDaily()
        ztstks = szt.getHotStocks(kickdate)
        mdate = TradingDate.maxTradingDate()
        self.hotstocks = {self.to_secucode(c): {'code': self.to_secucode(c), 'date': d, 'days': days, 'lbc': lbc, 'ndays': TradingDate.calcTradingDays(d, mdate) - 1} for c,d,days,lbc in ztstks}

    @classmethod
    def zt_lbc_sort_key(self, secu):
        code = secu['secu_code']
        if code not in self.hotstocks:
            return -1, -1
        days = self.hotstocks[code]['days'] + self.hotstocks[code]['ndays']
        if days == 0:
            return -1, self.hotstocks[code]['lbc']
        return days, self.hotstocks[code]['lbc'] / days

    @classmethod
    def connect_bk_stock(self, stats):
        zt_stocks = [z['secu_code'] for z in stats['stocks']['zt_yzb'] + stats['stocks']['zt']]
        for bk in self.topbks:
            self.topbks[bk]['zt_stocks'] = [s for s in self.bkstocklist[bk] if s in zt_stocks]
        stats['plates'] = sorted(self.topbks.values(), key=lambda x: len(x['zt_stocks']), reverse=True)

        stocks = {}
        for k in ['zt_yzb', 'zt', 'up', 'down', 'dt']:
            stocks[k] = []
            pstocks = [[] for _ in range(len(stats['plates']))]
            for zs in stats['stocks'][k]:
                inplates = False
                for i in range(0, len(stats['plates'])):
                    if zs['secu_code'] in self.bkstocklist[stats['plates'][i]['code']]:
                        pstocks[i].append(zs)
                        inplates = True
                        break
                if not inplates:
                    pstocks[-1].append(zs)

            for i in range(len(pstocks)):
                if len(pstocks[i]) < 2:
                    continue
                pstocks[i] = sorted(pstocks[i], key=self.zt_lbc_sort_key, reverse=True)
            stocks[k] = []
            for zs in pstocks:
                stocks[k] += zs
        stats['stocks'] = stocks

        estocks = []
        for k in ['zt_yzb', 'zt', 'up', 'down', 'dt']:
            for zs in stats['stocks'][k]:
                estocks.append(zs['secu_code'])
        stockextras = {}
        for s in estocks:
            if s in self.hotstocks:
                stockextras[s] = self.hotstocks[s]
            plist = []
            for p in stats['plates']:
                if s in self.bkstocklist[p['code']]:
                    plist.append(p['code'])
            if len(plist) > 0:
                if s not in stockextras:
                    stockextras[s] = {}
                stockextras[s]['plates'] = plist
        stats['stockextras'] = stockextras
        return stats

    @classmethod
    def execute_simple_task(self):
        if self.topbks is None or self.hotstocks is None:
            self.get_topbks()
        zdfranks = StockGlobal.getStocksZdfRank()
        up_down_stocks = []
        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            if c == '-' or zd == '-':
                continue
            cd = rkobj['f12'] # 代码
            m = rkobj['f13']  # 市场代码 0 深 1 沪
            if (m != 0 and m != 1):
                Utils.log(f'invalid market {m}')
                continue
            if zd >= 8 or zd <= -8:
                code = StockGlobal.full_stockcode(cd)
                up_down_stocks.append(code)

        sm_statistics = {'time': datetime.now().strftime('%Y-%m-%d %H:%M'), 'stocks': {'zt_yzb':[], 'zt':[], 'dt':[], 'up':[], 'down':[]}}
        fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px'
        for i in range(0,len(up_down_stocks),200):
            ccodes = ','.join([self.to_secucode(c) for c in up_down_stocks[i: i+200]])
            bUrl = f'https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields={fields}&os=web&secu_codes={ccodes}&sv=7.7.5'
            sbasics = json.loads(Utils.get_em_request(bUrl, 'x-quote.cls.cn'))
            if 'data' in sbasics:
                for secu in sbasics['data']:
                    sbasic = sbasics['data'][secu]
                    o,h,l,c = sbasic['open_px'], sbasic['high_px'], sbasic['low_px'], sbasic['last_px']
                    u,d,lc = sbasic['up_price'], sbasic['down_price'], sbasic['preclose_px']
                    if c == u:
                        if h == l:
                            # 一字
                            sm_statistics['stocks']['zt_yzb'].append(sbasic)
                        else:
                            # 涨停
                            sm_statistics['stocks']['zt'].append(sbasic)
                    elif c == d:
                        sm_statistics['stocks']['dt'].append(sbasic)
                        # 跌停
                    elif sbasic['change'] >= 0.08:
                        sm_statistics['stocks']['up'].append(sbasic)
                        # 大涨
                    elif sbasic['change'] <= -0.08:
                        # 大跌
                        sm_statistics['stocks']['down'].append(sbasic)

        sm_statistics = self.connect_bk_stock(sm_statistics)
        dsm, tsm = sm_statistics['time'].split(' ')
        smtable = StockMarkerStats()
        smtable.saveDailyStats([[dsm, tsm, sm_statistics]])
