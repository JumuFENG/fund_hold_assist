# Python 3
# -*- coding:utf-8 -*-
from utils import *

class DfsorgReason():
    '''
    龙虎榜上榜原因
    '''
    def __init__(self):
        self.tablename = 'dfsorg_reasons'
        self.colheaders = ['天数', '上榜原因']
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {self.colheaders[0]:'varchar(10) DEFAULT NULL', self.colheaders[1]:"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)
            self.reasons = ()
        else:
            self.reasons = self.sqldb.select(self.tablename)

    def checkReason(self, reason):
        if '3个交易日' in reason:
            reason = reason.replace('3个交易日', '三个交易日')
        for id, days, r in self.reasons:
            if r == reason:
                return (id, days)

        days = '3' if '三个交易日' in reason else '1'
        self.sqldb.insert(self.tablename, {self.colheaders[0]: days, self.colheaders[1]: reason})
        self.reasons = self.sqldb.select(self.tablename)
        return self.checkReason(reason)

    def getReason(self, id):
        for i, _, r in self.reasons:
            if i == id:
                return r

        return ''

class DfsorgNames():
    '''
    营业部代码和名称
    '''
    def __init__(self):
        self.tablename = 'dfsorg_op_names'
        self.colheaders = [column_code, column_name, column_short_name]
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {self.colheaders[0]:'varchar(20) DEFAULT NULL', self.colheaders[1]:"varchar(127) DEFAULT NULL", self.colheaders[2]:"varchar(31) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)
            self.opnames = ()
        else:
            self.opnames = self.sqldb.select(self.tablename)

    def checkOperateDept(self, code, name):
        for id, c, n, sn in self.opnames:
            if c == code:
                return

        self.sqldb.insert(self.tablename, {self.colheaders[0]: code, self.colheaders[1]: name})
        self.opnames = self.sqldb.select(self.tablename)

    def getFriendlyName(self, code):
        for _,c,n,sn in self.opnames:
            if c == code:
                return sn if sn is not None and len(sn) > 0 else n

        return ''


class DailyTradeOPERATEDEPT(EmDataCenterRequest, TableBase):
    '''
    龙虎榜买卖成交明细
    '''
    def __init__(self, rtable, code, date) -> None:
        super().__init__()
        self.code = code
        super(EmRequest, self).__init__()
        self.reasonTable = rtable
        self.date = date
        self.buyfetched = False
        self.opnameTable = DfsorgNames()

    def setDate(self, date):
        self.page = 1
        self.date = date
        self.buyfetched = False

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = f's_dfsorg_' + self.code
        self.colheaders = [
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'营业部','type':'varchar(20) DEFAULT NULL'},
            {'col':'原因','type':'varchar(10) DEFAULT NULL'},
            {'col':'买入额','type':'varchar(20) DEFAULT NULL'},
            {'col':'卖出额','type':'varchar(20) DEFAULT NULL'},
            {'col':'净买额','type':'varchar(20) DEFAULT NULL'}
        ]

        self.headers = {
            'Host': 'datacenter.eastmoney.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8s',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }

    def _buy_detail_url(self):
        url = f'''https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_BILLBOARD_DAILYDETAILSBUY&columns=ALL&filter=(TRADE_DATE%3D%27{self.date}%27)(SECURITY_CODE%3D%22{self.code[2:]}%22)&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BUY&source=WEB&client=WEB'''
        return url

    def _sell_detail_url(self):
        url = f'''https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_BILLBOARD_DAILYDETAILSSELL&columns=ALL&filter=(TRADE_DATE%3D%27{self.date}%27)(SECURITY_CODE%3D%22{self.code[2:]}%22)&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BUY&source=WEB&client=WEB'''
        return url

    def getUrl(self):
        return self._sell_detail_url() if self.buyfetched else self._buy_detail_url()

    def getBuySellDetails(self):
        self.getNext(self.headers)

    def saveFecthed(self):
        if self.fecthed is not None and len(self.fecthed) > 0:
            values = []
            for rec in self.fecthed:
                date = rec['TRADE_DATE'].split()[0]
                opcode = rec['OPERATEDEPT_CODE']
                opname = rec['OPERATEDEPT_NAME']
                self.opnameTable.checkOperateDept(opcode, opname)
                buyamt = rec['BUY']
                sellamt = rec['SELL']
                netbuy = rec['NET']
                rid, _ = self.reasonTable.checkReason(rec['EXPLANATION'])
                values.append([date, opcode, rid, buyamt, sellamt, netbuy])
            self.saveToDb(values)

        if not self.buyfetched:
            self.buyfetched = True
            self.page = 1
            self.fecthed = []
            self.getNext(self.headers)

    def saveToDb(self, opdetails):
        if opdetails is None or len(opdetails) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], opdetails)

    def getDumpCondition(self, date):
        return f'{column_date}="{date}"'


class StockDfsorg(EmDataCenterRequest, TableBase):
    '''
    机构游资龙虎榜
    ref: https://data.eastmoney.com/stock/tradedetail.html
    '''
    def __init__(self) -> None:
        super().__init__()
        super(EmRequest, self).__init__()
        self.reasonTable = DfsorgReason()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_dfsorg_stocks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'原因','type':'varchar(10) DEFAULT NULL'},
            {'col':'买入额','type':'varchar(20) DEFAULT NULL'},
            {'col':'卖出额','type':'varchar(20) DEFAULT NULL'},
            {'col':'净买额','type':'varchar(20) DEFAULT NULL'},
            {'col':'解读','type':'varchar(255) DEFAULT NULL'}
        ]

    def getUrl(self):
        url = f'''https://datacenter.eastmoney.com/api/data/v1/get?sortColumns=SECURITY_CODE&sortTypes=1&pageSize={self.pageSize}&pageNumber={self.page}&reportName=RPT_DAILYBILLBOARD_DETAILS&columns=SECURITY_CODE,SECUCODE,TRADE_DATE,EXPLAIN,BILLBOARD_NET_AMT,BILLBOARD_BUY_AMT,BILLBOARD_SELL_AMT,EXPLANATION&source=WEB&client=WEB&filter=(TRADE_DATE%3C=%27{self.date}%27)(TRADE_DATE%3E=%27{self.date}%27)'''
        return url

    def saveFecthed(self):
        if len(self.fecthed) > 0:
            dfscodes = set()
            values = []
            for rec in self.fecthed:
                code = ''.join(rec['SECUCODE'].split('.')[-1::-1])
                dfscodes.add(code)
                date = rec['TRADE_DATE'].split()[0]
                buyamt = rec['BILLBOARD_BUY_AMT']
                sellamt = rec['BILLBOARD_SELL_AMT']
                netbuy = rec['BILLBOARD_NET_AMT']
                rid, _ = self.reasonTable.checkReason(rec['EXPLANATION'])
                analyze = rec['EXPLAIN']
                values.append([code, date, rid, buyamt, sellamt, netbuy, analyze])

            self.saveToDb(values)
            for c in dfscodes:
                dtop = DailyTradeOPERATEDEPT(self.reasonTable, c, self.date)
                dtop.getBuySellDetails()

    def saveToDb(self, dfsdata):
        if dfsdata is None or len(dfsdata) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], dfsdata)

    def updateDfsorg(self, date = None):
        todaystr = Utils.today_date()
        if date is None:
            mdate = self._max_date()
            if mdate is None:
                date = todaystr
            else:
                date = TradingDate.nextTradingDate(mdate)

        dfsheaders = {
            'Host': 'datacenter.eastmoney.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
        self.pageSize = 100
        mxdate = TradingDate.maxTradingDate()
        while date <= mxdate:
            self.fecthed = []
            self.date = date
            self.getNext(params=dfsheaders)
            if date == mxdate:
                break
            date = TradingDate.nextTradingDate(date)

    def getDumpKeys(self):
        return [column_code, column_date]

    def updateDetails(self):
        dfscodes = self.dumpDataByDate()
        xcnt = 0
        derr = []
        while len(dfscodes) > 0:
            code = dfscodes[0][0]
            dfi = [d for c, d in dfscodes if c == code]
            dfscodes = [(c, d) for c, d in dfscodes if c != code]
            dtop = DailyTradeOPERATEDEPT(self.reasonTable, code, None)
            for d in dfi:
                dayops = dtop.dumpDataByDate(d)
                if dayops is None or len(dayops) == 0:
                    dtop.setDate(d)
                    try:
                        dtop.getBuySellDetails()
                        print('success', code, d)
                    except:
                        print('fail', code, d)
                        derr.append([code, d])
                        xcnt += 1
                        if xcnt > 50:
                            break

            if xcnt > 50:
                break

        print(derr)
