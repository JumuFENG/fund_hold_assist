# Python 3
# -*- coding:utf-8 -*-

import asyncio
import traceback
from utils import *
from history import StockGlobal, StockHotRank, StockEmBk, StockBkChangesHistory, StockChangesHistory
from pickup import StockZtDaily


def create_strategy_matched_message_direct_buy(match_data, subscribe_detail):
    account = subscribe_detail['account']
    amount = subscribe_detail['amount']
    code = match_data['code']
    price = round(float(match_data['price']), 2)
    dbmsg = {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': 0}
    if 'amtkey' not in subscribe_detail:
        dbmsg['count'] = Utils.calc_buy_count(amount, price)
    if 'amtkey' in subscribe_detail:
        strategies = {
            "grptype": "GroupStandard",
            "strategies": {
                "0": { "key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all" },
                "1": { "key": "StrategyGrid", "enabled": False, "buycnt": 1, "stepRate": 0.05 }
            },
            "transfers": { "0": { "transfer": "-1" }, "1": { "transfer": "-1" }},
            "amount": amount
        }
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
    strategies = {
        "grptype": "GroupStandard",
        "strategies": {
            "0": { "key":"StrategySellELS", "enabled":False, "cutselltype":"all", "selltype":"all", "topprice": round(price * 1.05, 2) },
            "1": { "key":"StrategyGrid", "enabled":False, "guardPrice": price, "buycnt": 1, "stepRate": 0.05 },
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
        block_bks = ['BK0511', 'BK0636'] # ST股 B股
        bkstks = []
        for bk in block_bks:
            bkdb = StockEmBk(bk)
            bkstks += bkdb.dumpDataByDate()

        zdfranks = StockGlobal.getStocksZdfRank()
        for rk in zdfranks:
            if rk['f14'].startswith('退市') or rk['f14'].endswith('退'):
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

    __bk_stocks = {}
    @classmethod
    def update_bk_stocks(self, bks):
        if isinstance(bks, str):
            bks = [bks]
        assert isinstance(bks, list), "bks must be a list"
        for bk in bks:
            sbk = StockEmBk(bk)
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

    def add_listener(self, listener):
        self.listeners.append(listener)

    def remove_listener(self, listener):
        if listener in self.listeners:
            self.listeners.remove(listener)

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

    async def get_changes(self, types=None):
        self.chg_page = 0
        self.chg_pagesize = 1000
        self.fecthed = []
        self.get_next_changes(types)
        await self.notify_change(self.fecthed)

    def get_next_changes(self, types=None):
        if types is None:
            types = '8213,8201,8193,8194,64,128,4'
        # 60日新高,火箭发射, 大笔买入, 大笔卖出, 有大买盘, 有大卖盘, 封涨停板
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
                self.exist_changes.add((code, ftm, tp))


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
            loop.call_later(Utils.delay_seconds('15:0:5'), self.stop_changes_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    def bk_changes_prepare(self):
        if self.bkchghis is None:
            self.bkchghis = StockBkChangesHistory()
        WsIsUtils.update_bk_stocks(self.bkchghis.dumpDataByDate())

    async def get_changes(self):
        if self.bkchghis is None:
            self.bkchghis = StockBkChangesHistory()
        bks = self.bkchghis.getLatestChanges()
        if len(bks) == 0:
            Utils.log(f'{__class__.__name__} StockBkChangesHistory get bk changes empty')
            return
        await self.notify_change(self.bkchghis.changesToDict(bks))


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
