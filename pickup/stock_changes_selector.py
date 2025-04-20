# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_zt_lead_selector import *
from pickup.stock_base_selector import *

class StockSuperFlowSelector(StockBaseSelector):
    '''
    异动选股，深水大笔买入跟进, 三次大笔买入且股价跌幅在-8以上跟进，第二天小盈小亏出局，大亏择机补仓，大盈择机卖出
    '''
    def __init__(self) -> None:
        super().__init__(False)
        self.chgtable = StockChangesHistory()
        self._sim_ops = [
            # 深水大笔买入跟进 次日收盘卖出
            {'prepare': self.sim_prepare, 'thread': self.simulate_buy_sell, 'post': self.sim_post_process, 'dtable': f'track_sim_supbuy'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def sim_prepare(self):
        orstks = self.chgtable.sqldb.select(self.chgtable.tablename, f'code, date, type, info', 'type = 64')
        c64dic = {}
        for c,d,t,i in orstks:
            date = d.split(' ')[0]
            if (c, date) not in c64dic:
                c64dic[(c, date)] = []
            c64dic[(c, date)].append([c, d, t, i])
        self.sim_stks = sorted([[cd[0], cd[1], s] for cd, s in c64dic.items()], key=lambda s: (s[0], s[1]))
        self.sim_deals = []
        self.threads_num = 6

    def simulate_buy_sell(self, orstks):
        kd = None
        for code, date, chgs in orstks:
            if len(chgs) < 3:
                continue

            chgs = sorted(chgs, key=lambda s: s[1])
            downlimit = -0.08
            if code.startswith('SZ30') or code.startswith('SH68'):
                downlimit = -0.15
            elif code.startswith('BJ'):
                downlimit = -0.22

            buy = None
            for i in range(2, len(chgs)):
                chg3i = chgs[i][3].split(',')
                if float(chg3i[-1]) > downlimit:
                    continue
                if float(chg3i[-1]) <= downlimit:
                    buy = float(chg3i[1])
                    break

            if buy is None:
                continue

            if kd is None:
                kd = self.get_kd_data(code, date)
            ki = 0
            while kd[ki].date != date:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
            if kd is None or len(kd) < 2:
                continue
            bpds = [[buy, date]]
            sell, sdate = None, None
            if kd[0].close > buy * (1 + 0.08):
                # 当日浮盈>8%次日卖出
                sell = kd[1].close
                sdate = kd[1].date
            else:
                ki = 1
                while ki < 5 and ki < len(kd):
                    if kd[ki].low <= kd[ki - 1].close * (1 + downlimit):
                        # 大跌加仓
                        bpds.append([kd[ki - 1].close * (1 + downlimit), kd[ki].date])
                    elif kd[ki].close > bpds[-1][0] * (1 - 0.03):
                        # 收盘浮盈>-3%卖出
                        sell = kd[ki].close
                        sdate = kd[ki].date
                        break
                    ki += 1
            if sell is None:
                ki = min(ki, len(kd) - 1)
                sell = kd[ki].close
                sdate = kd[ki].date
            self.sim_add_deals(code, bpds, [sell, sdate], 100000)

    def walk_on_history_thread(self):
        changes64 = self.chgtable.sqldb.select(self.chgtable.tablename, ['code', 'date', 'type', 'info'], ['date > "2025-04-08"', 'type = 64'])
        c64dic = {}
        for c,d,t,i in changes64:
            if float(i.split(',')[-1]) <= -0.08:
                if c not in c64dic:
                    c64dic[c] = []
                c64dic[c].append([c, d, t, i])
        for c, chg in c64dic.items():
            print(c, len(chg), chg)

