# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *

class StockZt1Selector(TableBase):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        self.dbname = stock_db_name
        self.tablename = 'stock_zt1_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'上板强度','type':'float DEFAULT NULL'},
            {'col':'放量程度','type':'float DEFAULT NULL'}, # 成交量/10日均量
            {'col':'建仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'清仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'实盘',   'type':'tinyint DEFAULT 0'},
            {'col':'交易记录','type':'varchar(255) DEFAULT NULL'}
        ]
        self.__tsstocks = None

    def get_vol_scale(self, klines, date, n = 10):
        ''' 放量程度, {date}日成交量/10日均量
        '''
        assert(isinstance(klines, list) or isinstance(klines, tuple))
        vd = None
        idx = None
        for i in range(1, len(klines)):
            if klines[-i][1] == date:
                vd = int(klines[-i][8])
                idx = i
                break

        if idx is None:
            return 1

        vsum = 0
        nc = n
        for i in range(1, n + 1):
            if idx + i > len(klines):
                nc -= 1
                continue
            vsum += int(klines[-idx - i][8])
        return round(vd * 10 / vsum, 2)

    def get_zt_strengh(self, klines, date):
        '''涨停强度, 当日(涨停价(收盘价) - 最低价) / 昨日收盘价
        '''
        assert(isinstance(klines, list) or isinstance(klines, tuple))
        l = None
        c = None
        idx = None
        for i in range(1, len(klines)):
            if klines[-i][1] == date:
                l = float(klines[-i][4])
                c = float(klines[-i][2])
                idx = i
                break

        if idx is None:
            if l is None or c is None:
                return 0
            return round(100 * (c - l) / l, 2)

        return round(100 * (c - l) / float(klines[-idx - 1][2]), 2)

    def get_bss18(self, klpre, klnew):
        bss18 = 'u'
        if float(klnew[4]) - klnew[10] > 0 and float(klpre[4]) - klpre[10] > 0:
            if klpre[11] == 'u':
                bss18 = 'b'
            else:
                bss18 = 'b' if klpre[11] == 'w' else 'h'
        elif float(klnew[3]) - klnew[10] < 0 and float(klpre[3]) - klpre[10] < 0:
            if (klpre[11] == 'u'):
                bss18 = 's'
            else:
                bss18 = 's' if klpre[11] == 'h' else 'w'
        else:
            bss18 = klpre[11]
            if (klpre[11] == 'b'):
                bss18 = 'h'
            elif (klpre[11] == 's'):
                bss18 = 'w'
        return bss18

    def check_trade_records(self, klines, date):
        '''买卖记录,
        '''
        assert(isinstance(klines, list) or isinstance(klines, tuple))
        klines = list(klines)
        idx = None
        for i in range(0, len(klines)):
            if klines[i][1] == date:
                idx = i
                break

        if idx is None:
            return []

        idx = 0 if idx - 1 < 0 else idx - 1
        sum = 0
        klen = 0
        for i in range(idx, len(klines)):
            sum += float(klines[i][2])
            if klen < 18:
                klen += 1
            else:
                if klen >= 18:
                    sum -= float(klines[i - 18][2])
            kl = list(klines[i])
            kl.append(round(sum / klen, 3))
            if i == idx:
                kl.append('u')
            else:
                kl.append(self.get_bss18(klines[i - 1], kl))
            klines[i] = kl

        idx += 2
        if idx >= len(klines):
            return []

        records = [{'date': klines[idx][1], 'price':klines[idx][5], 'type':'B'}]
        for i in range(idx + 1, len(klines)):
            if klines[i][11] == 's':
                records.append({'date':klines[i][1], 'price':klines[i][2], 'type':'S'})
                break

        return records

    def get_inprogress_stocks(self, date=None):
        stks = self.sqldb.select(self.tablename, f'{column_code}', '清仓日期 is NULL' if date is None else f'清仓日期 > "{date}" or 清仓日期 is NULL')
        if stks is None or len(stks) == 0:
            return set()
        return set([c for c, in stks])

    def walkOnHistory(self, date):
        szi = StockZtInfo()
        sd = StockDumps()
        while True:
            ztdata = szi.dumpDataByDate(date)
            if ztdata is None:
                break
            values = []
            date = ztdata['date']
            stks = self.get_inprogress_stocks(date)
            for zt in ztdata['pool']:
                code = zt[0]
                if code in stks:
                    continue
                ksdate = (datetime.strptime(ztdata['date'], r'%Y-%m-%d') + timedelta(days=-30)).strftime(r"%Y-%m-%d")
                kd = sd.read_kd_data(code, start=ksdate)
                st = self.get_zt_strengh(kd, date)
                vs = self.get_vol_scale(kd, date)
                recs = self.check_trade_records(kd, date)
                if recs is None or len(recs) == 0:
                    values.append([code, date, st, vs, None, None, 0, None])
                else:
                    sdate = recs[0]['date']
                    edate = recs[len(recs) - 1]['date'] if len(recs) > 1 else None
                    values.append([code, date, st, vs, sdate, edate, 0, json.dumps(recs)])

            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
            if date >= datetime.now().strftime(r"%Y-%m-%d"):
                break

    def check_quit_stock(self, kd, code, date):
        if kd and kd[-1]:
            kl = kd[-1]
            if kl and kl[1]:
                ldate = kl[1]
                date = self._max_date()
                if ldate >= date:
                    return

        if self.__tsstocks is None:
            allstk = AllStocks()
            self.__tsstocks = allstk.getAllTsStocks()

        if self.__tsstocks and len(self.__tsstocks) > 0:
            stk = list(filter(lambda x: x[1] == code, self.__tsstocks))
            if (len(stk) == 0):
                return
            stk = stk[0]
            if stk and stk[8]:
                print(code, 'already quit on', stk[8])
                zt1info = self.sqldb.select(self.tablename, 'id,建仓日期', {f'{column_code}': code, f'{column_date}': date})
                if zt1info and len(zt1info) == 1:
                    (id, sdate), = zt1info
                    if sdate is None:
                        self.sqldb.update(self.tablename, {'建仓日期':'0', '清仓日期':'0'},  {'id':id})
                    else:
                        self.sqldb.update(self.tablename, {'清仓日期': stk[8]},  {'id':id})

    def check_incomplete_records(self):
        incomplete = self.sqldb.select(self.tablename, f'id,{column_code},{column_date}', ['建仓日期 is not NULL', '清仓日期 is NULL'])
        sd = StockDumps()
        for id, code, date in incomplete:
            ksdate = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=-30)).strftime(r"%Y-%m-%d")
            kd = sd.read_kd_data(code, start=ksdate)
            recs = self.check_trade_records(kd, date)
            if recs is None or len(recs) < 2:
                print('check_incomplete_records invalid recs', code, date)
                self.check_quit_stock(kd, code, date)
                continue
            else:
                sdate = recs[0]['date']
                edate = recs[len(recs) - 1]['date']
                self.sqldb.update(self.tablename, {'建仓日期':sdate, '清仓日期':edate, '交易记录':json.dumps(recs)}, {'id':id})

    def check_noncreated_records(self):
        non_created = self.sqldb.select(self.tablename, f'id,{column_code},{column_date}', '建仓日期 is NULL')
        sd = StockDumps()
        for id, code, date in non_created:
            ksdate = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=-30)).strftime(r"%Y-%m-%d")
            kd = sd.read_kd_data(code, start=ksdate)
            st = self.get_zt_strengh(kd, date)
            vs = self.get_vol_scale(kd, date)
            recs = self.check_trade_records(kd, date)
            if recs is None or len(recs) == 0:
                self.check_quit_stock(kd, code, date)
                print('check_noncreated_records invalid recs', code, date)
                continue
            else:
                sdate = recs[0]['date']
                edate = recs[len(recs) - 1]['date'] if len(recs) > 1 else None
                self.sqldb.update(self.tablename, {'上板强度':st, '放量程度':vs, '建仓日期':sdate, '清仓日期':edate, '交易记录':json.dumps(recs)}, {'id':id})

    def add_latest_zt1_stocks(self):
        date = self._max_date()
        date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
        self.walkOnHistory(date)

    def updateZt1(self):
        self.check_incomplete_records()
        self.check_noncreated_records()
        self.add_latest_zt1_stocks()

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '上板强度', '放量程度', '交易记录','实盘'])

    def getDumpCondition(self, date):
        return self._select_condition('清仓日期 is NULL' if date is None else f'清仓日期 > "{date}" or 清仓日期 is NULL')

    def dumpFinishedRecords(self):
        dmpkeys = self._select_keys([column_code, column_date, '上板强度', '放量程度', '建仓日期', '清仓日期', '交易记录'])
        conds = self._select_condition(['清仓日期 is not NULL', 'not 清仓日期 = "0"'])
        recs = self.sqldb.select(self.tablename, dmpkeys, conds)
        if recs is None or len(recs) == 0:
            return ''
        return recs
