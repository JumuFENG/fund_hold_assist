import json
import gzip
from utils import *
from history import StockGlobal, StockEmBkAll, StockClsBkAll


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
        t = '8201,8202,8193,4,32,64,8207,8209,8211,8213,8215,8204,8203,8194,8,16,128,8208,8210,8212,8214,8216,8217,8218,8219,8220,8221,8222'
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

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
            date = date.split()[0]
        return [f'{column_date}>="{date}"']


class StockEmBkChgIgnore(StockEmBkAll):
    '''记录忽略异动的板块列表, 这些板块属于超大板块或者经常出现或者不适用于题材炒作
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_embks_chg_ignored'



class StockBkChangesHistory(EmRequest, TableBase):
    '''板块异动
    '''
    ydtypes = [4,8,16,32,64,128,8193,8194,8201,8202,8203,8204,8207,8208,8209,8210,8211,8212,8213,8214,8215,8216,8217,8218,8219,8220,8221,8222]
    ydpos_types = [4,32,64,8193,8201,8202,8207,8209,8211,8213,8215,8217,8219,8221]
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()
        self.fecthed = []
        self.exist_changes = set()
        self.page = 0
        self.pageSize = 1000

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'stock_changes_bks_history'
        self.allBkTable = StockEmBkAll()
        self.allBks = [bk for bk, in self.allBkTable.sqldb.select(self.allBkTable.tablename, column_code)]
        self.ignoreBkTable = StockEmBkChgIgnore()
        self.ignoredBks = [bk for i,bk,n in self.ignoreBkTable.dumpDataByDate()]
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_p_change, 'type': 'float DEFAULT NULL'}, #板块涨跌幅
            {'col': column_amount, 'type': 'float DEFAULT NULL'}, #主力净流入
            {'col': 'ydct', 'type': 'float DEFAULT NULL'}
        ]
        for t in self.ydtypes:
            self.colheaders.append({'col': f'y{t}', 'type': 'int DEFAULT 0'})
        self.colheaders.append({'col': 'ydpos', 'type': 'int DEFAULT 0'}) # 正异动
        self.colheaders.append({'col': 'ydabs', 'type': 'int DEFAULT 0'}) # 绝对正异动  正异动-负异动
        self.colheaders.append({'col': 'ztcnt', 'type': 'int DEFAULT 0'}) # 涨停数 封涨停-打开涨停
        self.colheaders.append({'col': 'dtcnt', 'type': 'int DEFAULT 0'}) # 跌停数 封跌停-打开跌停

    def getUrl(self):
        return f'http://push2ex.eastmoney.com/getAllBKChanges?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wzchanges&pageindex={self.page}&pagesize={self.pageSize}'

    def getNext(self):
        params = {
            'Host': 'push2ex.eastmoney.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }

        chgs = json.loads(self.getRequest(params))
        if 'data' not in chgs or chgs['data'] is None:
            return

        if 'allbk' in chgs['data']:
            self.mergeFetched(chgs['data']['allbk'], str(chgs['data']['dt']))

        if len(self.fecthed) == chgs['data']['tc']:
            return

        self.page += 1
        self.getNext()

    def mergeFetched(self, changes, chgtime):
        ftm = f'{chgtime[0:4]}-{chgtime[4:6]}-{chgtime[6:8]} {chgtime[8:10]}:{chgtime[10:12]}'
        for chg in changes:
            code = chg['c']
            name = chg['n']
            if code not in self.allBks:
                self.allBkTable.checkBk(code, name)
                self.allBks.append(code)
            pchange = float(chg['u'])
            amount = chg['zjl']
            ydct = chg['ct']
            if (code, ftm) not in self.exist_changes:
                ydrow = [code, ftm, pchange, amount, ydct]
                ydarr = [0] * len(self.ydtypes)
                ydpos = 0
                ztcnt = 0
                dtcnt = 0
                for yl in chg['ydl']:
                    ydarr[self.ydtypes.index(yl['t'])] = yl['ct']
                    if yl['t'] in self.ydpos_types:
                        ydpos += yl['ct']
                    if yl['t'] == 4:
                        ztcnt += yl['ct']
                    elif yl['t'] == 8:
                        dtcnt += yl['ct']
                    elif yl['t'] == 16:
                        ztcnt -= yl['ct']
                    elif yl['t'] == 32:
                        dtcnt -= yl['ct']
                ydrow += ydarr
                ydrow += [ydpos, 2*ydpos-ydct, ztcnt, dtcnt]
                self.fecthed.append(ydrow)
                self.exist_changes.add((code, ftm))

    def getLatestChanges(self):
        self.fecthed = []
        self.exist_changes = set()
        self.page = 0
        self.getNext()
        if len(self.fecthed) == 0:
            return []
        self.fecthed = [yd for yd in self.fecthed if yd[0] not in self.ignoredBks]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[3], reverse=True)
        # 净流入
        bkyd = self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[2], reverse=True)
        # 涨跌幅
        bkyd += self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[4], reverse=True)
        # 异动数量
        bkyd += self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[-4], reverse=True)
        # 正异动
        bkyd += self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[-3], reverse=True)
        # 绝对异动
        bkyd += self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[-2], reverse=True)
        # 涨停数
        for i in range(0, 10):
            if self.fecthed[i][-2] > 0:
                bkyd.append(self.fecthed[i])
            else:
                break
        bkset = set()
        self.fecthed = []
        for x in bkyd:
            if x[0] not in bkset:
                self.fecthed.append(x)
                bkset.add(x[0])
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date], self.fecthed)
        return self.fecthed

    def changesToDict(self, changes):
        if changes is None or len(changes) == 0:
            return []
        keys = [col['col'] for col in self.colheaders]
        assert len(changes[0]) == len(keys)
        return [{k:v for k,v in zip(keys, x)} for x in changes]

    def getDumpKeys(self):
        return column_code

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'{column_date}="{date}"'

    def dumpDataByDate(self, date=None):
        return [c for c, in super().dumpDataByDate(date)]


class StockClsBkChangesHistory(EmRequest, TableBase):
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()
        self.fecthed = []
        self.exist_changes = set()
        self.page = 1
        self.way = 'change'

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'stock_changes_clsbks_history'
        self.allBkTable = StockClsBkAll()
        self.allBks = [bk for bk, in self.allBkTable.sqldb.select(self.allBkTable.tablename, column_code)]
        self.ignoreBkTable = StockEmBkChgIgnore()
        self.ignoredBks = [bk for i,bk,n in self.ignoreBkTable.dumpDataByDate()]
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_p_change, 'type': 'float DEFAULT NULL'}, #板块涨跌幅
            {'col': column_amount, 'type': 'float DEFAULT NULL'}, #主力净流入
            {'col': 'ztcnt', 'type': 'int DEFAULT 0'}, # 涨停数 封涨停-打开涨停
            {'col': 'dtcnt', 'type': 'int DEFAULT 0'} # 跌停数 封跌停-打开跌停
        ]

    def getUrl(self):
        return f'https://x-quote.cls.cn/web_quote/plate/plate_list?app=CailianpressWeb&os=web&page={self.page}&rever=1&sv=7.7.5&type=concept&way={self.way}'

    def getNext(self):
        params = {
            'Host': 'x-quote.cls.cn',
            'Referer': f'https://www.cls.cn/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }

        chgs = json.loads(self.getRequest(params))
        if 'data' not in chgs or chgs['data'] is None:
            return

        if 'plate_data' in chgs['data']:
            self.mergeFetched(chgs['data']['plate_data'])

    def mergeFetched(self, changes, chgtime=None):
        if chgtime is None:
            ftm = datetime.strftime(datetime.now(), '%Y-%m-%d %H:%M')
        else:
            ftm = f'{chgtime[0:4]}-{chgtime[4:6]}-{chgtime[6:8]} {chgtime[8:10]}:{chgtime[10:12]}'
        # ftm = '2024-07-26 15:00'
        for chg in changes:
            code = chg['secu_code']
            name = chg['secu_name']
            if code not in self.allBks:
                self.allBkTable.checkBk(code, name)
                self.allBks.append(code)
            pchange = round(chg['change'] * 100, 2)
            amount = chg['main_fund_diff']/10000
            ztcnt = chg['limit_up_num']
            dtcnt = chg['limit_down_num']
            self.fecthed.append([code, ftm, pchange, amount, ztcnt, dtcnt])
            self.exist_changes.add((code, ftm))

    def getLatestChanges(self):
        ways = ['change', 'main_fund_diff', 'limit_up_num']
        self.fecthed = []
        self.exist_changes = set()
        for w in ways:
            self.way = w
            self.getNext()

        if len(self.fecthed) == 0:
            return []

        self.fecthed = [yd for yd in self.fecthed if yd[0] not in self.ignoredBks]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[3], reverse=True)
        # 净流入
        bkyd = self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[2], reverse=True)
        # 涨跌幅
        bkyd += self.fecthed[0:10]
        self.fecthed = sorted(self.fecthed, key=lambda x: x[4], reverse=True)
        # 涨停数
        i = 0
        ztnum = 0
        while i < len(self.fecthed):
            ztcnt = self.fecthed[i][4]
            if ztcnt == 0:
                break
            while i < len(self.fecthed) and self.fecthed[i][4] == ztcnt:
                bkyd.append(self.fecthed[i])
                ztnum += 1
                i += 1
            if ztnum >= 10:
                break

        bkset = set()
        self.fecthed = []
        for x in bkyd:
            if x[0] not in bkset:
                self.fecthed.append(x)
                bkset.add(x[0])
        self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_code, column_date], self.fecthed)
        return self.fecthed

    def changesToDict(self, changes):
        if changes is None or len(changes) == 0:
            return []
        keys = [col['col'] for col in self.colheaders]
        assert len(changes[0]) == len(keys)
        return [{k:v for k,v in zip(keys, x)} for x in changes]

    def getDumpKeys(self):
        return column_code

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'{column_date}="{date}"'

    def dumpDataByDate(self, date=None):
        return [c for c, in super().dumpDataByDate(date)]

class StockBkAllChangesHistory():
    __em_changes = StockBkChangesHistory()
    __cls_changes = StockClsBkChangesHistory()
    @classmethod
    def dumpDailyBkChanges(self, bks, date=None):
        if date is None:
            date = min(self.__em_changes._max_date(), self.__cls_changes._max_date())
            date = date.split()[0]
        changes = []
        cols = [column_code, column_date, column_p_change, column_amount, 'ztcnt', 'dtcnt']
        if isinstance(bks, str):
            bks = [bks]
        for bk in bks:
            if bk.startswith('BK'):
                changes += self.__em_changes.sqldb.select(self.__em_changes.tablename, cols, [f'{column_code}="{bk}"', f'{column_date} >= "{date}"'])
            elif bk.startswith('cls'):
                changes += self.__cls_changes.sqldb.select(self.__cls_changes.tablename, cols, [f'{column_code}="{bk}"', f'{column_date} >= "{date}"'])
        changes = sorted(changes, key=lambda x: x[1])
        def to_int_min(x):
            nval = x.split()[1].replace(':', '')
            if nval == '1250':
                return 1130
            if nval > '1250':
                return int(nval) + 50 if nval.endswith('50') else int(nval) + 10
            return int(nval)
        return [{
            column_code: chg[0],
            'minute': to_int_min(chg[1]),
            column_p_change: chg[2],
            column_amount: chg[3],
            'ztcnt': chg[4],
            'dtcnt': chg[5],
            } for chg in changes]
