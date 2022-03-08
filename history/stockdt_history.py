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
        self.tablename = 'day_dt_stocks'
        self.colheaders = [column_code, column_date, '封单资金', '板上成交额', '换手率', '连板数', '开板数', '板块']
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
            code = ('SZ' if dtobj['m'] == '0' else 'SH') + dtobj['c'] # code
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
    
        self.check_table_column(self.colheaders[2], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[3], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[4], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[5], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[6], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[7], 'varchar(63) DEFAULT NULL')

        self.sqldb.insertMany(self.tablename, self.colheaders, self.dtdata)
