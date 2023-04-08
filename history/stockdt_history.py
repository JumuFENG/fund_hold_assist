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
        self.dtdtl = {}

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_dt_maps'
        self.colheaders = [
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'step','type':'tinyint DEFAULT NULL'},
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':'success','type':'tinyint DEFAULT NULL'}
        ]

    def getdtl(self, code, step):
        dtl = []
        for i in range(1, step + 1):
            detail = self._dump_data(self._select_keys(column_date),
                self._select_condition([f'step={i}', f'{column_code}="{code}"', f'success=1']))
            if len(detail) > 0:
                ctdate, = detail[-1]
                if len(dtl) == 0 or ctdate > dtl[0]['date']:
                    dtl.append({'ct': i, 'date': ctdate})
        return dtl

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

        premap = premap['data']
        nxdate = TradingDate.nextTradingDate(mpdate)
        sdt = StockDtInfo()
        nxdt = sdt.dumpDataByDate(nxdate)
        if nxdt is None or nxdate != nxdt['date']:
            print(f'dt data for {nxdate} not invalid', nxdt)
            return

        nmap = []
        dt1 = [c for c,*_ in nxdt['pool']] if nxdt is not None and 'pool' in nxdt else []
        for c in dt1:
            oldmp = False
            premapbk = []
            for code, step, suc in premap:
                if code == c:
                    oldmp = True
                    nmap.append([nxdate, (step + 1 if suc==1 else step), c, 1])
                else:
                    premapbk.append([code, step, suc])
            if not oldmp:
                nmap.append([nxdate, 1, c, 1])
            premap = premapbk

        sd = StockDumps()
        for code, step, suc in premap:
            if code not in self.dtdtl:
                self.dtdtl[code] = self.getdtl(code, step)

            dtl = self.dtdtl[code]
            kd = sd.read_kd_data(code, start=dtl[-1]['date'])
            lkl = [KNode(k1) for k1 in kd if k1[1] == nxdate]
            if len(lkl) != 1:
                nmap.append([nxdate, (step + 1 if suc==1 else step), code, 0])
            else:
                lkl = lkl[0]
                if lkl.date != nxdate:
                    nmap.append([nxdate, (step + 1 if suc==1 else step), code, 0])
                else:
                    dkl = KNode(kd[0])
                    if lkl.low - dkl.close * 0.9 <= 0:
                        nmap.append([nxdate, (step + 1 if suc==1 else step), code, 1])
                    elif lkl.close - dkl.close * 1.08 <= 0 and len(kd) <= 4:
                        nmap.append([nxdate, (step + 1 if suc==1 else step), code, 0])

        values = []
        for d, step, c, suc in nmap:
            mp = self._dump_data(self._select_keys('id'), self._select_condition([f'{column_date}="{d}"', f'{column_code}="{c}"']))
            if mp is not None and len(mp) == 1:
                (mid,), = mp
                self.sqldb.update(self.tablename, {'step': step, 'success': suc}, {'id': mid})
            else:
                values.append([d, step, c, suc])

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        if date is None:
            return None

        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            mp = self._dump_data(self._select_keys([self.colheaders[1]['col'], self.colheaders[2]['col'], self.colheaders[3]['col']]), self._select_condition(f'{column_date}="{date}"'))
            if mp is not None and len(mp) > 0:
                data = {'date': date}
                dtmap = []
                for step, code, suc in mp:
                    dtmap.append([code, step, suc])
                data['data'] = dtmap
                return data
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        return self.dumpDataByDate()
