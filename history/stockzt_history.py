# Python 3
# -*- coding:utf-8 -*-

from utils import *
from bs4 import BeautifulSoup
import re

class StockZtXlm(EmRequest):
    '''  从xilimao获取涨停数据
    ref: https://www.xilimao.com/
    '''
    def __init__(self) -> None:
        super().__init__()

    def getUrl(self):
        return f'https://www.xilimao.com/fupan/zhangting/{self.date}.html'

    def getZtPage(self, date):
        self.date = date
        c = self.getRequest()
        if c is None:
            print("getZtPage failed")
            return

        soup = BeautifulSoup(c, 'html.parser')
        ztTable = soup.find('table', {'class':'table-striped'})
        if ztTable is None:
            print('cant find zt table')
            return

        rows = ztTable.find_all('tr')
        xlzt = []
        for r in rows:
            tds = r.find_all('td')
            if len(tds) == 0:
                continue
            codeReg = re.compile(r'\/(\d{6})\/')
            code = codeReg.search(tds[0].a.attrs['href']).group(1)
            lbc = tds[1].get_text()
            con = tds[3].get_text()
            if con == '其他':
                con = ''
            xlzt.append([code, lbc, con])

        return xlzt


class StockZtInfo(EmRequest):
    '''涨停
    ref: http://quote.eastmoney.com/ztb/detail#type=ztgc
    '''
    def __init__(self):
        super().__init__()
        self.date = None
        self.initConstrants()
        self.checkInfoTable(history_db_name, self.tablename)

    def initConstrants(self):
        self.tablename = 'day_zt_stocks'
        self.colheaders = [column_code, column_date, '涨停封单', '换手率', '连板数', '炸板数', '板块', '概念']
        self.urlroot = f'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&date='

    def checkInfoTable(self, dbname, tablename):
        self.sqldb = SqlHelper(password = db_pwd, database = dbname)
        if not self.sqldb.isExistTable(tablename):
            attrs = {column_code:'varchar(20) DEFAULT NULL', column_date:"varchar(20) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(tablename, attrs, constraint)

    def _max_date(self):
        if self.sqldb.isExistTable(self.tablename):
            maxDate = self.sqldb.select(self.tablename, f"max({column_date})")
            if maxDate is None or not len(maxDate) == 1 or maxDate[0][0] is None:
                return None
            else:
                (mdate,), = maxDate
                return mdate

    def getUrl(self):
        if self.date is None:
            mdate = self._max_date()
            if mdate is None:
                self.date = self.getTodayString('%Y%m%d')
            else:
                self.date = (datetime.strptime(mdate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y%m%d")
        return self.urlroot + self.date

    def getNext(self):
        emback = json.loads(self.getRequest())
        if emback is None or emback['data'] is None:
            print('StockZtInfo invalid response!', emback)
            if self.date < self.getTodayString('%Y%m%d'):
                self.date = (datetime.strptime(self.date, '%Y%m%d') + timedelta(days=1)).strftime("%Y%m%d")
                return self.getNext()
            return

        self.ztdata = []
        date = datetime.strptime(self.date, "%Y%m%d").strftime('%Y-%m-%d')
        for ztobj in emback['data']['pool']:
            code = ('SZ' if ztobj['m'] == '0' else 'SH') + ztobj['c'] # code
            hsl = ztobj['hs'] # 换手率 %
            fund = ztobj['fund'] # 封单金额
            zbc = ztobj['zbc'] # 炸板次数
            lbc = ztobj['lbc'] 
            hybk = ztobj['hybk'] # 行业板块
            # other sections: c->code, n->name, m->market(0=SZ,1=SH), p->涨停价*1000, zdp->涨跌幅,
            # amount->成交额, ltsz->流通市值, tshare->总市值, lbc->连板次数, fbt->首次封板时间, lbt-》最后封板时间
            # zttj->涨停统计 {days->天数, ct->涨停次数}
            self.ztdata.append([code, date, fund, hsl, lbc, zbc, hybk, ''])

        if len(self.ztdata) > 0:
            xlm = StockZtXlm()
            xldata = xlm.getZtPage(date)
            for c,_lbc, con in xldata:
                exists = False
                for i in range(0, len(self.ztdata)):
                    if self.ztdata[i][0][2:] == c:
                        self.ztdata[i][7] = con
                        exists = True
                        break
                if exists:
                    continue

                if c.startswith('00') or c.startswith('30'):
                    cd = 'SZ' + c
                elif c.startswith('60') or c.startswith('68'):
                    cd = 'SH' + c
                else:
                    continue
                self.ztdata.append([cd, date, 0, 0, _lbc, 0, '', con])

            self.saveFetched()

    def check_table_column(self, col, tp):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, tp)

    def saveFetched(self):
        if self.ztdata is None or len(self.ztdata) == 0:
            return

        self.check_table_column(self.colheaders[2], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[3], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[4], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[5], 'varchar(20) DEFAULT NULL')
        self.check_table_column(self.colheaders[6], 'varchar(63) DEFAULT NULL')
        self.check_table_column(self.colheaders[7], 'varchar(255) DEFAULT NULL')

        self.sqldb.insertMany(self.tablename, self.colheaders, self.ztdata)

    def getDumpKeys(self):
        return f'{column_code}, 板块, 概念'

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        data = {'date': date}
        pool = self.sqldb.select(self.tablename,self.getDumpKeys(), [f'{column_date}="{date}"', '连板数="1"'])
        data['pool'] = pool
        return data
