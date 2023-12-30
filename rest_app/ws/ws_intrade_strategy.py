# Python 3
# -*- coding:utf-8 -*-

import json
import asyncio
from datetime import datetime
from utils import *
from history import StockAuctionDetails, StockGlobal
from pickup import StockZt1BreakupSelector


class StrategyI_AuctionUp:
    ''' 竞价跌停,竞价结束时打开
    '''
    key = 'istrategy_auctionup'
    name = '竞价跌停打开'
    desc = '竞价跌停,竞价结束时打开跌停'
    snapshot_task_running = False
    auction_quote = {}
    on_intrade_matched = None
    matched = []

    @classmethod
    def check_dt_ranks(self):
        Utils.log('check_dt_ranks')
        rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=0&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'''
        res = Utils.get_em_equest(rankUrl, host='33.push2.eastmoney.com')
        if res is None:
            return

        r = json.loads(res)
        if r['data'] is None or len(r['data']['diff']) == 0:
            return

        for rkobj in r['data']['diff']:
            c = rkobj['f2']   # 最新价
            zd = rkobj['f3']  # 涨跌幅
            ze = rkobj['f4']  # 涨跌额
            if c == '-' or zd == '-' or ze == '-' or zd > -8:
                continue
            cd = rkobj['f12'] # 代码
            if cd.startswith('00') or cd.startswith('60'):
                m = rkobj['f13']  # 市场代码 0 深 1 沪
                self.auction_quote[cd] = {'fcode': f'{StockGlobal.full_stockcode(cd)}', 'quotes': self.get_trends(f'{m}.{cd}')}

    @classmethod
    def get_trends(self, secid):
        trends_url = f'http://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbfba10b&secid={secid}&ndays=1&iscr=1&iscca=0'
        trends_data = Utils.get_em_equest(trends_url, 'push2his.eastmoney.com')
        trends_data = json.loads(trends_data)
        trends = []
        if 'data' in trends_data and 'trends' in trends_data['data']:
            for trd in trends_data['data']['trends']:
                trds = trd.split(',')
                ttime = trds[0].split()[1]
                trends.append([ttime, trds[1], 0, 0])
                if trds[2] != trds[1]:
                    trends.append([ttime+':01', trds[2], 0, 0])

        return trends

    @classmethod
    def get_snapshot(self, code):
        quote_url = f'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id={code}&callback=jSnapshotBack'

        responsetext = Utils.get_em_equest(quote_url, host='emhsmarketwg.eastmoneysec.com')
        snapshot_data = responsetext.replace('jSnapshotBack(', '').rstrip(');')
        snapshot = json.loads(snapshot_data)

        # 解析买一买二和卖一卖二的价格和数量
        buy1_price = snapshot['fivequote']['buy1']
        sell1_price = snapshot['fivequote']['sale1']
        buy1_count = snapshot['fivequote']['buy1_count']
        sell1_count = snapshot['fivequote']['sale1_count']
        current_price = snapshot['realtimequote']['currentPrice']
        quote_time = snapshot['realtimequote']['time']

        if 'topprice' not in self.auction_quote[code]:
            self.auction_quote[code]['topprice'] = snapshot['topprice']
            self.auction_quote[code]['bottomprice'] = snapshot['bottomprice']
            self.auction_quote[code]['lclose'] = snapshot['fivequote']['yesClosePrice']

        quote_mins = quote_time.split(':')
        quote_mins = int(quote_mins[0]) * 60 + int(quote_mins[1])
        if quote_mins < 565:
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

        self.auction_quote[code]['quotes'].append([quote_time, current_price, matched_vol, unmatched_vol])

    @classmethod
    async def start_snapshot_task(self):
        self.snapshot_task_running = True
        while self.snapshot_task_running:
            for code in self.auction_quote.keys():
                self.get_snapshot(code)
            await asyncio.sleep(5)

    @classmethod
    def stop_snapshot_task(self):
        self.snapshot_task_running = False
        sad = StockAuctionDetails()
        sad.saveDailyAuctions(Utils.today_date(), self.auction_quote)

    @classmethod
    def check_buy_match(self, auctions):
        bottomprice = auctions['bottomprice']
        quotes = auctions['quotes']
        btmcount = 0
        othercount = 0
        for i in range(1, len(quotes)):
            qt, cp, mv, uv = quotes[i]
            if cp == bottomprice:
                btmcount += 1
            else:
                othercount += 1

        return othercount < 5 and quotes[-1][1] > bottomprice

    @classmethod
    async def check_auction_trends(self, uppercent=2):
        for code, auctions in self.auction_quote.items():
            if code in self.matched:
                continue
            if self.check_buy_match(auctions):
                Utils.log(f'{code} buy match! {auctions["lclose"] if "lclose" in auctions else "0"}')
                self.matched.append(code)
                if callable(self.on_intrade_matched):
                    aucup_match_data = {'code': code, 'price': float(auctions['quotes'][-1][1]) * (100 + uppercent) / 100}
                    await self.on_intrade_matched(self.key, aucup_match_data, self.create_intrade_matched_message)

    @classmethod
    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:20') > 0:
            loop.call_later(Utils.delay_seconds('9:20:1'), self.check_dt_ranks)
            loop.call_later(Utils.delay_seconds('9:20:2'), lambda: asyncio.ensure_future(self.start_snapshot_task()))
            loop.call_later(Utils.delay_seconds('9:24:55'), lambda: asyncio.ensure_future(self.check_auction_trends(5)))
            loop.call_later(Utils.delay_seconds('9:25:8'), self.stop_snapshot_task)
            loop.call_later(Utils.delay_seconds('9:25:16'), lambda: asyncio.ensure_future(self.check_auction_trends(2)))
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Err)

    @classmethod
    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        amount = subscribe_detail['amount']
        code = match_data['code']
        price = round(float(match_data['price']), 2)
        count = Utils.calc_buy_count(amount, price)
        return {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': count}


class StrategyI_Zt1Breakup:
    ''' 首板突破60最高价
    '''
    key = 'istrategy_zt1brk'
    name = '首板突破'
    desc = '首板突破60最高价, 打板买入'
    on_intrade_matched = None
    candidates = []
    stock_matched = []
    stock_notified = []
    exist_changes = set()

    @classmethod
    async def start_changes_task(self):
        self.changes_task_running = True
        if len(self.candidates) == 0:
            szbs = StockZt1BreakupSelector()
            self.candidates = szbs.dumpLatesetCandidates(fullcode=False)
        while self.changes_task_running:
            self.get_changes()
            await asyncio.sleep(60)

    @classmethod
    def stop_changes_task(self):
        self.changes_task_running = False

    @classmethod
    def get_changes(self):
        self.chg_page = 0
        self.chg_pagesize = 1000
        self.fecthed = []
        self.get_next_changes()
        for c, f, t, i in self.fecthed:
            if c not in self.candidates:
                continue
            if c in self.stock_notified or c in self.stock_matched:
                continue
            if t == 8213 or t == 8201:
                self.stock_matched.append(c)
                Utils.log(f'get_changes add {c}')

    @classmethod
    def get_next_changes(self):
        t = '8213,8201,8193,8194,64,128'
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

    @classmethod
    def merge_fetched(self, changes):
        for chg in changes:
            code = chg['c']
            tm = str(chg['tm']).rjust(6, '0')
            ftm = f'{tm[0:2]}:{tm[2:4]}:{tm[4:6]}'
            tp = chg['t']
            info = chg['i']
            if (code, ftm, tp) not in self.exist_changes:
                self.fecthed.append([code, ftm, tp, info])
                self.exist_changes.add((code, ftm, tp))

    @classmethod
    async def check_changes_matched(self):
        if not callable(self.on_intrade_matched):
            return

        while self.changes_task_running or len(self.stock_matched) > 0:
            while len(self.stock_matched) > 0:
                code = self.stock_matched.pop(0)
                aucup_match_data = {'code': code}
                await self.on_intrade_matched(self.key, aucup_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(code)
            await asyncio.sleep(5)

    @classmethod
    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:30') > 0:
            loop.call_later(Utils.delay_seconds('9:30:1'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('9:30:1'), lambda: asyncio.ensure_future(self.check_changes_matched()))
            loop.call_later(Utils.delay_seconds('11:30:1'), self.stop_changes_task)
            loop.call_later(Utils.delay_seconds('13:00:1'), lambda: asyncio.ensure_future(self.start_changes_task()))
            loop.call_later(Utils.delay_seconds('13:00:1'), lambda: asyncio.ensure_future(self.check_changes_matched()))
            loop.call_later(Utils.delay_seconds('14:57:1'), self.stop_changes_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Err)

    @classmethod
    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        amount = subscribe_detail['amount']
        strategies = {
            "grptype": "GroupStandard",
            "strategies": {
                "0": { "key": "StrategyBuyZTBoard", "enabled": True },
                "1": { "key": "StrategySellELS", "enabled": False, "cutselltype": "single" },
                "2": { "key": "StrategySellBE", "enabled": False, "selltype": "single" }
            },
            "transfers": { "0": { "transfer": "-1" }, "1": { "transfer": "-1" }, "2": { "transfer": "-1" } },
            "amount": amount
        }
        code = match_data['code']
        return {'type':'intrade_addwatch', 'code': code, 'strategies': strategies, 'account': account}


class WsIntradeStrategyFactory:
    istrategies = [StrategyI_AuctionUp, StrategyI_Zt1Breakup]

    @classmethod
    def all_available_istrategies(self):
        return [{'key': strategy.key, 'name': strategy.name, 'desc': strategy.desc} for strategy in self.istrategies]

    @classmethod
    def setup_intrade_strategies(self, match_callback):
        for strategy in self.istrategies:
            strategy.on_intrade_matched = match_callback

    @classmethod
    def delay_seconds(self, daytime):
        dnow = datetime.now()
        dtarr = daytime.split(':')
        hr = int(dtarr[0])
        minutes = int(dtarr[1])
        secs = 0 if len(dtarr) < 3 else int(dtarr[2])
        target_time = dnow.replace(hour=hr, minute=minutes, second=secs)
        return (target_time - dnow).total_seconds()

    @classmethod
    async def create_tasks(self):
        for strategy in self.istrategies:
            await strategy.start_strategy_tasks()
