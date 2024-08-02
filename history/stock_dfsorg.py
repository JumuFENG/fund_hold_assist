# Python 3
# -*- coding:utf-8 -*-
from utils import *
import re


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
        if '三个交易日' in reason:
            reason = reason.replace('三个交易日', '3个交易日')
        if '3个有成交的交易日' in reason:
            reason = reason.replace('3个有成交的交易日', '3个交易日')
        for id, days, r in self.reasons:
            if r == reason:
                return (id, days)

        pat = r'(\d+)[个]*交易日'
        mat = re.findall(pat, reason)
        days = mat.pop(0) if len(mat) > 0 else '1'
        self.sqldb.insert(self.tablename, {self.colheaders[0]: days, self.colheaders[1]: reason})
        self.reasons = self.sqldb.select(self.tablename)
        return self.checkReason(reason)

    def getReason(self, id):
        for i, _, r in self.reasons:
            if i == id:
                return r

        return ''


class DfsorgNames(TableBase):
    '''
    营业部代码和名称
    '''
    def initConstrants(self):
        self.tablename = 'dfsorg_op_names'
        self.dbname = history_db_name
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_name, 'type': 'varchar(127) DEFAULT NULL'},
            {'col': column_short_name, 'type': 'varchar(31) DEFAULT NULL'}
        ]
        self.opnames = None

    def checkOperateDept(self, code, name):
        if self.opnames is None:
            self.opnames = self.sqldb.select(self.tablename)
        for id, c, n, sn in self.opnames:
            if c == code:
                return

        self.sqldb.insert(self.tablename, {column_code: code, column_name: name})
        self.opnames = self.sqldb.select(self.tablename)

    def getFriendlyName(self, code):
        if self.opnames is None:
            self.opnames = self.sqldb.select(self.tablename)
        for _,c,n,sn in self.opnames:
            if c == code:
                return sn if sn is not None and len(sn) > 0 else n

        return ''


class StockDfsorgBuySellDetails(EmDataCenterRequest, TableBase):
    '''
    龙虎榜买卖成交明细
    '''
    opnameTable = DfsorgNames()
    reasonTable = DfsorgReason()
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()
        self.code = None
        self.date = None
        self.buyfetched = False
        self.rptName = 'RPT_BILLBOARD_DAILYDETAILSBUY'
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

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_dfsorg_bs_details'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'营业部','type':'varchar(20) DEFAULT NULL'},
            {'col':'原因','type':'int DEFAULT NULL'},
            {'col':'买入额','type':'float(20,2) DEFAULT 0'},
            {'col':'卖出额','type':'float(20,2) DEFAULT 0'},
            {'col':'净买额','type':'float(20,2) DEFAULT 0'}
        ]

    def getUrl(self):
        url = f'''https://datacenter.eastmoney.com/api/data/v1/get?reportName={self.rptName}&columns=ALL&filter=(TRADE_DATE%3D%27{self.date}%27)(SECURITY_CODE%3D%22{self.code[2:]}%22)&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BUY&source=WEB&client=WEB'''
        return url

    def get_rpt_details(self, code, date):
        self.code = code
        self.date = date
        self.page = 1
        self.fecthed = []
        self.getNext(self.headers)

    def getBuyDetails(self, code, date):
        self.rptName = 'RPT_BILLBOARD_DAILYDETAILSBUY'
        self.get_rpt_details(code, date)

    def getSellDetails(self, code, date):
        self.rptName = 'RPT_BILLBOARD_DAILYDETAILSSELL'
        self.get_rpt_details(code, date)

    def saveFecthed(self):
        if self.fecthed is None or len(self.fecthed) == 0:
            return

        values = []
        exists = [(dfs[1], dfs[2], dfs[3], dfs[4]) for dfs in self.dumpDataByDate(self.date)]
        for rec in self.fecthed:
            date = rec['TRADE_DATE'].split()[0]
            opcode = rec['OPERATEDEPT_CODE']
            opname = rec['OPERATEDEPT_NAME']
            self.opnameTable.checkOperateDept(opcode, opname)
            buyamt = rec['BUY']
            sellamt = rec['SELL']
            netbuy = rec['NET']
            rid, _ = self.reasonTable.checkReason(rec['EXPLANATION'])
            if (self.code, date, opcode, rid) not in exists:
                values.append([self.code, date, opcode, rid, buyamt, sellamt, netbuy])

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return [f'{column_date}="{date}"']

    def removeDuplicates(self):
        x = self.sqldb.select(self.tablename)
        exist_dfs = []
        for r in x:
            if r[3] == '0':
                continue
            if (r[1], r[2], r[3], r[4]) in exist_dfs:
                self.sqldb.delete(self.tablename, f'id={r[0]}')
            else:
                exist_dfs.append((r[1], r[2], r[3], r[4]))
        x0 = [r for r in x if r[3] == '0']
        exist_dfs = []
        for r in x0:
            if (r[1], r[2], r[3], r[4], r[5], r[6]) in exist_dfs:
                self.sqldb.delete(self.tablename, f'id={r[0]}')
            else:
                exist_dfs.append((r[1], r[2], r[3], r[4], r[5], r[6]))


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
            dtop = StockDfsorgBuySellDetails()
            for c in dfscodes:
                dtop.getBuyDetails(c, self.date)
                dtop.getSellDetails(c, self.date)

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
        dfsdic = {}
        for c,d in dfscodes:
            # 只更新2月内的记录
            if (datetime.now() - datetime.strptime(d, '%Y-%m-%d')).days > 60:
                continue
            if c not in dfsdic:
                dfsdic[c] = set()
            dfsdic[c].add(d)
        dtop = StockDfsorgBuySellDetails()
        all_ops = dtop.sqldb.select(dtop.tablename)
        xcnt = 0
        derr = []
        for code, dfi in dfsdic.items():
            for d in dfi:
                dayops = [x for x in all_ops if x[1] == code and x[2] == d]
                if len(dayops) == 0:
                    try:
                        dtop.getBuyDetails(code, d)
                        dtop.getSellDetails(code, d)
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
