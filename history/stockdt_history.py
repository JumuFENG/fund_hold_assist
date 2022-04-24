# Python 3
# -*- coding:utf-8 -*-
from history.stockzt_history import *

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
            if self.date < self.getTodayString('%Y%m%d'):
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
