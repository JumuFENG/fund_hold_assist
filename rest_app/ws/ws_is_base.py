# Python 3
# -*- coding:utf-8 -*-

import asyncio
import traceback
from utils import *
from history import StockGlobal, StockHotRank


wsis_watchers = None


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


def get_watcher(name):
    global wsis_watchers
    if wsis_watchers is None:
        wsis_watchers = {
            'endauction': StrategyI_EndAuction_Watcher(),
            'stkchanges': StrategyI_StkChanges_Watcher(),
            'hotrank': StrategyI_Hotrank_Watcher(),
            'hotrank_open': StrategyI_Hotrank_Once_Watcher('9:20:5'),
            'hotrank_close': StrategyI_Hotrank_Once_Watcher('14:55:50')
        }

    return wsis_watchers[name]

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
    def add_listener(self, listener):
        assert hasattr(self, 'listeners'), 'listeners not defined!'
        self.listeners.append(listener)

    def remove_listener(self, listener):
        assert hasattr(self, 'listeners'), 'listeners not defined!'
        if listener in self.listeners:
            self.listeners.remove(listener)

    async def notify_change(self, params):
        assert hasattr(self, 'listeners'), 'listeners not defined!'
        for listener in self.listeners:
            await listener.on_watcher(params)

    def notify_stop(self):
        assert hasattr(self, 'listeners'), 'listeners not defined!'
        for listener in self.listeners:
            listener.on_taskstop()


class StrategyI_Simple_Watcher(StrategyI_Watcher_Base):
    def __init__(self, stime):
        self.stime = stime
        self.listeners = []
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
        kquotes = StockGlobal.getStocksZdfRank()
        await self.notify_change(kquotes)


class StrategyI_StkChanges_Watcher(StrategyI_Watcher_Base):
    ''' 盘中异动
    '''
    listeners = []
    changes_task_running = False
    exist_changes = set()

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
            await asyncio.sleep(60)

    def stop_changes_task(self):
        self.changes_task_running = False
        self.notify_stop()
        Utils.log('stop task for changes!')

    async def get_changes(self):
        self.chg_page = 0
        self.chg_pagesize = 1000
        self.fecthed = []
        self.get_next_changes()
        await self.notify_change(self.fecthed)

    def get_next_changes(self):
        t = '8213,8201,8193,8194,64,128,4'
        # 60日新高,火箭发射, 大笔买入, 大笔卖出, 有大买盘, 有大卖盘, 封涨停板
        url = f'http://push2ex.eastmoney.com/getAllStockChanges?type={t}&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex={self.chg_page}&pagesize={self.chg_pagesize}&dpt=wzchanges'
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
            self.get_next_changes()

    def merge_fetched(self, changes):
        f2ch = ['00', '60', '30', '68', '83', '87', '43', '92', '90']
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


class StrategyI_Hotrank_Watcher(StrategyI_Watcher_Base):
    listeners = []
    hr_task_running = False
    hr_tgb_running = False
    shr = None

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:00') > 0:
            loop.call_later(Utils.delay_seconds('9:5:0'), lambda: asyncio.ensure_future(self.start_hotrank_tgb_task()))
        elif Utils.delay_seconds('9:30') > 0:
            await self.update_hotrank_tgb()
            loop.call_later(Utils.delay_seconds('10:5:0'), lambda: asyncio.ensure_future(self.start_hotrank_tgb_task()))
        if Utils.delay_seconds('9:30') > 0:
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
