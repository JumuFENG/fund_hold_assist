import asyncio
import traceback
import json
import concurrent
from urllib.parse import urlencode
from functools import cached_property
import easyquotation as ezqt
from app.logger import logger
from app.guang import guang
from datetime import datetime, timedelta


class iunCloud:
    dserver = None
    __watchers = None
    @classmethod
    def get_watcher(self, name):
        if self.__watchers is None:
            self.__watchers = {}
        if name not in self.__watchers:
            if name == 'aucsnaps':
                self.__watchers[name] = StrategyI_AuctionSnapshot_Watcher()
            elif name == 'stkchanges':
                self.__watchers[name] = StrategyI_StkChanges_Watcher()
            elif name == 'bkchanges':
                self.__watchers[name] = StrategyI_BKChanges_Watcher()
            elif name == 'stkzdf':
                self.__watchers[name] = StrategyI_StkZdf_Watcher()
            elif name == 'end_fundflow':
                self.__watchers[name] = StrategyI_EndFundFlow_Watcher()
        return self.__watchers[name]

    __save_db = True
    @classmethod
    def disable_save_db(self):
        self.__save_db = False

    @classmethod
    def save_db_enabled(self):
        return self.__save_db

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

    __stock_blacked = None
    @classmethod
    def is_stock_blacked(self, code):
        if self.__stock_blacked is None:
            # ST股 B股
            self.__stock_blacked = iunCloud.get_bk_stocks('BK0511') + iunCloud.get_bk_stocks('BK0636')
        return code[-6:] in self.__stock_blacked

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

    __bk_stocks = {}
    @classmethod
    def get_bk_stocks(self, bk):
        if bk not in self.__bk_stocks:
            url = guang.join_url(iunCloud.dserver, 'stock')
            params = {
                'act': 'bkstocks',
                'bks': bk
            }
            stks = json.loads(guang.get_request(url, params=params))
            self.__bk_stocks[bk] = stks[bk] if bk in stks else []
        return self.__bk_stocks[bk]

    __zt_recents = None
    @classmethod
    def recent_zt(self, code):
        if self.__zt_recents is None:
            url = guang.join_url(iunCloud.dserver, 'stock')
            params = {
                'act': 'ztstocks',
                'days': 3
            }
            self.__zt_recents = [c[-6:] for c in json.loads(guang.get_request(url, params=params))]
        return code[-6:] in self.__zt_recents

    @staticmethod
    def get_stock_fflow(secid, date=None, date1=None):
        """
        Get the stock's main fund flow data from eastmoney.

        Parameters:
            secid (str): The stock's secid, e.g. '1.600777'.

            date (str): The start date of the data, e.g. '2025-04-09'.

            date1 (str): The end date of the data, e.g. '2025-04-09'.

        Returns:
        list: A list of lists, each contains the date and the main fund flow data of the stock.
        [日期, 主力, 小单, 中单, 大单, 超大单 (净流入/占比)]
        [['2025-04-09', '-18626339.0', '7829801.0', '10796540.0', '15861618.0', '-34487957.0', '-5.70', '2.39', '3.30', '4.85', '-10.55', '2.66', '0.76', '0.00', '0.00']]
        Example:
        >>> iunCloud.get_stock_fflow('1.600777', '2025-04-09', '2025-04-09')
        """
        url = 'https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get'
        params = {
            'lmt': 0,
            'klt': 101,
            'fields1': 'f1,f2,f3,f7',
            'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65',
            'ut': 'b2884a393a59ad64002292a3e90d46a5',
            'secid': secid
        }
        headers = guang.em_headers('push2his.eastmoney.com')
        headers['Referer'] = 'http://quote.eastmoney.com/'
        rsp = guang.get_request(url, headers, params)
        fflow = json.loads(rsp)
        if fflow is None or 'data' not in fflow or fflow['data'] is None or 'klines' not in fflow['data']:
            logger.error(rsp)
            return

        fflow = [f.split(',') for f in fflow['data']['klines']]
        if fflow is None or len(fflow) == 0:
            return

        values = []
        if date is None:
            date = '0'

        for f in fflow:
            if f[0] < date:
                continue
            if date1 is None or f[0] <= date1:
                values.append([f[0]] + [float(v) for v in f[1:-4]])

        return values

    @staticmethod
    def getStocksZdfRank(minzdf=None):
        # http://quote.eastmoney.com/center/gridlist.html#hs_a_board
        pn = 1
        zdfranks = []
        pgsize = 1000
        fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
        fields = 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'
        if minzdf is not None:
            pgsize = 200
        while True:
            rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn={pn}&pz={pgsize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs={fs}&fields={fields}'''
            res = guang.get_request(rankUrl, headers=guang.em_headers('33.push2.eastmoney.com'))
            if res is None:
                break

            r = json.loads(res)
            if r['data'] is None or len(r['data']['diff']) == 0:
                break

            zdfranks += [rk for rk in r['data']['diff'] if rk['f3'] != '-']
            if len(zdfranks) == 0:
                break
            if minzdf is not None and zdfranks[-1]['f3'] < minzdf:
                break
            pn += 1
        return zdfranks


class StrategyI_Listener:
    async def start_strategy_tasks(self):
        assert hasattr(self, 'watcher'), 'watcher not set!'
        self.watcher.add_listener(self)
        await self.watcher.start_strategy_tasks()

    async def on_watcher(self, params):
        pass

    def on_taskstop(self):
        pass

    def done(self):
        return self.watcher.done()


class StrategyI_Watcher_Once:
    def __init__(self, btime, exec_if_expired=True):
        self.listeners = []
        self.btime = btime
        self.exec_if_expired = exec_if_expired
        self.task_running = False
        self.task_stopped = False

    def add_listener(self, listener):
        self.listeners.append(listener)

    def remove_listener(self, listener):
        if listener in self.listeners:
            self.listeners.remove(listener)

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if guang.delay_seconds(self.btime) > 0:
            loop.call_later(guang.delay_seconds(self.btime), lambda: asyncio.ensure_future(self.start_simple_task()))
        else:
            if self.exec_if_expired:
                await self.execute_task()
            self.task_stopped = True

    async def start_simple_task(self):
        if self.task_running:
            return
        self.task_running = True
        try:
            await self.execute_task()
        except Exception as e:
            logger.error(f'{e}')
            logger.error(traceback.format_exc())
        self.task_stopped = True
        self.notify_stop()

    async def execute_task(self):
        pass

    async def notify_change(self, params):
        for listener in self.listeners:
            try:
                await listener.on_watcher(params)
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())

    def notify_stop(self):
        for listener in self.listeners:
            listener.on_taskstop()

    def done(self):
        return self.task_stopped


class StrategyI_Watcher_Cycle(StrategyI_Watcher_Once):
    def __init__(self, btime, etime=[]):
        '''
        btime和etime成对设置, 不要有重叠. 如果是一次性任务使用StrategyI_Watcher_Base

        @param btime: '09:30' / ['09:30', '13:00']
        @param etime: '15:01' / ['11:31', '15:01']
        '''
        super().__init__('')
        self.btime = [btime]
        if isinstance(btime, list) or isinstance(btime, tuple):
            self.btime = btime
        self.etime = [etime]
        if isinstance(etime, list) or isinstance(etime, tuple):
            self.etime = etime
        assert len(self.btime) == len(self.etime), 'btime and etime must have same length'
        self.task_running = False
        self.task_stopped = [False] * max(len(self.etime), 1)
        self.simple_watchers = []

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        for bt, et in zip(self.btime, self.etime):
            if guang.delay_seconds(et) > 0:
                if guang.delay_seconds(bt) < 0:
                    await self.start_simple_task()
                else:
                    loop.call_later(guang.delay_seconds(bt), lambda: asyncio.ensure_future(self.start_simple_task()))
                loop.call_later(guang.delay_seconds(et), self.stop_simple_task)
            else:
                self.stop_one_task()

        if len(self.simple_watchers) > 0:
            for w in self.simple_watchers:
                await w.start_strategy_tasks()

    async def start_simple_task(self):
        if self.task_running:
            return
        self.task_running = True
        try:
            await self.execute_task()
        except Exception as e:
            logger.error(f'{e}')
            logger.error(traceback.format_exc())

    async def execute_task(self):
        logger.info('execute cycle task')

    def stop_one_task(self):
        for i, stopped in enumerate(self.task_stopped):
            if not stopped:
                self.task_stopped[i] = True
                break

    def stop_simple_task(self):
        self.task_running = False
        self.stop_one_task()
        self.notify_stop()

    def done(self):
        if self.simple_watchers and len(self.simple_watchers) > 0:
            return all(self.task_stopped) and all([w.done() for w in self.simple_watchers])
        return all(self.task_stopped)


class StrategyI_AuctionSnapshot_Watcher(StrategyI_Watcher_Cycle):
    auction_quote = {}
    def __init__(self):
        super().__init__(['9:20:2'], ['9:25:8'])
        w2 = StrategyI_Watcher_Once('9:24:53', False)
        w2.execute_task = self.notify_auctions1
        w3 = StrategyI_Watcher_Once('9:25:16', False)
        w3.execute_task = self.notify_auctions2
        w1 = StrategyI_Watcher_Once('9:20:1', guang.delay_seconds(w3.btime) > 0)
        w1.execute_task = self.check_dt_ranks
        self.simple_watchers = [w1, w2, w3]

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
                trends.append([ttime, trds[1], 0, 0])
                if trds[2] != trds[1]:
                    trends.append([ttime+':01', trds[2], 0, 0])

        return trends[1:]

    async def execute_task(self):
        ezapi = ezqt.use('sina')
        while self.task_running:
            quotes = ezapi.real(list(self.auction_quote.keys()))
            self.cache_quotes(quotes)
            await asyncio.sleep(5)

    def cache_quotes(self, quotes):
        for code, quote in quotes.items():
            if 'price' not in quote and 'now' in quote:
                quote['price'] = quote['now']
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

    async def notify_auctions1(self):
        await self.notify_change({'quotes': self.auction_quote, 'uppercent': 5})

    async def notify_auctions2(self):
        await self.notify_change({'quotes': self.auction_quote, 'uppercent': 2})

    def stop_simple_task(self):
        super().stop_simple_task()
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


class StrategyI_StkZdf_Watcher(StrategyI_Watcher_Cycle):
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
            except Exception as e:
                logger.error(e)
                logger.error(traceback.format_exc())
            await asyncio.sleep(self.period)

    async def get_zdf(self):
        zdfranks = iunCloud.getStocksZdfRank(self.min_zdf)
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


class StrategyI_StkChanges_Watcher(StrategyI_Watcher_Cycle):
    ''' 盘中异动
    '''
    def __init__(self):
        super().__init__(['9:30:1', '13:00:1'], ['11:30:1', '14:57:1'])
        self.changes_period = 60
        self.exist_changes = set()

    async def execute_task(self):
        while self.task_running:
            try:
                await self.get_changes()
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())
            await asyncio.sleep(self.changes_period)

    async def get_changes(self, types=None):
        self.chg_page = 0
        self.chg_pagesize = 1000
        self.fecthed = []
        self.get_next_changes(types)

        await self.notify_change(self.fecthed)

    def get_next_changes(self, types=None):
        if types is None:
            types = '8213,8201,8193,8194,64,128,4,16'
        # 60日新高,火箭发射, 大笔买入, 大笔卖出, 有大买盘, 有大卖盘, 封涨停板, 打开涨停板
        url = f'http://push2ex.eastmoney.com/getAllStockChanges?type={types}&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex={self.chg_page}&pagesize={self.chg_pagesize}&dpt=wzchanges'
        headers = guang.em_headers('push2ex.eastmoney.com')
        headers['Referer'] = 'http://quote.eastmoney.com/changes/'
        chgs = json.loads(guang.get_request(url, headers))
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


class StrategyI_BKChanges_Watcher(StrategyI_Watcher_Cycle):
    ''' 板块异动
    '''
    def __init__(self):
        super().__init__(['9:30:45', '12:50:45'], ['11:30', '15:2:5'])
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


class StrategyI_EndFundFlow_Watcher(StrategyI_Watcher_Once):
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
        FS = 'fs=m:0+t:6+f:!2,m:0+t:13+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2,m:0+t:7+f:!2,m:1+t:3+f:!2'
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
        first_page_diff, total = process_response(guang.get_request(build_url(1)))
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
                    lambda p: add_mainflow(process_response(guang.get_request(build_url(p)))[0]), 
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
