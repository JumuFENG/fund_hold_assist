# Python 3
# -*- coding:utf-8 -*-

import asyncio
import traceback
from datetime import timedelta
from utils import *
from history import StockGlobal, StockHotRank, StockEmBk, StockBkChangesHistory, StockChangesHistory, StockShareBonus
from history import StockDumps, StockClsBkChangesHistory, StockBkAllChangesHistory, StockClsBk, StockBkMap, StockMarkerStats
from history import Stock_Fflow_History, StockEmBkChgIgnore, StockAuctionDetails
from pickup import StockZtDaily, StockZtLeadingSelector
from tdx_common import TdxAsyncClient, search_best_tdx


def generate_strategy_json(match_data, subscribe_detail):
    amount = subscribe_detail['amount']
    price = round(float(match_data['price']), 2)
    strategies = {
        "grptype": "GroupStandard",
        "strategies": {},
        "transfers": {},
        "amount": amount
    }
    strobjs = {
        "StrategyBuyZTBoard": { "key": "StrategyBuyZTBoard", "enabled": True },
        "StrategySellELS": {"key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all", "topprice": round(price * 1.05, 2) },
        "StrategyGrid": { "key": "StrategyGrid", "enabled": False, "buycnt": 1, "stepRate": 0.05 },
        "StrategySellBE": { "key":"StrategySellBE", "enabled":False, "upRate": -0.03, "selltype":"all", 'sell_conds': 1}
    }
    if 'strategies' in match_data:
        mstrategies = match_data['strategies']
        for i, mk in enumerate(mstrategies):
            if mk not in strobjs:
                Utils.log(f'create_strategy_matched_message_direct_buy error key: {mk}', Utils.Err)
                Utils.log(f'{match_data}', Utils.Err)
            strategies['strategies'][i] = strobjs[mk]
            for k, v in mstrategies[mk].items():
                strategies['strategies'][i][k] = v
            strategies['transfers'][i] = { "transfer": "-1" }
    if 'amtkey' in subscribe_detail:
        strategies['uramount'] = {"key": subscribe_detail['amtkey']}
    return strategies

def create_strategy_matched_message_direct_buy(match_data, subscribe_detail):
    account = subscribe_detail['account']
    amount = subscribe_detail['amount']
    code = match_data['code'][-6:]
    price = round(float(match_data['price']), 2)
    dbmsg = {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': 0}
    if 'amtkey' not in subscribe_detail:
        dbmsg['count'] = Utils.calc_buy_count(amount, price)

    dbmsg['strategies'] = generate_strategy_json(match_data, subscribe_detail)
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
            elif name == 'stkzdf':
                self.__watchers[name] = StrategyI_StkZdf_Watcher()
            elif name == 'stkzt_open':
                self.__watchers[name] = StrategyI_StkZtChanges_Once_Watcher('9:25:05')
            elif name == 'open_fundflow':
                self.__watchers[name] = StrategyI_OpenFundFlow_Watcher()
            elif name == 'end_fundflow':
                self.__watchers[name] = StrategyI_EndFundFlow_Watcher()
            elif name == 'sm_stats':
                self.__watchers[name] = StockMarket_Quote_Watcher()
            elif name == 'open_auctions':
                self.__watchers[name] = Open_Auctions_Watcher()

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


    @classmethod
    def get_hot_stocks(self, days):
        szd = StockZtDaily()
        return szd.getHotStocks(TradingDate.prevTradingDate(TradingDate.maxTradedDate(), days))

    __stock_bks = {}
    @classmethod
    def get_stock_bks(self, code):
        if code not in self.__stock_bks:
            self.__stock_bks[code] = StockBkMap.stock_bks(code)
        return self.__stock_bks[code]

    __bk_ignored = []
    @classmethod
    def is_bk_ignored(self, bk):
        if len(self.__bk_ignored) == 0:
            ignoreBkTable = StockEmBkChgIgnore()
            self.__bk_ignored = [bk for i,bk,n in ignoreBkTable.dumpDataByDate()]
        return bk in self.__bk_ignored

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

    slogcnt = 0
    @classmethod
    def parse_match_unmatch(self, snapshot):
        # 竞价匹配量未匹配量
        # 解析买一买二和卖一卖二的价格和数量
        buy1_price = snapshot['fivequote']['buy1']
        sell1_price = snapshot['fivequote']['sale1']
        open_price = snapshot['fivequote']['openPrice']
        buy1_count = snapshot['fivequote']['buy1_count']
        sell1_count = snapshot['fivequote']['sale1_count']
        current_price = snapshot['realtimequote']['currentPrice']
        quote_time = snapshot['realtimequote']['time']
        # if quote_time == '09:25:00':
        #     Utils.log(f'parse_match_unmatch 9:25 >> {snapshot}')
        # if self.slogcnt < 3:
        #     self.slogcnt += 1
        #     Utils.log(f'parse_match_unmatch <9:25 >> {snapshot}')

        if buy1_price == '-' and sell1_price == '-':
            return [quote_time, current_price, 0, 0]

        if open_price == '-' and buy1_price == sell1_price:
            matched_vol = buy1_count
            buy2_count = snapshot['fivequote']['buy2_count']
            sell2_count = snapshot['fivequote']['sale2_count']
            unmatched_vol = buy2_count if buy2_count > 0 else -sell2_count
        else:
            matched_vol = snapshot['realtimequote']['volume']
            unmatched_vol = 0
            if current_price == buy1_price:
                unmatched_vol = buy1_count
            elif current_price == sell1_price:
                unmatched_vol = -sell1_count
        return [quote_time, current_price, matched_vol, unmatched_vol]

    __leading_selector = StockZtLeadingSelector()
    @classmethod
    def get_fetch_results(self, wsmsg):
        query = wsmsg.get('query')
        result = {}
        result['type'] = 'answer'
        result['query'] = query
        if query == 'bkstocks':
            bks = wsmsg.get('bks')
            result['stocks'] = {bk:StockBkMap.bk_stocks(bk) for bk in bks}
        elif query == 'hdstocks':
            try:
                bks = wsmsg.get('bks')
                start = wsmsg.get('start')
                result['main'] = wsmsg.get('main')
                bkstocks = StockBkMap.bk_stocks(bks)
                result['hdstocks'] = self.__leading_selector.getHeadedStocks(bkstocks, start)
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
        elif query == 'stkchanges':
            watcher = self.get_watcher('stkchanges')
            if (len(watcher.full_changes)) == 0:
                watcher.read_latest_history_changes()
            result['changes'] = watcher.full_changes
        elif query == 'sm_stats':
            watcher = self.get_watcher('sm_stats')
            if len(watcher.sm_statistics) == 0:
                smtable = StockMarkerStats()
                watcher.sm_statistics = smtable.dumpDataByDate()
            result['stats'] = watcher.sm_statistics
        elif query == 'open_auctions':
            watcher = self.get_watcher('open_auctions')
            result['auctions'] = watcher.all_auctions

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

    def remove_client_listener(self, listener):
        if listener in self.client_listeners:
            self.client_listeners.remove(listener)

    async def notify_change(self, params):
        for listener in self.listeners:
            try:
                await listener.on_watcher(params)
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)

    async def notify_clients(self, notification):
        for client in self.client_listeners[:]:
            try:
                await client.send(json.dumps(notification))
            except Exception as e:
                Utils.log(f'error when send to {client}', Utils.Err)
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
                self.client_listeners.remove(client)

    def notify_stop(self):
        for listener in self.listeners:
            listener.on_taskstop()

    def set_listener_configs(self, msg):
        pass


class StrategyI_Simple_Watcher(StrategyI_Watcher_Base):
    def __init__(self, btime, etime=[]):
        '''
        @param btime: '09:30' / ['09:30', '13:00']
        @param etime: ['11:31', '15:01']
        '''
        super().__init__()
        self.btime = [btime]
        if isinstance(btime, list) or isinstance(btime, tuple):
            self.btime = btime
        self.etime = [etime]
        if isinstance(etime, list) or isinstance(etime, tuple):
            self.etime = etime
        self.simple_task_running = False

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        for bt in self.btime:
            if Utils.delay_seconds(bt) > 0:
                loop.call_later(Utils.delay_seconds(bt), lambda: asyncio.ensure_future(self.start_simple_task()))
        for et in self.etime:
            if Utils.delay_seconds(et) > 0:
                loop.call_later(Utils.delay_seconds(et), self.stop_simple_task)

    async def start_simple_task(self):
        if self.simple_task_running:
            return
        self.simple_task_running = True
        try:
            await self.execute_simple_task()
        except Exception as e:
            Utils.log(f'{e}', Utils.Err)
            Utils.log(traceback.format_exc(), Utils.Err)

    async def execute_simple_task(self):
        pass

    def stop_simple_task(self):
        self.simple_task_running = False


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


class StrategyI_OpenFundFlow_Watcher(StrategyI_Simple_Watcher):
    ''' 开盘竞价净额, 选近期热门股中前10大竞价净额
    '''
    def __init__(self):
        super().__init__('9:26:30')

    async def execute_simple_task(self):
        szt = StockZtDaily()
        mdate = TradingDate.maxTradingDate()
        sdate = TradingDate.prevTradingDate(mdate, 5)
        ztstks = szt.getHotStocks(sdate)
        ztstks = [[c,d,days,lbc] for c,d,days,lbc in ztstks if TradingDate.calcTradingDays(d, mdate) > 2 or lbc >= 2]
        fund_diffs = []
        for c,d,days,lbc in ztstks:
            sc = Utils.to_cls_secucode(c)
            clsfundurl = f'https://x-quote.cls.cn/quote/stock/fundflow?secu_code={sc}&app=CailianpressWeb&os=web&sv=7.7.5'
            fundinfo = json.loads(Utils.get_em_request(clsfundurl, host='x-quote.cls.cn'))
            if 'data' in fundinfo and 'main_fund_diff' in fundinfo['data'] and fundinfo['data']['main_fund_diff'] > 0:
                fund_diffs.append([c,d,days,lbc,fundinfo['data']['main_fund_diff']])

        fund_diffs = sorted(fund_diffs, key=lambda x: x[4], reverse=True)
        fund_diffs = fund_diffs[0:10]
        sbasics = Utils.get_cls_basics([c for c, *x in fund_diffs])
        flow_diffs = []
        sfh = Stock_Fflow_History()
        for c,d,days,lbc,f in fund_diffs:
            fhist = sfh.dumpMainFlow(c, TradingDate.prevTradingDate(d, days), TradingDate.maxTradedDate())
            if fhist[0][2] < 0:
                mf = sum([x[2] for x in fhist[1:]])
            else:
                mf = sum([x[2] for x in fhist])
            flow_diffs.append([c,d,days,lbc,f,mf,sbasics[c]['change'], sbasics[c]['last_px']])
        await self.notify_change(flow_diffs)


class StrategyI_EndFundFlow_Watcher(StrategyI_Simple_Watcher):
    ''' 主力资金流
    '''
    def __init__(self):
        super().__init__('14:57:55')

    async def execute_simple_task(self):
        sfh = Stock_Fflow_History()
        mflow = sfh.updateLatestFflow(False)
        await self.notify_change(mflow)


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

    async def get_changes(self, types=None):
        self.chg_page = 0
        self.chg_pagesize = 1000
        self.fecthed = []
        self.get_next_changes(types)

        await self.notify_change(self.fecthed)
        if len(self.client_listeners) == 0:
            return

        notification = {'type': 'notification', 'subject': 'stkchanges' }
        notification['date'] = Utils.today_date()
        notification['changes'] = self.fecthed
        await self.notify_clients(notification)

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
            loop.call_later(Utils.delay_seconds('15:2:35'), self.update_bkchanges_5d)
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
        bks = self.bkchghis.changesToDict(self.bkchghis.getLatestChanges(WsIsUtils.save_db_enabled()))
        bks += self.clsbkhis.changesToDict(self.clsbkhis.getLatestChanges(WsIsUtils.save_db_enabled()))
        if len(bks) == 0:
            Utils.log(f'{__class__.__name__} StockBkChangesHistory get bk changes empty')
            return
        await self.notify_change(bks)

    def update_bkchanges_5d(self):
        if self.bkchghis is None:
            self.bkchghis = StockBkChangesHistory()
        self.bkchghis.updateBkChangedIn5Days()
        if self.clsbkhis is None:
            self.clsbkhis = StockClsBkChangesHistory()
        self.clsbkhis.updateBkChangedIn5Days()
        Utils.log('updateBkChangedIn5Days done!')

    def stop_changes_task(self):
        self.changes_task_running = False
        self.notify_stop()
        Utils.log('stop task for changes!')


class StrategyI_Hotrank_Watcher(StrategyI_Watcher_Base):
    hr_task_running = False
    shr = None

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            loop.call_later(Utils.delay_seconds('9:20:5'), lambda: asyncio.ensure_future(self.start_hotrank_task()))
            loop.call_later(Utils.delay_seconds('11:30:5'), self.stop_hotrank_task)
            loop.call_later(Utils.delay_seconds('13:00:0'), lambda: asyncio.ensure_future(self.start_hotrank_task()))
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

    async def update_hotranks(self):
        if self.shr is None:
            self.shr = StockHotRank()
        ranks = self.shr.getEmRanks(500)
        latest_ranks = {c: {'rank': r, 'newfans': f} for c,r,f in ranks}
        rankjqka = {x[0]: x[1] for x in self.shr.get10jqkaRanks()}
        await self.notify_change((latest_ranks, rankjqka))

    def stop_hotrank_task(self):
        self.hr_task_running = False
        Utils.log('stop task for hotrank!')


class StrategyI_Hotrank_Once_Watcher(StrategyI_Simple_Watcher):
    def __init__(self, stime='9:20:5'):
        super().__init__(stime)
        self.shr = None

    async def execute_simple_task(self):
        if self.shr is None:
            self.shr = StockHotRank()
        try:
            ranks = self.shr.getEmRanks(100)
            latest_ranks = {c: {'rank': r, 'newfans': f} for c,r,f in ranks}
            rankjqka = {x[0]: x[1] for x in self.shr.get10jqkaRanks()}
            await self.notify_change((latest_ranks, rankjqka))
        except Exception as e:
            Utils.log(f'{e}', Utils.Err)
            Utils.log(traceback.format_exc(), Utils.Err)


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
        self.tdxclient = TdxAsyncClient(search_best_tdx(1))
        while self.changes_task_running:
            try:
                quotes = await self.tdxclient.get_security_quotes_async(self.stock_ref.keys())
                for q in quotes:
                    simple_snap = {
                        'code': q['code'],
                        # 解析买一买二和卖一卖二的价格和数量
                        'buy1': q['bid1'],
                        'sell1': q['ask1'],
                        'buy2': q['bid2'],
                        'sell2': q['ask2'],
                        'price': q['price'],
                        'time': q['servertime'].split('.')[0],
                        'high': q['high'],
                        'low': q['low'],
                        'last_close': q['last_close'],
                    }
                    self.notify_change(simple_snap)

            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(self.snap_period)

    async def start_snapshot_task_bk(self):
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
            'up_price': 0 if snapshot['topprice'] == '-' else float(snapshot['topprice']),
            'down_price': 0 if snapshot['bottomprice'] == '-' else float(snapshot['bottomprice']),
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


class StrategyI_StkZdf_Watcher(StrategyI_Watcher_Base):
    ''' 个股涨幅排行,仅获取涨跌幅>=8%
    '''
    def __init__(self):
        super().__init__()
        self.task_running = False
        self.period = 60
        self.min_zdf = 8
        self.full_zdf = []

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            loop.call_later(Utils.delay_seconds('9:30:1'), lambda: asyncio.ensure_future(self.start_zdf_task()))
            loop.call_later(Utils.delay_seconds('11:30:1'), self.stop_zdf_task)
            loop.call_later(Utils.delay_seconds('13:00:1'), lambda: asyncio.ensure_future(self.start_zdf_task()))
            loop.call_later(Utils.delay_seconds('14:57:1'), self.stop_zdf_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def start_zdf_task(self):
        if self.task_running:
            return
        self.task_running = True
        while self.task_running:
            try:
                await self.get_zdf()
            except Exception as e:
                Utils.log(f'{e}', Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)
            await asyncio.sleep(self.period)

    def stop_zdf_task(self):
        self.task_running = False
        self.notify_stop()
        Utils.log('stop task for zdf!')

    async def get_zdf(self):
        zdfranks = StockGlobal.getStocksZdfRank(self.min_zdf)
        full_zdf = []
        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            if c == '-' or zd == '-':
                continue
            if zd < self.min_zdf:
                break
            cd = rkobj['f12'] # 代码
            code = StockGlobal.full_stockcode(cd)
            lc = rkobj['f18'] # 昨收
            full_zdf.append([code, zd, c, lc])
        self.full_zdf = full_zdf
        if len(self.full_zdf) == 0:
            return

        await self.notify_change(self.full_zdf)
        if len(self.client_listeners) == 0:
            return
        notification = {'type': 'notification', 'subject': 'stkzdf' }
        notification['stocks'] = self.full_zdf
        await self.notify_clients(notification)


class StockMarket_Quote_Watcher(StrategyI_Simple_Watcher):
    '''股市概况, 早盘竞价结束自动执行一次, 早上9:40自动执行一次, 收盘执行一次'''
    def __init__(self):
        super().__init__(['9:25:05', '9:40', '15:01'], '15:02')
        self.sm_statistics = []
        self.topbks = None
        self.hotstocks = None

    def to_secucode(self, code):
        return Utils.to_cls_secucode(code)

    def get_topbks(self):
        sbkchg = StockBkAllChangesHistory()
        self.topbks = sbkchg.get_topbks()
        self.bkstocklist = {}
        for bk in self.topbks:
            self.bkstocklist[bk] = [self.to_secucode(c) for c in StockBkMap.bk_stocks(bk)]

        kickdate = TradingDate.prevTradingDate(TradingDate.maxTradedDate(), 3) if len(self.topbks.values()) == 0 else min([bk['kickdate'] for bk in self.topbks.values()])
        szt = StockZtDaily()
        ztstks = szt.getHotStocks(kickdate)
        mdate = TradingDate.maxTradingDate()
        self.hotstocks = {self.to_secucode(c): {'code': self.to_secucode(c), 'date': d, 'days': days, 'lbc': lbc, 'ndays': TradingDate.calcTradingDays(d, mdate) - 1} for c,d,days,lbc in ztstks}

    def zt_lbc_sort_key(self, secu):
        code = secu['secu_code']
        if code not in self.hotstocks:
            return -1, -1
        days = self.hotstocks[code]['days'] + self.hotstocks[code]['ndays']
        if days == 0:
            return -1, self.hotstocks[code]['lbc']
        return days, self.hotstocks[code]['lbc'] / days

    def connect_bk_stock(self, stats):
        zt_stocks = [z['secu_code'] for z in stats['stocks']['zt_yzb'] + stats['stocks']['zt']]
        for bk in self.topbks:
            self.topbks[bk]['zt_stocks'] = [s for s in self.bkstocklist[bk] if s in zt_stocks]
        stats['plates'] = sorted(self.topbks.values(), key=lambda x: len(x['zt_stocks']), reverse=True)

        stocks = {}
        for k in ['zt_yzb', 'zt', 'up', 'down', 'dt']:
            stocks[k] = []
            pstocks = [[] for _ in range(len(stats['plates']))]
            for zs in stats['stocks'][k]:
                inplates = False
                for i in range(0, len(stats['plates'])):
                    if zs['secu_code'] in self.bkstocklist[stats['plates'][i]['code']]:
                        pstocks[i].append(zs)
                        inplates = True
                        break
                if not inplates:
                    pstocks[-1].append(zs)

            for i in range(len(pstocks)):
                if len(pstocks[i]) < 2:
                    continue
                pstocks[i] = sorted(pstocks[i], key=self.zt_lbc_sort_key, reverse=True)
            stocks[k] = []
            for zs in pstocks:
                stocks[k] += zs
        stats['stocks'] = stocks

        estocks = []
        for k in ['zt_yzb', 'zt', 'up', 'down', 'dt']:
            for zs in stats['stocks'][k]:
                estocks.append(zs['secu_code'])
        stockextras = {}
        for s in estocks:
            if s in self.hotstocks:
                stockextras[s] = self.hotstocks[s]
            plist = []
            for p in stats['plates']:
                if s in self.bkstocklist[p['code']]:
                    plist.append(p['code'])
            if len(plist) > 0:
                if s not in stockextras:
                    stockextras[s] = {}
                stockextras[s]['plates'] = plist
        stats['stockextras'] = stockextras
        return stats

    async def execute_simple_task(self):
        if self.topbks is None or self.hotstocks is None:
            self.get_topbks()
        zdfranks = StockGlobal.getStocksZdfRank()
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

        sm_statistics = {'time': datetime.now().strftime('%Y-%m-%d %H:%M'), 'stocks': {'zt_yzb':[], 'zt':[], 'dt':[], 'up':[], 'down':[]}}
        fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px'
        for i in range(0,len(up_down_stocks),200):
            ccodes = ','.join([self.to_secucode(c) for c in up_down_stocks[i: i+200]])
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
                            sm_statistics['stocks']['zt_yzb'].append(sbasic)
                        else:
                            # 涨停
                            sm_statistics['stocks']['zt'].append(sbasic)
                    elif c == d:
                        sm_statistics['stocks']['dt'].append(sbasic)
                        # 跌停
                    elif sbasic['change'] >= 0.08:
                        sm_statistics['stocks']['up'].append(sbasic)
                        # 大涨
                    elif sbasic['change'] <= -0.08:
                        # 大跌
                        sm_statistics['stocks']['down'].append(sbasic)

        sm_statistics = self.connect_bk_stock(sm_statistics)

        self.sm_statistics.append(sm_statistics)

        notification = {'type': 'notification', 'subject': 'sm_stats' }
        notification['date'] = Utils.today_date()
        notification['stats'] = self.sm_statistics

        await self.notify_clients(notification)
        self.simple_task_running = False

    def stop_simple_task(self):
        super().stop_simple_task()
        if WsIsUtils.save_db_enabled():
            dailystats = {}
            for i in range(0, len(self.sm_statistics)):
                dsm, tsm = self.sm_statistics[i]['time'].split(' ')
                if dsm not in dailystats:
                    dailystats[dsm] = {tsm: self.sm_statistics[i]}
                else:
                    dailystats[dsm][tsm] = self.sm_statistics[i]
            smtable = StockMarkerStats()
            for d, s in dailystats.items():
                daystats = []
                for tm, stat in s.items():
                    daystats.append([d, tm, stat])
                smtable.saveDailyStats(daystats)
        else:
            print('market statistics:', self.sm_statistics)


class Open_Auctions_Watcher(StrategyI_Simple_Watcher):
    def __init__(self):
        super().__init__(['9:15:03'], '9:25:10')
        self.stock_ref = {}
        self.snap_period = 10
        self.all_auctions = {}

    async def get_snapshots_batch_async(self, codes, tdx_client):
        """异步批量获取行情并处理"""
        quotes = await tdx_client.get_security_quotes_async(codes)
        if not quotes:
            return

        for quote in quotes:
            code = quote['code']
            try:
                mkt = ['SZ', 'SH', 'BJ']
                if code not in self.all_auctions:
                    zdf = Utils.zdf_from_code(mkt[quote['market']]+code)
                    self.all_auctions[code] = {
                        'preclose_px': quote['last_close'],
                        'up_price': Utils.zt_priceby(quote['last_close'], zdf=zdf),
                        'down_price': Utils.dt_priceby(quote['last_close'], zdf=zdf),
                        'quotes': []
                    }

                price = quote['price']
                if quote['open'] == 0 and quote['bid1'] == quote['ask1']:
                    price = quote['bid1']
                    matched_vol = quote['bid_vol1']
                    buy2_count = quote['bid_vol2']
                    sell2_count = quote['ask_vol2']
                    unmatched_vol = buy2_count if buy2_count > 0 else -sell2_count
                else:
                    matched_vol = quote['vol']
                    unmatched_vol = 0
                    if quote['price'] == quote['bid1']:
                        unmatched_vol = quote['bid_vol1']
                    elif quote['price'] == quote['ask1']:
                        unmatched_vol = -quote['ask_vol1']
                parsed_quote = [quote['servertime'].split('.')[0],price, matched_vol, unmatched_vol]
                self.all_auctions[code]['quotes'].append(parsed_quote)

            except Exception as e:
                Utils.log(f"处理股票{code}出错: {e}", Utils.Err)


    async def execute_simple_task(self):
        """Async 版定时任务"""
        # 初始化 TDX 异步客户端（8个最佳服务器）
        best_servers = search_best_tdx(8)
        self.tdx_clients = [TdxAsyncClient(host) for host in best_servers]
        stks = WsIsUtils.get_hot_stocks(2)
        stks = [c[2:] for c,d,dd,l in stks if l > 1]
        self.add_stock(stks)

        while True:
            zdfranks = StockGlobal.getStocksZdfRank(8)
            if len(zdfranks) > 0:
                break
            time.sleep(0.5)

        for rkobj in zdfranks:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            if c == '-' or zd == '-':
                continue
            if zd < 8:
                break
            cd = rkobj['f12'] # 代码
            self.add_stock(cd)

        while self.simple_task_running:
            try:
                mstocks = [c for c, n in self.stock_ref.items() if n > 0]
                if not mstocks:
                    await asyncio.sleep(self.snap_period)
                    continue

                # 分组（每组最多 80 只股票，避免 TDX 单次请求限制）
                group_size = 80
                stock_groups = [
                    mstocks[i:i + group_size] 
                    for i in range(0, len(mstocks), group_size)
                ]

                # 并发获取行情
                tasks = []
                for i, codes in enumerate(stock_groups):
                    client = self.tdx_clients[i % len(self.tdx_clients)]  # 轮询分配客户端
                    tasks.append(
                        self.get_snapshots_batch_async(codes, client)
                    )

                await asyncio.gather(*tasks)

                # 通知客户端
                notification = {
                    'type': 'notification',
                    'subject': 'open_auctions',
                    'auctions': self.all_auctions
                }

                await self.notify_clients(notification)
            except Exception as e:
                Utils.log(f"任务执行出错: {e}", Utils.Err)
                Utils.log(traceback.format_exc(), Utils.Err)

            await asyncio.sleep(self.snap_period)

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

    def set_listener_configs(self, msg):
        stocks = msg.get('stocks')
        if stocks is None:
            return

        self.add_stock(stocks)

    def stop_simple_task(self):
        super().stop_simple_task()
        if hasattr(self, 'tdx_clients'):
            [c.disconnect() for c in self.tdx_clients]
        if WsIsUtils.save_db_enabled():
            auctions = {}
            for c, q in self.all_auctions.items():
                auctions[c] = {}
                auctions[c]['topprice'] = q['up_price']
                auctions[c]['bottomprice'] = q['down_price']
                auctions[c]['quotes'] = q['quotes']
            sad = StockAuctionDetails()
            today = TradingDate.maxTradingDate()
            sad.saveDailyAuctions(today, auctions)
        else:
            print('save daily auctions:', self.all_auctions)
