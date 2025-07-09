from __future__ import annotations
import asyncio
import traceback
import json
import requests
import concurrent, concurrent.futures
from functools import lru_cache
from threading import Lock
from typing import Dict, List, ClassVar, Optional, TYPE_CHECKING
from urllib.parse import urlencode
from functools import cached_property
from datetime import datetime, timedelta
import stockrt as asrt
from app.logger import logger
from app.guang import guang
from app.klpad import klPad
from app.watcher_base import *
from app.trade_interface import TradeInterface

if TYPE_CHECKING:
    from app.strategy_factory import StrategyFactory


class iunCloud:
    dserver = None
    strFac: ClassVar[StrategyFactory] = None
    @staticmethod
    @lru_cache(maxsize=None)
    def get_watcher(name) -> Watcher_Once:
        if name == 'aucsnaps':
            return AuctionSnapshot_Watcher()
        if name == 'stkchanges':
            return StkChanges_Watcher()
        if name == 'bkchanges':
            return BKChanges_Watcher()
        if name == 'stkzdf':
            return StkZdf_Watcher()
        if name == 'end_fundflow':
            return EndFundFlow_Watcher()
        if name == 'kline1':
            return Stock_Klinem_Watcher(1)
        if name == 'kline15':
            return Stock_Klinem_Watcher(15, ['9:44:55', '13:14:50'], ['11:30:1', '14:57:1'])
        if name == 'klineday':
            return Stock_KlineDay_Watcher()
        if name == 'quotes':
            return Stock_Quote_Watcher()
        raise ValueError(f"Unknown watcher: {name}")

    __save_db = True
    @classmethod
    def disable_save_db(cls):
        cls.__save_db = False

    @classmethod
    def save_db_enabled(cls):
        return cls.__save_db

    @staticmethod
    def iun_str_conf(ikey):
        return TradeInterface.iun_str()[ikey]

    @staticmethod
    def is_rzrq(code):
        if TradeInterface.tserver is None:
            return False
        return TradeInterface.is_rzrq(code)

    @staticmethod
    def get_hold_account(code, account):
        if account == '':
            return 'collat' if iunCloud.is_rzrq(code) else 'normal'
        if account == 'credit':
            return 'collat'
        return account

    __bk_ignored = None
    @classmethod
    def is_bk_ignored(self, bk):
        if self.__bk_ignored is None:
            url = guang.join_url(iunCloud.dserver, 'stock')
            params = {
                'act': 'bk_ignored',
            }
            self.__bk_ignored = json.loads(guang.get_request(url, params=params))
        return bk in self.__bk_ignored

    @staticmethod
    @lru_cache(maxsize=1)
    def black_list():
        # ST股 B股
        return iunCloud.get_bk_stocks('BK0511') + iunCloud.get_bk_stocks('BK0636')

    @classmethod
    def is_stock_blacked(self, code):
        return code[-6:] in self.black_list()

    __dividen = None
    @classmethod
    def to_be_divided(self, code):
        if self.__dividen is None:
            url = guang.join_url(iunCloud.dserver, 'stock')
            params = {
                'act': 'planeddividen',
                'date': guang.today_date('-')
            }
            dividedetails = json.loads(guang.get_request(url, params=params))
            d35 = (datetime.now() + (timedelta(days=2) if datetime.now().day < 3 else timedelta(days=4))).strftime('%Y-%m-%d')
            self.__dividen = [d[1][-6:] for d in dividedetails if d[3] <= d35]
        return code[-6:] in self.__dividen

    __stock_bks = {}
    @classmethod
    def get_stock_bks(self, code):
        code = code[-6:]
        if code not in self.__stock_bks:
            url = guang.join_url(iunCloud.dserver, 'stock')
            params = {
                'act': 'stockbks',
                'stocks': code
            }
            bks = json.loads(guang.get_request(url, params=params))
            for c, b in bks.items():
                self.__stock_bks[c[-6:]] = [_b[0] for _b in b]
        return self.__stock_bks[code]

    @classmethod
    @lru_cache(maxsize=100)
    def get_bk_stocks(self, bk):
        url = guang.join_url(iunCloud.dserver, 'stock')
        params = {
            'act': 'bkstocks',
            'bks': bk
        }
        stks = json.loads(guang.get_request(url, params=params))
        return stks[bk] if bk in stks else []

    @staticmethod
    @lru_cache(maxsize=1)
    def zt_recently():
        url = guang.join_url(iunCloud.dserver, 'stock')
        params = {
            'act': 'ztstocks',
            'days': 3
        }
        return [c[-6:] for c in json.loads(guang.get_request(url, params=params))]

    @classmethod
    def recent_zt(self, code):
        return code[-6:] in self.zt_recently()

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hotstocks():
        url = guang.join_url(iunCloud.dserver, 'stock')
        params = {
            'act': 'hotstocks',
            'days': 5
        }
        return json.loads(guang.get_request(url, params=params))

    @staticmethod
    def get_stock_fflow(code, date=None, date1=None):
        """
        Get the stock's main fund flow data from eastmoney.

        Parameters:
            code (str): The stock code, e.g. '600777'.

            date (str): The start date of the data, e.g. '2025-04-09'.

            date1 (str): The end date of the data, e.g. '2025-04-09'.

        Returns:
        list: A list of lists, each contains the date and the main fund flow data of the stock.
        [日期, 主力, 小单, 中单, 大单, 超大单 (净流入/占比)]
        [['2025-04-09', '-18626339.0', '7829801.0', '10796540.0', '15861618.0', '-34487957.0', '-5.70', '2.39', '3.30', '4.85', '-10.55', '2.66', '0.76', '0.00', '0.00']]
        Example:
        >>> iunCloud.get_stock_fflow('600777', '2025-04-09', '2025-04-09')
        """
        url = guang.join_url(iunCloud.dserver, 'stock_fflow')
        params = {
            'code': code,
            'date': date,
        }

        fflow = json.loads(guang.get_request(url, params=params))
        values = [f[1:] for f in fflow if date is None or f[1] >= date and (date1 is None or f[1] <= date1)]
        return values

    @staticmethod
    def get_stocks_zdfrank(minzdf=None):
        # http://quote.eastmoney.com/center/gridlist.html#hs_a_board
        pn = 1
        po = 1 if minzdf is None or minzdf > 0 else 0
        zdfranks = []
        pgsize = 1000
        fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
        fields = 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'
        if minzdf is not None:
            pgsize = 200
        while True:
            rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz={pgsize}&po={po}&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs={fs}&fields={fields}'''
            res = guang.get_request(rankUrl, headers=guang.em_headers('33.push2.eastmoney.com'))
            if res is None:
                break

            r = json.loads(res)
            if r['data'] is None or len(r['data']['diff']) == 0:
                break

            zdfranks += [rk for rk in r['data']['diff'] if rk['f3'] != '-']
            if len(zdfranks) == 0:
                break
            if minzdf is not None and abs(zdfranks[-1]['f3']) < abs(minzdf):
                break
            pn += 1
        return zdfranks

    @staticmethod
    def get_zdfb():
        try:
            fburl = 'https://push2ex.eastmoney.com/getTopicZDFenBu?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt'
            zdfb = json.loads(guang.get_request(fburl, headers=guang.em_headers('push2ex.eastmoney.com')))['data']['fenbu']
            fbdic = {}
            [fbdic.update(d) for d in zdfb]
            up = sum([fbdic[k] for k in fbdic if int(k) > 0])
            down = sum([fbdic[k] for k in fbdic if int(k) < 0])
            fbdic.update({'up': up, 'down': down})
            return fbdic
        except:
            logger.error('get_zdfb error')

    __ranklock = Lock()
    @classmethod
    @lru_cache(maxsize=1)
    def get_open_hotranks(cls):
        with cls.__ranklock:
            emrk_url = ('http://datacenter-web.eastmoney.com/wstock/selection/api/data/get?'
                'type=RPTA_PCNEW_STOCKSELECT&sty=POPULARITY_RANK,NEWFANS_RATIO&filter='
                '(POPULARITY_RANK>0)(POPULARITY_RANK<=100)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)'
                '&p=1&ps=100&st=POPULARITY_RANK&sr=1&source=SELECT_SECURITIES&client=WEB')
            jdata = json.loads(guang.get_request(emrk_url))
            if not jdata or jdata['code'] != 0 or 'result' not in jdata or 'data' not in jdata['result']:
                rkurl = guang.join_url(iunCloud.dserver, 'stock?act=hotrankrt&rank=40')
                jdata = [ {'SECURITY_CODE': x[0], 'POPULARITY_RANK': x[1], 'NEWFANS_RATIO': x[2]} for x in json.loads(guang.get_request(rkurl))]
            else:
                jdata = jdata['result']['data']

            rkdict = {}
            for rk in jdata:
                code = rk['SECURITY_CODE']
                rkdict[code] = {'rank': rk['POPULARITY_RANK'], 'newfans': rk['NEWFANS_RATIO']}
            return rkdict

    @classmethod
    @lru_cache(maxsize=1)
    def get_dailyzdt(cls):
        '''
        获取最近10天的涨停数据
        Returns:
        [date, ztcount, zt0cnt, dtcount]
        '''
        url = guang.join_url(iunCloud.dserver, 'stock?act=zdtemot&days=10')
        return json.loads(guang.get_request(url))


class BaseStrategy:
    async def start_strategy_tasks(self):
        assert hasattr(self, 'watcher'), 'watcher not set!'
        self.watcher.add_listener(self)
        await self.watcher.start_strategy_tasks()

    async def on_watcher(self, params):
        pass

    def on_taskstop(self):
        pass


class StockStrategy(BaseStrategy):
    def __init__(self):
        self.accstocks = []
        self.watchers = []

    def add_stock(self, acc, code):
        if (acc, code) not in self.accstocks:
            self.accstocks.append((acc, code))
        for w in self.watchers:
            w.add_stock(code)

    def remove_stock(self, acc, code, watcher=None):
        if (acc, code) in self.accstocks:
            self.accstocks.remove((acc, code))
        if watcher is not None:
            watcher.remove_stock(code)
        else:
            for w in self.watchers:
                w.remove_stock(code)

    async def start_strategy_tasks(self):
        for w in self.watchers:
            w.add_listener(self)
            await w.start_strategy_tasks()

    async def on_watcher(self, params):
        for code in params:
            kltypes = params[code]
            if not kltypes:
                continue
            if 30 in kltypes and code.startswith('5'):
                logger.info('StrategyI_Listener on_watcher %s %s %s', code, kltypes, klPad.get_klines(code, 30))
            for acc, acode in self.accstocks:
                if code == acode:
                    await self.check_kline(acc, code, kltypes)

    async def check_kline(self, acc, code, kltypes):
        # 这里可以添加K线检查的代码
        pass


class AuctionSnapshot_Watcher(Watcher_Cycle):
    auction_quote = {}
    def __init__(self):
        super().__init__(['9:20:2'], ['9:25:8'])
        w2 = Watcher_Once('9:24:53', False)
        w2.execute_task = self.notify_auctions1
        w3 = Watcher_Once('9:25:16', False)
        w3.execute_task = self.notify_auctions2
        w1 = Watcher_Once('9:20:1', guang.delay_seconds(w3.btime) > 0)
        w1.execute_task = self.check_dt_ranks
        self.simple_watchers = [w1, w2, w3]
        self.matched = []

    async def check_dt_ranks(self):
        logger.info('check_dt_ranks')
        res = guang.get_request('http://33.push2.eastmoney.com/api/qt/clist/get', params={
            'pn': 1,
            'pz': 100,
            'po': 0,
            'np': 1,
            'ut': 'bd1d9ddb04089700cf9c27f6f7426281',
            'fltt': 2,
            'invt': 2,
            'wbp2u': '|0|0|0|web',
            'fid': 'f3',
            'fs': 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
            'fields': 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'
        }, headers=guang.em_headers('33.push2.eastmoney.com'))
        if res is None:
            return

        r = json.loads(res)
        if r['data'] is None or len(r['data']['diff']) == 0:
            return

        dtcodes = []
        for rkobj in r['data']['diff']:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            ze = rkobj['f4']  # 涨跌额
            if c == '-' or zd == '-' or ze == '-' or zd > -8:
                continue
            cd = rkobj['f12'] # 代码
            lclose = rkobj['f18']
            topprc = guang.zt_priceby(lclose, zdf=guang.zdf_from_code(cd))
            bottomprc = guang.dt_priceby(lclose, zdf=guang.zdf_from_code(cd))
            m = rkobj['f13']  # 市场代码 0 深 1 沪
            self.auction_quote[cd] = {
                'quotes': self.get_trends(f'{m}.{cd}'), 'lclose': lclose,
                'topprice': topprc, 'bottomprice': bottomprc}
            dtcodes.append(cd)

        url = guang.join_url(iunCloud.dserver, 'stock') + '?act=zdtindays&codes=' + ','.join(dtcodes) + '&date=' + guang.today_date('-')
        zddaysdt = json.loads(guang.get_request(url))
        for code, zddays in zddaysdt.items():
            code = code[-6:]
            if not self.auction_quote[code]:
                continue
            self.auction_quote[code]['zddays'] = zddays

    def get_trends(self, secid):
        trends_data = guang.get_request('http://push2his.eastmoney.com/api/qt/stock/trends2/get', params={
            'fields1': 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
            'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58',
            'ut': 'fa5fd1943c7b386f172d6893dbfba10b',
            'ndays': 1,
            'iscr': 1,
            'iscca': 0,
            'secid': secid
        }, headers=guang.em_headers('push2his.eastmoney.com'))

        trends_data = json.loads(trends_data)
        trends = []
        if 'data' in trends_data and 'trends' in trends_data['data']:
            for trd in trends_data['data']['trends']:
                trds = trd.split(',')
                ttime = trds[0].split()[1]
                trends.append([ttime, float(trds[1]), 0, 0])
                if trds[2] != trds[1]:
                    trends.append([ttime+':01', float(trds[2]), 0, 0])

        return trends[1:]

    async def execute_task(self):
        while self.task_running:
            quotes = asrt.quotes5(list(self.auction_quote.keys()))
            self.cache_quotes(quotes)
            await asyncio.sleep(5)

    def cache_quotes(self, quotes):
        for code, quote in quotes.items():
            try:
                price = quote['price']
                if quote['open'] == 0 and quote['bid1'] == quote['ask1']:
                    price = quote['bid1']
                    matched_vol = quote['bid1_volume']
                    buy2_count = quote['bid2_volume']
                    sell2_count = quote['ask2_volume']
                    unmatched_vol = buy2_count if buy2_count > 0 else -sell2_count
                else:
                    matched_vol = quote['volume']
                    unmatched_vol = 0
                    if quote['price'] == quote['bid1']:
                        unmatched_vol = quote['bid1_volume']
                    elif quote['price'] == quote['ask1']:
                        unmatched_vol = -quote['ask1_volume']
                self.auction_quote[code]['quotes'].append([quote['time'], price, matched_vol, unmatched_vol])
            except Exception as e:
                logger.error('exception in cache autcion quotes: %s, %s', code, quote)
                logger.error(traceback.format_exc())

    async def notify_auctions1(self):
        await self.notify_change({'quotes': self.auction_quote, 'uppercent': 5})

    async def notify_auctions2(self):
        await self.notify_change({'quotes': self.auction_quote, 'uppercent': 2})

    async def stop_simple_task(self, delay=0):
        await super().stop_simple_task(delay)
        if iunCloud.save_db_enabled():
            aucurl = guang.join_url(iunCloud.dserver, 'stock')
            today = guang.today_date('-')
            guang.post_data(aucurl, data={'act': 'save_auction_details', 'date': today, 'auctions': json.dumps(self.auction_quote)})

            values = []
            for c in self.auction_quote:
                if c not in self.matched:
                    continue
                q = self.auction_quote[c]
                if q['topprice'] == '-' and q['bottomprice'] == '-':
                    continue
                zdays, zdist, ddays, ddist = q['zddays']
                values.append([c, today, q['topprice'], q['bottomprice'], zdays, zdist, ddays, ddist])

            aucmatchurl = guang.join_url(iunCloud.dserver, 'stock')
            guang.post_data(aucmatchurl, data={'act': 'save_auction_matched', 'matched': json.dumps(values)})


class StkZdf_Watcher(Watcher_Cycle):
    ''' 个股涨幅排行,仅获取涨跌幅>=8%
    '''
    def __init__(self):
        super().__init__(['9:30:1', '13:00:1'], ['11:30:1', '14:57:1'])
        self.period = 60
        self.min_zdf = 8
        self.full_zdf = []

    async def execute_task(self):
        while self.task_running:
            try:
                await self.get_zdf()
            except ConnectionError as e:
                if hasattr(e, 'request') and e.request is not None:
                    logger.error(f'ConnectionError: {e.request.url}')
                logger.error(f'ConnectionError: {e}')
            except Exception as e:
                logger.error(e)
                logger.error(traceback.format_exc())
            await asyncio.sleep(self.period)

    async def get_zdf(self):
        zdfranks = iunCloud.get_stocks_zdfrank(self.min_zdf)
        full_zdf = []
        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            if c == '-' or zd == '-':
                continue
            if zd < self.min_zdf:
                break
            code = rkobj['f12'] # 代码
            lc = rkobj['f18'] # 昨收
            full_zdf.append([code, zd, c, lc])
        self.full_zdf = full_zdf
        if len(self.full_zdf) == 0:
            return

        await self.notify_change(self.full_zdf)


class StkChanges_Watcher(Watcher_Cycle):
    ''' 盘中异动
    '''
    def __init__(self):
        super().__init__(['9:30:1', '13:00:1'], ['11:30:1', '14:57:1'])
        self.changes_period = 60
        self.exist_changes = set()
        self.chg_pagesize = 1000
        self.session = None

    async def execute_task(self):
        while self.task_running:
            try:
                await self.get_changes()
            except Exception as e:
                logger.error('%s %s', self.__class__.__name__, e)
                logger.error(traceback.format_exc())
            await asyncio.sleep(self.changes_period)

    async def get_changes(self, types=None):
        self.chg_page = 0
        self.fecthed = []
        self.get_next_changes(types)
        self.fecthed.reverse()
        await self.notify_change(self.fecthed)
        if 0 < len(self.fecthed) < self.chg_pagesize:
            logger.info(f'fecthed {len(self.fecthed)}')
            self.chg_pagesize = max(64, len(self.fecthed))

    def get_next_changes(self, types=None):
        if types is None:
            types = '8213,8201,8193,8194,64,128,4,16'
        # 60日新高,火箭发射, 大笔买入, 大笔卖出, 有大买盘, 有大卖盘, 封涨停板, 打开涨停板
        url = f'https://push2ex.eastmoney.com/getAllStockChanges?type={types}&cb=&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex={self.chg_page}&pagesize={self.chg_pagesize}&dpt=wzchanges&_={guang.time_stamp()}'
        if self.session is None:
            self.session = requests.Session()
            self.session.timeout = 5
            headers = guang.em_headers('push2ex.eastmoney.com')
            headers['Accept-Encoding'] = 'gzip, deflate, br, zstd'
            headers['Priority'] = 'u=4'
            headers['Referer'] = 'https://quote.eastmoney.com/changes/'
            self.session.headers.update(headers)
        rsp = self.session.get(url)
        chgs = rsp.json()
        if 'data' not in chgs or chgs['data'] is None:
            return

        if 'allstock' in chgs['data']:
            self.merge_fetched(chgs['data']['allstock'])

        if len(self.fecthed) + len(self.exist_changes) < chgs['data']['tc']:
            self.chg_page += 1
            self.get_next_changes(types)

    def merge_fetched(self, changes):
        f2ch = ['00', '60', '30', '68', '83', '87', '43', '92', '90', '20']
        for chg in changes:
            code = chg['c']
            if code[0:2] not in f2ch:
                logger.warning(f'unknown code {chg}')
                continue
            tm = str(chg['tm']).rjust(6, '0')
            ftm = f'{tm[0:2]}:{tm[2:4]}:{tm[4:6]}'
            tp = chg['t']
            info = chg['i']
            if (code, ftm, tp) not in self.exist_changes:
                self.fecthed.append([code, ftm, tp, info])
                self.exist_changes.add((code, ftm, tp))


class BKChanges_Watcher(Watcher_Cycle):
    ''' 板块异动
    '''
    def __init__(self):
        super().__init__(['9:30:45', '12:50:45'], ['11:30', '15:1:5'])
        self.changes_period = 600
        self.bkchghis = None
        self.clsbkhis = None

    @cached_property
    def topbks5(self):
        url = guang.join_url(iunCloud.dserver, 'stock')
        params = {
            'act': 'hotbks',
            'days': 5
        }
        rsp = guang.get_request(url, params=params)
        return json.loads(rsp)

    def is_topbk5(self, bk):
        return bk in self.topbks5

    async def execute_task(self):
        while self.task_running:
            try:
                await self.get_changes()
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())
            await asyncio.sleep(self.changes_period)

    async def get_changes(self):
        bkchgurl = guang.join_url(iunCloud.dserver, 'stock')
        params = {
            'act': 'rtbkchanges',
            'save': 1
        }
        rsp = guang.get_request(bkchgurl, params=params)
        bks = json.loads(rsp)
        if len(bks) == 0:
            logger.info(f'{__class__.__name__} StockBkChangesHistory get bk changes empty')
            return
        await self.notify_change(bks)


class EndFundFlow_Watcher(Watcher_Once):
    ''' 主力资金流
    '''
    def __init__(self):
        super().__init__('14:57:55', False)

    def updateLatestFflow(self):
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
        FS = 'fs=m:0+t:6+f:!2,m:0+t:13+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2'
        date = guang.today_date('-')
        headers = guang.em_headers('push2.eastmoney.com')
        headers['Referer'] = 'https://data.eastmoney.com/zjlx/detail.html'
        mainflows = []

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
                secid = f"{fobj['f13']}.{fobj['f12']}"
                mainflows.append([secid, date, fobj['f62'], fobj['f184']])

        # 获取第一页数据并确定总页数
        first_page_diff, total = process_response(guang.get_request(build_url(1), headers=headers))
        if not first_page_diff:
            return mainflows

        add_mainflow(first_page_diff)

        # 计算总页数 (修正点)
        total_pages = max(1, (total + DEFAULT_PAGE_SIZE - 1) // DEFAULT_PAGE_SIZE)
        if total_pages <= 1:
            return mainflows

        # 使用线程池并发获取剩余页面
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(
                    lambda p: add_mainflow(process_response(guang.get_request(build_url(p), headers))[0]), 
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

        return mainflows

    async def execute_task(self):
        mflow = self.updateLatestFflow()
        await self.notify_change(mflow)


class Stock_KlineDay_Watcher(Watcher_Once, Stock_Rt_Watcher):
    def __init__(self):
        super().__init__('14:56:55', False)
        Stock_Rt_Watcher.__init__(self)

    async def execute_task(self):
        codes = [c for c in self.codes if self.codes[c] > 0]
        klines = asrt.klines(codes, kltype=101, length=32)
        chgklt = {}
        for c in klines:
            chgklt[c] = klPad.cache(c, klines[c], kltype=101)
        await self.notify_change(chgklt)


class KlineJobProcess(JobProcess):
    def __init__(self, task_queue, result_queue, period, klt):
        super().__init__(task_queue, result_queue, period)
        self.klt = klt

    def process_job(self, codes: List[str]) -> Dict:
        asrt.set_array_format('df')
        return asrt.klines(codes, kltype=self.klt, length=32)


class Stock_Klinem_Watcher(SubProcess_Watcher_Cycle):
    def __init__(self, m=1, btime=None, etime=None):
        if btime is None:
            btime = ['9:31:05', '13:00:50']
        if etime is None:
            etime = ['11:30:1', '14:57:1']
        SubProcess_Watcher_Cycle.__init__(self, m*60, btime, etime)
        self.klt = m

    def create_subprocess(self):
        return KlineJobProcess(self.task_queue, self.result_queue, self.period,self.klt)

    async def handle_process_result(self, result):
        if not result:
            logger.warning("Received empty kline data")
            return

        try:
            chgklt = {}
            for c in result:
                chgklt[c] = klPad.cache(c, result[c], kltype=self.klt)
            if chgklt:
                await self.notify_change(chgklt)
        except Exception as e:
            logger.error(f"Error processing kline data: {e}")
            logger.error(traceback.format_exc())
            # TODO: 如果数据处理出错，可以考虑重启进程


class QuoteJobProcess(JobProcess):
    def process_job(self, codes: List[str]) -> Dict:
        return asrt.quotes(codes)

class Stock_Quote_Watcher(SubProcess_Watcher_Cycle):
    def __init__(self):
        SubProcess_Watcher_Cycle.__init__(self, 5, ['9:30:1', '13:00'], ['11:30', '14:57'])

    def create_subprocess(self):
        return QuoteJobProcess(self.task_queue, self.result_queue, self.period)

    async def handle_process_result(self, result):
        if not result:
            logger.warning("Received empty quote data")
            return

        try:
            codes = []
            for c in result:
                if result[c] is None:
                    continue
                klPad.cache(c, quotes=result[c])
                codes.append(c)
            await self.notify_change(codes)
        except Exception as e:
            logger.error(f"Error processing quote data: {e}")
            logger.error(traceback.format_exc())
            # TODO: 如果数据处理出错，可以考虑重启进程
