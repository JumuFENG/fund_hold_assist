# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *

class StockDt3Selector(TableBase):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        self.dbname = stock_db_name
        self.tablename = 'stock_dt3_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'建仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'清仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'实盘',   'type':'tinyint DEFAULT 0'},
            {'col':'交易记录','type':'varchar(255) DEFAULT NULL'}
        ]

    def get_inprogress_stocks(self, date):
        stks = self.sqldb.select(self.tablename, f'{column_code}', '清仓日期 is NULL' if date is None else f'清仓日期 > "{date}" or 清仓日期 is NULL')
        if stks is None or len(stks) == 0:
            return set()
        return set([c for c, in stks])

    def _check_dt_more_buy(self, code, date):
        sdm = StockDtMap()
        dtmap = sdm.dumpDataByDate(date)
        if dtmap['date'] != date:
            return None
        mp = json.loads(dtmap['map'])
        dtl = json.loads(dtmap['details'])
        if code not in dtl:
            return None

        ct = None
        for dtli in dtl[code]:
            if dtli['date'] == date:
                ct = dtli['ct']
        if ct is None:
            return None

        ct = str(ct)
        if ct in mp and 'suc' in mp[ct] and code in mp[ct]['suc']:
            return {'date':date, 'type':'B'}
        return None

    def _check_dt_sell(self, klines, endi, recs):
        p = float(recs[0]['price'])
        for i in range(1, len(recs)):
            p += float(recs[i]['price'])
        p /= len(recs)
        o = float(klines[endi][5])
        c = float(klines[endi][2])
        h = float(klines[endi][3])
        if o > p:
            return {'date':klines[endi][1], 'price':o, 'type':'S'}
        if h > p:
            return {'date':klines[endi][1], 'price':h, 'type':'S'}
        if endi >= 5:
            return {'date':klines[endi][1], 'price':c, 'type':'S'}
        return None

    def check_incomplete_records(self):
        incomplete = self.sqldb.select(self.tablename, f'id,{column_code},建仓日期,交易记录', ['建仓日期 is not NULL', '建仓日期 != "0"', '清仓日期 is NULL'])
        sd = StockDumps()
        for id, code, sdate, srec in incomplete:
            ksdate = (datetime.strptime(sdate, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
            kd = sd.read_kd_data(code, start=ksdate)
            recs = json.loads(srec)
            for i in range(0, len(kd)):
                tdate = kd[i][1]
                if tdate <= recs[-1]['date']:
                    continue
                exbuy = self._check_dt_more_buy(code, tdate)
                if exbuy is not None:
                    exbuy['price'] = kd[i][4]
                    if exbuy is not None:
                        recs.append(exbuy)
                        print('check_incomplete_records buy more', code, tdate)
                        continue
                exsell = self._check_dt_sell(kd, i, recs)
                if exsell is not None:
                    edate = exsell['date']
                    recs.append(exsell)
                    self.sqldb.update(self.tablename, {'清仓日期':edate, '交易记录':json.dumps(recs)}, {'id':id})
                    break
            if recs[-1]['type'] == 'B':
                self.sqldb.update(self.tablename, {'交易记录':json.dumps(recs)}, {'id':id})

    def _check_dt3_buy(self, dtmap, code):
        date = dtmap['date']
        mp = json.loads(dtmap['map'])
        dtl = json.loads(dtmap['details'])
        if '4' in mp and 'suc' in mp['4']:
            dt4 = mp['4']['suc']
            dtdate = date
            for c in dt4:
                if c != code or dtl is None or c not in dtl:
                    continue
                for dtli in dtl[c]:
                    if int(dtli['ct']) == 4:
                        dtdate = dtli['date']
            sd = StockDumps()
            klines = sd.read_kd_data(code, start=dtdate)
            price = klines[0][4]
            return {'date': dtdate, 'type':'B', 'price':price}
        return None

    def check_noncreated_records(self):
        non_created = self.sqldb.select(self.tablename, f'id,{column_code},{column_date}', '建仓日期 is NULL')
        sdm = StockDtMap()
        for id, code, date in non_created:
            ksdate = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
            dtmap = sdm.dumpDataByDate(ksdate)
            if dtmap is None or dtmap['date'] < ksdate:
                continue
            buyrec = self._check_dt3_buy(dtmap, code)
            if buyrec is None or len(buyrec) == 0:
                print('check_noncreated_records no buy rec', code, date)
                self.sqldb.update(self.tablename, {'建仓日期':'0', '清仓日期':'0'}, {'id':id})
                continue
            else:
                sdate = buyrec['date']
                recs = [buyrec]
                self.sqldb.update(self.tablename, {'建仓日期':sdate, '交易记录':json.dumps(recs)}, {'id':id})

    def add_latest_dt3_stocks(self, date):
        sdm = StockDtMap()
        dtmap = sdm.dumpDataByDate(date)
        if dtmap is None or dtmap['date'] < date:
            return
        values = []
        date = dtmap['date']
        mp = json.loads(dtmap['map'])
        dtl = json.loads(dtmap['details'])
        if '3' in mp and 'suc' in mp['3']:
            dt3 = mp['3']['suc']
            stks = self.get_inprogress_stocks(date)
            for c in dt3:
                if c in stks:
                    continue
                dtdate = date
                if dtl is not None and c in dtl:
                    for dtli in dtl[c]:
                        if int(dtli['ct']) == 3:
                            dtdate = dtli['date']
                values.append([c, dtdate])
            if len(values) > 0:
                self.sqldb.insertMany(self.tablename, [column_code, column_date], values)

    def updateDt3(self):
        date = self._max_date()
        while date < datetime.now().strftime(r"%Y-%m-%d"):
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
            self.check_incomplete_records()
            self.check_noncreated_records()
            self.add_latest_dt3_stocks(date)

    def getDumpKeys(self):
        return self._select_keys([column_code, column_date, '交易记录','实盘'])

    def getDumpCondition(self, date):
        return self._select_condition('清仓日期 is NULL' if date is None else f'清仓日期 > "{date}" or 清仓日期 is NULL')
