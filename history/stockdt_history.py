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

    def getDumpKeys(self):
        return f'{column_code}, 连板数, 板块'

    def getDumpCondition(self, date):
        return [f'{column_date}="{date}"']


class StockDtMap():
    '''跌停进度表
    '''
    def __init__(self) -> None:
        self.initConstrants()
        self.checkInfoTable(history_db_name, self.tablename)

    def initConstrants(self):
        self.tablename = 'day_dt_maps'
        self.colheaders = [column_date, '跌停进度数据', '详情']

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)

    def checkInfoTable(self, dbname, tablename):
        self.sqldb = SqlHelper(password = db_pwd, database = dbname)
        if not self.sqldb.isExistTable(tablename):
            attrs = {
                column_date:'varchar(20) DEFAULT NULL',
                '跌停进度数据':"varchar(8192) DEFAULT NULL",
                '详情':"varchar(4096) DEFAULT NULL"
            }
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(tablename, attrs, constraint)

        self.check_table_column(self.colheaders[2], 'varchar(4096) DEFAULT NULL')

    def _max_date(self):
        if self.sqldb.isExistTable(self.tablename):
            maxDate = self.sqldb.select(self.tablename, f"max({column_date})")
            if maxDate is None or not len(maxDate) == 1 or maxDate[0][0] is None:
                return None
            else:
                (mdate,), = maxDate
                return mdate

    def addDtMap(self, date, mp, details):
        dtmp = self.sqldb.select(self.tablename, '*', f'{column_date}="{date}"')
        if dtmp is None or len(dtmp) == 0:
            self.sqldb.insert(self.tablename, {self.colheaders[0]: date, self.colheaders[1]:mp, self.colheaders[2]:details})
        else:
            self.sqldb.update(self.tablename, {self.colheaders[1]:mp, self.colheaders[2]:details}, {self.colheaders[0]: date})

    def getDumpKeys(self):
        return f'{self.colheaders[1]}, {self.colheaders[2]}'

    def getDumpCondition(self, date):
        return [f'{column_date}="{date}"']

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        if date is None:
            return None

        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            mp = self.sqldb.select(self.tablename, self.getDumpKeys(), self.getDumpCondition(date))
            if mp is not None and len(mp) == 1:
                data = {'date': date}
                data['map'] = mp[0][0]
                data['details'] = mp[0][1]
                return data
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        return self.dumpDataByDate()
