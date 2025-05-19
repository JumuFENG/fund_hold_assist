# Python 3
# -*- coding:utf-8 -*-
import re
from bs4 import BeautifulSoup
from utils import *
from history import StockGlobal


class AnnounceType(TableBase):
    ''' 公告类型
    '''
    def __init__(self) -> None:
        super().__init__()
        self.annTypes = None

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'annouce_types'
        self.colheaders = [
            {'col': column_code, 'type':'varchar(63) DEFAULT NULL'},
            {'col': column_name, 'type':'varchar(63) DEFAULT NULL'},
            {'col': column_type, 'type':'int DEFAULT 0'}
        ]
    
    def sort_code(self):
        self.sqldb.sortTable(self.tablename, column_code)

    def add_ann_type(self, tcode, tname, tp=0):
        if self.annTypes is None:
            cs = self.sqldb.select(self.tablename, [column_code, column_name])
            self.annTypes = {c: n for c,n in cs}
        if tcode in self.annTypes:
            if tp != 0:
                self.update(self.tablename, {column_type: tp}, {column_code: tcode})
        else:
            self.annTypes[tcode] = tname
            annattr = {column_code: tcode, column_name: tname}
            if tp != 0:
                annattr[column_type] = tp
            self.sqldb.insert(self.tablename, annattr)

class StockAnnoucements(EmDataCenterRequest, TableBase):
    ''' 公告 : https://data.eastmoney.com/notices/
    '''
    def __init__(self) -> None:
        super().__init__()
        super(EmRequest, self).__init__()
        self.headers = {
            'Host': 'np-anotice-stock.eastmoney.com',
            'Referer': 'https://data.eastmoney.com/notices/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        self.annTypes = AnnounceType()
        self.code = None
        self.pageSize = 100
        self.latestArts = None
        self.allfetched = False
        self.maxAnnDate = None

    def initConstrants(self):
        super().initConstrants()
        self.dbname = history_db_name
        self.tablename = 'stock_announcements'
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'ann_type', 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'inner_code', 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'type_code', 'type': 'varchar(63) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'title', 'type': 'varchar(255) DEFAULT NULL'},
            {'col': 'article_code', 'type': 'varchar(31) DEFAULT NULL'},
        ]

    def setCode(self, code):
        self.code = code if len(code) == 6 else code[2:]
        self.page = 1

    def getUrl(self):
        # ann_type=SHA,CYB,SZA,BJA
        url = f'''https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size={self.pageSize}&page_index={self.page}&ann_type=A,SHA,CYB,SZA,BJA&client_source=web'''
        if self.code is not None:
            url += f'&stock_list={self.code}'
        url += '&f_node=0&s_node=0'
        return url

    def getNext(self):
        anns = json.loads(self.getRequest(self.headers))
        if 'success' not in anns or not anns['success'] or 'data' not in anns:
            print('StockAnnoucements getUrl', self.getUrl())
            print('StockAnnoucements Error, ', anns['error'])
            return

        if (anns['data'] and anns['data']['list']):
            self.fecthed = anns['data']['list']

        self.saveFecthed()
        if anns['data']['page_index'] * anns['data']['page_size'] >= anns['data']['total_hits'] or self.allfetched:
            return

        self.page += 1
        self.getNext()

    def saveFecthed(self):
        values = []
        for ann in self.fecthed:
            dtime = ':'.join((ann['eiTime'] if ann['display_time'] == '' else ann['display_time']).split(':')[:-1]) 
            title = ann['title']
            art_code = ann['art_code']
            if self.code is None:
                if self.latestArts is None:
                    self.maxAnnDate = self._max_date()
                    self.maxAnnDate = self.maxAnnDate.split()[0]
                    arts = self.sqldb.select(self.tablename, 'article_code', f'{column_date}>{self.maxAnnDate}')
                    self.latestArts = set()
                    for ar, in arts:
                        self.latestArts.add(ar)
                if dtime < self.maxAnnDate:
                    self.allfetched = True
                if art_code in self.latestArts:
                    continue
            for anico in ann['columns']:
                type_code = anico['column_code']
                self.annTypes.add_ann_type(type_code, anico['column_name'])
                for ani in ann['codes']:
                    ann_type = ani['ann_type']
                    shsz = self.get_shsz_from_ann(ann_type)
                    s_code = (shsz + ani['stock_code']) if shsz is not None else StockGlobal.full_stockcode(ani['stock_code'])
                    inner_code = ani['inner_code'] if 'inner_code' in ani else ''
                    values.append([s_code, ann_type, inner_code, type_code, dtime, title, art_code])

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], values)
        self.fecthed = []

    def getUstDateAfter(self, code, date):
        ''' 获取date之后撤销ST的公告日期, 没有则返回None
        '''
        return self.sqldb.selectOneValue(self.tablename, f'min({column_date})', [f'(type_code="001002004003005" or type_code="001002004003002")', f'{column_code}="{code}"', f'{column_date}>"{date}"'])

    def getArticleTime(self, artcode):
        url = f'''https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code={artcode}&client_source=web&page_index=1'''
        rsp = requests.get(url, params=self.headers)
        rsp.raise_for_status()
        ntc = json.loads(rsp.text)
        if 'success' in ntc and ntc['success'] == 1:
            return ntc['data']['eitime']

    def get_shsz_from_ann(self, ant):
        if 'SZA' in ant or 'CYB' in ant:
            return 'SZ'
        elif 'SHA' in ant:
            return 'SH'
        elif 'BJA' in ant:
            return 'BJ'

    def check_stock_quit(self, stks):
        for code in stks:
            anns = self.sqldb.select(self.tablename, f'{column_date},title', [f'{column_code}="{code}"', f'(type_code=010002001 or type_code=001002004006002)'])
            for d, t in anns:
                if '终止上市' in t and '摘牌' in t:
                    dt = d.split()
                    if len(dt) != 2:
                        Utils.log(f'check_stock_quit {code} {anns}', Utils.Err)
                        continue
                    qdate,qtime = dt
                    if qtime > '15':
                        qdate = TradingDate.nextTradingDate(qdate)
                    Utils.log(f'check_stock_quit {code} already quit')
                    StockGlobal.setQuitDate(code, qdate)
                    break

    def check_fund_quit(self, stks):
        for code in stks:
            sg = StockGlobal.stock_general(code)
            if not hasattr(sg, 'type'):
                Utils.log(f'{code} cannot get general information!')
                continue
            if sg.type != 'ETF' and sg.type != 'LOF':
                continue
            ucode = code.lstrip('SZ').lstrip('SH')
            url = f'https://api.fund.eastmoney.com/f10/JJGG?fundcode={ucode}&pageIndex=1&pageSize=20&type=6'
            headers = {
                'Host': 'api.fund.eastmoney.com',
                'Referer': 'https://fundf10.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            }
            annresp = Utils.get_request(url, headers)
            anns =json.loads(annresp)
            if 'Data' not in anns:
                continue
            for annobj in anns['Data']:
                if '终止上市的公告' in annobj['TITLE']:
                    StockGlobal.setQuitFund(code, annobj['PUBLISHDATEDesc'])
                    Utils.log(f'check_fund_quit {code} already quit')
                    break

    def check_buyment(self, date=None):
        '''回购
        param date: 起始日期
        '''
        anns = self.sqldb.select(self.tablename, f'{column_date},{column_code},title', f'{column_date}>="{date}"')
        bmdict = {}
        for d,c,t in anns:
            if not c.startswith('SH') and not c.startswith('SZ') and not c.startswith('BJ'):
                continue
            if '回购' not in t:
                continue
            if c not in bmdict:
                bmdict[c] = []
            bmdict[c].append([d,t])

        return bmdict



class StockShareBonus(EmDataCenterRequest, TableBase):
    '''get bonus share notice datacenter.eastmoney.com.
    ref: https://data.eastmoney.com/yjfp/
    '''
    def __init__(self):
        super().__init__()
        super(EmRequest, self).__init__()
        self.headers = {
            'Host': 'datacenter.eastmoney.com',
            'Referer': 'https://data.eastmoney.com/yjfp/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }
        self.code = None
        self.pageSize = 100
        self.latestBn = None

    def initConstrants(self):
        super().initConstrants()
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

    def getUrl(self):
        return  f'''https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&quoteColumns=&pageNumber={self.page}&pageSize={self.pageSize}&sortColumns=EQUITY_RECORD_DATE&sortTypes=-1&source=WEB&client=WEB&filter={self._filter}'''

    def setCode(self, code):
        self.code = code if len(code) == 6 else code[2:]
        self.page = 1

    def getNext(self, params=None, proxies=None):
        if self.page == 1:
            if self.code is None:
                # (REPORT_DATE='2021-12-31')(EX_DIVIDEND_DAYS>0)(EX_DIVIDEND_DATE='2021-12-07')
                # self.setFilter(f'''(EX_DIVIDEND_DATE='{date}')''')
                date = Utils.today_date()
                mxdate = self.sqldb.selectOneValue(self.tablename, 'max(登记日期)')
                date = min(date, mxdate)
                self.setFilter(f'''(EQUITY_RECORD_DATE>='{date}')(EX_DIVIDEND_DAYS>=-10)''')
            else:
                self.setFilter(f'''(SECURITY_CODE="{self.code}")''')

        return super().getNext(self.headers if params is None else params, proxies)

    def saveFecthed(self):
        values = []
        for bn in self.fecthed:
            rptdate = bn['REPORT_DATE'].split()[0]
            rcddate = bn['EQUITY_RECORD_DATE'].split()[0] if bn['EQUITY_RECORD_DATE'] is not None else ''
            dividdate = bn['EX_DIVIDEND_DATE'].split()[0] if bn['EX_DIVIDEND_DATE'] is not None else ''
            if dividdate == '':
                continue

            secode = bn['SECUCODE'].split('.')
            secode.reverse()
            code = ''.join(secode)
            if self.code is None:
                if self.latestBn is None:
                    self.latestBn = self.sqldb.select(self.tablename, [f'{column_code}', '除权除息日期'], f'登记日期>="{Utils.today_date()}"')
                if (code, dividdate) in self.latestBn:
                    continue
            values.append([code, rptdate, rcddate, dividdate, bn['ASSIGN_PROGRESS'],
                bn['BONUS_IT_RATIO'], bn['BONUS_RATIO'], bn['IT_RATIO'], bn['PRETAX_BONUS_RMB'], bn['DIVIDENT_RATIO'],
                bn['BASIC_EPS'], bn['BVPS'], bn['TOTAL_SHARES'], bn['IMPL_PLAN_PROFILE']])

        if len(values) > 0:
            self.sqldb.insertMany(self.tablename, [c['col'] for c in self.colheaders], values)

    def dividenDateLaterThan(self, code, date):
        if date is None:
            date = Utils.today_date()
        brows = self.sqldb.selectOneValue(self.tablename, 'count(*)', [f'除权除息日期 > "{date}"', f'{column_code}="{code}"'])
        if brows is None:
            return False
        return brows > 0

    def dividenDetailsLaterThan(self, date=None):
        if date is None:
            date = Utils.today_date()
        return self.sqldb.select(self.tablename, conds=f'登记日期 > "{date}"')

    def getBonusHis(self, code):
        brows = self.sqldb.selectOneValue(self.tablename, 'count(*)', f'{column_code}="{code}"')
        if brows is not None and brows > 0:
            return self.sqldb.select(self.tablename, fields=[col['col'] for col in self.colheaders[1:]], conds=f'{column_code}="{code}"')
        return []


class FundShareBonus(StockShareBonus):
    ''' get bonus share data for fund
    ref: https://fundf10.eastmoney.com/fhsp_510050.html
    '''
    def __init__(self) -> None:
        super().__init__()

    def setCode(self, code):
        self.sg = StockGlobal.stock_general(code)
        self.code = self.sg.code
        self.bnData = []

    def getUrl(self):
        dcode = self.code[2:]
        return f'''https://fundf10.eastmoney.com/fhsp_{dcode}.html'''

    def getNext(self, params=None, proxies=None):
        fhsp = self.getRequest(params, proxies)
        soup = BeautifulSoup(fhsp, 'html.parser')
        fhTable = soup.find('table', {'class':'w782 comm cfxq'})
        self.fecthed = []
        if fhTable is not None:
            rows = fhTable.find_all('tr')
            for r in rows:
                tr = r.find_all('td')
                if len(tr) < 4:
                    continue
                rcddate = tr[1].get_text()
                rptdate = rcddate
                dividdate = tr[2].get_text()
                detail = tr[3].get_text()
                fh = re.findall(r'-?\d+\.?\d*', detail)[0]
                fh = 10 * float(fh)
                self.fecthed.append([self.code, rptdate, rcddate, dividdate, '', 0, 0, 0, fh, 0, 0, 0, 0, detail])

        self.saveFetched()

    def saveFetched(self):
        if len(self.fecthed) == 0:
            return
        attrs = [col['col'] for col in self.colheaders]
        self.sqldb.insertUpdateMany(self.tablename, attrs, [ch['col'] for ch in self.colheaders[0:2]], self.fecthed)
        self.fecthed = []

    def getBonusHis(self, code):
        brows = self.sqldb.selectOneValue(self.tablename, 'count(*)', f'{column_code}="{code}"')
        if brows is None or brows == 0:
            self.setCode(code)
            self.getNext()
        return self.sqldb.select(self.tablename, fields=[col['col'] for col in self.colheaders[1:]], conds=f'{column_code}="{code}"')
