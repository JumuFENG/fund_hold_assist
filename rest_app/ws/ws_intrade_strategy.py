# Python 3
# -*- coding:utf-8 -*-

import json
import asyncio
from datetime import datetime
from utils import *
from history import StockAuctionDetails, StockGlobal, StockDumps, StockBkMap
from pickup import StockZt1BreakupSelector, StockZt1HotrankSelector, StockZt1j2Selector
from pickup import StockAuctionUpSelector, StockEndVolumeSelector, StockHotrankDaySelector
from training.models import ModelAnn1j2, ModelAnnEndVolume

from ws_is_base import *


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
        if 'topprice' not in self.auction_quote[code]:
            self.auction_quote[code]['topprice'] = snapshot['topprice']
            self.auction_quote[code]['bottomprice'] = snapshot['bottomprice']
            self.auction_quote[code]['lclose'] = snapshot['fivequote']['yesClosePrice']

        self.auction_quote[code]['quotes'].append(WsIsUtils.parse_match_unmatch(snapshot))

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
        while True:
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
                    if callable(self.on_intrade_matched) and len(self.matched) < 5:
                        price = float(auctions['quotes'][-1][1]) * (100 + uppercent) / 100
                        if auctions['quotes'][-1][1] == auctions['bottomprice']:
                            price = float(auctions["lclose"]) * 0.97
                        aucup_match_data = {'code': code, 'price': price}
                        aucup_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}, 'StrategySellBE': {}}
                        await self.on_intrade_matched(self.key, aucup_match_data, self.create_intrade_matched_message)
            if Utils.delay_seconds('9:25:01') < 0:
                break
            time.sleep(1)

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        if Utils.delay_seconds('9:20') > 0:
            loop.call_later(Utils.delay_seconds('9:20:1'), self.check_dt_ranks)
            loop.call_later(Utils.delay_seconds('9:20:2'), lambda: asyncio.ensure_future(self.start_snapshot_task()))
            loop.call_later(Utils.delay_seconds('9:24:53'), lambda: asyncio.ensure_future(self.check_auction_trends(5)))
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
                chg_match_data['strategies'] = {'StrategyBuyZTBoard':{}, 'StrategySellELS': {}, 'StrategyGrid': {"buycnt": 3}}
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        code = match_data['code']
        strategies = generate_strategy_json(match_data, subscribe_detail)
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
        rk, rkjqka = hotranks
        if rk is not None:
            self.latest_ranks = rk
        if rkjqka is not None:
            self.rankjqka = rkjqka

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
            chg_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}, 'StrategySellBE': {}}
            if c in self.latest_ranks and t == 4 and callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append((c, t))
            self.changes_matched.append([
                c, f, t, self.latest_ranks[c]['rank'] if c in self.latest_ranks else 0,
                self.rankjqka[c] if c in self.rankjqka else 0, 0,
                self.latest_ranks[c]['newfans'] if c in self.latest_ranks else 0, i])

    def on_taskstop(self):
        self.changes_matched = sorted(self.changes_matched, key=lambda c: c[2])
        if WsIsUtils.save_db_enabled():
            szh = StockZt1HotrankSelector()
            szh.setChanges(self.changes_matched)
        else:
            print('zt1hr setChanges', self.changes_matched)
        self.changes_matched = []


class StrategyI_DayHotrank(StrategyI_Listener):
    ''' 人气排行
    '''
    key = 'istrategy_dayhr'
    name = '人气排行前10'
    desc = '股价涨跌幅介于[-3, 9] 选新增粉丝>60%且5日内排名首次进入人气排行前10的'
    on_intrade_matched = None
    hotranktbl = None
    rked5d = []
    latest_ranks = None

    def __init__(self):
        self.stockranks = []
        self.watcher = WsIsUtils.get_watcher('hotrank')

    async def on_watcher(self, hotranks):
        rk, rkjqka = hotranks
        if rk is None:
            return

        if self.hotranktbl is None:
            self.hotranktbl = StockHotrankDaySelector()

        if len(self.rked5d) == 0:
            self.rked5d = [c[2:] for c in self.hotranktbl.getRanked(TradingDate.maxTradedDate())]

        thm = datetime.now().strftime('%H:%M')
        if thm < '09:30':
            return

        self.latest_ranks = rk
        rkdict = {}
        for code, rf in self.latest_ranks.items():
            rankNumber=rf['rank']
            newFans = rf['newfans']
            if newFans < 60 or rankNumber > 10:
                continue

            rkobj = {'code': code, 'rank': rankNumber, 'newfans': newFans}
            rkdict[StockGlobal.full_stockcode(code)] = {'code': code, 'rank': rankNumber, 'newfans': newFans}
            self.stockranks.append(rkobj)

        if len(rkdict.keys()) == 0:
            return

        rkbasics = Utils.get_cls_basics(rkdict.keys())
        topranks = []
        for c, b in rkbasics.items():
            code = rkdict[c]['code']
            current_price = b['last_px']
            zdf = round(b['change'] * 100, 2)
            name = b['secu_name']
            if name.startswith('退市') or name.endswith('退'):
                continue

            if thm == '09:30' and zdf > 9:
                Utils.log(f'current zdf > 9: {c} price={current_price} zdf={zdf} open={b["open_px"]}')
                current_price = b['open_px']
                zdf = round((b['open_px'] - b['preclose_px']) * 100 / b['preclose_px'], 2)
            if code not in self.rked5d:
                topranks.append([StockGlobal.full_stockcode(code), TradingDate.maxTradingDate(), thm, rkdict[c]['rank'], rkdict[c]['newfans'], current_price, zdf])
            if zdf < -3 or zdf > 9 or current_price < 1 or current_price > 100:
                self.rked5d.append(code)
                continue

            if WsIsUtils.is_stock_blacked(code) or WsIsUtils.to_be_divided(code):
                self.rked5d.append(code)
                continue
            if code not in self.rked5d:
                if callable(self.on_intrade_matched):
                    price = min(current_price * 1.015, b['up_price'])
                    mdata = {'code': code, 'price': price}
                    mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}}
                    await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
                    Utils.log(f'StrategyI_DayHotrank matched {code}')
                self.rked5d.append(code)

        if len(topranks) == 0:
            return

        if WsIsUtils.save_db_enabled():
            self.hotranktbl.saveHotRanks(topranks)
        else:
            for trk in topranks:
                Utils.log(f'{trk}')


class StrategyI_Zt1Bk(StrategyI_Listener):
    ''' 热门板块首板打板
    '''
    key = 'istrategy_zt1bk'
    name = '首板板块'
    desc = '板块5日内首次满足涨幅>2%, 涨幅8%以上家数>=5且主力净流入时, 排队/打板'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkzdf')
        self.bkwatcher = WsIsUtils.get_watcher('bkchanges')
        self.bklistener = StrategyI_Listener()
        self.bklistener.watcher = self.bkwatcher
        self.bklistener.on_watcher = self.on_bk_changes
        self.matched_bks = []
        self.up_matched_bks = []
        self.candidates_bkstks = []
        self.changes_matched = []
        self.stock_notified = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.bklistener.start_strategy_tasks()

    def select_bk_of(self, bk_changes, attr, selector):
        '''选择异动板块
        @param bk_changes 所有异动
        @param attr 属性名: p_change, ydpos, ztcnt...
        @param selector 选择方法， e.g. lanmbda x: x > 0
        '''
        s_changes = [chg for chg in bk_changes if attr in chg]
        if len(s_changes) == 0:
            return set()
        return set([chg[column_code] for chg in s_changes if selector(chg[attr])])

    async def on_bk_changes(self, bk_changes):
        mtbk = self.select_bk_of(bk_changes, column_amount, lambda a: a > 0)
        mtbk = mtbk.intersection(self.select_bk_of(bk_changes, column_p_change, lambda a: a >= 2))
        # mtbk = mtbk.intersection(self.select_bk_of(bk_changes, 'ztcnt', lambda a: a >= 5))
        mtbk = [bk for bk in mtbk if not self.bkwatcher.is_topbk5(bk)]
        [self.matched_bks.append(bk) for bk in mtbk if bk not in self.matched_bks]

        if len(self.watcher.full_zdf) == 0:
            return
        await self.on_watcher(self.watcher.full_zdf)

    def check_bks_candidates(self, zdfrank):
        bkupdict = {}
        for c, *x in zdfrank:
            bks = WsIsUtils.get_stock_bks(c)
            for bk in bks:
                if WsIsUtils.is_bk_ignored(bk): continue
                if bk not in bkupdict:
                    bkupdict[bk] = []
                bkupdict[bk].append(c)

        for bk, zds in bkupdict.items():
            if len(zds) >= 5 and bk in self.matched_bks and bk not in self.up_matched_bks:
                self.up_matched_bks.append(bk)

        Utils.log(f'bk changes selected: {self.up_matched_bks}')
        candidates = []
        for bk in self.up_matched_bks:
            candidates += [s[2:] for s in WsIsUtils.get_bk_stocks(bk) if not s.startswith('BJ')]
        self.candidates_bkstks = []
        for s in set(candidates):
            if WsIsUtils.is_stock_blacked(s) or WsIsUtils.recent_zt(s) or WsIsUtils.to_be_divided(s):
                continue
            self.candidates_bkstks.append(s)
        Utils.log(f'candidates_bkstks: {len(self.candidates_bkstks)}')

    async def on_watcher(self, fecthed):
        self.check_bks_candidates(fecthed)
        if len(self.candidates_bkstks) == 0:
            return

        for c, zd, p, lc in fecthed:
            if zd < 8: continue
            s = c[2:]
            if s in self.stock_notified: continue
            if s not in self.candidates_bkstks: continue
            if not callable(self.on_intrade_matched):
                continue
            price = Utils.zt_priceby(lc, zdf=Utils.zdf_from_code(c))
            mdata = {'code': s, 'price': price, 'buy': p >= price}
            mdata['strategies'] = {}
            if p < price:
                mdata['strategies']['StrategyBuyZTBoard'] = {}
            mdata['strategies']['StrategySellELS'] = {'guardPrice': round(price * 0.92, 2)}
            mdata['strategies']['StrategySellBE'] = {}
            await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
            self.stock_notified.append(s)

    def on_taskstop(self):
        Utils.log(f'zt1bk stopped! {self.stock_notified}')

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        account = subscribe_detail['account']
        code = match_data['code']
        buy = match_data['buy']
        strategies = generate_strategy_json(match_data, subscribe_detail)
        if buy:
            price = round(float(match_data['price']), 2)
            dbmsg = {'type':'intrade_buy', 'code': code, 'account': account, 'price': price, 'count': 0}
            if 'amtkey' not in subscribe_detail:
                amount = subscribe_detail['amount']
                dbmsg['count'] = Utils.calc_buy_count(amount, price)
            dbmsg['strategies'] = strategies
            return dbmsg

        return {'type':'intrade_addwatch', 'code': code, 'strategies': strategies, 'account': account}


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
        self.latest_ranks, self.rankjqka = hotranks
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
            rkval.append(newFans)
            rkvalues.append(rkval)
            # if newFans < 70:
            #     continue
            # if self.zt1j2_candidates[code][2] != 1:
            #     continue
            rkobj = {'code': code, 'rank': rankNumber,'newfans': newFans}
            rkobj['rkjqka'] = self.rankjqka[code] if code in self.rankjqka else 0
            rkobj['pscore'] = 0
            self.stockranks.append(rkobj)
        pvdata = []
        for rk in self.stockranks:
            code = rk['code']
            p = rk['rank']
            if p == 0: p = 100
            pt = rk['rkjqka']
            if pt == 0: pt = 100
            f = rk['newfans']
            pv = [p/100, pt/100, f/100]
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
                    mnshadow_match_data['strategies'] = {'StrategySellELS': {'topprice': round(topprice * 1.02, 2)}, 'StrategySellBE': {}}
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
            if len(tests) == 0:
                return

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
                    mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.95, 2) }}
                    await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
                    self.stock_notified.append(c)


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
            if callable(self.on_intrade_matched):
                price = float(i.split(',')[0])
                chg_match_data = {'code': c, 'price': price}
                chg_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2) }, 'StrategySellBE': {}}
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
            chg_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2) }, 'StrategySellBE': {}}
            if callable(self.on_intrade_matched):
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)


class StrategyI_EndFundFlow(StrategyI_Listener):
    ''' 尾盘主力净流入
    '''
    key = 'istrategy_endfflow'
    name = '尾盘净流入'
    desc = '尾盘主力资金净流入, 流入额>1000w, 流入占比>10%, 三日连续净流入, 三日累计涨幅<10%, 流通市值<1000亿'
    on_intrade_matched = None
    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('end_fundflow')

    async def on_watcher(self, main_flows):
        fstocks = []
        chkdate = main_flows[0][1]
        for c, d, f, fp in main_flows:
            if fp < 10 or f < 1e7: continue
            if WsIsUtils.is_stock_blacked(c): continue
            if WsIsUtils.to_be_divided(c): continue
            fstocks.append(c)
        sbasics = Utils.get_cls_basics(fstocks)
        fstocks = []
        sprices = {}
        for c, b in sbasics.items():
            if b['cmc'] is None or b['cmc'] >= 1e11:
                continue
            if b['change'] > 0.05 or b['change'] < -0.05 or b['last_px'] < b['high_px'] * 0.95:
                continue
            fstocks.append(c)
            sprices[c] = b['last_px']

        sd = StockDumps()
        sfh = Stock_Fflow_History()
        sstocks = []
        for c in fstocks:
            allkl = sd.read_kd_data(c, fqt=1, length=3)
            if allkl is None:
                continue
            allkl = [KNode(kl) for kl in allkl]
            if allkl[-1].date == chkdate:
                allkl = sd.read_kd_data(c, fqt=1, length=4)
                allkl = [KNode(kl) for kl in allkl]
                allkl.pop()
            if len(allkl) < 3:
                continue
            if sprices[c] > 1.1 * allkl[0].close or sprices[c] < 0.95 * allkl[0].close:
                continue
            if allkl[1].pchange < -5 or allkl[2].pchange < -5:
                continue
            mfs = sfh.dumpMainFlow(c, allkl[0].date, allkl[-1].date)
            if mfs is None or len(mfs) == 0 or mfs[0][2] > 0:
                continue
            min_in = min([m[2] for m in mfs[1:]])
            if min_in < 1e6:
                continue
            sstocks.append(c)
            if callable(self.on_intrade_matched):
                mdata = {'code': c, 'price': sprices[c]*1.02}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(sprices[c] * 1.07, 2), 'guardPrice': round(sprices[c] * 0.95, 2) }}
                await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
        Utils.log(f'EndFundFlow select {len(sstocks)} stocks: {sstocks}')


class WsIntradeStrategyFactory:
    istrategies = [
        StrategyI_AuctionUp(), StrategyI_Zt1Breakup(), StrategyI_EndFundFlow(),
        StrategyI_Zt1Hotrank(), StrategyI_DayHotrank(), StrategyI_Zt1j2Open(), StrategyI_Zt1Bk(),
        StrategyI_EVolume(), StrategyI_Zt1H_Bk()]

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

        watchers = ['sm_stats', 'open_auctions']
        for watcher in watchers:
            await WsIsUtils.get_watcher(watcher).start_strategy_tasks()
