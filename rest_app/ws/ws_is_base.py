# Python 3
# -*- coding:utf-8 -*-

import asyncio
import traceback
from datetime import timedelta
from utils import *
from history import StockGlobal, StockHotRank, StockEmBk, StockBkChangesHistory, StockChangesHistory, StockShareBonus
from history import StockDumps, StockClsBkChangesHistory, StockClsBk, StockBkMap
from pickup import StockZtDaily, StockZtLeadingSelector


def create_strategy_matched_message_direct_buy(match_data, subscribe_detail):
    account = subscribe_detail['account']
    amount = subscribe_detail['amount']
    code = match_data['code']
    price = round(float(match_data['price']), 2)
    dbmsg = {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': 0}
    if 'amtkey' not in subscribe_detail:
        dbmsg['count'] = Utils.calc_buy_count(amount, price)

    strategies = {
        "grptype": "GroupStandard",
        "strategies": {},
        "transfers": {},
        "amount": amount
    }
    strobjs = {
        "StrategySellELS": {"key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all", "topprice": round(price * 1.05, 2) },
        "StrategyGrid": { "key": "StrategyGrid", "enabled": False, "buycnt": 1, "stepRate": 0.05 },
        "StrategySellBE": { "key":"StrategySellBE", "enabled":False, "upRate": -0.03, "selltype":"all", "sell_conds": 8}
    }
    if 'strategies' in match_data:
        mstrategies = match_data['strategies']
        for i, mstr in enumerate(mstrategies):
            strategies['strategies'][i] = strobjs[mstr[0]]
            for k, v in mstr[1]:
                strategies['strategies'][i][k] = v
            strategies['transfers'][i] = { "transfer": "-1" }
    if 'amtkey' in subscribe_detail:
        strategies['uramount'] = {"key": subscribe_detail['amtkey']}
    dbmsg['strategies'] = strategies
    return dbmsg

def create_strategy_matched_message_zt_buy(match_data, subscribe_detail):
    account = subscribe_detail['account']
    amount = subscribe_detail['amount']
    code = match_data['code']
    price = round(float(match_data['price']), 2)
    dbmsg = {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': 0}
    dbmsg['count'] = Utils.calc_buy_count(amount, price)
    sels = { "key":"StrategySellELS", "enabled":False, "cutselltype":"all", "selltype":"all", "topprice": round(price * 1.05, 2) }
    if 'cutline' in match_data:
        sels['guardPrice'] = round(float(match_data['cutline']), 2)
    strategies = {
        "grptype": "GroupStandard",
        "strategies": {
            "0": sels,
            "1": { "key":"StrategyGrid", "enabled":False, "buycnt": 1, "stepRate": 0.05 },
            "2": { "key":"StrategySellBE", "enabled":False, "upRate": -0.03, "selltype":"all", "sell_conds": 8}
        },
        "transfers": { "0": { "transfer": "-1" }, "1": { "transfer": "-1" }, "2": { "transfer": "-1" }},
        "amount": amount
    }

    if 'amtkey' in subscribe_detail:
        strategies['uramount'] = {"key": subscribe_detail['amtkey']}
    dbmsg['strategies'] = strategies
    return dbmsg


class WsIsUtils():
    __watchers = None
    @classmethod
    def get_watcher(self, name):
        if self.__watchers is None:
            self.__watchers = {}
        if  name not in self.__watchers:
            if name == 'endauction':
                self.__watchers[name] = StrategyI_EndAuction_Watcher()
            elif name == 'stkchanges':
                self.__watchers[name] = StrategyI_StkChanges_Watcher()
            elif name == 'bkchanges':
                self.__watchers[name] = StrategyI_BKChanges_Watcher()
            elif name == 'hotrank':
                self.__watchers[name] = StrategyI_Hotrank_Watcher()
            elif name == 'hotrank_open':
                self.__watchers[name] = StrategyI_Hotrank_Once_Watcher('9:20:5')
            elif name == 'hotrank_close':
                self.__watchers[name] = StrategyI_Hotrank_Once_Watcher('14:55:50')
            elif name == 'snapshot_5m':
                self.__watchers[name] = StrategyI_Snapshot_Watcher()
            elif name == 'stkzt_open':
                self.__watchers[name] = StrategyI_StkZtChanges_Once_Watcher('9:25:05')
            elif name == 'sm_stats':
                self.__watchers[name] = StockMarket_Quote_Watcher()

        return self.__watchers[name]

    __save_db = True
    @classmethod
    def disable_save_db(self):
        self.__save_db = False

    @classmethod
    def save_db_enabled(self):
        return self.__save_db

    __stock_blacked = []
    @classmethod
    def setup_blacklist(self):
        bkstks = StockBkMap.bk_stocks(['BK0511', 'BK0636']) # ST股 B股

        # 退市整理期
        zdfranks = StockGlobal.getStocksZdfRank()
        for rk in zdfranks:
            if rk['f14'].startswith('退市') or rk['f14'].endswith('退'):
                bkstks.append(StockGlobal.full_stockcode(rk['f12']))
                continue
            if rk['f2'] == '-' or StockGlobal.full_stockcode(rk['f12']) in bkstks:
                continue
            if rk['f2'] < 1:
                zdf = 10
                if rk['f12'].startswith('30') or rk['f12'].startswith('68'):
                    zdf = 20
                elif 'ST' in rk['f14']:
                    zdf = 5
                if self.is_price_quit_risk(StockGlobal.full_stockcode(rk['f12']), rk['f2'], zdf):
                    bkstks.append(StockGlobal.full_stockcode(rk['f12']))

        bkstks = list(set(bkstks))
        self.__stock_blacked = [c[2:] for c in bkstks] + bkstks

    @classmethod
    def blacklist(self):
        if len(self.__stock_blacked) == 0:
            self.setup_blacklist()
        return self.__stock_blacked

    @classmethod
    def is_stock_blacked(self, code):
        if len(self.__stock_blacked) == 0:
            self.setup_blacklist()
        return code in self.__stock_blacked

    __zt_recents = []
    @classmethod
    def recent_zt(self, code):
        if len(self.__zt_recents) == 0:
            szbs = StockZtDaily()
            self.__zt_recents = szbs.dumpZtStocksInDays(3, False)
        return code in self.__zt_recents

    __zt_reached = []
    @classmethod
    def recent_zt_reached(cls, code):
        if len(cls.__zt_reached) == 0:
            chgtbl = StockChangesHistory()
            sdate = TradingDate.maxTradingDate()
            if sdate == Utils.today_date():
                cnt = 2
            else:
                cnt = 1
            i = 0
            while i < cnt:
                sdate = TradingDate.prevTradingDate(sdate)
                i += 1
            zr = chgtbl.sqldb.select(chgtbl.tablename, column_code, [f'{column_type}="4"', f'{column_date}>"{sdate}"'])
            cls.__zt_reached = set([c[2:] for c, in zr])
        return code in cls.__zt_reached

    __dividen = []
    @classmethod
    def to_be_divided(cls, code):
        if len(cls.__dividen) == 0:
            ssb = StockShareBonus()
            ddtl = ssb.sqldb.select(ssb.tablename, [column_code, '登记日期'], conds=f'登记日期 >= "{Utils.today_date()}"')
            d35 = (datetime.now() + (timedelta(days=2) if datetime.now().day < 3 else timedelta(days=4))).strftime('%Y-%m-%d')
            [cls.__dividen.append(c) for c, d in ddtl if d <= d35]
        return code in cls.__dividen

    __bk_stocks = {}
    @classmethod
    def update_bk_stocks(self, bks):
        if isinstance(bks, str):
            bks = [bks]
        assert isinstance(bks, list), "bks must be a list"
        for bk in bks:
            if bk.startswith('BK'):
                sbk = StockEmBk(bk)
            elif bk.startswith('cls'):
                sbk = StockClsBk(bk)
            else:
                Utils.log(f'format error for BK code: {bk}', Utils.Err)
                continue
            if WsIsUtils.save_db_enabled():
                self.__bk_stocks[bk] = sbk.fetchBkStocks()
                sbk.saveFetched()
            else:
                self.__bk_stocks[bk] = sbk.dumpDataByDate()

    @classmethod
    def get_bk_stocks(self, bk):
        if bk not in self.__bk_stocks:
            self.update_bk_stocks(bk)
        return self.__bk_stocks[bk]

    __kl_dump = None
    @classmethod
    def is_price_quit_risk(self, code, price, zdf=10):
        if price >= 1:
            return False
        if self.__kl_dump is None:
            self.__kl_dump = StockDumps()
        allkl = self.__kl_dump.read_kd_data(code, fqt=1, length=20)
        if allkl is None:
            return False
        allkl = [KNode(kl) for kl in allkl]
        lowdays = 0
        i = len(allkl) - 1
        while i >= 0 and allkl[i].close < 1:
            lowdays += 1
            i -= 1
        if lowdays == 0:
            return False
        leftdays = 20 - lowdays - 2 # 留2天buffer

        if price * pow((100+zdf)/100, leftdays) > 1:
            return False
        return True

    __leading_selector = StockZtLeadingSelector()
    @classmethod
    def get_fetch_results(self, wsmsg):
        query = wsmsg.get('query')
        result = {}
        if query == 'bkstocks':
            bks = wsmsg.get('bks')
            result['type'] = 'answer'
            result['query'] = query
            result['stocks'] = {bk:StockBkMap.bk_stocks(bk) for bk in bks}
        if query == 'hdstocks':
            try:
                bks = wsmsg.get('bks')
                start = wsmsg.get('start')
                result['type'] = 'answer'
                result['query'] = query
                result['main'] = wsmsg.get('main')
                bkstocks = StockBkMap.bk_stocks(bks)
                result['hdstocks'] = self.__leading_selector.getHeadedStocks(bkstocks, start)
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
        if query == 'stkchanges':
            result['type'] = 'answer'
            result['query'] = query
            watcher = self.get_watcher('stkchanges')
            if (len(watcher.full_changes)) == 0:
                watcher.read_latest_history_changes()
            result['changes'] = watcher.full_changes
        if query == 'sm_stats':
            result['type'] = 'answer'
            result['query'] = query
            watcher = self.get_watcher('sm_stats')
            result['stats'] = watcher.sm_statistics
        return result


class StrategyI_Listener:
    async def start_strategy_tasks(self):
        assert hasattr(self, 'watcher'), 'watcher not set!'
        self.watcher.add_listener(self)
        await self.watcher.start_strategy_tasks()

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_direct_buy(match_data, subscribe_detail)

    async def on_watcher(self, params):
        pass

    def on_taskstop(self):
        pass


class StrategyI_Watcher_Base:
    def __init__(self):
        self.listeners = []
        self.client_listeners = []

    def add_listener(self, listener):
        self.listeners.append(listener)

    def remove_listener(self, listener):
        if listener in self.listeners:
            self.listeners.remove(listener)

    def add_client_listener(self, listener):
        self.client_listeners.append(listener)

    async def notify_change(self, params):
        for listener in self.listeners:
            try:
                await listener.on_watcher(params)
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)

    def notify_stop(self):
        for listener in self.listeners:
            listener.on_taskstop()


class StrategyI_Simple_Watcher(StrategyI_Watcher_Base):
    def __init__(self, stime):
        super().__init__()
        self.stime = stime
        self.simple_task_running = False

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds(self.stime) > 0:
            loop.call_later(Utils.delay_seconds(self.stime), lambda: asyncio.ensure_future(self.start_simple_task()))
        else:
            Utils.log(f'{self.__class__.__name__} start time expired.', Utils.Warn)

    async def start_simple_task(self):
        if self.simple_task_running:
            return
        self.simple_task_running = True
        await self.execute_simple_task()

    async def execute_simple_task(self):
        pass


class StrategyI_EndAuction_Watcher(StrategyI_Simple_Watcher):
    ''' 尾盘竞价
    '''
    def __init__(self):
        super().__init__('14:59:52')

    async def execute_simple_task(self):
        zdfranks = StockGlobal.getStocksZdfRank()
        kquotes = []
        today = Utils.today_date()
        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            ze = rkobj['f4']  # 涨跌额
            cj = rkobj['f5']  # 成交量（手）
            ce = rkobj['f6']  # 成交额
            if c == '-' or cj == '-' or ce == '-' or zd == '-' or ze == '-':
                continue
            cd = rkobj['f12'] # 代码
            m = rkobj['f13']  # 市场代码 0 深 1 沪
            h = rkobj['f15']  # 最高
            l = rkobj['f16']  # 最低
            o = rkobj['f17']  # 今开
            lc = rkobj['f18'] # 昨收
            if (m != 0 and m != 1):
                Utils.log(f'invalid market {m}')
                continue
            code = StockGlobal.full_stockcode(cd)
            knode = KNode([0, today, c, h, l, o, ze, zd, cj, ce/10000, lc])
            kquotes.append([code, knode])
        await self.notify_change(kquotes)


class StrategyI_StkChanges_Watcher(StrategyI_Watcher_Base):
    ''' 盘中异动
    '''
    def __init__(self):
        super().__init__()
        self.changes_task_running = False
        self.changes_period = 60
        self.exist_changes = set()
        self.full_changes = []

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            loop.call_later(Utils.delay_seconds('9:30:1'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('11:30:1'), self.stop_changes_task)
            loop.call_later(Utils.delay_seconds('13:00:1'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('14:57:1'), self.stop_changes_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def start_changes_task(self):
        if self.changes_task_running:
            return
        self.changes_task_running = True
        while self.changes_task_running:
            try:
                await self.get_changes()
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(self.changes_period)

    def stop_changes_task(self):
        self.changes_task_running = False
        self.notify_stop()
        Utils.log('stop task for changes!')

    async def notify_change(self, params):
        await super().notify_change(params)
        if len(self.client_listeners) == 0:
            return

        notification = {'type': 'notification', 'subject': 'stkchanges' }
        notification['date'] = Utils.today_date()
        notification['changes'] = params
        for client in self.client_listeners[:]:
            try:
                await client.send(json.dumps(notification))
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
                self.client_listeners.remove(client)

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
        params = {
            'Host': 'push2ex.eastmoney.com',
            'Referer': 'http://quote.eastmoney.com/changes/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Accept': '/',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }

        chgs = json.loads(Utils.get_request(url, params))
        if 'data' not in chgs or chgs['data'] is None:
            return

        if 'allstock' in chgs['data']:
            self.merge_fetched(chgs['data']['allstock'])

        if len(self.fecthed) + len(self.exist_changes) < chgs['data']['tc']:
            self.chg_page += 1
            self.get_next_changes(types)

    def merge_fetched(self, changes):
        f2ch = ['00', '60', '30', '68', '83', '87', '43', '92', '90', '20']
        date = Utils.today_date()
        for chg in changes:
            code = chg['c']
            if code[0:2] not in f2ch:
                Utils.log(f'unknown code {chg}', Utils.Warn)
                continue
            tm = str(chg['tm']).rjust(6, '0')
            ftm = f'{tm[0:2]}:{tm[2:4]}:{tm[4:6]}'
            tp = chg['t']
            info = chg['i']
            if (code, ftm, tp) not in self.exist_changes:
                self.fecthed.append([code, ftm, tp, info])
                self.full_changes.append([code, f'{date} {ftm}', tp, info])
                self.exist_changes.add((code, ftm, tp))

    def read_latest_history_changes(self):
        sch = StockChangesHistory()
        self.full_changes = sch.dumpDataByDate()


class StrategyI_StkZtChanges_Once_Watcher(StrategyI_StkChanges_Watcher):
    ''' 个股异动, 单次
    '''
    def __init__(self, stime):
        super().__init__()
        self.stime = stime
        self.zttypes = '4'

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds(self.stime) > 0:
            loop.call_later(Utils.delay_seconds(self.stime), lambda: asyncio.ensure_future(self.start_changes_task()))
        else:
            Utils.log(f'{self.__class__.__name__} start time expired.', Utils.Warn)

    async def start_changes_task(self):
        if self.changes_task_running:
            return
        self.changes_task_running = True
        try:
            await self.get_changes(self.zttypes)
        except Exception as e:
            Utils.log(f'{e}', Utils.Err)
            Utils.log(traceback.format_exc(), Utils.Err)


class StrategyI_BKChanges_Watcher(StrategyI_StkChanges_Watcher):
    ''' 板块异动
    '''
    def __init__(self):
        super().__init__()
        self.changes_period = 600
        self.bkchghis = None
        self.clsbkhis = None
        self.topbks5 = []

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            if Utils.delay_seconds('9:16') > 0:
                loop.call_later(Utils.delay_seconds('9:16'), self.bk_changes_prepare)
            else:
                self.bk_changes_prepare()
            loop.call_later(Utils.delay_seconds('9:30:45'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('11:30'), self.stop_changes_task)
            loop.call_later(Utils.delay_seconds('12:50:45'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('15:2:5'), self.stop_changes_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    def bk_changes_prepare(self):
        if self.bkchghis is None:
            self.bkchghis = StockBkChangesHistory()
        if self.clsbkhis is None:
            self.clsbkhis = StockClsBkChangesHistory()
        WsIsUtils.update_bk_stocks(self.bkchghis.dumpDataByDate())
        WsIsUtils.update_bk_stocks(self.clsbkhis.dumpDataByDate())
        date = TradingDate.maxTradingDate()
        date = TradingDate.prevTradingDate(date)
        for i in range(5):
            self.topbks5 += self.bkchghis.dumpTopBks(date)
            self.topbks5 += self.clsbkhis.dumpTopBks(date)
            date = TradingDate.prevTradingDate(date)
        self.topbks5 = list(set(self.topbks5))

    def is_topbk5(self, bk):
        return bk in self.topbks5

    async def get_changes(self):
        if self.bkchghis is None:
            self.bkchghis = StockBkChangesHistory()
        if self.clsbkhis is None:
            self.clsbkhis = StockClsBkChangesHistory()
        bks = self.bkchghis.getLatestChanges()
        bks += self.clsbkhis.getLatestChanges()
        if len(bks) == 0:
            Utils.log(f'{__class__.__name__} StockBkChangesHistory get bk changes empty')
            return
        await self.notify_change(self.bkchghis.changesToDict(bks))

    def stop_changes_task(self):
        if self.clsbkhis is None:
            self.clsbkhis = StockClsBkChangesHistory()
        self.clsbkhis.updateBkChangedIn5Days()
        self.changes_task_running = False
        self.notify_stop()
        Utils.log('stop task for changes!')


class StrategyI_Hotrank_Watcher(StrategyI_Watcher_Base):
    hr_task_running = False
    hr_tgb_running = False
    shr = None

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            if Utils.delay_seconds('9:00') > 0:
                loop.call_later(Utils.delay_seconds('9:5:0'), lambda: asyncio.ensure_future(self.start_hotrank_tgb_task()))
            else:
                await self.update_hotrank_tgb()
                loop.call_later(Utils.delay_seconds('10:5:0'), lambda: asyncio.ensure_future(self.start_hotrank_tgb_task()))
            loop.call_later(Utils.delay_seconds('9:20:5'), lambda: asyncio.ensure_future(self.start_hotrank_task()))
            loop.call_later(Utils.delay_seconds('11:30:5'), self.stop_hotrank_task)
            loop.call_later(Utils.delay_seconds('13:00:0'), lambda: asyncio.ensure_future(self.start_hotrank_task()))
            loop.call_later(Utils.delay_seconds('13:00:0'), lambda: asyncio.ensure_future(self.start_hotrank_tgb_task()))
            loop.call_later(Utils.delay_seconds('14:57:1'), self.stop_hotrank_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def start_hotrank_task(self):
        if self.hr_task_running:
            return
        self.hr_task_running = True
        while self.hr_task_running:
            try:
                await self.update_hotranks()
                Utils.log(f'{__class__.__name__} update_hotranks')
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(600)

    async def start_hotrank_tgb_task(self):
        if self.hr_tgb_running:
            return
        self.hr_tgb_running = True
        while self.hr_tgb_running:
            try:
                await self.update_hotrank_tgb()
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(3600)

    async def update_hotranks(self):
        if self.shr is None:
            self.shr = StockHotRank()
        ranks = self.shr.getEmRanks(500)
        latest_ranks = {c: {'rank': r, 'newfans': f} for c,r,f in ranks}
        rankjqka = {x[0]: x[1] for x in self.shr.get10jqkaRanks()}
        await self.notify_change((latest_ranks, rankjqka, None))

    async def update_hotrank_tgb(self):
        if self.shr is None:
            self.shr = StockHotRank()
        ranktgb = {x[0]: x[1] for x in self.shr.getTgbRanks()}
        await self.notify_change((None, None, ranktgb))

    def stop_hotrank_task(self):
        self.hr_task_running = False
        self.hr_tgb_running = False
        Utils.log('stop task for hotrank!')


class StrategyI_Hotrank_Once_Watcher(StrategyI_Simple_Watcher):
    def __init__(self, stime='9:20:5'):
        super().__init__(stime)
        self.shr = None

    async def execute_simple_task(self):
        if self.shr is None:
            self.shr = StockHotRank()
        ranks = self.shr.getEmRanks(100)
        latest_ranks = {c: {'rank': r, 'newfans': f} for c,r,f in ranks}
        rankjqka = {x[0]: x[1] for x in self.shr.get10jqkaRanks()}
        ranktgb = {x[0]: x[1] for x in self.shr.getTgbRanks()}
        await self.notify_change((latest_ranks, rankjqka, ranktgb))


class StrategyI_Snapshot_Watcher(StrategyI_Watcher_Base):
    def __init__(self, period=300):
        super().__init__()
        self.snap_period = period
        self.changes_task_running = False
        self.stock_ref = {}

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            loop.call_later(Utils.delay_seconds('9:30:2'), lambda: asyncio.ensure_future(self.start_snapshot_task()))
            loop.call_later(Utils.delay_seconds('11:30:1'), self.stop_snapshot_task)
            loop.call_later(Utils.delay_seconds('13:00:2'), lambda: asyncio.ensure_future(self.start_snapshot_task()))
            loop.call_later(Utils.delay_seconds('14:57:1'), self.stop_snapshot_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def start_snapshot_task(self):
        if self.changes_task_running:
            return
        self.changes_task_running = True
        while self.changes_task_running:
            try:
                for c in self.stock_ref.keys():
                    if self.stock_ref[c] > 0:
                        await self.get_snapshots(c)
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(self.snap_period)

    def stop_snapshot_task(self):
        self.changes_task_running = False
        self.notify_stop()
        Utils.log('stop task for changes!')

    async def get_snapshots(self, code):
        snapshot = Utils.get_em_snapshot(code)

        simple_snap = {
            'code': code,
            # 解析买一买二和卖一卖二的价格和数量
            'buy1': 0 if snapshot['fivequote']['buy1'] == '-' else float(snapshot['fivequote']['buy1']),
            'sell1': 0 if snapshot['fivequote']['sale1'] == '-' else float(snapshot['fivequote']['sale1']),
            'buy2': 0 if snapshot['fivequote']['buy2'] == '-' else float(snapshot['fivequote']['buy2']),
            'sell2': 0 if snapshot['fivequote']['sale2'] == '-' else float(snapshot['fivequote']['sale2']),
            'price': 0 if snapshot['realtimequote']['currentPrice'] == '-' else float(snapshot['realtimequote']['currentPrice']),
            'time': snapshot['realtimequote']['time'],
            'top_price': 0 if snapshot['topprice'] == '-' else float(snapshot['topprice']),
            'bottom_price': 0 if snapshot['bottomprice'] == '-' else float(snapshot['bottomprice']),
            'last_close': float(snapshot['fivequote']['yesClosePrice'])
        }

        await self.notify_change(simple_snap)

    def add_stock(self, code):
        if isinstance(code, str):
            code = [code]
        for c in code:
            if c not in self.stock_ref:
                self.stock_ref[c] = 1
            else:
                self.stock_ref[c] += 1

    def remove_stock(self, code):
        if isinstance(code, str):
            code = [code]
        for c in code:
            if c not in self.stock_ref or self.stock_ref[c] == 0:
                continue
            self.stock_ref[c] -= 1


class Client_Watcher_Base(StrategyI_Watcher_Base):
    def __init__(self, stime):
        super().__init__()
        self.stime = [stime]
        if isinstance(stime, list) or isinstance(stime, tuple):
            self.stime = stime
        self.simple_task_running = False

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        for stime in self.stime:
            if Utils.delay_seconds(stime) > 0:
                loop.call_later(Utils.delay_seconds(stime), lambda: asyncio.ensure_future(self.start_simple_task()))

    async def start_simple_task(self):
        if self.simple_task_running:
            return
        self.simple_task_running = True
        await self.execute_simple_task()

    async def execute_simple_task(self):
        pass

    async def notify_change(self, notification):
        for client in self.client_listeners[:]:
            try:
                await client.send(json.dumps(notification))
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
                self.client_listeners.remove(client)


class StockMarket_Quote_Watcher(Client_Watcher_Base):
    '''股市概况, 早盘竞价结束自动执行一次， 早上9:40自动执行一次'''
    def __init__(self):
        super().__init__(['9:25:05', '9:40'])
        self.sm_statistics = []

    async def execute_simple_task(self):
        zdfranks = StockGlobal.getStocksZdfRank()
        today = Utils.today_date()
        up_down_stocks = []
        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            if c == '-' or zd == '-':
                continue
            cd = rkobj['f12'] # 代码
            m = rkobj['f13']  # 市场代码 0 深 1 沪
            if (m != 0 and m != 1):
                Utils.log(f'invalid market {m}')
                continue
            if zd >= 8 or zd <= -8:
                code = StockGlobal.full_stockcode(cd)
                up_down_stocks.append(code)

        sm_statistics = {'time': datetime.now().strftime('%Y-%m-%d %H:%M'), 'zt_yzb':[], 'zt':[], 'dt':[], 'up':[], 'down':[]}
        fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px';
        for i in range(0,len(up_down_stocks),200):
            ccodes = ','.join([c[2:] + '.BJ' if c.startswith('BJ') else c.lower() for c in up_down_stocks[i: i+200]])
            bUrl = f'https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields={fields}&os=web&secu_codes={ccodes}&sv=7.7.5'
            sbasics = json.loads(Utils.get_em_request(bUrl, 'x-quote.cls.cn'))
            if 'data' in sbasics:
                for secu in sbasics['data']:
                    sbasic = sbasics['data'][secu]
                    o,h,l,c = sbasic['open_px'], sbasic['high_px'], sbasic['low_px'], sbasic['last_px']
                    u,d,lc = sbasic['up_price'], sbasic['down_price'], sbasic['preclose_px']
                    if c == u:
                        if h == l:
                            # 一字
                            sm_statistics['zt_yzb'].append(sbasic)
                        else:
                            # 涨停
                            sm_statistics['zt'].append(sbasic)
                    elif c == d:
                        sm_statistics['dt'].append(sbasic)
                        # 跌停
                    elif sbasic['change'] >= 0.08:
                        sm_statistics['up'].append(sbasic)
                        # 大涨
                    elif sbasic['change'] <= -0.08:
                        # 大跌
                        sm_statistics['down'].append(sbasic)

        self.sm_statistics.append(sm_statistics)

        notification = {'type': 'notification', 'subject': 'sm_stats' }
        notification['date'] = Utils.today_date()
        notification['stats'] = self.sm_statistics

        await self.notify_change(notification)
