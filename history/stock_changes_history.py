import json
import gzip
from utils import *
from history import StockGlobal


class StockChangesHistory(EmRequest, TableBase):
    '''盘口异动
    '''
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()
        self.page = 0
        self.pageSize = 1000
        self.fecthed = []
        self.date = None
        self.exist_changes = set()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'stock_changes_history'
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_type, 'type': 'int DEFAULT NULL'},
            {'col': 'info', 'type': 'varchar(64) DEFAULT NULL'}
        ]

    def getUrl(self):
        t = 'type=8201,8202,8193,4,32,64,8207,8209,8211,8213,8215,8204,8203,8194,8,16,128,8208,8210,8212,8214,8216,8217,8218,8219,8220,8221,8222'
        return f'http://push2ex.eastmoney.com/getAllStockChanges?type={t}&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex={self.page}&pagesize={self.pageSize}&dpt=wzchanges'

    def getNext(self):
        params = {
            'Host': 'push2ex.eastmoney.com',
            'Referer': 'http://quote.eastmoney.com/changes/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }

        chgs = json.loads(self.getRequest(params))
        if 'data' not in chgs or chgs['data'] is None:
            if len(self.fecthed) > 0:
                self.saveFetched()
            return

        if 'allstock' in chgs['data']:
            self.mergeFetched(chgs['data']['allstock'])

        if len(self.fecthed) == chgs['data']['tc']:
            self.saveFetched()
        else:
            self.page += 1
            self.getNext()

    def mergeFetched(self, changes):
        if self.date is None:
            self.date = TradingDate.maxTradingDate()

        for chg in changes:
            code = chg['c']
            code = StockGlobal.full_stockcode(code)
            tm = str(chg['tm']).rjust(6, '0')
            ftm = f'{self.date} {tm[0:2]}:{tm[2:4]}:{tm[4:6]}'
            tp = chg['t']
            info = chg['i']
            if (code, ftm, tp) not in self.exist_changes:
                self.fecthed.append([code, ftm, tp, info])
                self.exist_changes.add((code, ftm, tp))

    def saveFetched(self):
        if len(self.fecthed) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.fecthed)

    def updateDaily(self):
        date = self._max_date()
        self.date = TradingDate.maxTradingDate()
        if date.startswith(self.date):
            Utils.log(f'{self.__class__.__name__} already updated to {self.date}')
            return

        self.getNext()
