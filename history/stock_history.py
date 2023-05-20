# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import time
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
    def removeStock(self, code):
        self.sqldb.delete(gl_all_stocks_info_table, {column_code: code})

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
            res = Utils.get_em_equest(rankUrl)
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
                zf = rkobj['f7']  # 振幅
                hsl = rkobj['f8'] # 换手率
                syl = rkobj['f9'] # 市盈率 动态
                lb = rkobj['f10'] # 量比
                zd5 = rkobj['f11']# 五分钟涨跌幅
                cd = rkobj['f12'] # 代码
                m = rkobj['f13']  # 市场代码 0 深 1 沪
                n = rkobj['f14']  # 名称
                h = rkobj['f15']  # 最高
                l = rkobj['f16']  # 最低
                o = rkobj['f17']  # 今开
                lc = rkobj['f18'] # 昨收
                sz = rkobj['f20'] # 总市值
                lt = rkobj['f21'] # 流通市值
                zs = rkobj['f22'] # 涨速
                sj = rkobj['f23'] # 市净率
                z60 = rkobj['f24']# 60日涨跌幅
                zy = rkobj['f25'] # 当年涨跌幅
                lr = rkobj['f62'] # 主力净流入
                syttm = rkobj['f115'] # 市盈率 TTM
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

    def checkNotices(self, code):
        # https://data.eastmoney.com/notices/
        url = f'''https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=10&page_index=1&ann_type=A&client_source=web&stock_list={code[2:]}&f_node=0&s_node=0'''
        nres = Utils.get_em_equest(url)
        if nres is None:
            print('no notice for', code)
            return

        r = json.loads(nres)
        if r['success'] != 1 or r['data'] is None or len(r['data']['list']) == 0:
            print('cannot parse the response data', nres)
            return

        tsupdate = False
        for ntc in r['data']['list']:
            title = ntc['title']
            colname = set([col['column_name'] for col in ntc['columns']])
            ntdate = ntc['notice_date'].split(' ')[0]
            if ('终止上市' in title or '摘牌' in title) and '终止上市' in colname:
                self.updateStockCol(code, column_type, 'TSStock')
                self.updateStockCol(code, 'quit_date', ntdate)
                tsupdate = True
                break

        if not tsupdate:
            print(code, 'check again!')

    def updateStockCol(self, code, col, val):
        stockinfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, col], "%s = '%s'" % (column_code, code))
        if stockinfo is None or len(stockinfo) == 0:
            self.sqldb.insert(gl_all_stocks_info_table, {col: val, column_code: code})
        else:
            (c, l), = stockinfo
            if l == val:
                return
            self.sqldb.update(gl_all_stocks_info_table, {col: val}, {column_code: code})

    def requestEtfListData(self, pz):
        # data src: http://quote.eastmoney.com/center/gridlist.html#fund_etf
        timestamp = Utils.time_stamp()
        cbstr = 'etfcb_' + str(timestamp)
        etfListUrl = 'http://36.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = Utils.get_em_equest(etfListUrl)
        if c is None:
            print("get etf list failed")
            return

        etflist = json.loads(c[len(cbstr) + 1 : -2])
        if etflist is None:
            print('load ETF Data wrong!')
            return

        if etflist['data']['total'] > pz:
            print('total more than', pz, 'retry')
            return self.requestEtfListData(etflist['data']['total'])

        return etflist['data']['diff']

    def loadAllFunds(self, ftype):
        self.check_table_column(column_type, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_short_name, 'varchar(255) DEFAULT NULL')
        self.check_table_column(column_assets_scale, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_setup_date, 'varchar(20) DEFAULT NULL')

        fundList = None
        if ftype == 'ETF':
            fundList = self.requestEtfListData(1000)
        elif ftype == 'LOF':
            fundList = self.requestLofListData(1000)
        if fundList is None:
            return

        attrs = [column_name, column_type, column_short_name, column_setup_date, column_assets_scale]
        conds = [column_code]
        allFundInfo = []
        for e in fundList:
            tp = e['f13']
            code = ('SH' if e['f13'] == 1 else 'SZ') + e['f12']
            name = e['f14']
            fundInfo = self.getFundInfo(code)
            if fundInfo is None:
                self.updateStockCol(code, column_name, name)
                self.updateStockCol(code, column_type, ftype)
                continue
            (short_name, setup_date, assets_scale) = fundInfo                
            allFundInfo.append([name, ftype, short_name, setup_date, assets_scale, code])
        self.sqldb.insertUpdateMany(gl_all_stocks_info_table, attrs, conds, allFundInfo)

    def getFundInfo(self, code):
        ucode = code
        if ucode.startswith('SZ') or ucode.startswith('SH'):
            ucode = ucode[2:]
        url = 'http://fund.eastmoney.com/f10/' + ucode + '.html'

        c = Utils.get_em_equest(url)
        if c is None:
            print("getRequest", url, "failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        infoTable = soup.find('table', {'class':'info'})
        if infoTable is None:
            return

        rows = infoTable.find_all('tr')
        tr0 = rows[0].find_all('td')
        short_name = tr0[1].get_text()
        tr2 = rows[2].find_all('td')
        setup_date = tr2[1].get_text().split()[0]
        setup_date = setup_date.replace('年', '-')
        setup_date = setup_date.replace('月', '-')
        setup_date = setup_date.replace('日', '')
        tr3 = rows[3].find_all('td')
        assets_scale = tr3[0].get_text().split('（')[0]
        return (short_name, setup_date, assets_scale)

    def loadFundInfo(self, code):
        fundInfo = self.getFundInfo(code)
        if fundInfo is None:
            return

        (short_name, setup_date, assets_scale) = fundInfo
        self.updateStockCol(code, column_setup_date, setup_date)
        self.updateStockCol(code, column_assets_scale, assets_scale)
        self.updateStockCol(code, column_short_name, short_name)

    def requestLofListData(self, pz):
        # data src: http://quote.eastmoney.com/center/gridlist.html#fund_lof
        timestamp = Utils.time_stamp()
        cbstr = 'lofcb_' + str(timestamp)
        lofListUrl = 'http://40.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0404,b:MK0405,b:MK0406,b:MK0407&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = Utils.get_em_equest(lofListUrl)
        if c is None:
            print("get lof list failed")
            return

        loflist = json.loads(c[len(cbstr) + 1 : -2])
        if loflist is None:
            print('load LOF Data wrong!')
            return

        if loflist['data']['total'] > pz:
            print('total more than', pz, 'retry')
            return self.requestLofListData(loflist['data']['total'])

        return loflist['data']['diff']


class DividenBonus(EmDataCenterRequest):
    '''get bonus share notice datacenter-web.eastmoney.com.
    ref: https://data.eastmoney.com/yjfp/
    '''
    def __init__(self):
        super().__init__()

    def getUrl(self):
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&quoteColumns=&pageNumber={self.page}&pageSize={self.pageSize}&sortColumns=PLAN_NOTICE_DATE&sortTypes=-1&source=WEB&client=WEB&filter={self._filter}'''

    def saveFecthed(self):
        if len(self.fecthed) == 0:
            return

        bn = StockShareBonus()
        bnheaders = {
            'Host': 'datacenter-web.eastmoney.com',
            'Referer': 'https://data.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:101.0) Gecko/20100101 Firefox/101.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }

        for sn in self.fecthed:
            code = sn['SECUCODE'].split('.')
            print('update bonus share table for', code)
            code.reverse()
            bn.setCode(''.join(code))
            bn.getNext(params=bnheaders)

    def getBonusNotice(self, date = None):
        if date is None:
            datedate = datetime.now()
            d = 0
            while d < 3:
                datedate += timedelta(days=1)
                if datedate.weekday() >= 5:
                    continue
                date = datedate.strftime('%Y-%m-%d')
                self.setFilter(f'''(EQUITY_RECORD_DATE='{date}')''')
                self.getNext()
                d += 1
            return
        # date = '2021-12-20'
        # (REPORT_DATE='2021-12-31')(EX_DIVIDEND_DAYS>0)(EX_DIVIDEND_DATE='2021-12-07')
        # self.setFilter(f'''(EX_DIVIDEND_DATE='{date}')''')
        self.setFilter(f'''(EQUITY_RECORD_DATE='{date}')''')
        self.getNext()

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
        allstocks = AllStocks()
        allstocks.checkNotices(self.code)

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

class StockShareBonus(EmDataCenterRequest, TableBase):
    """get bonus share data from datacenter-web.eastmoney.com. 
    ref: https://data.eastmoney.com/yjfp/detail/000858.html
    """
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'stock_bonus_shares'
        self.colheaders = [
            {'col': column_code, 'type':'varchar(20) DEFAULT NULL'},
            {'col':'报告日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'登记日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'除权除息日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'进度','type':'varchar(20) DEFAULT NULL'},
            {'col':'总送转','type':'float DEFAULT 0'},
            {'col':'送股','type':'float DEFAULT 0'},
            {'col':'转股','type':'float DEFAULT 0'},
            {'col':'派息','type':'float DEFAULT 0'},
            {'col':'股息率','type':'float DEFAULT 0'},
            {'col':'每股收益','type':'float DEFAULT 0'},
            {'col':'每股净资产','type':'float DEFAULT 0'},
            {'col':'总股本','type':'float DEFAULT NULL'},
            {'col':'分红送配详情','type':'varchar(64) DEFAULT NULL'},
        ]

    def setCode(self, code):
        self.sg = StockGlobal.stock_general(code)
        self.code = self.sg.code
        self.bnData = []

    def getUrl(self):
        dcode = self.code[2:]
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&quoteColumns=&pageNumber={self.page}&pageSize={self.pageSize}&sortColumns=PLAN_NOTICE_DATE&sortTypes=1&source=WEB&client=WEB&filter=(SECURITY_CODE%3D%22{dcode}%22)&_={Utils.time_stamp()}'''

    def saveFecthed(self):
        self.saveFecthedBonus()

    def getBonusHis(self):
        brows = self.sqldb.selectOneValue(self.tablename, 'count(*)', f'{column_code}="{self.code}"')
        if brows is None or brows == 0:
            self.getNext()
        else:
            self.loadBonusTable()
        return self.bnData

    def loadBonusTable(self):
        self.bnData = self.sqldb.select(self.tablename, fields=[col['col'] for col in self.colheaders], conds=f'{column_code}="{self.code}"')

    def saveFecthedBonus(self):
        attrs = [col['col'] for col in self.colheaders[2:]]
        values = []
        self.bnData = []
        for bn in self.fecthed:
            rptdate = bn['REPORT_DATE'].split()[0]
            rcddate = bn['EQUITY_RECORD_DATE'].split()[0] if bn['EQUITY_RECORD_DATE'] is not None else ''
            dividdate = bn['EX_DIVIDEND_DATE'].split()[0] if bn['EX_DIVIDEND_DATE'] is not None else ''
            if dividdate == '':
                continue
            xid = self.sqldb.selectOneValue(self.tablename, 'id', [f'{column_code}="{self.code}"', f'除权除息日期="{dividdate}"'])
            if xid is None:
                values.append([rcddate, dividdate, bn['ASSIGN_PROGRESS'],
                    bn['BONUS_IT_RATIO'], bn['BONUS_RATIO'], bn['IT_RATIO'], bn['PRETAX_BONUS_RMB'], bn['DIVIDENT_RATIO'],
                    bn['BASIC_EPS'], bn['BVPS'], bn['TOTAL_SHARES'], bn['IMPL_PLAN_PROFILE'], self.code, rptdate])
            self.bnData.append((rptdate, rcddate, dividdate, bn['ASSIGN_PROGRESS'],
                bn['BONUS_IT_RATIO'], bn['BONUS_RATIO'], bn['IT_RATIO'], bn['PRETAX_BONUS_RMB'], bn['DIVIDENT_RATIO'],
                bn['BASIC_EPS'], bn['BVPS'], bn['TOTAL_SHARES'], bn['IMPL_PLAN_PROFILE']))

        self.sqldb.insertUpdateMany(self.tablename, attrs, [self.colheaders[0]['col'], self.colheaders[1]['col']], values)
        self.fecthed = []

    def dividenDateLaterThan(self, date):
        if date is None:
            date = Utils.today_date()
        brows = self.sqldb.selectOneValue(self.tablename, 'count(*)', [f'除权除息日期 > "{date}"', f'{column_code}="{self.code}"'])
        if brows is None:
            return False
        return brows > 0

    def dividenDetailsLaterThan(self, date=None):
        if date is None:
            date = Utils.today_date()
        return self.sqldb.select(self.tablename, conds=f'登记日期 > "{date}"')

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
                valranks.append()

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
