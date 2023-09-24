# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import json
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
from threading import Lock
import hashlib


class StockGlobal():
    generals = {}
    stocks = None
    sqldb = SqlHelper(password=db_pwd, database=stock_db_name)
    sqllock = Lock()
    klupdateFailed = set()

    @classmethod
    def stock_general(self, code):
        # type: (str) -> StockGeneral
        '''code: 'SH'/'SZ'+xxxxxx
        '''
        if code not in self.generals:
            self.sqllock.acquire()
            self.generals[code] = StockGeneral(self.sqldb, code)
            self.sqllock.release()
        return self.generals[code]

    @classmethod
    def all_stocks(self):
        if self.stocks is None:
            self.sqllock.acquire()
            if self.stocks is None:
                self.stocks = self.sqldb.select(gl_all_stocks_info_table)
                self.generals = {stk[1]: StockGeneral(self.sqldb, stk) for stk in self.stocks}
            self.sqllock.release()
        return self.stocks

    @classmethod
    def getAllStocksShortInfo(self):
        stksInfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, column_name, column_type], "type != 'TSSTOCK'")
        return [{
            'c': c, 'n': n, 't': ('AB' if t == 'ABStock' else 'E' if t == 'ETF' else 'L' if t == 'LOF' else '')
        } for (c, n, t) in stksInfo]

    @classmethod
    def getAllStocksSetup(self):
        return self.sqldb.select(gl_all_stocks_info_table, [column_code, column_setup_date], f'{column_type}="ABStock" or {column_type}="TSStock"')

    @classmethod
    def removeStock(self, code):
        self.sqldb.delete(gl_all_stocks_info_table, {column_code: code})

    @classmethod
    def setQuitDate(self, code, date):
        self.sqldb.update(gl_all_stocks_info_table, {column_type: 'TSStock', 'quit_date': date}, f'{column_code}="{code}"')

    @classmethod
    def checkTsStock(self, code):
        return self.sqldb.selectOneValue(gl_all_stocks_info_table, 'quit_date', [f'{column_code}="{code}"', f'{column_type}="TSStock"'])

    @classmethod
    def getStocksZdfRank(self):
        # http://quote.eastmoney.com/center/gridlist.html#hs_a_board
        today = datetime.now().strftime("%Y-%m-%d")
        tradeday = TradingDate.maxTradingDate()
        updateKl = today == tradeday and datetime.now().hour > 15
        print(f'StockGlobal.getStocksZdfRank {updateKl}, {today}, {tradeday}')

        pn = 1
        while True:
            rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz=1000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'''
            res = Utils.get_em_equest(rankUrl, host='33.push2.eastmoney.com')
            if res is None:
                break

            r = json.loads(res)
            if r['data'] is None or len(r['data']['diff']) == 0:
                break

            for rkobj in r['data']['diff']:
                c = rkobj['f2']   # 最新价
                zd = rkobj['f3']  # 涨跌幅
                ze = rkobj['f4']  # 涨跌额
                cj = rkobj['f5']  # 成交量（手）
                ce = rkobj['f6']  # 成交额
                if c == '-' or cj == '-' or ce == '-' or zd == '-' or ze == '-':
                    continue
                cd = rkobj['f12'] # 代码
                m = rkobj['f13']  # 市场代码 0 深 1 沪
                h = rkobj['f15']  # 最高
                l = rkobj['f16']  # 最低
                o = rkobj['f17']  # 今开
                if (m != 0 and m != 1):
                    print('invalid market', m)
                    continue
                code = 'SH' + cd if m == 1 else 'SZ' + cd
                if updateKl:
                    Stock_history.updateStockKlDayData(code, KNode([0, today, c, h, l, o, ze, zd, cj, ce/10000]))
            pn += 1


class AllStocks(InfoList):
    """get all stocks' general info and save to db table allstoks"""
    def __init__(self):
        self.checkInfoTable(stock_db_name, gl_all_stocks_info_table)
        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')
        self.check_table_column('quit_date', 'varchar(10) DEFAULT NULL')
        self.historydb = None

    def loadInfo(self, code):
        code = code.upper()
        url = 'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/CompanySurveyAjax?code=' + code
        c = Utils.get_em_equest(url)
        if c is None:
            print("getRequest", url, "failed")
            return

        try:
            cs = json.loads(c)
            self.updateStockCol(code, column_name, cs['SecurityShortName'])
            self.updateStockCol(code, column_type, cs['CodeType'])
            self.updateStockCol(code, column_setup_date, cs['fxxg']['ssrq'])
            self.updateStockCol(code, column_assets_scale, cs['jbzl']['zczb'])
            self.updateStockCol(code, column_short_name, cs['jbzl']['agjc'])
        except Exception as ex:
            print('get CompanySurvey error', c)
            print(ex)

    def loadNewStock(self, sdate = None):
        # http://quote.eastmoney.com/center/gridlist.html#newshares
        newstocks = []
        today = datetime.now().strftime("%Y-%m-%d")
        if sdate is None:
            maxDate = self.sqldb.selectOneValue(gl_all_stocks_info_table, f"max({column_setup_date})")
            if maxDate is None:
                sdate = today
            else:
                sdate = maxDate

        pn = 1
        while True:
            newstocksUrl = f'''http://18.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f26&fs=m:0+f:8,m:1+f:8&fields=f12,f13,f14,f21,f26&_={Utils.time_stamp()}'''
            res = Utils.get_em_equest(newstocksUrl)
            if res is None:
                break

            r = json.loads(res)
            if r['data'] is None or len(r['data']['diff']) == 0:
                break

            ldate = None
            for nsobj in r['data']['diff']:
                c = nsobj['f12']
                m = nsobj['f13']
                n = nsobj['f14']
                s = nsobj['f21']
                d = str(nsobj['f26'])
                if (m != 0 and m != 1):
                    print('invalid market', m)
                    continue
                setdate = d[0:4] + '-' + d[4:6] + '-' + d[6:]
                if ldate is None:
                    ldate = setdate
                elif setdate < ldate:
                    ldate = setdate

                ipodays = (datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(setdate, "%Y-%m-%d")).days
                if ipodays > 10:
                    continue
                newstocks.append(('SH' + c if m == 1 else 'SZ' + c, n, s, setdate))

            if ldate < sdate:
                break

            pn += 1

        if len(newstocks) > 0:
            self.addNewStocks(newstocks)

    def addNewStocks(self, newstocks):
        headers = [column_code, column_name, column_type, column_short_name, column_assets_scale, column_setup_date]
        values = []
        for code,name,assets_scale,setup_date in newstocks:
            stockinfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, column_short_name], "%s = '%s'" % (column_code, code))
            if stockinfo is None or len(stockinfo) == 0:
                values.append([code, name, 'ABStock', name, assets_scale, setup_date])
            else:
                (c, sn), = stockinfo
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, 'ABStock')
                self.updateStockCol(code, column_setup_date, setup_date)
                self.updateStockCol(code, column_assets_scale, assets_scale)
                if sn is None or sn == 'NULL' or sn == '':
                    self.updateStockCol(code, column_short_name, name)
        if len(values) > 0:
            self.sqldb.insertMany(gl_all_stocks_info_table, headers, values)

    def updateStockCol(self, code, col, val):
        stockinfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, col], "%s = '%s'" % (column_code, code))
        if stockinfo is None or len(stockinfo) == 0:
            self.sqldb.insert(gl_all_stocks_info_table, {col: val, column_code: code})
        else:
            (c, l), = stockinfo
            if l == val:
                return
            self.sqldb.update(gl_all_stocks_info_table, {col: val}, {column_code: code})

    def request_fund_list(self, pz, ftype):
        # 定义不同类型基金对应的fs参数
        fund_fs = {'ETF': 'b:MK0021,b:MK0022,b:MK0023,b:MK0024', 'LOF': 'b:MK0404,b:MK0405,b:MK0406,b:MK0407'}

        # 检查ftype参数是否为合法值
        if ftype not in fund_fs:
            print("Invalid value for 'ftype'. Allowed values are 'ETF' and 'LOF'.")
            return []

        # 构建请求URL
        list_url = f'http://36.push2.eastmoney.com/api/qt/clist/get?pn=1&pz={pz}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs={fund_fs[ftype]}&fields=f12,f13,f14,f20'

        # 发送请求并获取响应内容
        c = Utils.get_em_equest(list_url)
        if c is None:
            print(f'get {ftype} list failed')
            return []

        # 解析响应内容
        data_list = json.loads(c)
        if data_list is None:
            print(f'load {ftype} Data wrong!')
            return []

        # 若数据量超过指定pz值，则进行重试
        if data_list['data']['total'] > pz:
            print(f'total more than {pz}, retry')
            return self.request_fund_list(data_list['data']['total'], ftype)

        return data_list['data']['diff']

    def loadAllFunds(self, ftype):
        self.check_table_column(column_type, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_short_name, 'varchar(255) DEFAULT NULL')
        self.check_table_column(column_assets_scale, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_setup_date, 'varchar(20) DEFAULT NULL')
        # self.check_table_column('所属行业', 'varchar(255) DEFAULT NULL')

        fundList = self.request_fund_list(1000, ftype)
        if fundList is None:
            return

        attrs = [column_name, column_type, column_short_name, column_setup_date, column_assets_scale, column_code]
        allFundInfo = []
        for e in fundList:
            tp = e['f13']
            code = ('SH' if e['f13'] == 1 else 'SZ') + e['f12']
            name = e['f14']
            assets_scale = e['f20']
            fundInfo = self.getFundInfo(code)
            if fundInfo is None:
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, ftype)
                self.updateStockCol(code, column_assets_scale, assets_scale)
                continue
            (short_name, setup_date, assets_scale) = fundInfo                
            allFundInfo.append([name, ftype, short_name, setup_date, assets_scale, code])
        self.sqldb.insertUpdateMany(gl_all_stocks_info_table, attrs, [column_code], allFundInfo)

    def getFundInfo(self, code):
        ucode = code.lstrip('SZ').lstrip('SH')
        url = f'http://fund.eastmoney.com/f10/{ucode}.html'

        c = Utils.get_em_request(url)
        if c is None:
            print(f"getRequest {url} failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        infoTable = soup.find('table', {'class': 'info'})
        if infoTable is None:
            return

        rows = infoTable.find_all('tr')

        # 从第1行第2个元素获取基金的简称
        short_name = rows[0].find_all('td')[1].get_text()

        # 从第3行第2个元素获取基金的成立日期
        setup_date = rows[2].find_all('td')[1].get_text().split()[0]
        setup_date = setup_date.replace('年', '-').replace('月', '-').replace('日', '')

        # 从第4行第1个元素获取基金的资产规模
        assets_scale = rows[3].find_all('td')[0].get_text().split('（', 1)[0]

        # 从第11行第2个元素获取跟踪标的
        # tracking_target = rows[10].find_all('td')[1].get_text()

        fund_info = (short_name, setup_date, assets_scale)
        return fund_info

    def loadFundInfo(self, code):
        fundInfo = self.getFundInfo(code)
        if fundInfo is None:
            return

        (short_name, setup_date, assets_scale, fbk) = fundInfo
        self.updateStockCol(code, column_setup_date, setup_date)
        self.updateStockCol(code, column_assets_scale, assets_scale)
        self.updateStockCol(code, column_short_name, short_name)
        # self.updateStockCol(code, '所属行业', fbk)


class Stock_history(HistoryFromSohu):
    """
    get stock history data
    """
    historydb = None

    def setCode(self, code):
        self.sg = StockGlobal.stock_general(code)
        super().setCode(self.sg.code)
        self.km_histable = self.sg.stockKmtable
        self.kw_histable = self.sg.stockKwtable
        self.k_histable = self.sg.stockKtable
        self.k15_histable = self.sg.stockK15table

    def getHistoryFailed(self):
        StockGlobal.klupdateFailed.add(self.code)

    @classmethod
    def updateStockKlDayData(self, code, kl):
        # type: (str, KNode) -> None
        sg = StockGlobal.stock_general(code)
        ktable = sg.stockKtable

        if self.historydb is None:
            self.historydb = SqlHelper(password=db_pwd, database=history_db_name)
        if not self.historydb.isExistTable(ktable):
            return

        mxd = self.historydb.selectOneValue(ktable, 'max(date)')
        if kl.date == mxd:
            return

        if kl.date != TradingDate.nextTradingDate(mxd):
            print(f'There is gap between {mxd} and {kl.date} for {code}')
            return

        self.historydb.insert(ktable, {
            column_date: kl.date, column_close: kl.close, column_high: kl.high, column_low: kl.low, column_open: kl.open,
            column_price_change: kl.prcchange, column_p_change: kl.pchange, column_volume: kl.vol, column_amount: kl.amount
        })

    def getSetupDate(self):
        return (datetime.strptime(self.sg.setupdate, "%Y-%m-%d")).strftime("%Y%m%d")

    def getSohuCode(self):
        return self.sg.sohucode

    def getEmSecCode(self):
        return self.sg.emseccode

    def kHistoryTableExists(self, stk):
        self.setCode(stk)
        return self.sqldb.isExistTable(self.k_histable)


class Stock_Fflow_History(TableBase, EmRequest):
    '''get fflow from em pushhis 资金流向
       ref: https://data.eastmoney.com/zjlx/600777.html
    '''
    def __init__(self) -> None:
        super().__init__(False)

    def initConstrants(self):
        self.sqldb = None
        self.dbname = history_db_name
        self.colheaders = [
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'main','type':'double DEFAULT NULL'},
            {'col':'small','type':'double DEFAULT NULL'},
            {'col':'middle','type':'double DEFAULT NULL'},
            {'col':'big','type':'double DEFAULT 0'},
            {'col':'super','type':'double DEFAULT 0'},
            {'col':'mainp','type':'float DEFAULT 0'},
            {'col':'smallp','type':'float DEFAULT 0'},
            {'col':'midllep','type':'float DEFAULT 0'},
            {'col':'bigp','type':'float DEFAULT 0'},
            {'col':'superp','type':'float DEFAULT 0'}
        ]

    def setCode(self, code):
        self.sg = StockGlobal.stock_general(code)
        self.code = self.sg.code
        self.tablename = self.sg.fflowtable

    def getUrl(self):
        emsecid = self.sg.emseccode
        return f'''https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&secid={emsecid}&_={Utils.time_stamp()}'''

    def getNext(self):
        headers = {
            'Host': 'push2.eastmoney.com',
            'Referer': 'http://quote.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        rsp = self.getRequest(params=headers)
        fflow = json.loads(rsp)
        if fflow is None or 'data' not in fflow or 'klines' not in fflow['data']:
            print(rsp)
            return

        fflow = [f.split(',') for f in fflow['data']['klines']]
        if fflow is None or len(fflow) == 0:
            return

        self._check_or_create_table()
        maxdate = self._max_date()
        values = []
        for f in fflow:
            if maxdate is None or f[0] > maxdate:
                values.append(f[0:-4])
        if len(fflow) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def getFflowFromEm(self, code):
        self.setCode(code)
        self.getNext()

    def updateFflow(self, code):
        if self.sqldb is None:
            self.getFflowFromEm(code)
            return True

        date = self._max_date()
        if date == Utils.today_date():
            print(f'fflow already updated to {date}')
            return False

        self.getFflowFromEm(code)
        return True


class StockHotRank(TableBase, EmRequest):
    ''' 获取人气榜
    http://guba.eastmoney.com/rank/
    '''
    def __init__(self) -> None:
        self.market = 0 # 1: hk 2: us
        super().__init__()
        self.headers = None
        self.decrypter = None

    def initConstrants(self):
        self.sqldb = None
        self.dbname = history_db_name
        self.tablename = f'''day_hotrank_{['cn','hk','us'][self.market]}'''
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'hrank','type':'int DEFAULT NULL'}
        ]

    def getUrl(self):
        return f'''http://gbcdn.dfcfw.com/rank/popularityList.js?type={self.market}&sort=0&page=1'''

    def getNext(self):
        if self.headers is None:
            self.headers = {
                'Host': 'gbcdn.dfcfw.com',
                'Referer': 'http://guba.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0',
                'Accept': '/',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            }
        rsp = self.getRequest(params=self.headers)
        enrk = rsp.split("'")[1]

        if self.decrypter is None:
            k = hashlib.md5('getUtilsFromFile'.encode()).hexdigest()
            iv = 'getClassFromFile'
            self.decrypter = AesCBCBase64(k, iv)
        ranks = json.loads(self.decrypter.decrypt(enrk))
        if ranks is None or len(ranks) == 0:
            print(rsp)
            return

        valranks = []
        for rk in ranks:
            code = rk['code']
            if 'history' in rk:
                for h in rk['history']:
                    if 'SRCSECURITYCODE' in h:
                        code = h['SRCSECURITYCODE']
                for h in rk['history']:
                    ex = self.sqldb.selectOneValue(self.tablename, 'id', [f'{column_code}="{code}"', f'''{column_date}="{h['CALCTIME']}"'''])
                    if ex is None:
                        valranks.append([code, h['CALCTIME'], h['RANK']])
            rklatest = [code, rk['exactTime'], rk['rankNumber']]
            if rklatest not in valranks:
                valranks.append(rklatest)

        self.update_ranks(valranks)

    def update_ranks(self, ranks):
        rkdic = {}
        values = []
        for code, dr, rr in ranks:
            allranks = self.sqldb.select(self.tablename, conds=f'{column_code}="{code}"')
            day = dr.split(' ')[0]
            for id, code, date, r in allranks:
                if date.split(' ')[0] != day:
                    continue
                if code not in rkdic:
                    rkdic[code] = {}
                day = date.split(' ')[0]
                if day not in rkdic[code]:
                    rkdic[code][day] = []
                rkdic[code][day].append([id, date, r])
            if code not in rkdic or day not in rkdic[code] or len(rkdic[code][day]) < 2:
                values.append([code, dr, rr])
                continue
            sdrk = sorted(rkdic[code][day], key=lambda x : x[1])
            drk2 = [sdrk[0], sdrk[-1]]
            for i in range(1, len(sdrk) - 1):
                self.sqldb.delete(self.tablename, {'id': sdrk[i][0]})
            uid = None
            if dr < drk2[0][1]:
                uid = 0
            elif dr > drk2[1][1]:
                uid = 1
            if uid is not None:
                self.sqldb.update(self.tablename, {column_date: dr, 'hrank': rr}, {'id': drk2[uid][0]})

        if len(values) > 0:
            attrs = [kv['col'] for kv in self.colheaders]
            self.sqldb.insertMany(self.tablename, attrs, values)

    def getDumpKeys(self):
        return [f'{column_code}, {column_date}, hrank']

    def getDumpCondition(self, date=None):
        return f'{column_date} > "{date}"'

    def dumpDataByDate(self, date=None):
        if date is None:
            date = TradingDate.maxTradingDate()
        rks = super().dumpDataByDate(date)
        return [{'code':c, 'date': d, 'rank': r} for c, d, r in rks if d.startswith(date)]


class StockEmBkAll(TableBase):
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.dbname = history_db_name
        self.tablename = 'stock_embks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_name,'type':'varchar(20) DEFAULT NULL'}
        ]

    def checkBk(self, code, name):
        bkname = self.sqldb.selectOneValue(self.tablename, column_name, f'{column_code}="{code}"')
        if bkname is None:
            self.sqldb.insert(self.tablename, {column_code: code, column_name: name})
        elif name != '' and name != bkname:
            self.sqldb.update(self.tablename, {column_name: name}, f'{column_code}="{code}"')


class StockEmBk(TableBase, EmRequest):
    def __init__(self, bk, name='') -> None:
        self.bk = bk
        self.bname = name
        super().__init__()

    def initConstrants(self):
        super().initConstrants()
        self.dbname = history_db_name
        self.tablename = 'stock_' + self.bk
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'}
        ]
        self.page = 1
        self.pageSize = 50
        self.headers = {
            'Host': 'push2.eastmoney.com',
            'Referer': 'http://quote.eastmoney.com/center/boardlist.html',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        self.bkstocks = []

    def getUrl(self):
        return f'http://push2.eastmoney.com/api/qt/clist/get?ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fields=f12,f13,f14&pn={self.page}&pz={self.pageSize}&fs=b:{self.bk}'

    def getNext(self):
        bkstks = json.loads(self.getRequest(self.headers))
        if 'data' in bkstks and 'diff' in bkstks['data']:
            for stk in bkstks['data']['diff'].values():
                code = stk['f12']
                mk = stk['f13']
                self.bkstocks.append(('SH' if mk == 1 else 'SZ') + code)
            if bkstks['data']['total'] > len(self.bkstocks):
                self.page += 1
                self.getNext()
            else:
                self.saveFetched()
        elif len(self.bkstocks) > 0:
            self.saveFetched()

    def saveFetched(self):
        seb = StockEmBkAll()
        seb.checkBk(self.bk, self.bname)
        exstocks = self.sqldb.select(self.tablename, column_code)
        exstocks = [s for s, in exstocks]
        if len(exstocks) == 0:
            self.sqldb.insertMany(self.tablename, [kv['col'] for kv in self.colheaders], [[s] for s in self.bkstocks])
            return

        ex = list(set(exstocks) - set(self.bkstocks))
        new = list(set(self.bkstocks) - set(exstocks))
        while len(ex) > 0 and len(new) > 0:
            e0 = ex.pop(0)
            n0 = new.pop(0)
            self.sqldb.update(self.tablename, {column_code: n0}, {column_code: e0})

        if len(ex) > 0:
            for e in ex:
                self.sqldb.delete(self.tablename, f'{column_code}="{e}"')
        if len(new) > 0:
            self.sqldb.insertMany(self.tablename, [kv['col'] for kv in self.colheaders], [[s] for s in new])

        self.bkstocks = []

    def getDumpKeys(self):
        return column_code

    def dumpDataByDate(self, date=None):
        pool = super().dumpDataByDate(date)
        return [s for s, in pool]
