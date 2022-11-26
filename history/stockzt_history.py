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


class StockZtInfo(EmRequest, TableBase):
    '''涨停
    ref: http://quote.eastmoney.com/ztb/detail#type=ztgc
    '''
    def __init__(self) -> None:
        super().__init__()
        super(EmRequest, self).__init__()
        self.date = None

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_zt_stocks'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'涨停封单','type':'varchar(20) DEFAULT NULL'},
            {'col':'换手率','type':'varchar(20) DEFAULT NULL'},
            {'col':'连板数','type':'varchar(20) DEFAULT NULL'},
            {'col':'炸板数','type':'varchar(20) DEFAULT NULL'},
            {'col':'板块','type':'varchar(63) DEFAULT NULL'},
            {'col':'概念','type':'varchar(255) DEFAULT NULL'}
        ]

        self.urlroot = f'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&date='

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
            code = ('SZ' if ztobj['m'] == '0' or ztobj['m'] == 0 else 'SH') + ztobj['c'] # code
            hsl = ztobj['hs'] # 换手率 %
            fund = ztobj['fund'] # 封单金额
            zbc = ztobj['zbc'] # 炸板次数
            lbc = ztobj['lbc'] 
            hybk = ztobj['hybk'] # 行业板块
            # other sections: c->code, n->name, m->market(0=SZ,1=SH), p->涨停价*1000, zdp->涨跌幅,
            # amount->成交额, ltsz->流通市值, tshare->总市值, lbc->连板次数, fbt->首次封板时间, lbt->最后封板时间
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

                if c.startswith('00') or c.startswith('30') or c.startswith('8') or c.startswith('4'):
                    cd = 'SZ' + c
                elif c.startswith('60') or c.startswith('68'):
                    cd = 'SH' + c
                else:
                    continue
                self.ztdata.append([cd, date, 0, 0, _lbc, 0, self._get_bk(cd), con])

            self.saveFetched()

    def _get_bk(self, code):
        bks = self.sqldb.select(self.tablename, ['板块'], [f'{column_code}="{code}"'])
        if bks is None or len(bks) == 0:
            return ''

        for i in range(len(bks) - 1, 0, -1):
            bk, = bks[i]
            if bk != '':
                return bk
        return ''

    def saveFetched(self):
        if self.ztdata is None or len(self.ztdata) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.ztdata)

    def getDumpKeys(self):
        return self._select_keys([f'{column_code}, 板块, 概念'])

    def getDumpCondition(self, date):
        return self._select_condition([f'{column_date}="{date}"', '连板数="1"'])

    def dumpDataByDate(self, date = None):
        if date is None:
            date = self._max_date()

        if date is None:
            return None

        hld = Holiday()
        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            pool = self.sqldb.select(self.tablename, self.getDumpKeys(), self.getDumpCondition(date))
            if pool is not None and len(pool) > 0:
                data = {'date': date}
                data['pool'] = pool
                return data
            elif datetime.strptime(date, r'%Y-%m-%d').weekday() < 5 and not hld.isholiday(date):
                data = {'date': date,'pool':[]}
                return data
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        return self.dumpDataByDate()

    def _unify_concepts(self, pool):
        return [[c, n, bk if con == '' else con] for c, n, bk, con in pool]

    def dumpZtDataByConcept(self, date, concept):
        if date is None:
            return []

        pool = self.sqldb.select(self.tablename, [f'{column_code}', '连板数', '板块', '概念'], f'{column_date}="{date}"')
        if concept is not None:
            ztcpt = []
            for c, n, bk, con in pool:
                cons = [bk]
                if '+' in con:
                    cons = con.split('+')
                elif con != '':
                    cons = [con]
                if concept in cons:
                    ztcpt.append([c, n, bk, con])
            return self._unify_concepts(ztcpt)
        return self._unify_concepts(pool)


class StockZtConcepts(TableBase):
    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'day_zt_concepts'
        self.colheaders = [
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'},
            {'col':'概念','type':'varchar(255) DEFAULT NULL'},
            {'col':'涨停数','type':'smallint DEFAULT NULL'}
        ]

    def _save_concepts(self, cdata):
        if cdata is None or len(cdata) == 0:
            return

        self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], cdata)

    def getNext(self):
        date = self._max_date()
        if date is None:
            date = '2021-01-04'
        else:
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")
        zthisttable = 'day_zt_stocks'
        ztconceptsdata = []
        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            pool = self.sqldb.select(zthisttable, [f'{column_code}, 板块, 概念'], [f'{column_date}="{date}"'])
            if pool is not None and len(pool) > 0:
                cdict = {}
                for c, bk, con in pool:
                    if con == '' and bk == '':
                        raise Exception(f'no bk or con for {c} on {date}, please correct the data!')
                    cons = []
                    if con == '':
                        cons.append(bk)
                    elif '+' in con:
                        cons = con.split('+')
                    else:
                        cons.append(con)
                    for k in cons:
                        if k not in cdict:
                            cdict[k] = 1
                        else:
                            cdict[k] += 1
                for k,v in cdict.items():
                    ztconceptsdata.append([date, k, v])
                if len(ztconceptsdata) > 5000:
                    self._save_concepts(ztconceptsdata)
                    ztconceptsdata = []
            date = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=1)).strftime(r"%Y-%m-%d")

        if len(ztconceptsdata) > 0:
            self._save_concepts(ztconceptsdata)

    def dumpDataByDate(self, date=None):
        ''' date: start date.
        '''
        if date is None:
            date = (datetime.now() - timedelta(days=40)).strftime(r"%Y-%m-%d")
        return self.sqldb.select(self.tablename, [f'{column_date}', '概念', '涨停数'], [f'{column_date}>"{date}"'])
