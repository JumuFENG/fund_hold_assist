# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
from pickup.stock_base_selector import *
from rest_app.ws.ws_intrade_strategy import *


class StockAuctionUpSelector(StockBaseSelector):
    ''' 竞价跌停,竞价结束时打开
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_auc_up_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'end','type':'varchar(20) DEFAULT NULL'},
        ]
        self.sim_cutrate = 0.08
        self.sim_earnrate = 0.06
        self._sim_ops = [
            # 竞价跌停 结束时打开
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_up'},
            # 竞价跌停 随后持续上升
            {'prepare': self.sim_prepare1, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_contup'},
            # 竞价跌停 结束时买入有剩余
            {'prepare': self.sim_prepare2, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_auc_open'},
            ]
        self.sim_ops = self._sim_ops[2:3]

    def walk_prepare(self, date=None):
        sad = StockAuctionDetails()
        if date is None:
            self.wkstocks = list(sad.dumpAllRows())
        else:
            self.wkstocks = list(sad.dumpDataByDate(date))

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            c, d, t, b, q = self.wkstocks.pop(0)
            q = json.loads(q)
            cqt = {'quotes': q}
            cqt['bottomprice'] = b
            cqt['topprice'] = t

            if StrategyI_AuctionUp.check_buy_match(cqt):
                self.wkselected.append([d, c, q[-1][1]])

            # allkl = self.get_kd_data(c, start=d)
            # if allkl is None:
            #     continue

    def post_process(self):
        [print(x) for x in self.wkselected]

    def sim_prepare(self):
        self.walk_prepare()
        self.sim_stks = sorted(self.wkstocks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def sim_check_match(self, cqt):
        return StrategyI_AuctionUp.check_buy_match(cqt)

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, dt, t, b, q in orstks:
            q = json.loads(q)
            cqt = {'quotes': q}
            cqt['bottomprice'] = b
            cqt['topprice'] = t

            if not self.sim_check_match(cqt):
                continue

            if kd is None:
                kd = self.get_kd_data(code, dt)

            ki = 0
            while kd[ki].date != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 2:
                    continue

            op0 = kd[0].open
            hi0 = kd[0].high
            lo0 = kd[0].low
            cl0 = kd[0].close

            buy = min(op0 * 1.03, hi0)
            bdate = kd[0].date
            sell = 0
            sdate = kd[0].date

            j = 1
            cutl = buy * (1 - self.sim_cutrate)
            if cl0 <= buy * (1 + 0.03):
                cutl = min(cutl, cl0 * (1 - self.sim_cutrate))
            elif cl0 >= buy * (1 + self.sim_earnrate):
                cutl = buy
            earnl = buy * (1 + self.sim_earnrate)
            if cl0 <= hi0 * (1 - 0.05) and hi0 >= buy * (1 + 2 * self.sim_earnrate):
                earnl = hi0 * (1 - 0.02)
            while j < len(kd):
                clp0 = kd[j-1].close
                cl1 = kd[j].close
                hi1 = kd[j].high
                lo1 = kd[j].low
                op1 = kd[j].open

                if lo1 == hi1 and hi1 <= Utils.dt_priceby(clp0):
                    # 一字跌停，无法卖出
                    j += 1
                    continue

                if lo1 == hi1 and hi1 >= Utils.zt_priceby(clp0):
                    # 一字涨停，持股不动
                    cutl = cl1 * (1 - self.sim_cutrate)
                    earnl = hi1
                    j += 1
                    continue

                if op1 < cutl:
                    if op1 > Utils.dt_priceby(clp0):
                        sell = op1
                        sdate = kd[j].date
                        break

                if lo1 < cutl:
                    sell = cutl
                    sdate = kd[j].date
                    break

                if hi1 >= earnl:
                    sell = (hi1 + earnl) / 2
                    sdate = kd[j].date
                    break

                j += 1

            if sdate != bdate:
                self.sim_add_deals(code, [[buy, bdate]], [sell, sdate], 100000)
                sdate = None
                bdate = None
                buy = 0
                sell = 0

    def sim_check_match1(self, auctions):
        bottomprice = auctions['bottomprice']
        quotes = auctions['quotes']
        if quotes[0][1] > bottomprice:
            return False

        for i in range(1, len(quotes)):
            qt, cp, mv, uv = quotes[i]
            if qt < '09:22' and quotes[i][1] > bottomprice:
                return False
            if quotes[i][1] < quotes[i - 1][1]:
                return False

        return quotes[-1][1] > bottomprice

    def sim_prepare1(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match1

    def sim_prepare2(self):
        self.sim_prepare()
        self.sim_check_match = self.sim_check_match2

    def sim_check_match2(self, auctions):
        bottomprice =auctions['bottomprice']
        quotes = auctions['quotes']

        if quotes[-1][0] < '09:25':
            return False

        if max([q[1] for q in quotes]) > bottomprice:
            return False

        # if quotes[-1][1] > bottomprice:
        #     return False
        return quotes[-1][3] > 0
