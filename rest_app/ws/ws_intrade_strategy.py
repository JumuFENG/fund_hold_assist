# Python 3
# -*- coding:utf-8 -*-

import json
import asyncio
from datetime import datetime
from utils import *
from history import StockAuctionDetails, StockGlobal, StockDumps, StockBkMap
from pickup import StockZt1BreakupSelector, StockZt1HotrankSelector, StockBlackHotrank, StockZt1j2Selector, StockZt1BkSelector
from pickup import StockAuctionUpSelector, StockTrippleBullSelector, StockEndVolumeSelector
from training.models import ModelAnn1j2, ModelAnnEndVolume

from rest_app.ws.ws_is_base import *


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
    auction_selector = None

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
            snapshot = Utils.get_em_snapshot(cd)
            if snapshot['topprice'] == '-' or snapshot['bottomprice'] == '-':
                continue
            if c != float(snapshot['bottomprice']):
                continue
            if WsIsUtils.is_stock_blacked(cd) or WsIsUtils.to_be_divided(cd):
                continue
            if self.auction_selector is None:
                self.auction_selector = StockAuctionUpSelector()
            fcode = StockGlobal.full_stockcode(cd)
            zddays = self.auction_selector.calc_dzt_num(fcode, Utils.today_date())
            m = rkobj['f13']  # 市场代码 0 深 1 沪
            self.auction_quote[cd] = {'fcode': fcode, 'quotes': self.get_trends(f'{m}.{cd}'), 'zddays': zddays}

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

        return trends[1:]

    def get_snapshot(self, code):
        snapshot = Utils.get_em_snapshot(code)

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
        if WsIsUtils.save_db_enabled():
            sad = StockAuctionDetails()
            today = Utils.today_date()
            sad.saveDailyAuctions(today, self.auction_quote)
            if self.auction_selector is not None:
                values = []
                for c in self.auction_quote:
                    if c not in self.matched:
                        continue
                    q = self.auction_quote[c]
                    if q['topprice'] == '-' and q['bottomprice'] == '-':
                        continue
                    fcode = q['fcode'] if 'fcode' in q else StockGlobal.full_stockcode(c)
                    zdays, zdist, ddays, ddist = q['zddays']
                    values.append([fcode, today, q['topprice'], q['bottomprice'], zdays, zdist, ddays, ddist])
                self.auction_selector.save_daily_auction_matched(values)

    async def check_auction_trends(self, uppercent=2):
        for code, auctions in self.auction_quote.items():
            if code in self.matched:
                continue
            if not (code.startswith('00') or code.startswith('60')):
                continue
            zdays, zdist, ddays, ddist = auctions['zddays']
            if zdays > 0 or zdist > 0 or ddays == 0 or ddist >= ddays:
                continue
            if StockAuctionDetails.check_buy_match(auctions) or StockAuctionDetails.check_buy_vol_more_match(auctions):
                Utils.log(f'{code} buy match! {auctions["lclose"] if "lclose" in auctions else "0"}')
                self.matched.append(code)
                if callable(self.on_intrade_matched):
                    price = float(auctions['quotes'][-1][1]) * (100 + uppercent) / 100
                    if auctions['quotes'][-1][1] == auctions['bottomprice']:
                        price = float(auctions["lclose"]) * 0.97
                    aucup_match_data = {'code': code, 'price': price}
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


class StrategyI_Zt1Breakup(StrategyI_Listener):
    ''' 首板突破60最高价
    '''
    key = 'istrategy_zt1brk'
    name = '首板突破'
    desc = '首板突破60最高价, 打板买入'
    on_intrade_matched = None
    candidates = []
    stock_notified = []

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkchanges')

    async def on_watcher(self, fecthed):
        if len(self.candidates) == 0:
            szbs = StockZt1BreakupSelector()
            self.candidates = szbs.dumpLatesetCandidates(fullcode=False)

        for c, f, t, i in fecthed:
            if c not in self.candidates:
                continue
            if c in self.stock_notified:
                continue
            if WsIsUtils.is_stock_blacked(c):
                continue
            if t == 8213 or t == 8201:
                if not callable(self.on_intrade_matched):
                    continue
                p,prc,x = i.split(',')
                p, prc = float(p), float(prc)
                zdf = 0.3
                if c.startswith('30') or c.startswith('68'):
                    zdf = 0.2
                elif c.startswith('60') or c.startswith('00'):
                    zdf = 0.1
                price = prc * (1 + zdf) / (1+p)
                chg_match_data = {'code': c, 'price': price}
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        amount = subscribe_detail['amount']
        price = round(float(match_data['price']), 2)
        strategies = {
            "grptype": "GroupStandard",
            "strategies": {
                "0": { "key": "StrategyBuyZTBoard", "enabled": True },
                "1": { "key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all", "topprice": round(price * 1.05, 2) },
                "2": { "key": "StrategyGrid", "enabled": False, "buycnt": 3, "stepRate": 0.05 }
            },
            "transfers": { "0": { "transfer": "-1" }, "1": { "transfer": "-1" }, "2": { "transfer": "-1" } },
            "amount": amount
        }
        if 'amtkey' in subscribe_detail:
            strategies['uramount'] = {"key": subscribe_detail['amtkey']}
        code = match_data['code']
        return {'type':'intrade_addwatch', 'code': code, 'strategies': strategies, 'account': account}


class StrategyI_Zt1Hotrank(StrategyI_Listener):
    ''' 首板人气打板
    '''
    key = 'istrategy_zt1hr'
    name = '首板人气'
    desc = '首板人气高, 排队/打板'
    on_intrade_matched = None
    shr = None
    stock_notified = []
    latest_ranks = {}
    rankjqka = {}
    ranktgb = {}
    changes_matched = []

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkchanges')
        self.hrwatcher = WsIsUtils.get_watcher('hotrank')
        self.hrlistener = StrategyI_Listener()
        self.hrlistener.watcher = self.hrwatcher
        self.hrlistener.on_watcher = self.on_hotrank_fetched

    async def start_strategy_tasks(self):
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
        for c, f, t, i in fecthed:
            if WsIsUtils.recent_zt(c): continue
            if WsIsUtils.is_stock_blacked(c): continue
            if WsIsUtils.to_be_divided(c): continue
            if (c,t) in self.stock_notified: continue
            price = 1
            if t == 4:
                price = float(i.split(',')[0])
            elif t == 64 or t == 128 or t == 8193 or t == 8194 or t == 8201 or t == 8213:
                price = float(i.split(',')[1])
            if price < 1:
                continue
            chg_match_data = {'code': c, 'price': price}
            if c in self.latest_ranks and t == 4 and callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append((c, t))
            self.changes_matched.append([
                c, f, t, self.latest_ranks[c]['rank'] if c in self.latest_ranks else 0,
                self.rankjqka[c] if c in self.rankjqka else 0, self.ranktgb[c] if c in self.ranktgb else 0,
                self.latest_ranks[c]['newfans'] if c in self.latest_ranks else 0, i])

    def on_taskstop(self):
        self.changes_matched = sorted(self.changes_matched, key=lambda c: c[2])
        if WsIsUtils.save_db_enabled():
            szh = StockZt1HotrankSelector()
            szh.setChanges(self.changes_matched)
        else:
            print('zt1hr setChanges', self.changes_matched)
        self.changes_matched = []

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_Zt1Bk(StrategyI_Listener):
    ''' 热门板块首板打板
    '''
    key = 'istrategy_zt1bk'
    name = '首板板块'
    desc = '首板板块主力净流入多, 排队/打板'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkchanges')
        self.bkwatcher = WsIsUtils.get_watcher('bkchanges')
        self.bklistener = StrategyI_Listener()
        self.bklistener.watcher = self.bkwatcher
        self.bklistener.on_watcher = self.on_bk_changes
        self.candidates_bkstks = []
        self.changes_matched = []
        self.stock_notified = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.bklistener.start_strategy_tasks()

    def select_bk_of(self, bk_changes, attr, count=3):
        '''选择异动板块
        @param bk_changes 所有异动
        @param attr 属性名: p_change, ydpos, ztcnt...
        @param count 数量, 选排序最靠前的n个
        '''
        s_changes = [chg for chg in bk_changes if attr in chg]
        if len(s_changes) == 0:
            return []
        s_changes = sorted(s_changes, key=lambda x: x[attr], reverse=True)
        mtbk = [s_changes[0][column_code]]
        bkpked = 1
        i = 1
        while bkpked < 3 and i < len(s_changes):
            bkstks1 = set(WsIsUtils.get_bk_stocks(s_changes[i][column_code]))
            similar = False
            for bk in mtbk:
                bkstks0 = set(WsIsUtils.get_bk_stocks(bk))
                cntstks = min(len(bkstks0), len(bkstks1))
                if cntstks == 0:
                    Utils.log(f'bkstock is empty {bk}: {len(bkstks0)}, {s_changes[i][column_code]} {len(bkstks1)}')
                    cntstks = max(len(bkstks0), len(bkstks1))
                    if cntstks == 0:
                        continue
                if len(bkstks0.intersection(bkstks1)) / min(len(bkstks0), len(bkstks1)) > 0.3:
                    similar = True
                    break
            if not similar:
                mtbk.append(s_changes[i][column_code])
                bkpked += 1
            i += 1
        return mtbk

    async def on_bk_changes(self, bk_changes):
        mtbk = self.select_bk_of(bk_changes, column_amount)
        mtbk += self.select_bk_of(bk_changes, column_p_change)
        mtbk += self.select_bk_of(bk_changes, 'ydabs')
        mtbk += self.select_bk_of(bk_changes, 'ztcnt')
        mtbk = list(set(mtbk))
        Utils.log(f'bk changes selected: {mtbk}')

        candidates = []
        for bk in mtbk:
            candidates += [s[2:] for s in WsIsUtils.get_bk_stocks(bk)]
        self.candidates_bkstks = []
        for s in set(candidates):
            if WsIsUtils.is_stock_blacked(s) or WsIsUtils.recent_zt(s) or WsIsUtils.to_be_divided(s):
                continue
            self.candidates_bkstks.append(s)
        Utils.log(f'candidates_bkstks: {len(self.candidates_bkstks)}')

    async def on_watcher(self, fecthed):
        for c, f, t, i in fecthed:
            if t != 4: continue
            if c in self.stock_notified: continue
            if c not in self.candidates_bkstks: continue
            if not callable(self.on_intrade_matched):
                continue
            price = float(i.split(',')[0])
            chg_match_data = {'code': c, 'price': price}
            await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
            self.changes_matched.append([c, f, t, i])
            self.stock_notified.append(c)

    def on_taskstop(self):
        if WsIsUtils.save_db_enabled():
            szh = StockZt1BkSelector()
            szh.setChanges(self.changes_matched)
        else:
            print('zt1bk setChanges', self.changes_matched)
        self.changes_matched = []

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_EndAuc_Nzt(StrategyI_Listener):
    ''' 盘中触及涨停价，尾盘竞价买入
    '''
    key = 'istrategy_eaucnzt'
    name = '炸板尾盘买入'
    desc = '盘中触及涨停, 尾盘竞价买入, 次日开盘卖出, 选上影线最小者.'
    watcher = WsIsUtils.get_watcher('endauction')
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
                if len(allkl) < 3:
                    Utils.log(f'kldata not valid, {code}, {allkl}', Utils.Warn)
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


class StrategyI_HighClose(StrategyI_Listener):
    ''' 收盘价为当日最高价，尾盘竞价买入
    '''
    key = 'istrategy_highclose'
    name = '光头阳线尾盘买入'
    desc = '收盘价为当日最高价尾盘竞价买入, 次日开盘卖出, 选涨跌幅最大者.'
    watcher = WsIsUtils.get_watcher('endauction')
    on_intrade_matched = None

    async def on_watcher(self, quotes):
        hcloses = []
        for code, knode in quotes:
            if not code.startswith('SH60') and not code.startswith('SZ00'):
                continue
            if WsIsUtils.is_stock_blacked(code) or WsIsUtils.to_be_divided(code) or knode.close < 1:
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


class StrategyI_HotrankOpen(StrategyI_Listener):
    ''' 开盘人气排行
    '''
    key = 'istrategy_hotrank0'
    name = '开盘人气排行'
    desc = '不涨停且股价大于水下一半 选人气排行最靠前且新增粉丝>70%'
    on_intrade_matched = None
    hotblack = None
    latest_ranks = None
    rankjqka = None
    ranktgb = None

    def __init__(self):
        self.stockranks = []
        self.watcher = WsIsUtils.get_watcher('hotrank_open')
        self.taskwatcher = StrategyI_Simple_Watcher('9:24:54')
        self.taskwatcher.execute_simple_task = self.start_check_task

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.taskwatcher.start_strategy_tasks()

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
            if WsIsUtils.is_stock_blacked(code) or WsIsUtils.to_be_divided(code):
                continue
            snapshot = Utils.get_em_snapshot(code)
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
            hro_match_data = {'code': candidate['code'], 'price': min(candidate['price'] * 1.05, candidate['topprice'])}
            await self.on_intrade_matched(self.key, hro_match_data, self.create_intrade_matched_message)
            if WsIsUtils.save_db_enabled():
                self.hotblack.add(candidate['code'], Utils.today_date())


class StrategyI_HotrankClose(StrategyI_HotrankOpen):
    ''' 收盘人气排行
    '''
    key = 'istrategy_hotrank1'
    name = '收盘人气排行'
    desc = '盘中不触及涨停且股价大于水下一半 选人气排行最靠前且新增粉丝>70%'

    def __init__(self):
        self.stockranks = []
        self.watcher =  WsIsUtils.get_watcher('hotrank_close')
        self.taskwatcher = StrategyI_Simple_Watcher('14:55:50')
        self.taskwatcher.execute_simple_task = self.start_check_task
        self.tasklistner = StrategyI_Listener()
        self.tasklistner.watcher = self.taskwatcher

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


class StrategyI_Zt1j2Open(StrategyI_Listener):
    ''' 1进2
    '''
    key = 'istrategy_zt1j2'
    name = '开盘1进2'
    desc = '开盘买入昨日首板股, 选新增粉丝>70%且人气排名靠前者前5买入'
    on_intrade_matched = None
    szt1j2 = None
    zt1j2_candidates = None
    latest_ranks = None
    rankjqka = None
    ranktgb = None
    model1j2 = None

    def __init__(self):
        self.stockranks = []
        self.watcher = WsIsUtils.get_watcher('hotrank_open')
        self.taskwatcher = StrategyI_Simple_Watcher('9:22:54')
        self.taskwatcher.execute_simple_task = self.start_check_task

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.taskwatcher.start_strategy_tasks()

    async def on_watcher(self, hotranks):
        self.latest_ranks, self.rankjqka, self.ranktgb = hotranks
        if self.latest_ranks is None:
            return
        if self.szt1j2 is None:
            self.szt1j2 = StockZt1j2Selector()
        self.zt1j2_candidates = {cds[0][2:]: list(cds) for cds in self.szt1j2.getCandidates()}
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
            # if newFans < 70:
            #     continue
            # if self.zt1j2_candidates[code][2] != 1:
            #     continue
            rkobj = {'code': code, 'rank': rankNumber,'newfans': newFans}
            rkobj['rkjqka'] = self.rankjqka[code] if code in self.rankjqka else 0
            rkobj['rktgb'] = self.ranktgb[code] if code in self.ranktgb else 0
            rkobj['pscore'] = 0
            self.stockranks.append(rkobj)
        pvdata = []
        for rk in self.stockranks:
            code = rk['code']
            p = rk['rank']
            if p == 0: p = 100
            pt = rk['rkjqka']
            if pt == 0: pt = 100
            pg = rk['rktgb']
            if pg == 0: pg = 100
            f = rk['newfans']
            pv = [p/100, pt/100, pg/100, f/100]
            pv += self.zt1j2_candidates[code][3:]
            pvdata.append(pv)
        if self.model1j2 is None:
            self.model1j2 = ModelAnn1j2()
        if len(pvdata) > 0:
            pscores = self.model1j2.predict(pvdata)
            for i in range(0, len(pscores)):
                self.stockranks[i]['pscore'] = pscores[i][0]
        if len(rkvalues) > 0:
            if WsIsUtils.save_db_enabled():
                self.szt1j2.updateRanks(rkvalues)
            else:
                print('zt1j2 updateRanks', rkvalues)

    def check_snapshot(self, snapshot):
        try:
            topprice = float(snapshot['topprice'])
            bottomprice = float(snapshot['bottomprice'])
            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            return topprice > 0 and bottomprice > 0 and lclose > 0 and current_price > 1
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankOpen.check_snapshot {e}', Utils.Err)
            return False

    async def start_check_task(self):
        today = Utils.today_date()
        bivalues = []
        for rk in self.stockranks:
            if rk['pscore'] < 0.5:
                continue
            code = rk['code']
            snapshot = Utils.get_em_snapshot(code)
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
            if WsIsUtils.save_db_enabled():
                self.szt1j2.updateBuyInfo(bivalues)
            else:
                print('zt1j2 updateBuyInfo', bivalues)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_3Bull_Breakup(StrategyI_Listener):
    ''' 三阳开泰
    '''
    key = 'istrategy_3brk'
    name = '三阳开泰'
    desc = '连续3根阳线价升量涨 以突破此3根阳线的最高价为买入点 以第一根阳线到买入日期之间的最低价为止损价 止盈设置5%'
    on_intrade_matched = None
    s3btbl = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('snapshot_5m')
        self.prewatcher = StrategyI_Simple_Watcher('9:28')
        self.prewatcher.execute_simple_task = self.prepare_candidates
        self.candidates = {}
        self.stock_notified = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.prewatcher.start_strategy_tasks()

    async def prepare_candidates(self):
        if self.s3btbl is None:
            self.s3btbl = StockTrippleBullSelector()
        chl = self.s3btbl.getLatestCandidatesHighLow()
        for c, h, l in chl:
            if WsIsUtils.is_stock_blacked(c) or WsIsUtils.to_be_divided(c):
                continue
            snap = Utils.get_em_snapshot(c)
            if snap['topprice'] == '-' or float(snap['topprice']) <= h:
                continue
            self.candidates[c] = {'high': h, 'low': l}
        self.watcher.add_stock(self.candidates.keys())

    async def on_watcher(self, csnapshot):
        code = csnapshot['code']
        if code not in self.candidates:
            return

        if csnapshot['price'] <= self.candidates[code]['high']:
            return

        if callable(self.on_intrade_matched) and csnapshot['price'] < 1.05 * self.candidates[code]['high'] and csnapshot['sell2'] > 0:
            mdata = {'code': code, 'price': csnapshot['sell2'], 'cutline': self.candidates[code]['low']}
            await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)

        self.candidates.pop(code)
        self.watcher.remove_stock(code)
        self.stock_notified.append(code)

    def on_taskstop(self):
        if WsIsUtils.save_db_enabled():
            for code in self.stock_notified:
                self.s3btbl.setFdate(code)
        else:
            print ('save notified', self.stock_notified)
        self.stock_notified = []

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_EVolume(StrategyI_Listener):
    ''' 尾盘竞价爆量
    '''
    key = 'istrategy_evol'
    name = '尾盘竞价爆量'
    desc = '收盘集合竞价爆量 竞价成交量>0.04*全天成交量 换手>1% 成交额>1000万 30日内有涨停'
    on_intrade_matched = None
    evoltbl = None
    modelevol = None

    def __init__(self):
        self.watcher = StrategyI_Simple_Watcher('9:23')
        self.watcher.execute_simple_task = self.execute_open_task
        self.candidates = {}
        self.stock_notified = []

    async def execute_open_task(self):
        evoltbl = StockEndVolumeSelector()
        mx_tdate = TradingDate.maxTradingDate()
        if mx_tdate == Utils.today_date():
            candi_date = TradingDate.prevTradingDate(mx_tdate)
            tx, ty, tests = evoltbl.dumpTrainingData(candi_date)
            if len(tx) > 0:
                tests += tx
            if self.modelevol is None:
                self.modelevol = ModelAnnEndVolume()
            pre = self.modelevol.predict([t[2:] for t in tests])
            candidates = []
            for t,p in zip(tests, pre):
                if p >= 0.5:
                    candidates.append(t[0][2:])
                    Utils.log(f'evol model predict {t[0]} {t[1]} with score {p}')
            # TODO: use the predicted values when needed!
            candidates = evoltbl.dumpLatesetCandidates(candi_date, False)
            for c in candidates:
                if WsIsUtils.is_stock_blacked(c): continue
                if WsIsUtils.to_be_divided(c): continue
                snapshot = Utils.get_em_snapshot(c)
                price = 0 if snapshot['realtimequote']['currentPrice'] == '-' else float(snapshot['realtimequote']['currentPrice'])
                top_price = 0 if snapshot['topprice'] == '-' else float(snapshot['topprice'])
                if top_price == 0:
                    continue
                if price == 0:
                    price = top_price
                price = min(price * 1.02, top_price)
                if callable(self.on_intrade_matched):
                    mdata = {'code': c, 'price': price}
                    await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
                    self.stock_notified.append(c)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_Zt1H_Bk(StrategyI_Listener):
    ''' 一字涨停板块打板
    '''
    key = 'istrategy_hbk'
    name = '一字板块打板'
    desc = '一字板相关板块打板买入, 首板一字板排单, 非首板的一字板不排单'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkchanges')
        self.candi_watcher = WsIsUtils.get_watcher('stkzt_open')
        self.candi_listener = StrategyI_Listener()
        self.candi_listener.watcher = self.candi_watcher
        self.candi_listener.on_watcher = self.candi_on_watcher
        self.zt1h_stocks = []
        self.stock_notified = []
        self.candidates = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.candi_listener.start_strategy_tasks()

    async def candi_on_watcher(self, fecthed):
        self.zt1h_stocks = []
        for c, f, t, i in fecthed:
            if t != 4: continue
            if WsIsUtils.is_stock_blacked(c): continue
            self.zt1h_stocks.append(StockGlobal.full_stockcode(c))
            if WsIsUtils.recent_zt_reached(c): continue
            if WsIsUtils.to_be_divided(c): continue
            price = float(i.split(',')[0])
            chg_match_data = {'code': c, 'price': price}
            if callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)

        self.get_candidates_from1h()

    def get_candidates_from1h(self):
        zbks = set(StockBkMap.stock_bks(self.zt1h_stocks))
        candidates = []
        for bk in zbks:
            candidates += [s[2:] for s in WsIsUtils.get_bk_stocks(bk)]
        self.candidates = []
        for s in set(candidates):
            if WsIsUtils.is_stock_blacked(s) or WsIsUtils.recent_zt(s) or WsIsUtils.to_be_divided(s):
                continue
            self.candidates.append(s)
        Utils.log(f'zt1h: {self.zt1h_stocks}, bks: {zbks}')

    async def on_watcher(self, fecthed):
        for c, f, t, i in fecthed:
            if t != 4: continue
            if c in self.stock_notified: continue
            if c not in self.candidates: continue
            if WsIsUtils.recent_zt_reached(c): continue
            if WsIsUtils.is_stock_blacked(c): continue
            if WsIsUtils.to_be_divided(c): continue

            price = float(i.split(',')[0])
            chg_match_data = {'code': c, 'price': price}
            if callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class StrategyI_Zt1H_Yzb(StrategyI_Listener):
    ''' 首板一字涨停排单
    '''
    key = 'istrategy_yzb'
    name = '首板一字板'
    desc = '首板一字板排单买入'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkzt_open')
        self.stock_notified = []

    async def on_watcher(self, fecthed):
        for c, f, t, i in fecthed:
            if t != 4: continue
            if c in self.stock_notified: continue
            if WsIsUtils.recent_zt_reached(c): continue
            if WsIsUtils.is_stock_blacked(c): continue
            if WsIsUtils.to_be_divided(c): continue

            price = float(i.split(',')[0])
            chg_match_data = {'code': c, 'price': price}
            if callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_zt_buy(match_data, subscribe_detail)


class WsIntradeStrategyFactory:
    istrategies = [
        StrategyI_AuctionUp(), StrategyI_Zt1Breakup(), StrategyI_EndAuc_Nzt(), StrategyI_HighClose(),
        StrategyI_HotrankOpen(), StrategyI_Zt1Hotrank(), StrategyI_Zt1j2Open(), StrategyI_Zt1Bk(),
        StrategyI_3Bull_Breakup(), StrategyI_EVolume(), StrategyI_Zt1H_Bk(), StrategyI_Zt1H_Yzb()]

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
