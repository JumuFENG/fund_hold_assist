# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history.stock_history import StockGlobal
import re


class StockZtInfo(EmRequest):
    '''涨停
    ref: http://quote.eastmoney.com/ztb/detail#type=ztgc
    '''
    def __init__(self) -> None:
        super().__init__()
        self.urlroot = f'http://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&sort=fbt%3Aasc&Pageindex=0&dpt=wz.ztzt&date='
        self.date = None
        self.fetchedDate = None

    def setDate(self, date):
        self.date = date
        self.fetchedDate = None
        self.page = 1
        self.ztdata = {}

    def getUrl(self):
        if self.date is None:
            self.date = Utils.today_date('%Y%m%d')
        return self.urlroot + self.date

    def getNext(self):
        emback = json.loads(self.getRequest())
        if emback is None or emback['data'] is None:
            print('StockZtInfo invalid response!', emback)
            if self.date < Utils.today_date('%Y%m%d'):
                self.date = (datetime.strptime(self.date, '%Y%m%d') + timedelta(days=1)).strftime("%Y%m%d")
                return self.getNext()
            return

        date = datetime.strptime(self.date, "%Y%m%d").strftime('%Y-%m-%d')
        for ztobj in emback['data']['pool']:
            code = StockGlobal.full_stockcode(ztobj['c']) # code
            hsl = ztobj['hs'] # 换手率 %
            fund = ztobj['fund'] # 封单金额
            zbc = ztobj['zbc'] # 炸板次数
            lbc = ztobj['lbc'] 
            zdf = ztobj['zdp']
            hybk = ztobj['hybk'] # 行业板块
            # other sections: c->code, n->name, m->market(0=SZ,1=SH), p->涨停价*1000, zdp->涨跌幅,
            # amount->成交额, ltsz->流通市值, tshare->总市值, lbc->连板次数, fbt->首次封板时间, lbt->最后封板时间
            # zttj->涨停统计 {days->天数, ct->涨停次数}
            self.ztdata[code] = [date, zdf, fund, hsl, lbc, zbc, hybk, '']
        self.fetchedDate = date


class StockZtInfo10jqka(StockZtInfo):
    '''涨停
    ref: http://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html
    '''
    def __init__(self) -> None:
        super().__init__()
        self.date = None
        self.fetchedDate = None
        self.pageSize = 15
        self.headers = {
            'Host': 'data.10jqka.com.cn',
            'Referer': 'http://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }

    def getUrl(self):
        if self.date is None:
            self.date = Utils.today_date('%Y%m%d')
        url = f'http://data.10jqka.com.cn/dataapi/limit_up/limit_up_pool?page={self.page}&limit={self.pageSize}&field=199112,330329,9001,330325,9002,133971,133970,1968584&filter=HS,GEM2STAR,ST&order_field=199112&order_type=0&date={self.date}'
        return url

    def setDate(self, date):
        super().setDate(date)
        self.ztdata = {}
        self.ztdata_kccy = {}
        self.ztdata_st = {}
        self.ztdata_bj = {}

    def getNext(self):
        jqkback = json.loads(self.getRequest(self.headers))
        if jqkback is None or jqkback['status_code'] != 0 or jqkback['data'] is None:
            self.fetchedDate = datetime.strptime(self.date, "%Y%m%d").strftime('%Y-%m-%d')
            print('StockZtInfo invalid response!', jqkback)
            return

        date = datetime.strptime(self.date, "%Y%m%d").strftime('%Y-%m-%d')
        for ztobj in jqkback['data']['info']:
            mt = ztobj['market_type']
            code = ztobj['code']
            code = StockGlobal.full_stockcode(code) # code
            hsl = ztobj['turnover_rate'] # 换手率 %
            fund = ztobj['order_amount'] # 封单金额
            zbc = 0 if ztobj['open_num'] is None else ztobj['open_num'] # 炸板次数
            lbc = 1 if ztobj['high_days'] is None or ztobj['high_days'] == '首板' else int(re.findall(r'\d+', ztobj['high_days'])[-1])
            zdf = ztobj['change_rate']
            cpt = ztobj['reason_type'] # 涨停原因
            ztrec = [date, zdf, fund, hsl, lbc, zbc, '', cpt]

            rzdf = round(zdf)
            if rzdf == 30:
                self.ztdata_bj[code] = ztrec
            elif rzdf == 20:
                self.ztdata_kccy[code] = ztrec
            elif rzdf == 5:
                self.ztdata_st[code] = ztrec
            else:
                self.ztdata[code] = ztrec
        # fields:
        # 199112(change_rate涨跌幅),330329(high_days几天几板),9001(reason_type涨停原因),330325(limit_up_type涨停形态),
        # 9002(open_num开板次数),133971(order_volume封单量),133970(order_amount封单额),1968584(turnover_rate换手率),
        # 330323(first_limit_up_time首次涨停时间),330324(last_limit_up_time最后涨停时间),3475914(currency_value流通市值),
        # 10(latest最新价),9003(limit_up_suc_rate近一年涨停封板率),9004(time_preview)

        if jqkback['data']['page']['count'] == jqkback['data']['page']['page']:
            self.fetchedDate = date
        else:
            self.page += 1
            self.getNext()


class StockZtLeadings(EmDataCenterRequest):
    ''' https://emrnweb.eastmoney.com/ztzt/Home?date=2023-04-03
    deprecated use StockZtInfo10jqka instead.
    '''
    def __init__(self) -> None:
        super().__init__()
        self.headers = {
            'Host': 'datacenter.eastmoney.com',
            'Referer': 'https://emrnweb.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        self.date = None
        self.fetchedDate = None

    def setDate(self, date):
        self.date = date
        self.fetchedDate = None
        self.page = 1

    def getNext(self, params=None, proxies=None):
        super().getNext(self.headers)

    def getUrl(self):
        return f'https://datacenter.eastmoney.com/securities/api/data/v1/get?source=SECURITIES&client=APP&reportName=RPT_INTSELECTION_LIMITSTOCKHIS&columns=SECUCODE,SECURITY_NAME_ABBR,BOARD_NAME,YIELD,LIMITUP_NUM,TURNOVERRATE&filter=(TRADE_DATE%3D%27{self.date}%27)&distinct=SECUCODE&pageNumber={self.page}&pageSize={self.pageSize}&sortTypes=-1&sortColumns=BOARD_YILD'

    def saveFecthed(self):
        self.ztdata = {}
        self.ztdata_kccy = {}
        self.ztdata_st = {}
        for sftch in self.fecthed:
            secode = sftch['SECUCODE'].split('.')
            secode.reverse()
            code = ''.join(secode)
            zdf = sftch['YIELD']
            fund = sftch['LIMITUP_NUM']
            hsl = sftch['TURNOVERRATE']
            rzdf = round(sftch['YIELD'])
            cpt = sftch['BOARD_NAME']
            ztrec = [self.date, zdf, fund, hsl, 1, 0, '', cpt]
            if rzdf == 20:
                self.ztdata_kccy[code] = ztrec
            elif rzdf == 5:
                self.ztdata_st[code] = ztrec
            else:
                self.ztdata[code] = ztrec
        self.fetchedDate = self.date


class StockZtConcepts(TableBase):
    def initConstrants(self):
        super().initConstrants()
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
        zthisttable = ['day_zt_stocks', 'day_zt_stocks_kccy'] #, 'day_zt_stocks_st']
        ztconceptsdata = []
        while date <= datetime.now().strftime(r'%Y-%m-%d'):
            pool = ()
            for ztable in zthisttable:
                pool += tuple(self.sqldb.select(ztable, [f'{column_code}, 板块, 概念'], [f'{column_date}="{date}"']))
            if pool is not None and len(pool) > 0:
                cdict = {}
                for c, bk, con in pool:
                    if con is None:
                        con = ''
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
