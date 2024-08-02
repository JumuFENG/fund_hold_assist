# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from pickup.stock_base_selector import *


class StockAuctionUpSelector(StockBaseSelector):
    ''' 竞价跌停,竞价结束时打开
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_auction_pickup'
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'top', 'type': 'varchar(10) DEFAULT NULL'},
            {'col': 'bottom', 'type': 'varchar(10) DEFAULT NULL'},
            {'col': 'zdays', 'type': 'int DEFAULT 0'}, # 连板天数
            {'col': 'zdistance', 'type': 'int DEFAULT 0'}, # 涨停之后调整天数
            {'col': 'ddays', 'type': 'int DEFAULT 0'}, # 跌停天数
            {'col': 'ddistance', 'type': 'int DEFAULT 0'}, # 跌停之后调整天数
        ]

        self.sim_cutrate = 0.08
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 连续跌停 竞价抢筹
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_dt_all'},
            # 竞价跌停 结束时打开
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_dt_up'},
            # 竞价跌停 随后持续上升
            {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_dt_contup'},
            # 竞价跌停 结束时买入有剩余
            {'prepare': self.sim_prepare3, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_dt_volmore'},
            # 竞价跌停 结束时打开/买入有剩余
            {'prepare': self.sim_prepare4, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_dt_uv'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def walk_prepare(self, date=None):
        sad = StockAuctionDetails()
        if date is None:
            self.wkstocks = list(sad.dumpAllRows())
        else:
            self.wkstocks = list(sad.dumpDataByDate(date))
        self.wkselected = []

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d, t, b, q = self.wkstocks.pop(0)
            q = json.loads(q)
            cqt = {'quotes': q}
            cqt['bottomprice'] = b
            cqt['topprice'] = t

            zdays, zdist, ddays, ddist = self.calc_dzt_num(c, d)

            if not self.sim_check_dzt_num(zdays, zdist, ddays, ddist):
                continue
            if self.sim_check_match(cqt):
                self.wkselected.append([c, d, t, b, zdays, zdist, ddays, ddist])

    def save_daily_auction_matched(self, values):
        if not isinstance(values, list) or len(values) == 0:
            return
        self.wkselected = values
        self.walk_post_process()

    def sim_prepare(self):
        self.walk_prepare()
        self.sim_stks = sorted(self.wkstocks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def calc_dzt_num(self, code, date):
        i = 0
        sdt = date
        while i < 10:
            sdt = TradingDate.prevTradingDate(sdt)
            i += 1
        kd = self.get_kd_data(code, sdt)
        if len(kd) < 10:
            return 0,0,0,0

        i = 0
        while i < len(kd) and kd[i].date < date:
            i += 1

        scode = code.replace('SH', '').replace('SZ', '')
        zdf = 10 if scode.startswith('60') or scode.startswith('00') else 20
        j = i - 1
        while j > 0:
            if kd[j].high == kd[j].close and kd[j].high >= Utils.zt_priceby(kd[j-1].close, zdf=zdf):
                break
            j -= 1
        while j > 0 and kd[j].high == kd[j].close and kd[j].high >= Utils.zt_priceby(kd[j-1].close, zdf=zdf):
            j -= 1

        i = j
        zdays, zdist, ddays, ddist = 0,0,0,0
        if i == 0 and round(kd[i].pchange) == zdf and kd[i].high == kd[i].close:
            zdays = 1
        i += 1
        while i < len(kd) and kd[i].date < date:
            if kd[i].close >= Utils.zt_priceby(kd[i-1].close, zdf=zdf) and kd[i].high == kd[i].close:
                zdays += 1
            else:
                if kd[i].close <= Utils.dt_priceby(kd[i-1].close, zdf=zdf) and kd[i].low == kd[i].close:
                    ddays += 1
                elif ddays > 0:
                    ddist += 1
                if zdays > 0:
                    zdist += 1
            i += 1
        return zdays, zdist, ddays, ddist
    
    def sim_check_dzt_num(self, zdays, zdist, ddays, ddist):
        if zdays == 0 and zdist == 0 and ddays > 0 and ddist < ddays:
            # 无涨停, 有跌停
            return True
        # if zdays > 0 and zdist == 1:
        #     # 涨停 无调整
        #     return True
        # if zdays > 0 and zdist == 2:
        #     # 调整1天
        #     return True
        # if zdays > 0 and zdist == 3:
        #     # 调整1天
        #     return True
        # if zdays > 0 and zdist > 4:
        #     # 调整天数大于3
        #     return True
        return False

    def sim_check_match(self, auctions):
        # 连续跌停 竞价打开/买入有剩余
        return (
                StockAuctionDetails.check_buy_match(auctions) or 
                # StockAuctionDetails.check_buy_match_cont_up(auctions) or 
                StockAuctionDetails.check_buy_vol_more_match(auctions))

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, dt, t, b, q in orstks:
            q = json.loads(q)
            cqt = {'quotes': q}
            cqt['bottomprice'] = b
            cqt['topprice'] = t
            cqt['date'] = dt
            cqt['code'] = code

            zdays, zdist, ddays, ddist = self.calc_dzt_num(code, dt)

            if not self.sim_check_dzt_num(zdays, zdist, ddays, ddist):
                continue
            if not self.sim_check_match(cqt):
                continue

            if kd is None:
                kd = self.get_kd_data(code, dt)

            ki = 0
            while kd[ki].date != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]

            self.sim_quick_sell(kd, code, kd[0].date, kd[0].open, 0.05, 0.08)

    def sim_check_match1(self, auctions):
        return StockAuctionDetails.check_buy_match(auctions)

    def sim_check_match2(self, auctions):
        return StockAuctionDetails.check_buy_match_cont_up(auctions)

    def sim_check_match3(self, auctions):
        return StockAuctionDetails.check_buy_vol_more_match(auctions)

    def sim_check_match13(self, auctions):
        return StockAuctionDetails.check_buy_match(auctions) or StockAuctionDetails.check_buy_vol_more_match(auctions)

    def sim_prepare1(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match1

    def sim_prepare2(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match2

    def sim_prepare3(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match3

    def sim_prepare4(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match13
