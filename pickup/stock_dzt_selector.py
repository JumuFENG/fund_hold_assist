# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_dumps import *
from pickup.stock_base_selector import *
import json
from threading import Thread

class StockDztSelector(StockBaseSelector):
    '''
    选股： 前一日跌幅>8% 次日涨幅>8%
    '''
    def __init__(self) -> None:
        super().__init__()
        self.dpath = os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/dyxy.dzt.deals.')

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_dzt_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'dtpercent', 'type':'float DEFAULT NULL'},
            {'col':'dshadow', 'type':'float DEFAULT NULL'},
            {'col':'isdt', 'type':'tinyint DEFAULT NULL'},
            {'col':'ztdate', 'type':'varchar(20) DEFAULT NULL'},
            {'col':'ztpercent', 'type':'float DEFAULT NULL'},
            {'col':'zshadow', 'type':'float DEFAULT NULL'},
            {'col':'iszt', 'type':'tinyint DEFAULT NULL'}
        ]

    def walk_on_history_thread(self):
        sd = StockDumps()
        while len(self.wkstocks) > 0:
            c, sdate = self.wkstocks.pop()
            if not c.startswith('SZ00') and not c.startswith('SH60'):
                continue

            allkl = sd.read_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 1
            while i + 1 < len(allkl):
                kl = KNode(allkl[i])
                kl2 = KNode(allkl[i+1])
                lcl = KNode(allkl[i-1]).close if i > 0 else kl.open
                if kl.pchange < -8 and kl2.pchange > 8:
                    isdt = 1 if kl.close <= Utils.dt_priceby(lcl) else 0
                    iszt = 1 if kl2.close >= Utils.zt_priceby(kl.close) else 0
                    self.wkselected.append([
                        c, kl.date, kl.pchange, round((kl.close - kl.low) / lcl, 4), isdt,
                        kl2.date, kl2.pchange, round((kl2.high - kl2.close) / kl.close, 4), iszt
                    ])
                    i += 1
                i += 1

    def walk_post_process(self):
        completed = []
        for dzt in self.wkselected:
            dtid = self.sqldb.selectOneValue(self.tablename, f'id', f'{column_date} = "{dzt[1]}" and {column_code} = "{dzt[0]}"')
            if len(dzt) == 9:
                if dtid is None:
                    completed.append(dzt)
                else:
                    self.sqldb.update(self.tablename, {
                        'dtpercent': dzt[2], 'dshadow': dzt[3], 'isdt': dzt[4],'ztdate': dzt[5], 
                        'ztpercent': dzt[6], 'zshadow': dzt[7], 'iszt': dzt[8]
                    }, {'id': dtid})

        if len(completed) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], completed)

    def updateDzt(self):
        # 更新涨跌停数据
        mdate = self.sqldb.selectOneValue(self.tablename, f"max(ztdate)")
        if mdate == TradingDate.maxTradingDate():
            print('StockDztSelector.getNext already updated to latest!')
            return

        nxdate = self._max_date()
        nxdate = '2023-04-17'
        self.walkOnHistory(nxdate)
    
    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, 'dtpercent', 'ztdate', 'ztpercent'])

    def getDumpCondition(self, date):
        if date is None:
            date = TradingDate.maxTradingDate()
        return self._select_condition(f'ztdate = "{date}"')

    def simulate(self):
        # 用历史数据回测，生成买卖记录保存
        simstart = datetime.now()
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'isdt = 1 and iszt = 1')
        self.sim_orstks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_orstks = self.sim_orstks[0:500]
        self.sim_deals = []
        self.sim_cutrate = 0.055
        sim_ths = []
        for i in range(0, self.threads_num):
            t = Thread(target=self.thread_simulate)
            sim_ths.append(t)
            t.start()

        for t in sim_ths:
            t.join()

        # print(self.sim_deals)
        print(self.sim_cutrate)
        print(len(self.sim_orstks))
        print('time used: ', datetime.now() - simstart)

    def thread_simulate(self):
        orstks = []
        while len(self.sim_orstks) > 0:
            while len(orstks) == 0 or self.sim_orstks[0][0] == orstks[0][0]:
                orstks.append(self.sim_orstks.pop())
                if len(self.sim_orstks) == 0:
                    break

            kd = None
            for code, dt, zt in orstks:
                if kd is None:
                    sd = StockDumps()
                    kd = sd.read_kd_data(code, start=dt)
                    if kd is None or len(kd) < 4:
                        break
                ki = 0
                while kd[ki][1] != dt:
                    ki += 1
                if ki > 0:
                    kd = kd[ki:]
                    if kd is None or len(kd) < 4:
                        continue

                kldt =  KNode(kd[0])
                assert kldt.date == dt, 'wrong kl data!'

                klzt = KNode(kd[1])
                i = 2
                kl1 = KNode(kd[i])
                op0 = kl1.open
                hi0 = kl1.high
                lo0 = kl1.low
                cl0 = kl1.close
                if hi0 == lo0 and cl0 >= Utils.zt_priceby(klzt.close):
                    # 一字涨停 无法买进
                    print('一字涨停 无法买进', code, kl1.date)
                    continue
                if op0 < klzt.close * 0.99:
                    print('低开', round((op0 - klzt.close) / klzt.close, 3), code, klzt.date)
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
                    if op3 < cutl:
                        if op3 > Utils.dt_priceby(clp3):
                            sell = op3
                            sdate = klj.date
                            break
                    if lo3 < cutl:
                        sell = cutl
                        sdate = klj.date
                        break
                    if hi3 >= earnl:
                        if hi3 == cl3 and cl3 >= Utils.zt_priceby(clp3):
                            # 涨停
                            cutl = cl3 * 0.97
                            earnl = hi3
                            j += 1
                            break
                        sell = hi3 * 0.99
                        sdate = klj.date
                        break
                    j += 1

                if sdate != bdate:
                    count = round(100/buy) * 100
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': buy, 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': sell, 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0

            orstks = []

    def filterDzt(self, cutrate = 0.055):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}, ztdate', f'isdt = 1 and iszt = 1')
        orstks = sorted(orstks, key=lambda s: (s[0], s[1]))
        deals = []
        earn = 0
        suc = 0
        fail = 0
        sd = StockDumps()
        kd = None
        precode = None
        for code, dt, zt in orstks:
            if kd is None or precode != code:
                kd = sd.read_kd_data(code, start=dt)
                precode = code
                if kd is None or len(kd) < 4:
                    continue

            ki = 0
            while kd[ki][1] != dt:
                ki += 1
            if ki > 0:
                kd = kd[ki:]
                if kd is None or len(kd) < 4:
                    continue

            kl0 = KNode(kd[0])
            if kl0.date != dt:
                raise Exception('wrong kl data')

            klzt = KNode(kd[1])
            i = 2
            kl1 = KNode(kd[i])
            op0 = kl1.open
            hi0 = kl1.high
            lo0 = kl1.low
            cl0 = kl1.close
            if hi0 == lo0 and cl0 >= Utils.zt_priceby(klzt.close):
                # 一字涨停 无法买进
                print('一字涨停 无法买进', code, kl1.date)
                continue
            if op0 < klzt.close * 0.99:
                print('低开', round((op0 - klzt.close) / klzt.close, 3), code, klzt.date)
                continue
            
            buy = op0
            bdate = kl1.date
            sell = 0
            sdate = kl1.date
            j = i + 1
            cutl = buy * (1 - cutrate)
            earnl = buy * 1.05
            while j < len(kd):
                clp3 = KNode(kd[j-1]).close
                klj = KNode(kd[j])
                cl3 = klj.close
                h3 = klj.high
                l3 = klj.low
                o3 = klj.open
                if o3 == h3 and h3 <= Utils.dt_priceby(clp3):
                    # 一字跌停，无法卖出
                    j += 1
                    continue
                if o3 < cutl:
                    if o3 > clp3 * 0.89:
                        sell = o3
                        sdate = klj.date
                    break
                if l3 <= cutl:
                    sell = cutl
                    sdate = klj.date
                    break
                if h3 >= earnl:
                    if h3 == cl3 and cl3 - clp3 >= clp3 * 1.09:
                        # 涨停
                        cutl = cl3 * 0.97
                        earnl = h3
                        j += 1
                        continue
                    sell = h3 * 0.99
                    sdate = klj.date
                    break
                j += 1
            e = (sell - buy) / buy
            if sdate != bdate and e > -0.12:
                if e > 0:
                    suc += 1
                elif e < 0:
                    fail += 1
                earn += e
                deals.append({
                    'buy': {'code': code, 'time': bdate, 'tradeType': 'B', 'price': buy, 'sid': 0, 'count': 0},
                    'sell': {'code': code, 'time': sdate, 'tradeType': 'S', 'price': round(sell, 2), 'sid': 0, 'count': 0},
                    'earn': e,
                    'hdays': j - i
                })

        # # 2015-07-10 当日涨停太多，剔除
        # if date == '2015-07-10'
        #     continue
        dlearn = {
            'cutrate':cutrate,
            'earn': earn,
            'count': len(deals),
            'success': suc,
            'fail': fail,
            'sucrate': str(round(100 * suc / len(deals), 2)) + '%',
            'deals': deals
        }
        print('cut rate =', cutrate, 'count =', len(deals), 'suc rate =', str(round(100 * suc / len(deals), 2)) + '%', 'earn = ', round(earn, 4))
        with open(self.dpath + str(cutrate) + '.json', 'w') as df:
            json.dump(dlearn, df, indent=4)
