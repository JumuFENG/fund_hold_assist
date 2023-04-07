# Python 3
# -*- coding:utf-8 -*-
from history.stockzt_history import *
from history.stock_dumps import *

class StockDtInfo(StockZtInfo):
    '''跌停
    ref: http://quote.eastmoney.com/ztb/detail#type=ztgc
    '''
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_dt_stocks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'封单资金','type':'varchar(20) DEFAULT NULL'},
            {'col':'板上成交额','type':'varchar(20) DEFAULT NULL'},
            {'col':'换手率','type':'varchar(20) DEFAULT NULL'},
            {'col':'连板数','type':'varchar(20) DEFAULT NULL'},
            {'col':'开板数','type':'varchar(20) DEFAULT NULL'},
            {'col':'板块','type':'varchar(63) DEFAULT NULL'},
        ]

        self.urlroot = f'http://push2ex.eastmoney.com/getTopicDTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&sort=fund%3Aasc&date='

    def getNext(self):
        emback = json.loads(self.getRequest())
        if emback is None or emback['data'] is None:
            print('StockDtInfo invalid response!', emback)
            if self.date < Utils.today_date('%Y%m%d'):
                self.date = (datetime.strptime(self.date, '%Y%m%d') + timedelta(days=1)).strftime("%Y%m%d")
                return self.getNext()
            return

        self.dtdata = []
        date = datetime.strptime(self.date, "%Y%m%d").strftime('%Y-%m-%d')
        for dtobj in emback['data']['pool']:
            code = ('SZ' if dtobj['m'] == '0' or dtobj['m'] == 0 else 'SH') + dtobj['c'] # code
            hsl = dtobj['hs'] # 换手率 %
            fund = dtobj['fund'] # 封单金额
            fba = dtobj['fba'] # 板上成交额
            lbc = dtobj['days'] # 连板次数
            zbc = dtobj['oc'] # 开板次数
            hybk = dtobj['hybk'] # 行业板块
            self.dtdata.append([code, date, fund, fba, hsl, lbc, zbc, hybk])
        if len(self.dtdata) > 0:
            self.saveFetched()

    def saveFetched(self):
        if self.dtdata is None or len(self.dtdata) == 0:
            return
    
        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.dtdata)

    def getDumpKeys(self):
        return self._select_keys([f'{column_code}, 连板数, 板块']) 

    def getDumpCondition(self, date):
        return self._select_condition(f'{column_date}="{date}"')


class StockDtMap(TableBase):
    '''跌停进度表
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_dt_maps'
        self.colheaders = [
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'跌停进度数据','type':'TEXT(8192) DEFAULT NULL'},
            {'col':'详情','type':'TEXT(8192) DEFAULT NULL'}
        ]

    def updateDtMap(self):
        mxdate = TradingDate.maxTradingDate()
        mpdate = self._max_date()
        if mpdate == mxdate:
            print('StockDtMap.updateDtMap already updated!')
            return

        premap = self.dumpDataByDate(mpdate)
        if premap['date'] != mpdate:
            print('data invalid', premap)
            return

        mpdtl = json.loads(premap['details'])
        premap = json.loads(premap['map'])
        nxdate = TradingDate.nextTradingDate(mpdate)
        sdt = StockDtInfo()
        nxdt = sdt.dumpDataByDate(nxdate)
        if nxdt is None or nxdate != nxdt['date']:
            print(f'dt data for {nxdate} not invalid', nxdt)
            return

        nmap = {}
        npdtl = {}
        dt1 = [c for c,*_ in nxdt['pool']] if nxdt is not None and 'pool' in nxdt else []
        for c in dt1:
            if c in mpdtl:
                ct = mpdtl[c][-1]['ct']
                cd = mpdtl[c][-1]['date']
                if cd == mpdate:
                    self.__map_add_to_suc(nmap, ct + 1, c)
                    npdtl[c] = [o for o in mpdtl[c]]
                    npdtl[c].append({'ct': ct + 1, 'date': nxdate})
                    premap[f'{ct}']['suc'].remove(c)
                else:
                    self.__map_add_to_suc(nmap, ct, c)
                    premap[f'{int(ct) + 1}']['fai'].remove(c)
                    npdtl[c] = [o for o in mpdtl[c]]
                    npdtl[c][-1]['date'] = nxdate
            else:
                self.__map_add_to_suc(nmap, 1, c)
                npdtl[c] = [{'ct': 1, 'date': nxdate}]

        sd = StockDumps()
        for i in premap:
            suc = premap[i]['suc'] if 'suc' in premap[i] else []
            fai = premap[i]['fai'] if 'fai' in premap[i] else []
            
            for s in suc:
                kd = sd.read_kd_data(s, start=mpdtl[s][-1]['date'])
                self.__merge_map(kd, s, mpdtl[s], nxdate, f'{int(i) + 1}', f'{int(i) + 1}', nmap, npdtl)

            for s in fai:
                kd = sd.read_kd_data(s, start=mpdtl[s][-1]['date'])
                self.__merge_map(kd, s, mpdtl[s], nxdate, f'{int(i) + 1}', i, nmap, npdtl)

        self.addDtMap(nxdate, json.dumps(nmap), json.dumps(npdtl))

    def __merge_map(self, kd, s, mpdtls, nxdate, sct, fct, nmap, npdtl):
        lkl = [KNode(k1) for k1 in kd if k1[1] == nxdate]
        if len(lkl) != 1:
            self.__map_add_to_fail(nmap, fct, s)
            npdtl[s] = [md for md in mpdtls]
            return

        lkl = lkl[0]
        if lkl.date != nxdate:
            self.__map_add_to_fail(nmap, fct, s)
            npdtl[s] = [md for md in mpdtls]
            return

        dkl = KNode(kd[0])
        if lkl.low - dkl.close * 0.9 <= 0:
            self.__map_add_to_suc(nmap, sct, s)
            npdtl[s] = [md for md in mpdtls]
            npdtl[s].append({'ct': sct, 'date': nxdate})
        else:
            if lkl.close - dkl.close * 1.08 <= 0 and len(kd) <= 4:
                self.__map_add_to_fail(nmap, fct, s)
                npdtl[s] = [md for md in mpdtls]

    def __map_add_to_fail(self, dmap, ct, code):
        if not isinstance(ct, str):
            ct = f'{ct}'
        if ct not in dmap:
            dmap[ct] = {'fai': []}
        if 'fai' not in dmap[ct]:
            dmap[ct]['fai'] = []
        dmap[ct]['fai'].append(code)

    def __map_add_to_suc(self, dmap, ct, code):
        if not isinstance(ct, str):
            ct = f'{ct}'
        if ct not in dmap:
            dmap[ct] = {'suc': []}
        if 'suc' not in dmap[ct]:
            dmap[ct]['suc'] = []
        dmap[ct]['suc'].append(code)

    def addDtMap(self, date, mp, details):
        dtmp = self.sqldb.select(self.tablename, '*', f'{column_date}="{date}"')
        if dtmp is None or len(dtmp) == 0:
            self.sqldb.insert(self.tablename, {self.colheaders[0]['col']: date, self.colheaders[1]['col']: mp, self.colheaders[2]['col']:details})
        else:
            self.sqldb.update(self.tablename, {self.colheaders[1]['col']: mp, self.colheaders[2]['col']: details}, {self.colheaders[0]['col']: date})

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        if date is None:
            return None

        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            mp = self._dump_data(self._select_keys([self.colheaders[1]['col'], self.colheaders[2]['col']]), self._select_condition(f'{column_date}="{date}"'))
            if mp is not None and len(mp) == 1:
                data = {'date': date}
                data['map'] = mp[0][0]
                data['details'] = mp[0][1]
                return data
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        return self.dumpDataByDate()
