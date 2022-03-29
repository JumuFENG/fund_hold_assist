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


class DailyTradeOPERATEDEPT(EmDataCenterRequest):
    '''
    龙虎榜买卖成交明细
    '''
    def __init__(self, rtable, code, date) -> None:
        super().__init__()
        self.reasonTable = rtable
        self.code = code
        self.date = date
        self.tablename = f's_dfsorg_' + self.code
        self.colheaders = [column_date, '营业部', '原因', '买入额', '卖出额', '净买额']
        self.buyfetched = False
        self.opnameTable = DfsorgNames()

    def _buy_detail_url(self):
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_BILLBOARD_DAILYDETAILSBUY&columns=ALL&filter=(TRADE_DATE%3D%27{self.date}%27)(SECURITY_CODE%3D%22{self.code[2:]}%22)&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BUY&source=WEB&client=WEB&_={self.getTimeStamp()}'''

    def _sell_detail_url(self):
        return f'''https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_BILLBOARD_DAILYDETAILSSELL&columns=ALL&filter=(TRADE_DATE%3D%27{self.date}%27)(SECURITY_CODE%3D%22{self.code[2:]}%22)&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BUY&source=WEB&client=WEB&_={self.getTimeStamp()}'''

    def getUrl(self):
        return self._sell_detail_url() if self.buyfetched else self._buy_detail_url()

    def getBuySellDetails(self):
        self.getNext()

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
            self.getNext()

    def checkInfoTable(self):
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {self.colheaders[0]:"varchar(20) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)

    def saveToDb(self, opdetails):
        if opdetails is None or len(opdetails) == 0:
            return

        self.checkInfoTable()
        self.check_table_column(self.colheaders[1], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[2], 'varchar(10) DEFAULT NULL')
        self.check_table_column(self.colheaders[3], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[4], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[5], 'varchar(20) DEFAULT NULL')

        self.sqldb.insertMany(self.tablename, self.colheaders, opdetails)


class StockDfsorg(EmDataCenterRequest):
    '''
    机构游资龙虎榜
    ref: https://data.eastmoney.com/stock/tradedetail.html
    '''
    def __init__(self) -> None:
        super().__init__()
        self.reasonTable = DfsorgReason()
        self.tablename = 'day_dfsorg_stocks'
        self.colheaders = [column_code, column_date, '原因', '买入额', '卖出额', '净买额', '解读']
        self.checkInfoTable()

    def getUrl(self):
        return f'https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=SECURITY_CODE&sortTypes=1&pageSize={self.pageSize}&pageNumber={self.page}&reportName=RPT_DAILYBILLBOARD_DETAILS&columns=SECURITY_CODE%2CSECUCODE%2CTRADE_DATE%2CEXPLAIN%2CBILLBOARD_NET_AMT%2CBILLBOARD_BUY_AMT%2CBILLBOARD_SELL_AMT%2CEXPLANATION&source=WEB&client=WEB&filter=(TRADE_DATE%3C%3D%27{self.date}%27)(TRADE_DATE%3E%3D%27{self.date}%27)'

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

    def checkInfoTable(self):
        self.sqldb = SqlHelper(password = db_pwd, database = history_db_name)
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_date:"varchar(20) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)

    def saveToDb(self, dfsdata):
        if dfsdata is None or len(dfsdata) == 0:
            return

        self.check_table_column(self.colheaders[2], 'varchar(10) DEFAULT NULL')
        self.check_table_column(self.colheaders[3], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[4], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[5], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[6], 'varchar(255) DEFAULT NULL')

        self.sqldb.insertMany(self.tablename, self.colheaders, dfsdata)

    def _max_date(self):
        if self.sqldb.isExistTable(self.tablename):
            maxDate = self.sqldb.select(self.tablename, f"max({column_date})")
            if maxDate is None or not len(maxDate) == 1 or maxDate[0][0] is None:
                return None
            else:
                (mdate,), = maxDate
                return mdate

    def updateDfsorg(self, date = None):
        todaystr = self.getTodayString()
        if date is None:
            mdate = self._max_date()
            if mdate is None:
                date = todaystr
            else:
                date = (datetime.strptime(mdate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

        while date <= todaystr:
            self.fecthed = []
            self.date = date
            self.getNext()
            date = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

