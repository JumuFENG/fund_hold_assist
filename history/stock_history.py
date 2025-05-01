# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import json
from datetime import datetime, timedelta
from time import sleep
import concurrent, concurrent.futures
from urllib.parse import urlencode
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
    def full_stockcode(self, code):
        # type: (str) -> str
        # simple get full stock code
        if len(code) != 6:
            return code
        prefixes = {'60': 'SH', '68': 'SH', '30': 'SZ', '00': 'SZ', '83': 'BJ', '43': 'BJ', '87': 'BJ', '92': 'BJ', '90': 'HB', '20': 'SB'}
        if code[0:2] not in prefixes:
            return code
        return f'{prefixes[code[0:2]]}{code}'

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
    def all_stock_codes(self, exclude_quit=True):
        if self.stocks is None:
            self.all_stocks()
        return [x[1] for x in self.stocks if not(exclude_quit and x[4] == 'TSStock')]

    @classmethod
    def getAllStocksShortInfo(self):
        stksInfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, column_name, column_type], "type != 'TSSTOCK'")
        return [{
            'c': c, 'n': n, 't': ('AB' if t == 'ABStock' or t == 'BJStock' else 'E' if t == 'ETF' else 'L' if t == 'LOF' else '')
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
    def setQuitFund(self, code, date):
        self.sqldb.update(gl_all_stocks_info_table, {'quit_date': date}, f'{column_code}="{code}"')

    @classmethod
    def checkTsStock(self, code):
        return self.sqldb.selectOneValue(gl_all_stocks_info_table, 'quit_date', [f'{column_code}="{code}"', f'{column_type}="TSStock"'])

    @classmethod
    def getStocksZdfRank(self, minzdf=None):
        # http://quote.eastmoney.com/center/gridlist.html#hs_a_board
        pn = 1
        zdfranks = []
        pgsize = 1000
        fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
        fields = 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'
        if minzdf is not None:
            pgsize = 200
        while True:
            rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz={pgsize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs={fs}&fields={fields}'''
            res = Utils.get_em_request(rankUrl, host='33.push2.eastmoney.com')
            if res is None:
                break

            r = json.loads(res)
            if r['data'] is None or len(r['data']['diff']) == 0:
                break

            zdfranks += [rk for rk in r['data']['diff'] if rk['f3'] != '-']
            if len(zdfranks) == 0:
                break
            if minzdf is not None and zdfranks[-1]['f3'] < minzdf:
                break
            pn += 1
        return zdfranks

    @classmethod
    def updateStocksDailyData(self):
        today = datetime.now().strftime("%Y-%m-%d")
        tradeday = TradingDate.maxTradingDate()
        updateKl = today == tradeday and datetime.now().hour > 15
        print(f'StockGlobal.updateStocksDailyData {updateKl}, {today}, {tradeday}')

        zdfranks = self.getStocksZdfRank()
        for rkobj in zdfranks:
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
            lc = rkobj['f18'] # 昨收
            if (m != 0 and m != 1):
                print('invalid market', m)
                continue
            code = self.full_stockcode(cd)
            knode = KNode([0, today, c, h, l, o, ze, zd, cj, ce/10000, lc])
            if updateKl:
                Stock_history.updateStockKlDayData(code, knode)


class AllStocks(InfoList):
    """get all stocks' general info and save to db table allstoks"""
    def __init__(self):
        self.checkInfoTable(stock_db_name, gl_all_stocks_info_table)
        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')
        self.check_table_column('quit_date', 'varchar(10) DEFAULT NULL')
        self.historydb = None

    def loadInfo(self, code):
        secode = code.upper()
        if code.startswith('SB'):
            secode = 'SZ' + code[2:]
        elif code.startswith('HB'):
            secode = 'SH' + code[2:]
        url = 'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/CompanySurveyAjax?code=' + secode
        c = Utils.get_em_request(url, host='emweb.securities.eastmoney.com')
        if c is None:
            print("getRequest", url, "failed")
            return

        try:
            cs = json.loads(c)
            self.updateStockCol(code, column_name, cs['SecurityShortName'])
            self.updateStockCol(code, column_type, cs['CodeType'])
            self.updateStockCol(code, column_setup_date, cs['fxxg']['ssrq'])
            if 'jbzl' in cs and cs['jbzl'] is not None:
                self.updateStockCol(code, column_assets_scale, cs['jbzl']['zczb'])
                if code.startswith('SB') or code.startswith('HB'):
                    self.updateStockCol(code, column_short_name, cs['jbzl']['bgjc'])
                else:
                    self.updateStockCol(code, column_short_name, cs['jbzl']['agjc'])
        except Exception as ex:
            print('get CompanySurvey error', c)
            print(ex)

    def loadNewStock(self, market='AB', sdate = None):
        # http://quote.eastmoney.com/center/gridlist.html#newshares
        newstocks = []
        today = datetime.now().strftime("%Y-%m-%d")
        if sdate is None:
            maxDate = self.sqldb.selectOneValue(gl_all_stocks_info_table, f"max({column_setup_date})", f'{column_type}="BJStock"' if market=='BJ' else '')
            if maxDate is None:
                sdate = '0'
            else:
                sdate = maxDate

        pn = 1
        fs = 'm:0+f:81+s:2048' if market == 'BJ' else 'm:0+f:8,m:1+f:8'
        while True:
            newstocksUrl = f'''http://18.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f26&fs={fs}&fields=f12,f13,f14,f21,f26&_={Utils.time_stamp()}'''
            res = Utils.get_em_request(newstocksUrl, host='18.push2.eastmoney.com')
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
                code = ('BJ' if market == 'BJ' else 'SH' if m == 1 else 'SZ') + c
                newstocks.append((code, n, s, setdate))

            if ldate < sdate:
                break

            pn += 1

        if len(newstocks) > 0:
            self.addNewStocks(newstocks)

    def addNewStocks(self, newstocks):
        headers = [column_code, column_name, column_type, column_short_name, column_assets_scale, column_setup_date]
        values = []
        for code,name,assets_scale,setup_date in newstocks:
            mstype = 'BJStock' if code.startswith('BJ') else 'ABStock'
            stockinfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, column_short_name], "%s = '%s'" % (column_code, code))
            if stockinfo is None or len(stockinfo) == 0:
                values.append([code, name, mstype, name, assets_scale, setup_date])
            else:
                (c, sn), = stockinfo
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, mstype)
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
        url = f'https://fundf10.eastmoney.com/jbgk_{ucode}.html'

        c = Utils.get_em_request(url, 'fundf10.eastmoney.com')
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
            Utils.log(f'There is gap between {mxd} and {kl.date} for {code}', Utils.Warn)
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
        https://data.eastmoney.com/zjlx/detail.html
       ref: https://data.eastmoney.com/zjlx/600777.html
    '''
    def __init__(self) -> None:
        super().__init__(False)
        self.session = None

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
        self.headers = {
            'Host': 'push2his.eastmoney.com',
            'Referer': 'http://quote.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }


    def setCode(self, code):
        self.sg = StockGlobal.stock_general(code)
        self.code = self.sg.code
        self.tablename = self.sg.fflowtable

    def getUrl(self):
        emsecid = self.sg.emseccode
        return f'''https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&secid={emsecid}&_={Utils.time_stamp()}'''

    def getNext(self):
        if self.code.startswith('SB') or self.code.startswith('HB'):
            Utils.log(f'fflow skip B stock {self.code}')
            return
        headers = self.headers
        headers['Referer'] = f'https://data.eastmoney.com/zjlx/{self.code[2:]}.html'
        if self.session is None:
            self.session = requests.Session()
            self.session.timeout = 5
        self.session.headers.update(headers)
        rsp = self.session.get(self.getUrl())
        fflow = rsp.json()
        if fflow is None or 'data' not in fflow or fflow['data'] is None or 'klines' not in fflow['data']:
            Utils.log(rsp.url)
            Utils.log(fflow)
            return

        fflow = [f.split(',') for f in fflow['data']['klines']]
        if fflow is None or len(fflow) == 0:
            return

        if len(fflow) == 1 and TradingDate.prevTradingDate(fflow[0][0]) != self._max_date():
            Utils.log(f'Stock_Fflow_History got only 1 data {self.code}, and not continously, discarded!')
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
        if date == TradingDate.maxTradingDate():
            # print(f'fflow already updated to {date}')
            return False

        self.getFflowFromEm(code)
        return True

    def updateLatestFflow(self, save_to_db=True):
        """获取最新主力资金流数据"""
        DEFAULT_PAGE_SIZE = 100
        BASE_URL = 'https://push2.eastmoney.com/api/qt/clist/get'
        COMMON_PARAMS = {
            'fid': 'f62',
            'po': 1,
            'np': 1,
            'fltt': 2,
            'invt': 2,
            'ut': 'b2884a393a59ad64002292a3e90d46a5'
        }
        FIELDS = 'fields=f1,f2,f3,f12,f13,f14,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f124'
        FS = 'fs=m:0+t:6+f:!2,m:0+t:13+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2,m:0+t:7+f:!2,m:1+t:3+f:!2'
        date = TradingDate.maxTradingDate()
        headers = self.headers
        headers['Host'] = 'push2.eastmoney.com'
        headers['Referer'] = 'https://data.eastmoney.com/zjlx/detail.html'
        mainflows = []

        tosave = {}

        def build_url(pageno):
            params = {
                **COMMON_PARAMS,
                'pz': DEFAULT_PAGE_SIZE,
                'pn': pageno
            }
            return f"{BASE_URL}?{urlencode(params)}&{FS}&{FIELDS}"

        def process_response(response):
            """处理API响应数据"""
            try:
                data = json.loads(response)
                if data.get('data') and data['data'].get('diff'):
                    return data['data']['diff'], data['data'].get('total', 0)
                return [], 0
            except (json.JSONDecodeError, KeyError) as e:
                print(f"Error processing response: {e}")
                return [], 0

        def add_mainflow(fdatadiff):
            """添加有效的主力资金流数据"""
            for fobj in fdatadiff:
                if fobj.get('f62') == '-' or fobj.get('f184') == '-':
                    continue
                code = StockGlobal.full_stockcode(fobj['f12'])
                mainflows.append([code, date, fobj['f62'], fobj['f184']])
                tosave[code] = {
                    column_date: date, 'main': fobj['f62'], 'mainp': fobj['f184'],
                    'small': fobj['f84'], 'middle': fobj['f78'], 'big': fobj['f72'], 'super': fobj['f66'],
                    'smallp': fobj['f87'], 'midllep': fobj['f81'], 'bigp': fobj['f75'], 'superp': fobj['f69']}

        def save_latest_fflow():
            ucode = []
            for code, data in tosave.items():
                self.setCode(code)
                if not self._check_table_exists():
                    ucode.append(code)
                    continue
                if date == self._max_date():
                    continue
                if TradingDate.prevTradingDate(date) == self._max_date():
                    self.sqldb.insert(self.tablename, data)
                else:
                    ucode.append(code)
            return ucode

        # 获取第一页数据并确定总页数
        first_page_diff, total = process_response(Utils.get_request(build_url(1), headers))
        if not first_page_diff:
            return mainflows

        add_mainflow(first_page_diff)

        # 计算总页数 (修正点)
        total_pages = max(1, (total + DEFAULT_PAGE_SIZE - 1) // DEFAULT_PAGE_SIZE)
        if total_pages <= 1:
            if save_to_db:
                save_latest_fflow()
            return mainflows

        # 使用线程池并发获取剩余页面
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(
                    lambda p: add_mainflow(process_response(Utils.get_request(build_url(p), headers))[0]), 
                    pageno
                ): pageno
                for pageno in range(2, total_pages + 1)
            }

            for future in concurrent.futures.as_completed(futures):
                pageno = futures[future]
                try:
                    future.result()
                except Exception as e:
                    print(f"Error processing page {pageno}: {e}")

        if save_to_db:
            ucodes = save_latest_fflow()
            if len(ucodes) > 0:
                sleep(20)
                Utils.log(f'fflow update failed for {len(ucodes)} codes {ucodes}')
                for code in ucodes:
                    self.getFflowFromEm(code)
        return mainflows

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'{column_date}="{date}"'

    def dumpMainFlow(self, code, date=None, date1=None):
        self.setCode(code)
        if date is None:
            date = self._max_date()
        conds = [f'{column_date}>="{date}"']
        if date1 is not None:
            conds.append(f'{column_date}<="{date1}"')
        return self.sqldb.select(self.tablename, conds=conds)


class StockHotRank(TableBase, EmRequest):
    ''' 获取人气榜
    http://guba.eastmoney.com/rank/
    '''
    def __init__(self) -> None:
        self.market = 0 # 1: hk 2: us
        super().__init__()
        self.decrypter = None
        self.headers = None
        self.page = 1

    def initConstrants(self):
        self.sqldb = None
        self.dbname = history_db_name
        self.tablename = f'''day_hotrank_{['cn','hk','us'][self.market]}'''
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'hrank','type':'int DEFAULT NULL'},
            {'col':'newfans','type':'float DEFAULT NULL'}
        ]

    def getUrl(self):
        return f'''http://gbcdn.dfcfw.com/rank/popularityList.js?type={self.market}&sort=0&page={self.page}'''

    def getLatestRanks(self, page=1):
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
        self.page = page
        rsp = self.getRequest(params=self.headers)
        enrk = rsp.split("'")[1]

        if self.decrypter is None:
            k = hashlib.md5('getUtilsFromFile'.encode()).hexdigest()
            iv = 'getClassFromFile'
            self.decrypter = AesCBCBase64(k, iv)
        ranks = json.loads(self.decrypter.decrypt(enrk))
        if ranks is None or len(ranks) == 0:
            print(rsp)
            return []
        return ranks

    def getNext(self):
        ranks = self.getLatestRanks()
        valranks = []
        for rk in ranks:
            code = rk['code']
            rklatest = [rk['exactTime'], rk['rankNumber']]
            if 'history' in rk:
                for h in rk['history']:
                    if 'SRCSECURITYCODE' in h:
                        code = h['SRCSECURITYCODE']
                for h in rk['history']:
                    ex = self.sqldb.selectOneValue(self.tablename, 'id', [f'{column_code}="{code}"', f'''{column_date}="{h['CALCTIME']}"'''])
                    if ex is None and [h['CALCTIME'], h['RANK']] != rklatest:
                        valranks.append([code, h['CALCTIME'], h['RANK'], 0])
            valranks.append([code, rk['exactTime'], rk['rankNumber'], rk['newFans']])

        self.update_ranks(valranks)

    def update_ranks(self, ranks):
        rkdic = {}
        values = []
        for code, dr, rr, nf in ranks:
            allranks = self.sqldb.select(self.tablename, conds=f'{column_code}="{code}"')
            day, dtime = dr.split(' ')
            for id, code, date, r, f in allranks:
                if date.split(' ')[0] != day:
                    continue
                if code not in rkdic:
                    rkdic[code] = {}
                day = date.split(' ')[0]
                if day not in rkdic[code]:
                    rkdic[code][day] = []
                rkdic[code][day].append([id, date, r, f])
            if code not in rkdic or day not in rkdic[code] or len(rkdic[code][day]) == 0:
                values.append([code, dr, rr, nf])
                continue
            if len(rkdic[code][day]) < 2:
                exrk = rkdic[code][day][0]
                extime = exrk[1].split(' ')[1]
                if (extime <= '09:30:00' and dtime <= '09:30:00') or (extime > '09:30:00' and dtime > '09:30:00'):
                    rkinfo = {column_date: dr, 'hrank': rr}
                    if nf != 0:
                        rkinfo['newfans'] = nf
                    self.sqldb.update(self.tablename, rkinfo, {'id': exrk[0]})
                else:
                    values.append([code, dr, rr, nf])
                continue
            sdrk = sorted(rkdic[code][day], key=lambda x : x[1])
            drk2 = [sdrk[0], sdrk[-1]]
            for i in range(1, len(sdrk) - 1):
                self.sqldb.delete(self.tablename, {'id': sdrk[i][0]})
            uid = None
            if dr < drk2[0][1]:
                uid = 0
            elif dtime <= '09:30:00' and dr > drk2[0][1]:
                uid = 0
            elif dr > drk2[1][1]:
                uid = 1
            if uid is not None:
                rkinfo = {column_date: dr, 'hrank': rr}
                if nf != 0:
                    rkinfo['newfans'] = nf
                self.sqldb.update(self.tablename, rkinfo, {'id': drk2[uid][0]})

        if len(values) > 0:
            attrs = [kv['col'] for kv in self.colheaders]
            self.sqldb.insertMany(self.tablename, attrs, values)

    def getGbRanks(self, page=1):
        ''' max page = 5
        '''
        ranks = self.getLatestRanks(page)
        valranks = []
        for rk in ranks:
            valranks.append([rk['code'], rk['rankNumber'], float(rk['newFans'])])
        return valranks

    def getEmRanks(self, total=20):
        url = f'''https://data.eastmoney.com/dataapi/xuangu/list?st=POPULARITY_RANK&sr=1&ps={total}&p=1&sty=SECURITY_CODE,SECURITY_NAME_ABBR,NEW_PRICE,CHANGE_RATE,VOLUME_RATIO,HIGH_PRICE,LOW_PRICE,PRE_CLOSE_PRICE,VOLUME,DEAL_AMOUNT,TURNOVERRATE,POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<={total})(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&source=SELECT_SECURITIES&client=WEB'''
        rsp = Utils.get_em_request(url, host='data.eastmoney.com')
        jdata = json.loads(rsp)
        if jdata['code'] != 0 or 'result' not in jdata or 'data' not in jdata['result']:
            return []

        ranks = []
        for rk in jdata['result']['data']:
            ranks.append([rk['SECURITY_CODE'], rk['POPULARITY_RANK'], rk['NEWFANS_RATIO']])
        return ranks

    def get10jqkaRanks(self):
        # https://basic.10jqka.com.cn/basicph/popularityRanking.html
        url = 'https://basic.10jqka.com.cn/api/stockph/popularity/top/'
        rsp = Utils.get_em_request(url, host='basic.10jqka.com.cn')
        jdata = json.loads(rsp)
        if jdata['status_code'] != 0 or 'data' not in jdata or 'list' not in jdata['data']:
            return []

        ranks = []
        for rk in jdata['data']['list']:
            ranks.append([rk['code'], rk['hot_rank']])
        return ranks

    def getTgbRanks(self):
        # https://www.taoguba.com.cn/new/nrnt/toPopularityBoard
        url = 'https://www.taoguba.com.cn/new/nrnt/getNoticeStock?type=H'
        try:
            headers = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Host': 'www.taoguba.com.cn',
                'Priority': 'u=0, i',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'TE': 'trailers',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0',
            }
            rsp = Utils.get_request(url, headers)
            jdata = json.loads(rsp)
            if jdata['errorCode'] != 0 or 'dto' not in jdata:
                return []

            ranks = []
            for rk in jdata['dto']:
                ranks.append([rk['fullCode'][2:], rk['ranking']])
            return ranks
        except Exception as e:
            Utils.log(f'{e}', Utils.Err)
            return []

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
        self.dbname = stock_db_name
        self.tablename = 'stock_embks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) UNIQUE NOT NULL'},
            {'col':column_name,'type':'varchar(20) DEFAULT NULL'}
        ]

    def checkBk(self, code, name):
        bkname = self.sqldb.selectOneValue(self.tablename, column_name, f'{column_code}="{code}"')
        if bkname is None:
            self.sqldb.insert(self.tablename, {column_code: code, column_name: name})
        elif name != '' and name != bkname:
            self.sqldb.update(self.tablename, {column_name: name}, f'{column_code}="{code}"')

    def queryBkName(self, bk):
        return self.sqldb.selectOneValue(self.tablename, column_name, f'{column_code}="{bk}"')


class StockEmBkChgIgnore(StockEmBkAll):
    '''记录忽略异动的板块列表, 这些板块属于超大板块或者经常出现或者不适用于题材炒作
    '''
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_embks_chg_ignored'


class StockEmBkMap(TableBase):
    def initConstrants(self):
        super().initConstrants()
        self.dbname = stock_db_name
        self.tablename = 'stock_bk_map'
        self.colheaders = [
            {'col':'bk','type':'varchar(20)'},
            {'col':'stock','type':'varchar(20)'}
        ]
        self.constraint = 'PRIMARY KEY (bk, stock)'

    def __query_stocks_bks(self, codes, col1, col2, union=True):
        if not isinstance(codes, list) and not isinstance(codes, tuple):
            codes = [codes]
        if len(codes) == 0:
            return []
        bks = self.sqldb.select(self.tablename, col1, f'{col2}="{codes[0]}"')
        bkset = set([c for c, in bks] if bks is not None and len(bks) > 0 else [])
        for i in range(1, len(codes)):
            bks = self.sqldb.select(self.tablename, col1, f'{col2}="{codes[i]}"')
            cbks = set([c for c, in bks] if bks is not None and len(bks) > 0 else [])
            if union:
                bkset = bkset.union(cbks)
            else:
                bkset = bkset.intersection(cbks)
        return list(bkset)

    def stock_bks(self, codes, union=True):
        return self.__query_stocks_bks(codes, 'bk', 'stock', union)

    def bk_stocks(self, bks, union=True):
        return self.__query_stocks_bks(bks, 'stock', 'bk', union)


class StockEmBk(EmRequest):
    bkmap = StockEmBkMap()
    def __init__(self, bk, name='') -> None:
        self.bk = bk
        self.bname = name
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
        self.page = 1
        self.bkstocks = []
        self.fetchBkStocks()
        self.saveFetched()

    def fetchBkStocks(self):
        bkstks = json.loads(self.getRequest(self.headers))
        if 'data' in bkstks and bkstks['data'] is not None and 'diff' in bkstks['data']:
            for stk in bkstks['data']['diff'].values():
                code = stk['f12']
                mk = stk['f13']
                self.bkstocks.append(StockGlobal.full_stockcode(code))
            if bkstks['data']['total'] > len(self.bkstocks):
                self.page += 1
                self.fetchBkStocks()
            else:
                return self.bkstocks
        else:
            Utils.log(f'{self.bk} get bkstocks error! {bkstks}')
        return self.bkstocks

    def checkBkExists(self, bk, name):
        seb = StockEmBkAll()
        seb.checkBk(bk, name)

    def saveFetched(self):
        self.checkBkExists(self.bk, self.bname)
        exstocks = self.bkmap.sqldb.select(self.bkmap.tablename, 'stock', f'bk="{self.bk}"')
        exstocks = [s for s, in exstocks]
        allstocks = StockGlobal.all_stock_codes()
        self.bkstocks = list(filter(lambda x: x in allstocks, self.bkstocks))
        if len(exstocks) == 0:
            self.bkmap.sqldb.insertMany(self.bkmap.tablename, [kv['col'] for kv in self.bkmap.colheaders], [[self.bk, s] for s in self.bkstocks])
            self.bkstocks = []
            return

        ex = list(set(exstocks) - set(self.bkstocks))
        new = list(set(self.bkstocks) - set(exstocks))
        while len(ex) > 0 and len(new) > 0:
            e0 = ex.pop(0)
            n0 = new.pop(0)
            self.bkmap.sqldb.update(self.bkmap.tablename, {'stock': n0}, {'stock': e0, 'bk': self.bk})

        if len(ex) > 0:
            for e in ex:
                self.bkmap.sqldb.delete(self.bkmap.tablename, [f'stock="{e}"', f'bk="{self.bk}"'])

        if len(new) > 0:
            self.bkmap.sqldb.insertMany(self.bkmap.tablename, [kv['col'] for kv in self.bkmap.colheaders], [[self.bk, s] for s in new])

        self.bkstocks = []

    def dumpDataByDate(self, date=None):
        pool = self.bkmap.sqldb.select(self.bkmap.tablename, 'stock', f'bk="{self.bk}"')
        return [s for s, in pool]


class StockClsBkAll(StockEmBkAll):
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_clsbks'


class StockClsBkMap(StockEmBkMap):
    def initConstrants(self):
        super().initConstrants()
        self.tablename = 'stock_bkcls_map'
        self.constraint = 'PRIMARY KEY (bk, stock)'


class StockClsBk(StockEmBk):
    bkmap = StockClsBkMap()
    def __init__(self, bk, name='') -> None:
        super().__init__(bk, name)
        self.page = 1
        self.pageSize = 50
        self.bkstocks = []

    def getUrl(self):
        return f'https://x-quote.cls.cn/web_quote/plate/stocks?app=CailianpressWeb&os=web&rever=1&secu_code={self.bk}&sv=8.4.6&way=change'

    def fetchBkStocks(self):
        self.headers = {
            'Host': 'x-quote.cls.cn',
            'Referer': f'https://www.cls.cn/plate?code={self.bk}',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        bkstks = json.loads(self.getRequest(self.headers))
        if 'data' in bkstks and 'stocks' in bkstks['data']:
            for stk in bkstks['data']['stocks']:
                code = ''.join(reversed(stk['secu_code'].split('.'))).upper()
                self.bkstocks.append(code)
        return self.bkstocks

    def checkBkExists(self, bk, name):
        seb = StockClsBkAll()
        seb.checkBk(bk, name)


class StockBkMap():
    __em_map = StockEmBkMap()
    __cls_map = StockClsBkMap()

    @classmethod
    def stock_bks(self, codes, union=True):
        return self.__em_map.stock_bks(codes, union) + self.__cls_map.stock_bks(codes, union)

    @classmethod
    def bk_stocks(self, bks, union=True):
        if isinstance(bks, str):
            return self.__em_map.bk_stocks(bks, union) if bks.startswith('BK') else self.__cls_map.bk_stocks(bks, union)
        embks = [bk for bk in bks if bk.startswith('BK')]
        clsbks = [bk for bk in bks if bk.startswith('cls')]
        emstks = set(self.__em_map.bk_stocks(embks, union))
        clsstks = set(self.__cls_map.bk_stocks(clsbks, union))
        if union:
            return list(emstks.union(clsstks))
        return list(emstks.intersection(clsstks))


class StockBkAll():
    __emall = StockEmBkAll()
    __clsall = StockClsBkAll()

    @classmethod
    def checkBk(self, code, name):
        if code.startswith('BK'):
            self.__emall.checkBk(code, name)
            return
        self.__clsall.checkBk(code, name)

    @classmethod
    def queryBkName(self, bk):
        if bk.startswith('BK'):
            return self.__emall.queryBkName(bk)
        return self.__clsall.queryBkName(bk)

    __bk_ignored = []
    @classmethod
    def bkIgnored(self, bk):
        if len(self.__bk_ignored) == 0:
            ignoreBkTable = StockEmBkChgIgnore()
            self.__bk_ignored = [bk for i,bk,n in ignoreBkTable.dumpDataByDate()]
        return bk in self.__bk_ignored
