# Python 3
# -*- coding:utf-8 -*-

import time
from utils import *
from history import *
from history.stock_history import *
from history.stock_dumps import *
from pickup.stock_base_selector import *


class StockZtDailyMain(StockBaseSelector):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 10
        self.wkstocks = None

    def initConstrants(self):
        super().initConstrants()
        self.dbname = history_db_name
        self.tablename = 'day_zt_stocks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'涨停封单','type':'varchar(20) DEFAULT NULL'},
            {'col':'换手率','type':'varchar(20) DEFAULT NULL'},
            {'col':'连板数','type':'tinyint DEFAULT NULL'},
            {'col':'总天数','type':'tinyint DEFAULT NULL'},
            {'col':'炸板数','type':'tinyint DEFAULT NULL'},
            {'col':'板块','type':'varchar(63) DEFAULT NULL'},
            {'col':'概念','type':'varchar(255) DEFAULT NULL'}
        ]
        self.dailyztinfo = {}

    def code_matches(self, code):
        return code.startswith('SH60') or code.startswith('SZ00')

    def walk_prepare(self, date=None):
        self.wkselected = []
        if self.wkstocks is None:
            stks = StockGlobal.all_stocks()
            if date is None:
                self.wkstocks = [
                    [s[1], (s[7] if s[7] > '1996-12-16' else '1996-12-16')]
                    for s in stks if (s[4] == 'ABStock' or s[4] == 'TSStock') and self.code_matches(s[1])]
                self.tsdate = {s[1]: s[8] for s in stks if s[4] == 'TSStock'}
            else:
                self.wkstocks = [[s[1], date] for s in stks if s[4] == 'ABStock' and self.code_matches(s[1])]

        for i in range(0, len(self.wkstocks)):
            sdate = self.sqldb.selectOneValue(self.tablename, 'max(date)', [f'{column_code}="{self.wkstocks[i][0]}"', f'连板数=1'])
            if sdate is None or sdate == 0:
                sdate = '0'
            else:
                sdate = TradingDate.prevTradingDate(sdate)
            self.wkstocks[i].append(sdate)

    def walk_on_history_thread(self):
        while len(self.wkstocks) > 0:
            cdlb = self.wkstocks.pop(0)
            c = cdlb[0]
            sdate = cdlb[-1]
            if not self.code_matches(c):
                continue

            allkl = self.get_kd_data(c, start=sdate)
            if allkl is None or len(allkl) == 0:
                continue

            i = 0
            while i < len(allkl):
                if allkl[i].date < cdlb[1]:
                    i += 1
                    continue
                if len(cdlb) > 3 and cdlb[1] != allkl[i].date:
                    i += 1
                    continue
                if i == 0 and allkl[i].close == allkl[i].high and allkl[i].pchange >= self.zdf - 0.1:
                    if len(cdlb) == 3:
                        self.wkselected.append([c, allkl[i].date, 0, 0, 1, 1, 0, "", ""])
                    else:
                        self.wkselected.append([c, allkl[i].date, cdlb[2], cdlb[3], 1, 1, cdlb[5], cdlb[6], cdlb[7]])
                    i += 1
                    continue

                c0 = allkl[i-1].close
                if allkl[i].close == allkl[i].high and allkl[i].close >= Utils.zt_priceby(c0, zdf=self.zdf):
                    days = 1
                    lbc = 1
                    t = i
                    j = i - 1
                    while j >= 0:
                        if j == 0:
                            if allkl[j].pchange >= self.zdf - 0.1:
                                lbc += 1
                                days += t
                            break
                        c0 = allkl[j-1].close
                        if allkl[j].close == allkl[j].high and allkl[j].close >= Utils.zt_priceby(c0, zdf=self.zdf):
                            lbc += 1
                            days += t - j
                            t = j
                            j -= 1
                            continue
                        if t - j >= 3:
                            break
                        j -= 1
                    if lbc == 1:
                        days = 1
                    if len(cdlb) == 3:
                        self.wkselected.append([c, allkl[i].date, 0, 0, lbc, days, 0, "", ""])
                    else:
                        self.wkselected.append([c, allkl[i].date, cdlb[2], cdlb[3], lbc, days, cdlb[5], cdlb[6], cdlb[7]])
                i += 1

    def walk_post_process(self):
        if len(self.dailyztinfo.keys()) > 0:
            for i in range(0, len(self.wkselected)):
                code = self.wkselected[i][0]
                date = self.wkselected[i][1]
                if date in self.dailyztinfo and code in self.dailyztinfo[date]:
                    d, zdf, fund, hsl, lbc, zbc, hybk, cpt = self.dailyztinfo[date][code]
                    self.wkselected[i][2] = fund
                    self.wkselected[i][3] = hsl
                    self.wkselected[i][6] = zbc
                    if self.wkselected[i][7] == '':
                        if hybk == '':
                            hybk = self.get_bk(code)
                        self.wkselected[i][7] = hybk
                    self.wkselected[i][8] = cpt
        for i in range(0, len(self.wkselected)):
            if self.wkselected[i][7] == '':
                self.wkselected[i][7] = self.get_bk(self.wkselected[i][0])
        super().walk_post_process()

    def get_bk(self, code):
        bks = self.sqldb.select(self.tablename, ['板块'], [f'{column_code}="{code}"'])
        if bks is None or len(bks) == 0:
            return ''

        for i in range(len(bks) - 1, 0, -1):
            bk, = bks[i]
            if bk != '':
                return bk
        return ''

    def sortTable(self):
        self.sqldb.sortTable(self.tablename, column_date)

    def getDumpKeys(self):
        return self._select_keys([f'{column_code}, 板块, 概念'])

    def getDumpCondition(self, date):
        return self._select_condition([f'{column_date}="{date}"', '连板数="1"'])

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        if date is None:
            return None

        while date <= Utils.today_date():
            pool = self.sqldb.select(self.tablename, self.getDumpKeys(), self.getDumpCondition(date))
            if pool is not None and len(pool) > 0:
                data = {'date': date}
                data['pool'] = pool
                return data
            elif TradingDate.isTradingDate(date):
                data = {'date': date,'pool':[]}
                return data
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        return self.dumpDataByDate()

    def dump1d1ByDate(self, date=None):
        if date is None:
            date = self._max_date()

        pool = self.sqldb.select(self.tablename, self.getDumpKeys(), self.getDumpCondition(date))
        if pool is None or len(pool) == 0:
            return []
        zt1d1 = []
        sd = StockDumps()
        for code, bk, cpt in pool:
            kls = sd.read_kd_data(code, 1, 10)
            if len(kls) < 2:
                continue
            allkl = [KNode(kl) for kl in kls]
            if allkl[-1].date != date:
                continue
            if allkl[-1].high != allkl[-1].low:
                continue
            if allkl[-1].close < Utils.zt_priceby(allkl[-2].close, zdf=self.zdf):
                continue
            zt1d1.append([code, bk, cpt])
        return zt1d1

    def _unify_concepts(self, pool):
        return [[c, n, bk if con == '' else con] for c, n, bk, con in pool]

    def dumpZtDataByConcept(self, date, concept):
        if date is None:
            return []

        pool = self.sqldb.select(self.tablename, [f'{column_code}', '连板数', '板块', '概念'], f'{column_date}="{date}"')
        if concept is not None:
            ztcpt = []
            for c, n, bk, con in pool:
                cons = [bk]
                if '+' in con:
                    cons = con.split('+')
                elif con != '':
                    cons = [con]
                if concept in cons:
                    ztcpt.append([c, n, bk, con])
            return self._unify_concepts(ztcpt)
        return self._unify_concepts(pool)        

    def dumpDailyZt(self):
        tot = self.sqldb.select(self.tablename, [f'{column_date}', 'count(*)', 'max(连板数)'], order=f'group by {column_date}')
        non_st = self.sqldb.select(self.tablename, [f'{column_date}', 'count(*)', 'max(连板数)'], '概念!="ST股"', order=f'group by {column_date}')
        ret = []
        for x, y in zip(tot, non_st):
            if x[0] != y[0]:
                raise Exception('Error! dates not coinstant!')
            ret.append(x + y[1:])
        return ret


class StockZtDailyKcCy(StockZtDailyMain):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 20

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'day_zt_stocks_kccy'

    def code_matches(self, code):
        return code.startswith('SH68') or code.startswith('SZ30')

    def rmv_starts(self):
        stks = self.sqldb.select(self.tablename, conds=['板块=""', '板块=""'])
        for _id, code, date, f, h, l, d, z, bk, cpt in stks:
            allkl = self.get_kd_data(code, start='')
            if allkl[0].date == date:
                self.sqldb.delete(self.tablename, {'id': _id})


class StockZtDailyST(StockZtDailyMain):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 5

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'day_zt_stocks_st'

    def code_matches(self, code):
        if code in self.ststocks:
            return super().code_matches(code)
        return False

    def walk_prepare(self, date=None):
        stbk = StockEmBk('BK0511')
        self.ststocks = stbk.dumpDataByDate()
        return super().walk_prepare(date)

    def get_kd_data(self, code, start, fqt=0):
        super().get_kd_data(code, start, fqt)
        allkl = self.simed_kd[code]
        i = len(allkl) - 1
        while i > 0:
            if allkl[i].close > Utils.zt_priceby(allkl[i-1].close, zdf=5) + 0.01 or allkl[i].close < Utils.dt_priceby(allkl[i-1].close, zdf=5) - 0.01:
                break
            i -= 1
        return allkl[i:]


class StockZtLeadingSelector(StockBaseSelector):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 10

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt_lead_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'首日连板','type':'tinyint DEFAULT NULL'},
            {'col':'龙头天数','type':'tinyint DEFAULT NULL'},
            {'col':'edate','type':'varchar(20) DEFAULT NULL'},
        ]
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_lead'},
            {'prepare': self.sim_prepare1, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_lead_2023'},
            ]
        self.sim_ops = self._sim_ops[1:2]

    def genZtDailyObj(self):
        return StockZtDailyMain()

    def walkOnHistory(self, date=None):
        ndate = self.sqldb.selectOneValue(self.tablename, 'max(edate)')
        if ndate is None:
            ndate = '0'
        szd = self.genZtDailyObj()
        fdate = ndate if date is None else date
        mxdate = szd.sqldb.selectOneValue(szd.tablename, f'max({column_date})')
        self.wkselected = []
        laststocks = {}
        existingselects = []
        if ndate != '0':
            lleads = self.sqldb.select(self.tablename, conds=f'edate = "{ndate}"')
            for _, c, d, l, days, e in lleads:
                laststocks[c] = {'date': d, 'lbc': l, 'days': days, 'edate': e}
                existingselects.append([c, d])
        while fdate is not None and fdate <= mxdate:
            fdate = szd.sqldb.selectOneValue(szd.tablename, f'min({column_date})', f'{column_date} > "{fdate}"')
            if fdate:
                lbc = szd.sqldb.selectOneValue(szd.tablename, f'max(连板数)', f'{column_date} = "{fdate}"')
                if lbc > 2:
                    sleads = szd.sqldb.select(szd.tablename, f'{column_code}, {column_date}, 连板数, 总天数', [f'连板数={lbc}', f'{column_date} = "{fdate}"'])
                    curstocks = []
                    for c, d, l, n in sleads:
                        curstocks.append(c)
                        if c in laststocks:
                            if laststocks[c]['edate'] != d:
                                laststocks[c]['days'] += 1
                                laststocks[c]['edate'] = d
                        else:
                            laststocks[c] = {'date': d, 'lbc': l, 'days': 1, 'edate': d}
                    for k, v in laststocks.items():
                        if k not in curstocks:
                            self.wkselected.append([k, v['date'], v['lbc'], v['days'], v['edate']])
                    laststocks = {k:v for k, v in laststocks.items() if k in curstocks}
                elif len(laststocks.keys()) > 0:
                    for k, v in laststocks.items():
                        self.wkselected.append([k, v['date'], v['lbc'], v['days'], v['edate']])
                    laststocks = {}
        if len(laststocks.keys()) > 0:
            for k, v in laststocks.items():
                self.wkselected.append([k, v['date'], v['lbc'], v['days'], v['edate']])

        updates = []
        values = []
        if len(existingselects) > 0:
            for i in range(0, len(self.wkselected)):
                if [self.wkselected[i][0], self.wkselected[i][1]] in existingselects:
                    updates.append(self.wkselected[i])
                else:
                    values.append(self.wkselected[i])
        else:
            values = self.wkselected
        if len(updates) > 0:
            self.sqldb.updateMany(self.tablename, [col['col'] for col in self.colheaders], [col['col'] for col in self.colheaders[0:2]], updates)
        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def getDumpKeys(self):
        return self._select_keys([column_code, '首日连板', '龙头天数'])

    def getDumpCondition(self, date=None):
        if date is None:
            date = self.sqldb.selectOneValue(self.tablename, 'max(edate)')
        return self._select_condition(f'edate="{date}"')

    def sim_prepare(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []

    def simulate_thread(self):
        # 成为龙头次日开盘买入, 不再涨停时尾盘卖出
        while len(self.sim_stks) > 0:
            orstks = self.get_begin_stock_records(self.sim_stks)
            for i in range(0, len(orstks)):
                code, date = orstks[i]
                allkl = self.get_kd_data(code, date)
                ki = 0
                while allkl[ki].date != date:
                    ki += 1

                if len(allkl) <=  ki + 2:
                    continue

                cl0 = allkl[ki].close
                ki += 1
                while ki < len(allkl) and allkl[ki].low == allkl[ki].high and allkl[ki].high >= Utils.zt_priceby(cl0, zdf=self.zdf):
                    ki += 1
                if len(allkl) <= ki + 1:
                    continue

                buy = allkl[ki].open
                sell = 0
                bdate = allkl[ki].date
                sdate = bdate
                cl0 = allkl[ki].close
                j = ki + 1
                while j < len(allkl):
                    if allkl[j].high == allkl[j].close and allkl[j].close >= Utils.zt_priceby(cl0, zdf=self.zdf):
                        cl0 = allkl[j].close
                        j += 1
                        continue

                    if allkl[j].high == allkl[j].low and allkl[j].close <= Utils.dt_priceby(cl0, zdf=self.zdf):
                        cl0 = allkl[j].close
                        j += 1
                        continue

                    sell = allkl[j].close
                    sdate = allkl[j].date
                    break

                if sdate != bdate:
                    count = round(1000/buy)
                    self.sim_deals.append({'time': bdate, 'code': code, 'sid': 0, 'tradeType': 'B', 'price': round(buy, 2), 'count': count})
                    self.sim_deals.append({'time': sdate, 'code': code, 'sid': 0, 'tradeType': 'S', 'price': round(sell, 2), 'count': count})
                    sdate = None
                    bdate = None
                    buy = 0
                    sell = 0

    def sim_prepare1(self):
        orstks = self.sqldb.select(self.tablename, f'{column_code}, {column_date}', f'edate>"2023"')
        self.sim_stks = sorted(orstks, key=lambda s: (s[0], s[1]))
        self.sim_deals = []


class StockZtLeadingSelectorKcCy(StockZtLeadingSelector):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 20

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt_lead_kccy_pickup'
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_lead_kccy'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def genZtDailyObj(self):
        return StockZtDailyKcCy()


class StockZtLeadingSelectorST(StockZtLeadingSelector):
    def __init__(self) -> None:
        super().__init__()
        self.zdf = 5

    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_zt_lead_st_pickup'
        self._sim_ops = [
            {'prepare': self.sim_prepare, 'thread': self.simulate_thread, 'post': self.sim_post_process, 'dtable': f'track_sim_zt_lead_st'},
            ]
        self.sim_ops = self._sim_ops[0:1]

    def genZtDailyObj(self):
        return StockZtDailyST()


class StockZtDaily():
    def __init__(self) -> None:
        self.ztinfo = StockZtInfo()
        self.ztleading = StockZtInfo10jqka()
        self.dailyMain = StockZtDailyMain()
        self.dailyKccy = StockZtDailyKcCy()
        self.dailySt = StockZtDailyST()
        self.leadingMain = None
        self.leadingKccy = None
        self.leadingSt = None
        self.stkAcution = None

    def getNext(self):
        date = max(self.dailyMain._max_date(), self.dailyKccy._max_date(), self.dailySt._max_date())
        mxdate = TradingDate.maxTradingDate()
        if date == mxdate:
            print('zt info already updated!')
            return

        date = TradingDate.nextTradingDate(date)
        while date <= mxdate:
            nardate = datetime.strptime(date, '%Y-%m-%d').strftime("%Y%m%d")
            self.ztinfo.setDate(nardate)
            self.ztinfo.getNext()
            self.ztleading.setDate(nardate)
            self.ztleading.getNext()
            while self.ztinfo.fetchedDate != date or self.ztleading.fetchedDate != date:
                time.sleep(1)
            self.mergeZtInfo(date)
            if date == mxdate:
                break
            date = TradingDate.nextTradingDate(date)
        self.updateZtDaily()

    def mergeZtInfo(self, date):
        dailyztinfo = {k: v for k,v in self.ztinfo.ztdata.items()}
        for code, rc in self.ztleading.ztdata.items():
            if code in dailyztinfo:
                dailyztinfo[code][7] = rc[7]
            else:
                dailyztinfo[code] = rc
        for code, rc in self.ztleading.ztdata_kccy.items():
            if code in dailyztinfo:
                dailyztinfo[code][7] = rc[7]
            else:
                dailyztinfo[code] = rc
        for code, rc in self.ztleading.ztdata_st.items():
            if code in dailyztinfo:
                dailyztinfo[code][7] = rc[7]
            else:
                dailyztinfo[code] = rc
        self.dailyMain.dailyztinfo[date] = dailyztinfo
        self.dailyKccy.dailyztinfo[date] = dailyztinfo
        self.dailySt.dailyztinfo[date] = dailyztinfo

    def updateZtDaily(self):
        self.dailySt.walkOnHistory()
        date = TradingDate.nextTradingDate(self.dailyKccy._max_date())
        self.dailyKccy.walkOnHistory(date)
        date = TradingDate.nextTradingDate(self.dailyMain._max_date())
        self.dailyMain.walkOnHistory(date)

    def dumpDataByDate(self, date=None, days=3, mkt='A'):
        ztDaily = None
        ztLeading = None
        if mkt == 'K':
            ztDaily = self.dailyKccy
            if self.leadingKccy is None:
                self.leadingKccy = StockZtLeadingSelectorKcCy()
            ztLeading = self.leadingKccy
        elif mkt == 'S':
            ztDaily = self.dailySt
            if self.leadingSt is None:
                self.leadingSt = StockZtLeadingSelectorST()
            ztLeading = self.leadingSt
        else:
            ztDaily = self.dailyMain
            if self.leadingMain is None:
                self.leadingMain = StockZtLeadingSelector()
            ztLeading = self.leadingMain

        if date is None:
            date = ztDaily._max_date()

        zdays = [date]
        while len(zdays) < days:
            zdays.append(ztDaily.sqldb.selectOneValue(ztDaily.tablename, 'max(date)', f'date<"{zdays[-1]}"'))

        ztmaps_arr = []
        for d in zdays:
            zmap = {'date': d}
            ztrows = ztDaily.sqldb.select(ztDaily.tablename, 'code, 总天数, 连板数', f'date="{d}"')
            leads = ztLeading.sqldb.select(ztLeading.tablename, 'code', [f'date <= "{d}"', f'edate >= "{d}"'])
            leads = [z for z, in leads]
            zmap['candidates'] = []
            zmap['lead'] = []
            for c, zd, zn in ztrows:
                if c in leads:
                    zmap['lead' if len(leads) == 1 else 'candidates'].append({'code': c, 'days': zd, 'lbc': zn})
                else:
                    if str(zn) not in zmap:
                        zmap[str(zn)] = []
                    zmap[str(zn)].append({'code': c, 'days': zd, 'lbc': zn})
            ztmaps_arr.append(zmap)
        return ztmaps_arr

    def updatecpt(self):
        date = '2021-07-02'
        while True:
            nardate = datetime.strptime(date, '%Y-%m-%d').strftime("%Y%m%d")
            self.ztleading.setDate(nardate)
            self.ztleading.getNext()
            if len(self.ztleading.ztdata.keys()) == 0 and len(self.ztleading.ztdata_kccy.keys()) == 0 and len(self.ztleading.ztdata_st.keys()) == 0:
                print(date)
                break
            if len(self.ztleading.ztdata.keys()) > 0:
                for c in self.ztleading.ztdata:
                    d, zdf, fund, hsl, lbc, zbc, bk, cpt = self.ztleading.ztdata[c]
                    self.dailyMain.sqldb.update(self.dailyMain.tablename, {'概念': cpt}, [f'{column_code}="{c}"', f'{column_date}="{d}"'])
            if len(self.ztleading.ztdata_kccy.keys()) > 0:
                for c in self.ztleading.ztdata_kccy:
                    d, zdf, fund, hsl, lbc, zbc, bk, cpt = self.ztleading.ztdata_kccy[c]
                    self.dailyKccy.sqldb.update(self.dailyKccy.tablename, {'概念': cpt}, [f'{column_code}="{c}"', f'{column_date}="{d}"'])
            if len(self.ztleading.ztdata_st.keys()) > 0:
                for c in self.ztleading.ztdata_st:
                    d, zdf, fund, hsl, lbc, zbc, bk, cpt = self.ztleading.ztdata_st[c]
                    self.dailySt.sqldb.update(self.dailySt.tablename, {'概念': cpt, '涨停封单': fund, '换手率': hsl, '炸板数': zbc}, [f'{column_code}="{c}"', f'{column_date}="{d}"'])
            date = max(
                self.dailyMain.sqldb.selectOneValue(self.dailyMain.tablename, 'max(date)', f'date<"{date}"'),
                self.dailyKccy.sqldb.selectOneValue(self.dailyKccy.tablename, 'max(date)', f'date<"{date}"'),
                self.dailySt.sqldb.selectOneValue(self.dailySt.tablename, 'max(date)', f'date<"{date}"')
                )
            if date is None:
                break

    def updatebk(self):
        cbk = {}
        bkm = self.dailyMain.sqldb.select(self.dailyMain.tablename, 'code, 板块')
        for c,bk in bkm:
            if bk != '' and c not in cbk:
                cbk[c] = bk
        bkm = self.dailyKccy.sqldb.select(self.dailyKccy.tablename, 'code, 板块')
        for c,bk in bkm:
            if bk != '' and c not in cbk:
                cbk[c] = bk

        for c, bk in cbk.items():
            self.dailyMain.sqldb.update(self.dailyMain.tablename, {'板块': bk}, {'code': c, '板块': ''})
            self.dailyKccy.sqldb.update(self.dailyKccy.tablename, {'板块': bk}, {'code': c, '板块': ''})
            self.dailySt.sqldb.update(self.dailySt.tablename, {'板块': bk}, {'code': c, '板块': ''})

    def dumpZtDataByConcept(self, date, concept):
        if date is None:
            return []
        zmain = self.dailyMain.dumpZtDataByConcept(date, concept)
        zkccy = self.dailyKccy.dumpZtDataByConcept(date, concept)
        zst = self.dailySt.dumpZtDataByConcept(date, concept)
        return zmain + zkccy + zst

    def predictNextZtMap(self, date=None):
        predicts = []
        sel = set()

        if date is None:
            date = self.dailyMain._max_date()
        i = 1
        sd = StockDumps()

        while True:
            dayzt = self.dailyMain.sqldb.select(self.dailyMain.tablename, 'code, 总天数, 连板数, 板块, 概念', f'date="{date}"')
            for c, day, lbc, bk, cpt in dayzt:
                if c in sel:
                    continue
                sel.add(c)
                kd = sd.read_kd_data(c, length=30, fqt=1)
                allkl = [KNode(kl) for kl in kd]
                ztprice = Utils.zt_priceby(allkl[-1].close)
                i10 = 0 if len(allkl) < 10 else -10
                zd10 = (ztprice - allkl[i10].close) * 100 / allkl[i10].close
                i30 = 0 if len(allkl) < 30 else -30
                zd30 = (ztprice - allkl[i30].close) * 100 / allkl[i30].close
                predicts.append([c, date, day+i, lbc+1, zd10, zd30, bk, cpt])
            i += 1
            if i > 3 :
                break
            date = self.dailyMain.sqldb.selectOneValue(self.dailyMain.tablename, 'max(date)', f'date<"{date}"')

        return sorted(predicts, key=lambda x: x[3], reverse=True)

    def updateZtAuctions(self, wchexin):
        mainZts = self.dailyMain.sqldb.select(self.dailyMain.tablename, conds='date>"2023"')
        mainZts += self.dailyKccy.sqldb.select(self.dailyKccy.tablename, conds='date>"2023"')
        mainZts += self.dailySt.sqldb.select(self.dailySt.tablename, conds='date>"2023"')
        ztdict = {}
        for _,c,d,f,h,lbc,days,*x in mainZts:
            if c not in ztdict and days > 1:
                continue
            if days == 1:
                if c not in ztdict:
                    ztdict[c] = []
                ztdict[c].append([d, d])
            else:
                ztdict[c][-1][-1] = d

        i = 0
        ecount = 0
        lexep = ''
        for c in reversed(ztdict.keys()):
            zds = ztdict[c]
        # for c, zds in ztdict.items():
            j = 0
            while j < len(zds):
                i += 1
                zd = zds[j]
                Utils.log(i)
                try:
                    self.getAuctions(c, zd[0], zd[1], wchexin)
                    j += 1
                except Exception as e:
                    if lexep == e.args[0]:
                        Utils.log(f'{lexep}, {e.args[0]}, {ecount}')
                        if ecount == 2:
                            raise e
                        ecount += 1
                    else:
                        ecount = 0
                    lexep = e.args[0]
                    time.sleep(200)
                    continue

    def getAuctions(self, code, d0, d1, wchx):
        if self.stkAcution is None:
            self.stkAcution = StockAuction()
            self.stkAcution.hexin = wchx
            exauction = self.stkAcution.dumpDataByDate()
            self.exacutions = {}
            for c,d,*_ in exauction:
                if c not in self.exacutions:
                    self.exacutions[c] = set()
                self.exacutions[c].add(d)

        if code in self.exacutions and d0 in self.exacutions[code] and d1 in self.exacutions[code]:
            return

        reqauctions = self.stkAcution.request_for_auction(code, d0, d1)
        values = [[c,d,v,uv] for c,d,v,uv in reqauctions if c not in self.exacutions or d not in self.exacutions[c]]
        self.stkAcution.sqldb.insertMany(self.stkAcution.tablename, [col['col'] for col in self.stkAcution.colheaders], values)
        time.sleep(5)

    def getZt2Today(self, ztdaily, date):
        ztdict = {}
        mainZts = ztdaily.sqldb.select(ztdaily.tablename, conds=f'{column_date}="{date}"')
        for _,c,d,f,h,lbc,days,*x in mainZts:
            if c not in ztdict:
                ztdict[c] = []
            if days == 1:
                ztdict[c].append([d, d])
            else:
                d0 = ztdaily.sqldb.selectOneValue(ztdaily.tablename, f'max({column_date})', [f'{column_code}="{c}"', f'总天数=1', f'{column_date}<"{date}"'])
                if d0 is None:
                    continue
                ztdict[c].append([d0, d])
        return ztdict

    def updatelatestAuctions(self, wchexin):
        date = max(self.dailyMain._max_date(), self.dailyKccy._max_date(), self.dailySt._max_date())
        ztdict = {}
        mndict = self.getZt2Today(self.dailyMain, date)
        for k,v in mndict.items():
            ztdict[k] = v
        kydict = self.getZt2Today(self.dailyKccy, date)
        for k,v in kydict.items():
            ztdict[k] = v
        stdict = self.getZt2Today(self.dailySt, date)
        for k,v in stdict.items():
            ztdict[k] = v
        
        for c, zds in ztdict.items():
            for zd in zds:
                self.getAuctions(c, zd[0], zd[1], wchexin)
