# Python 3
# -*- coding:utf-8 -*-

import json
import asyncio
from datetime import datetime
from utils import *
from history import StockAuctionDetails, StockGlobal, StockEmBk, StockHotRank, StockDumps
from pickup import StockZt1BreakupSelector, StockZt1HotrankSelector, StockBlackHotrank, StockZtDaily, StockZt1j2Selector

from rest_app.ws.ws_is_base import *


gstocks_st = []
save_db = True

def get_em_snapshot(code):
    quote_url = f'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id={code}&callback=jSnapshotBack'
    responsetext = Utils.get_em_request(quote_url, host='emhsmarketwg.eastmoneysec.com')
    snapshot_data = responsetext.replace('jSnapshotBack(', '').rstrip(');')
    return json.loads(snapshot_data)

def check_st_stock(code):
    global gstocks_st
    if len(gstocks_st) == 0:
        stbk = StockEmBk('BK0511')
        gstocks_st = stbk.dumpDataByDate()
        gstocks_st += [c[2:] for c in gstocks_st]
    return code in gstocks_st

def disable_save_db():
    global save_db
    save_db = False

def save_db_enabled():
    global save_db
    return save_db


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

    def check_dt_ranks(self):
        Utils.log('check_dt_ranks')
        rankUrl = f'''http://33.push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=0&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115,f152'''
        res = Utils.get_em_request(rankUrl, host='33.push2.eastmoney.com')
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

    def get_trends(self, secid):
        trends_url = f'http://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbfba10b&secid={secid}&ndays=1&iscr=1&iscca=0'
        trends_data = Utils.get_em_request(trends_url, 'push2his.eastmoney.com')
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

    def get_snapshot(self, code):
        snapshot = get_em_snapshot(code)

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

    async def start_snapshot_task(self):
        if self.snapshot_task_running:
            return

        self.snapshot_task_running = True
        while self.snapshot_task_running:
            for code in self.auction_quote.keys():
                self.get_snapshot(code)
            await asyncio.sleep(5)

    def stop_snapshot_task(self):
        self.snapshot_task_running = False
        if save_db_enabled():
            sad = StockAuctionDetails()
            sad.saveDailyAuctions(Utils.today_date(), self.auction_quote)

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

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:20') > 0:
            loop.call_later(Utils.delay_seconds('9:20:1'), self.check_dt_ranks)
            loop.call_later(Utils.delay_seconds('9:20:2'), lambda: asyncio.ensure_future(self.start_snapshot_task()))
            loop.call_later(Utils.delay_seconds('9:24:55'), lambda: asyncio.ensure_future(self.check_auction_trends(5)))
            loop.call_later(Utils.delay_seconds('9:25:8'), self.stop_snapshot_task)
            loop.call_later(Utils.delay_seconds('9:25:16'), lambda: asyncio.ensure_future(self.check_auction_trends(2)))
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_direct_buy(match_data, subscribe_detail)


class StrategyI_Zt1Breakup(StrategyI_StkChanges_Listener):
    ''' 首板突破60最高价
    '''
    key = 'istrategy_zt1brk'
    name = '首板突破'
    desc = '首板突破60最高价, 打板买入'
    on_intrade_matched = None
    candidates = []
    stock_notified = []

    async def on_watcher(self, fecthed):
        if len(self.candidates) == 0:
            szbs = StockZt1BreakupSelector()
            self.candidates = szbs.dumpLatesetCandidates(fullcode=False)

        for c, f, t, i in fecthed:
            if c not in self.candidates:
                continue
            if c in self.stock_notified:
                continue
            if t == 8213 or t == 8201:
                if not callable(self.on_intrade_matched):
                    continue

                chg_match_data = {'code': c}
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)
                Utils.log(f'get_changes add {c}')

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        amount = subscribe_detail['amount']
        strategies = {
            "grptype": "GroupStandard",
            "strategies": {
                "0": { "key": "StrategyBuyZTBoard", "enabled": True },
                "1": { "key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all" },
                "2": { "key": "StrategyGrid", "enabled": False, "buycnt": 3, "stepRate": 0.05 }
            },
            "transfers": { "0": { "transfer": "-1" }, "1": { "transfer": "-1" }, "2": { "transfer": "-1" } },
            "amount": amount
        }
        if 'amtkey' in subscribe_detail:
            strategies['uramount'] = {"key": subscribe_detail['amtkey']}
        code = match_data['code']
        return {'type':'intrade_addwatch', 'code': code, 'strategies': strategies, 'account': account}


class StrategyI_Zt1Hotrank(StrategyI_StkChanges_Listener):
    ''' 首板人气打板
    '''
    key = 'istrategy_zt1hr'
    name = '首板人气'
    desc = '首板人气高, 排队/打板'
    on_intrade_matched = None
    shr = None
    hrlistener = StrategyI_Hotrank_Listener()
    stock_notified = []
    latest_ranks = {}
    rankjqka = {}
    ranktgb = {}
    zt_recent = []
    changes_matched = []

    async def start_strategy_tasks(self):
        self.hrlistener.on_watcher = self.on_hotrank_fetched
        await super().start_strategy_tasks()
        await self.hrlistener.start_strategy_tasks()

    async def on_hotrank_fetched(self, hotranks):
        rk, rkjqka, rktgb = hotranks
        if rk is not None:
            self.latest_ranks = rk
        if rkjqka is not None:
            self.rankjqka = rkjqka
        if rktgb is not None:
            self.ranktgb = rktgb

    async def on_watcher(self, fecthed):
        if len(self.zt_recent) == 0:
            szbs = StockZtDaily()
            self.zt_recent = szbs.dumpZtStocksInDays(3, False)

        for c, f, t, i in fecthed:
            if c in self.zt_recent: continue
            if check_st_stock(c): continue
            if (c,t) in self.stock_notified: continue
            # if c not in self.latest_ranks: continue
            # if t != 4: continue
            # if not callable(self.on_intrade_matched):
            #     continue
            price = 1
            if t == 4:
                price = float(i.split(',')[0])
            elif t == 64 or t == 128 or t == 8193 or t == 8194 or t == 8201 or t == 8213:
                price = float(i.split(',')[1])
            chg_match_data = {'code': c, 'price': price}
            await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
            self.stock_notified.append((c, t))
            self.changes_matched.append([
                c, f, t, self.latest_ranks[c]['rank'] if c in self.latest_ranks else 0,
                self.rankjqka[c] if c in self.rankjqka else 0, self.ranktgb[c] if c in self.ranktgb else 0,
                self.latest_ranks[c]['newfans'] if c in self.latest_ranks else 0, i])
            Utils.log(f'get_changes add {c}, {t}')

    def on_taskstop(self):
        szh = StockZt1HotrankSelector()
        self.changes_matched = sorted(self.changes_matched, key=lambda c: c[2])
        if save_db_enabled():
            szh.setChanges(self.changes_matched)
        else:
            print('zt1hr setChanges', self.changes_matched)
        self.changes_matched = []


class StrategyI_EndAuc_Nzt(StrategyI_EndAuction_Listener):
    ''' 盘中触及涨停价，尾盘竞价买入
    '''
    key = 'istrategy_eaucnzt'
    name = '炸板尾盘买入'
    desc = '盘中触及涨停, 尾盘竞价买入, 次日开盘卖出, 选上影线最小者.'
    on_intrade_matched = None
    sd = StockDumps()

    async def on_watcher(self, quotes):
        ushadows = []
        for code, knode in quotes:
            if knode.open > knode.close:
                continue
            if not code.startswith('SH60') and not code.startswith('SZ00'):
                continue
            if knode.close < 1:
                # 股价低于1元
                continue
            if knode.high > knode.close and knode.high >= Utils.zt_priceby(knode.lclose):
                allkl = self.sd.read_kd_data(code, fqt=1, length=10)
                if allkl is None:
                    continue
                allkl = [KNode(kl) for kl in allkl]
                if len([kl for kl in allkl if kl.pchange > 9 and kl.high == kl.close]) > 2:
                    # 10日内涨停数>2, 忽略
                    continue
                if ((allkl[-1].high == allkl[-1].close and Utils.zt_priceby(allkl[-2].close))
                    ) or (
                    (allkl[-2].high == allkl[-2].close and Utils.zt_priceby(allkl[-3].close))):
                    # 前两个交易日有涨停, 忽略
                    continue
                ushadows.append([code, round((knode.high - knode.close) * 100 / knode.lclose, 2), knode])
        if len(ushadows) == 0:
            return

        mncode, mnshadow, knode = sorted(ushadows, key=lambda x: x[1])[0]
        mncode = mncode.lstrip('SH').lstrip('SZ')
        if callable(self.on_intrade_matched):
            mnshadow_match_data = {'code': mncode, 'price': knode.high}
            await self.on_intrade_matched(self.key, mnshadow_match_data, self.create_intrade_matched_message)


class StrategyI_HighClose(StrategyI_EndAuction_Listener):
    ''' 收盘价为当日最高价，尾盘竞价买入
    '''
    key = 'istrategy_highclose'
    name = '光头阳线尾盘买入'
    desc = '收盘价为当日最高价尾盘竞价买入, 次日开盘卖出, 选涨跌幅最大者.'
    on_intrade_matched = None

    async def on_watcher(self, quotes):
        hcloses = []
        for code, knode in quotes:
            if not code.startswith('SH60') and not code.startswith('SZ00'):
                continue
            if check_st_stock(code) or knode.close < 1:
                # ST股或股价低于1元
                continue
            if knode.high == knode.close and knode.high > knode.low and knode.close < Utils.zt_priceby(knode.lclose):
                hcloses.append([code, knode.pchange, knode])

        if len(hcloses) == 0:
            return
        mxcode, mxhclose, knode = sorted(hcloses, key=lambda x: x[1], reverse=True)[0]
        mxcode = mxcode.lstrip('SH').lstrip('SZ')
        if callable(self.on_intrade_matched):
            mnshadow_match_data = {'code': mxcode, 'price': round(Utils.zt_priceby(knode.lclose), 2)}
            await self.on_intrade_matched(self.key, mnshadow_match_data, self.create_intrade_matched_message)


class StrategyI_HotrankOpen(StrategyI_Hotrank_Once_Listener):
    ''' 开盘人气排行
    '''
    key = 'istrategy_hotrank0'
    name = '开盘人气排行'
    desc = '不涨停且股价大于水下一半 选人气排行最靠前且新增粉丝>70%'
    on_intrade_matched = None
    hotblack = None
    stockranks = []
    latest_ranks = None
    rankjqka = None
    ranktgb = None

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:20') > 0:
            loop.call_later(Utils.delay_seconds('9:24:54'), lambda: asyncio.ensure_future(self.start_check_task()))
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def on_watcher(self, hotranks):
        self.latest_ranks, self.rankjqka, self.ranktgb = hotranks
        if self.latest_ranks is None or self.rankjqka is None or self.ranktgb is None:
            return

        rank20 = []
        for code, rf in self.latest_ranks.items():
            rankNumber=rf['rank']
            newFans = rf['newfans']
            if rankNumber <= 20:
                rank20.append([code, rankNumber])
            if newFans < 70 or rankNumber > 40:
                continue

            # if code not in self.rankjqka and code not in self.ranktgb:
            #     continue

            rkobj = {'code': code, 'rank': rankNumber, 'newfans': newFans}
            rkobj['rkjqka'] = self.rankjqka[code] if code in self.rankjqka else 0
            rkobj['rktgb'] = self.ranktgb[code] if code in self.ranktgb else 0
            self.stockranks.append(rkobj)

        if self.hotblack is None:
            self.hotblack = StockBlackHotrank()
        if len(rank20) > 0:
            self.hotblack.check_quit(rank20)

    def get_first_available(self, candidates, blacklist):
        for candidate in candidates:
            if candidate['code'] not in blacklist:
                return candidate

    def check_snapshot(self, snapshot):
        try:
            name = snapshot['name']
            if name.startswith('退市') or name.endswith('退'):
                return False
            topprice = float(snapshot['topprice'])
            bottomprice = float(snapshot['bottomprice'])
            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            return current_price < topprice and current_price > 1 and current_price > (bottomprice + lclose) / 2
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankOpen.check_snapshot {e}', Utils.Err)
            return False

    async def start_check_task(self):
        checked_ranks = []
        for rk in self.stockranks:
            code = rk['code']
            snapshot = get_em_snapshot(code)
            if snapshot['status'] != 0:
                continue

            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            zdf = round((current_price - lclose)*100/lclose, 2)
            Utils.log(f'{rk} {snapshot["topprice"]} {snapshot["bottomprice"]} {snapshot["realtimequote"]["currentPrice"]}, {zdf}')
            if self.check_snapshot(snapshot):
                topprice = 0 if snapshot['topprice'] == '-' else float(snapshot['topprice'])
                checked_ranks.append({'code': code, 'rank': rk['rank'], 'price': current_price, 'topprice': topprice, 'zdf': zdf})

        if self.hotblack is None:
            self.hotblack = StockBlackHotrank()
        candidate = self.get_first_available(checked_ranks, self.hotblack.dumpDataByDate())
        if candidate is not None and callable(self.on_intrade_matched):
            hro_match_data = {'code': candidate['code'], 'price': candidate['topprice']}
            await self.on_intrade_matched(self.key, hro_match_data, self.create_intrade_matched_message)
            if save_db_enabled():
                self.hotblack.add(candidate['code'], Utils.today_date())


class StrategyI_HotrankClose(StrategyI_HotrankOpen):
    ''' 收盘人气排行
    '''
    key = 'istrategy_hotrank1'
    name = '收盘人气排行'
    desc = '盘中不触及涨停且股价大于水下一半 选人气排行最靠前且新增粉丝>70%'
    watcher = StrategyI_Hotrank_Once_Watcher()

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('14:50') > 0:
            loop.call_later(Utils.delay_seconds('14:50'), self.watcher.add_listener, self)
            loop.call_later(Utils.delay_seconds('14:55:50'), lambda: asyncio.ensure_future(self.watcher.start_hotrank_task()))
            loop.call_later(Utils.delay_seconds('14:59:50'), lambda: asyncio.ensure_future(self.start_check_task()))
            loop.call_later(Utils.delay_seconds('15:0:15'), self.watcher.stop_hotrank_task)
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    def check_snapshot(self, snapshot):
        try:
            topprice = float(snapshot['topprice'])
            bottomprice = float(snapshot['bottomprice'])
            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            high_price = float(snapshot['realtimequote']['high'])
            # 尾盘买入时排除炸板票
            return high_price < topprice and current_price > 1 and current_price < topprice and current_price > (bottomprice + lclose) / 2
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankClose.check_snapshot {e}', Utils.Err)
            return False


class StrategyI_Zt1j2Open(StrategyI_Hotrank_Once_Listener):
    ''' 1进2
    '''
    key = 'istrategy_zt1j2'
    name = '开盘1进2'
    desc = '开盘买入昨日首板股, 选新增粉丝>70%且人气排名靠前者前5买入'
    on_intrade_matched = None
    szt1j2 = None
    zt1j2_candidates = None
    stockranks = []
    latest_ranks = None
    rankjqka = None
    ranktgb = None

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:20') > 0:
            loop.call_later(Utils.delay_seconds('9:22:54'), lambda: asyncio.ensure_future(self.start_check_task()))
        else:
            Utils.log(f'{__class__.__name__} start time expired.', Utils.Warn)

    async def on_watcher(self, hotranks):
        self.latest_ranks, self.rankjqka, self.ranktgb = hotranks
        if self.latest_ranks is None:
            return
        if self.szt1j2 is None:
            self.szt1j2 = StockZt1j2Selector()
        self.zt1j2_candidates = {c[2:]: [c,d,s] for c, d, s in self.szt1j2.getCandidates()}
        rkvalues = []
        for code, rf in self.latest_ranks.items():
            rankNumber = rf['rank']
            newFans = rf['newfans']
            if code not in self.zt1j2_candidates:
                continue
            rkval = self.zt1j2_candidates[code][0:2]
            rkval.append(rankNumber)
            rkval.append(self.rankjqka[code] if code in self.rankjqka else 0)
            rkval.append(self.ranktgb[code] if code in self.ranktgb else 0)
            rkval.append(newFans)
            rkvalues.append(rkval)
            if newFans < 70:
                continue
            if self.zt1j2_candidates[code][2] != 1:
                continue
            rkobj = {'code': code, 'rank': rankNumber,'newfans': newFans}
            rkobj['rkjqka'] = self.rankjqka[code] if code in self.rankjqka else 0
            rkobj['rktgb'] = self.ranktgb[code] if code in self.ranktgb else 0
            self.stockranks.append(rkobj)
        if len(rkvalues) > 0:
            if save_db_enabled():
                self.szt1j2.updateRanks(rkvalues)
            else:
                print('zt1j2 updateRanks', rkvalues)

    def check_snapshot(self, snapshot):
        try:
            topprice = float(snapshot['topprice'])
            bottomprice = float(snapshot['bottomprice'])
            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            return topprice > 0 and bottomprice > 0 and lclose > 0 and current_price > 0
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankOpen.check_snapshot {e}', Utils.Err)
            return False

    async def start_check_task(self):
        today = Utils.today_date()
        bivalues = []
        for rk in self.stockranks:
            code = rk['code']
            snapshot = get_em_snapshot(code)
            if snapshot['status'] != 0:
                continue

            if self.check_snapshot(snapshot):
                topprice = 0 if snapshot['topprice'] == '-' else float(snapshot['topprice'])
                if callable(self.on_intrade_matched) and len(bivalues) < 5:
                    mnshadow_match_data = {'code': code, 'price': topprice}
                    await self.on_intrade_matched(self.key, mnshadow_match_data, self.create_intrade_matched_message)

                    bival = self.zt1j2_candidates[code][0:2]
                    bival.append(today)
                    bival.append(1)
                    bivalues.append(bival)
        if len(bivalues) > 0:
            if save_db_enabled():
                self.szt1j2.updateBuyInfo(bivalues)
            else:
                print('zt1j2 updateBuyInfo', bivalues)


class WsIntradeStrategyFactory:
    istrategies = [
        StrategyI_AuctionUp(), StrategyI_Zt1Breakup(), StrategyI_EndAuc_Nzt(), StrategyI_HighClose(),
        StrategyI_HotrankOpen(), StrategyI_HotrankClose(), StrategyI_Zt1Hotrank(), StrategyI_Zt1j2Open()]

    @classmethod
    def all_available_istrategies(self):
        return [{'key': strategy.key, 'name': strategy.name, 'desc': strategy.desc} for strategy in self.istrategies]

    @classmethod
    def setup_intrade_strategies(self, match_callback):
        for strategy in self.istrategies:
            strategy.on_intrade_matched = match_callback

    @classmethod
    async def create_tasks(self):
        if Utils.today_date() != TradingDate.maxTradingDate():
            Utils.log(f'today is not trading day!', Utils.Warn)
            return

        for strategy in self.istrategies:
            await strategy.start_strategy_tasks()
