# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *
import time
import json
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

class AllStocks(InfoList):
    """get all stocks' general info and save to db table allstoks"""
    def __init__(self):
        self.checkInfoTable(stock_db_name, gl_all_stocks_info_table)
        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')
        self.check_table_column('quit_date', 'varchar(10) DEFAULT NULL')

    def loadInfo(self, code):
        code = code.upper()
        url = 'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/CompanySurveyAjax?code=' + code
        c = self.getRequest(url)
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

    def laodNewStock(self, sdate = None):
        # http://quote.eastmoney.com/center/gridlist.html#newshares
        newstocks = []
        pn = 1
        today = datetime.now().strftime("%Y-%m-%d")
        maxDate = self.sqldb.select(gl_all_stocks_info_table, f"max({column_setup_date})")
        if maxDate is None or not len(maxDate) == 1:
            sdate = today
        else:
            (sdate,), = maxDate

        while True:
            newstoksUrl = f'''http://18.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f26&fs=m:0+f:8,m:1+f:8&fields=f12,f13,f14,f21,f26&_={self.getTimeStamp()}'''
            res = self.getRequest(newstoksUrl)
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
                if setdate < sdate or setdate == today or n.startswith('N'):
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
        nres = self.getRequest(url)
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

    def getTimeStamp(self):
        curTime = datetime.now()
        stamp = time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond
        return int(stamp)

    def requestEtfListData(self, pz):
        # data src: http://quote.eastmoney.com/center/gridlist.html#fund_etf
        timestamp = self.getTimeStamp()
        cbstr = 'etfcb_' + str(timestamp)
        etfListUrl = 'http://36.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = self.getRequest(etfListUrl)
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

        c = self.getRequest(url)
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
        timestamp = self.getTimeStamp()
        cbstr = 'lofcb_' + str(timestamp)
        lofListUrl = 'http://40.push2.eastmoney.com/api/qt/clist/get?cb=' + cbstr + '&pn=1&pz=' + str(pz) + '&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0404,b:MK0405,b:MK0406,b:MK0407&fields=f12,f13,f14&_=' + str(timestamp + 1)
        c = self.getRequest(lofListUrl)
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

    def getAllStocks(self):
        return self.sqldb.select(gl_all_stocks_info_table)

    def getAllStocksShortInfo(self):
        stksInfo = self.sqldb.select(gl_all_stocks_info_table, [column_code, column_name, column_type], "type != 'TSSTOCK'")
        rslt = []
        for (c, n, t) in stksInfo:
            jobj = {}
            jobj['c'] = c
            jobj['n'] = n
            jobj['t'] = 'AB' if t == 'ABStock' else 'E' if t == 'ETF' else 'L' if t == 'LOF' else ''
            rslt.append(jobj)
        return rslt

    def removeStock(self, code):
        self.sqldb.delete(gl_all_stocks_info_table, {column_code: code})

class DividenBonus(EmDataCenterRequest):
    def __init__(self):
        super().__init__()

    def getUrl(self):
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&quoteColumns=&pageNumber={self.page}&pageSize={self.pageSize}&sortColumns=PLAN_NOTICE_DATE&sortTypes=-1&source=WEB&client=WEB&filter={self._filter}'''

    def saveFecthed(self):
        if len(self.fecthed) == 0:
            return

        bn = StockShareBonus()
        for sn in self.fecthed:
            code = sn['SECUCODE'].split('.')
            print('update bonus share table for', code)
            code.reverse()
            bn.setCode(''.join(code))
            bn.getBonusHis()

    def getBonusNotice(self):
        date = datetime.now().strftime("%Y-%m-%d")
        # date = '2021-12-20'
        # (REPORT_DATE%3D%272021-12-31%27)(EX_DIVIDEND_DAYS%3C0)(EX_DIVIDEND_DATE%3D%272021-12-07%27)
        self.setFilter(f'''(EX_DIVIDEND_DATE%3D%27{date}%27)''')
        self.getNext()

class Stock_history(HistoryFromSohu):
    """
    get stock history data
    """
    def setCode(self, code):
        allstocks = AllStocks()
        self.sg = StockGeneral(allstocks.sqldb, code)
        super().setCode(self.sg.code)
        self.km_histable = self.sg.stockKmtable
        self.kw_histable = self.sg.stockKwtable
        self.k_histable = self.sg.stockKtable
        self.k15_histable = self.sg.stockK15table

    def getSetupDate(self):
        return (datetime.strptime(self.sg.setupdate, "%Y-%m-%d")).strftime("%Y%m%d")

    def getSohuCode(self):
        return self.sg.sohucode

    def getEmSecCode(self):
        return self.sg.emseccode

    def kHistoryTableExists(self, stk):
        self.setCode(stk)
        return self.sqldb.isExistTable(self.k_histable)

class StockShareBonus(EmDataCenterRequest):
    """get bonus share data from datacenter-web.eastmoney.com. 
    ref: https://data.eastmoney.com/yjfp/detail/000858.html
    """
    def __init__(self):
        super().__init__()
        self.columns = ['报告日前', '登记日期', '除权除息日期', '进度', '总送转', '送股', '转股', '派息', '股息率', '每股收益', '每股净资产', '总股本', '分红送配详情']

    def setCode(self, code):
        allstocks = AllStocks()
        self.sg = StockGeneral(allstocks.sqldb, code)
        self.code = self.sg.code
        self.bonustable = self.sg.bonustable
        self.bnData = []

    def getUrl(self):
        dcode = self.code[2:]
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&quoteColumns=&pageNumber={self.page}&pageSize={self.pageSize}&sortColumns=PLAN_NOTICE_DATE&sortTypes=1&source=WEB&client=WEB&filter=(SECURITY_CODE%3D%22{dcode}%22)&_={self.getTimeStamp()}'''

    def saveFecthed(self):
        self.saveFecthedBonus()

    def getBonusHis(self):
        if not self.checkBonusTable():
            self.getNext()
        else:
            self.loadBonusTable()
        return self.bnData

    def loadBonusTable(self):
        self.bnData = self.sqldb.select(self.bonustable, fields=self.columns)

    def checkBonusTable(self):
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        return self.sqldb.isExistTable(self.bonustable)

    def createBonusTable(self):
        attrs = {
            self.columns[0]:'varchar(20) DEFAULT NULL', self.columns[1]:"varchar(20) DEFAULT NULL",
            self.columns[2]:"varchar(20) DEFAULT NULL", self.columns[3]:"varchar(20) DEFAULT NULL",
            self.columns[4]:'varchar(10) DEFAULT 0', self.columns[5]:'varchar(10) DEFAULT 0', self.columns[6]:'varchar(10) DEFAULT 0',
            self.columns[7]:'varchar(10) DEFAULT 0', self.columns[8]:'varchar(10) DEFAULT 0',
            self.columns[9]:'varchar(10) DEFAULT 0', self.columns[10]:'varchar(10) DEFAULT 0', self.columns[11]:'varchar(20) DEFAULT NULL',
            self.columns[12]:'varchar(64) DEFAULT NULL'}
        constraint = 'PRIMARY KEY(`id`)'
        self.sqldb.createTable(self.bonustable, attrs, constraint)

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.bonustable, col):
            self.sqldb.addColumn(self.bonustable, col, tp)

    def saveFecthedBonus(self):
        if not self.checkBonusTable():
            self.createBonusTable()

        attrs = self.columns[1:]
        values = []
        self.bnData = []
        for bn in self.fecthed:
            rptdate = bn['REPORT_DATE'].split()[0]
            rcddate = bn['EQUITY_RECORD_DATE'].split()[0] if bn['EQUITY_RECORD_DATE'] is not None else ''
            dividdate = bn['EX_DIVIDEND_DATE'].split()[0] if bn['EX_DIVIDEND_DATE'] is not None else ''
            values.append([rcddate, dividdate, bn['ASSIGN_PROGRESS'], 
                bn['BONUS_IT_RATIO'], bn['BONUS_RATIO'], bn['IT_RATIO'], bn['PRETAX_BONUS_RMB'], bn['DIVIDENT_RATIO'],
                bn['BASIC_EPS'], bn['BVPS'], bn['TOTAL_SHARES'], bn['IMPL_PLAN_PROFILE'], rptdate])
            self.bnData.append((rptdate, rcddate, dividdate, bn['ASSIGN_PROGRESS'], 
                bn['BONUS_IT_RATIO'], bn['BONUS_RATIO'], bn['IT_RATIO'], bn['PRETAX_BONUS_RMB'], bn['DIVIDENT_RATIO'],
                bn['BASIC_EPS'], bn['BVPS'], bn['TOTAL_SHARES'], bn['IMPL_PLAN_PROFILE']))

        self.sqldb.insertUpdateMany(self.bonustable, attrs, [self.columns[0]], values)
        self.fecthed = []
