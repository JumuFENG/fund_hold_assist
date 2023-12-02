# Python 3
# -*- coding:utf-8 -*-

import json
import asyncio
from datetime import datetime
from utils import *
from history import StockAuctionDetails


class StrategyI_AuctionUp:
    ''' 竞价跌停,竞价结束时打开
    '''
    key = 'istrategy_auctionup'
    name = '竞价跌停打开'
    desc = '竞价跌停,竞价结束时打开跌停'
    snapshot_task_running = False
    auction_quote = {}
    broadcast_intrade = None
    matched = []

    @classmethod
    def add_subscription(self, websocket):
        self.clients.add(websocket)

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
                self.auction_quote[cd] = {'fcode': f'{"SZ" if m == 0 else "SH"}{cd}', 'quotes': self.get_trends(f'{m}.{cd}')}

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
                Utils.log(f'{code} buy match!')
                self.matched.append(code)
                if callable(self.broadcast_intrade):
                    await self.broadcast_intrade(self.key, code, float(auctions['quotes'][-1][1]) * (100 + uppercent) / 100)


class WsIntradeStrategyFactory:
    istrategies = [StrategyI_AuctionUp]

    @classmethod
    def all_available_istrategies(self):
        return [{'key': strategy.key, 'name': strategy.name, 'desc': strategy.desc} for strategy in self.istrategies]

    @classmethod
    def setup_intrade_strategies(self, func_broadcast):
        for strategy in self.istrategies:
            strategy.broadcast_intrade = func_broadcast

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
        loop = asyncio.get_event_loop()
        dnow = datetime.now()
        if dnow.hour < 9:
            loop.call_later(self.delay_seconds('9:20:1'), StrategyI_AuctionUp.check_dt_ranks)
            loop.call_later(self.delay_seconds('9:20:2'), lambda: asyncio.ensure_future(StrategyI_AuctionUp.start_snapshot_task()))
            loop.call_later(self.delay_seconds('9:24:55'), lambda: asyncio.ensure_future(StrategyI_AuctionUp.check_auction_trends(5)))
            loop.call_later(self.delay_seconds('9:25:8'), StrategyI_AuctionUp.stop_snapshot_task)
            loop.call_later(self.delay_seconds('9:25:16'), lambda: asyncio.ensure_future(StrategyI_AuctionUp.check_auction_trends(2)))
