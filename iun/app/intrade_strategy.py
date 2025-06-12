import asyncio, time, json
import stockrt as asrt
from app.logger import logger
from app.config import IunCache
from app.guang import guang
from app.intrade_base import StrategyI_Listener, iunCloud, StrategyI_Watcher_Once
from app.klpad import klPad


class GlobalStartup(StrategyI_Listener):
    def __init__(self):
        self.watcher = StrategyI_Watcher_Once('9:15', True)
        self.watcher.execute_task = self.execute
        self.twatcher = StrategyI_Watcher_Once('9:24', False)
        self.twatcher.execute_task = self.openauction

    async def execute(self):
        # 准备工作，
        # * 1分钟k线数据，部分数据源只能获取当日数据，可以提前将昨日1分K线数据获取
        # * 有的行情数据没有涨跌停价格或总市值等，可以提前用明确能获取到这些数据的数据源获取一次
        stocks = IunCache.all_stocks_cached()
        hrk = iunCloud.get_open_hotranks()
        stocks += list(hrk.keys())
        hstks = iunCloud.get_hotstocks()
        stocks += [hs[0][-6:] for hs in hstks]
        if len(stocks) == 0:
            logger.info("GlobalStartup no stocks")
            return

        stocks = list(set(stocks))
        tdx = asrt.rtsource('tdx')
        for klt in [1, 15]:
            klines = tdx.klines(stocks, kltype=klt, length=240)
            for c, k in klines.items():
                klPad.cache(c, k, kltype=1)

        for c in stocks:
            klPad.resize_cached_klines(c, 20)
        logger.info("GlobalStartup init kline1 for %d", len(klines))

        qq = asrt.rtsource('qq')
        quotes = qq.quotes(stocks)
        for c, q in quotes.items():
            klPad.cache(c, quotes=q)
            if q['top_price'] == 0 and q['bottom_price'] == 0:
                logger.info('%s %s no top or bottom price, %s', c, q['name'], q)
        logger.info("GlobalStartup init quotes for %d", len(quotes))
        logger.info("init stocks: %s", stocks)

    async def openauction(self):
        stocks = iunCloud.get_hotstocks()
        stocks = [hs[0][-6:] for hs in stocks[0:3]]
        source = ['qq', 'tdx', 'sina', 'em']
        for s in source:
            src = asrt.rtsource(s)
            src.quotes(stocks)
            logger.info('quotes from %s %s', (s, stocks))


class StrategyI_AuctionUp(StrategyI_Listener):
    ''' 竞价跌停,竞价结束时打开
    '''
    key = 'istrategy_auctionup'
    name = '竞价跌停打开'
    desc = '竞价跌停,竞价结束时打开跌停'
    on_intrade_matched = None
    matched = []
    auction_selector = None

    def __init__(self):
        self.watcher = iunCloud.get_watcher('aucsnaps')

    @classmethod
    def check_buy_match(self, auctions):
        # 竞价跌停, 竞价结束时报价不跌停且不跌停的报价数<5
        bottomprice = auctions['bottomprice']
        quotes = auctions['quotes']
        btmcount = 0
        othercount = 0
        for i in range(0, len(quotes)):
            qt, cp, mv, uv = quotes[i]
            if cp == bottomprice:
                btmcount += 1
            else:
                othercount += 1

        return othercount < 5 and quotes[-1][1] > bottomprice

    @classmethod
    def check_buy_match_cont_up(self, auctions):
        # 竞价跌停 随后持续上升 09:22之前一直跌停, 之后价格不下降
        bottomprice = auctions['bottomprice']
        quotes = auctions['quotes']
        for i in range(0, len(quotes)):
            qt, cp, mv, uv = quotes[i]
            if qt < '09:22' and cp > bottomprice:
                return False
            if cp < quotes[i-1][1]:
                return False

        return quotes[-1][1] > bottomprice

    @classmethod
    def check_buy_vol_more_match(self, auctions):
        # 竞价一直跌停 结束时买盘大于卖盘
        bottomprice = auctions['bottomprice']
        quotes = auctions['quotes']

        if max([q[1] for q in quotes]) > bottomprice:
            return False

        return quotes[-1][3] > 0

    async def on_watcher(self, aucparams):
        auction_quote = aucparams['quotes']
        uppercent = aucparams['uppercent']
        for code, auctions in auction_quote.items():
            if code in self.matched:
                continue
            if not (code.startswith('00') or code.startswith('60')):
                continue
            zdays, zdist, ddays, ddist = auctions['zddays']
            if zdays > 0 or zdist > 0 or ddays == 0 or ddist >= ddays:
                continue
            if self.check_buy_match(auctions) or self.check_buy_vol_more_match(auctions):
                logger.info(f'{code} buy match! {auctions["lclose"] if "lclose" in auctions else "0"}')
                self.matched.append(code)
                if callable(self.on_intrade_matched) and len(self.matched) < 5:
                    price = float(auctions['quotes'][-1][1]) * (100 + uppercent) / 100
                    if auctions['quotes'][-1][1] == auctions['bottomprice']:
                        price = float(auctions["lclose"]) * 0.97
                    aucup_match_data = {'code': code, 'price': price}
                    aucup_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}, 'StrategySellBE': {}}
                    await self.on_intrade_matched(self.key, aucup_match_data, guang.create_buy_message)
        self.watcher.matched = self.matched


class StrategyI_Zt1Bk(StrategyI_Listener):
    ''' 热门板块首板打板
    '''
    key = 'istrategy_zt1bk'
    name = '首板板块'
    desc = '板块5日内首次满足涨幅>2%, 涨幅8%以上家数>=5且主力净流入时, 排队/打板'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = iunCloud.get_watcher('stkzdf')
        self.bkwatcher = iunCloud.get_watcher('bkchanges')
        self.bklistener = StrategyI_Listener()
        self.bkwatcher.add_listener(self.bklistener)
        self.bklistener.on_watcher = self.on_bk_changes
        self.matched_bks = []
        self.up_matched_bks = []
        self.candidates_bkstks = []
        self.changes_matched = []
        self.stock_notified = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.bkwatcher.start_strategy_tasks()

    def select_bk_of(self, bk_changes, attr, selector):
        '''选择异动板块
        @param bk_changes 所有异动
        @param attr 属性名: p_change, ydpos, ztcnt...
        @param selector 选择方法， e.g. lanmbda x: x > 0
        '''
        s_changes = [chg for chg in bk_changes if attr in chg]
        if len(s_changes) == 0:
            return set()
        return set([chg['code'] for chg in s_changes if selector(chg[attr])])

    async def on_bk_changes(self, bk_changes):
        mtbk = self.select_bk_of(bk_changes, 'amount', lambda a: a > 0)
        mtbk = mtbk.intersection(self.select_bk_of(bk_changes, 'p_change', lambda a: a >= 2))
        # mtbk = mtbk.intersection(self.select_bk_of(bk_changes, 'ztcnt', lambda a: a >= 5))
        mtbk = [bk for bk in mtbk if not self.bkwatcher.is_topbk5(bk)]
        [self.matched_bks.append(bk) for bk in mtbk if bk not in self.matched_bks]

        if len(self.watcher.full_zdf) == 0:
            return
        await self.on_watcher(self.watcher.full_zdf)

    def check_bks_candidates(self, zdfrank):
        bkupdict = {}
        for c, *x in zdfrank:
            bks = iunCloud.get_stock_bks(c)
            for bk in bks:
                if iunCloud.is_bk_ignored(bk): continue
                if bk not in bkupdict:
                    bkupdict[bk] = []
                bkupdict[bk].append(c)

        for bk, zds in bkupdict.items():
            if len(zds) >= 5 and bk in self.matched_bks and bk not in self.up_matched_bks:
                self.up_matched_bks.append(bk)

        logger.info(f'bk changes selected: {self.up_matched_bks}')
        candidates = []
        for bk in self.up_matched_bks:
            candidates += [s[-6:] for s in iunCloud.get_bk_stocks(bk) if not s.startswith('BJ')]
        self.candidates_bkstks = []
        for s in set(candidates):
            if iunCloud.is_stock_blacked(s) or iunCloud.recent_zt(s) or iunCloud.to_be_divided(s):
                continue
            self.candidates_bkstks.append(s)
        logger.info(f'candidates_bkstks: {len(self.candidates_bkstks)}')

    async def on_watcher(self, fecthed):
        self.check_bks_candidates(fecthed)
        if len(self.candidates_bkstks) == 0:
            return

        for c, zd, p, lc in fecthed:
            if zd < 8: continue
            s = c[-6:]
            if s in self.stock_notified: continue
            if s not in self.candidates_bkstks: continue
            if not callable(self.on_intrade_matched):
                continue
            zt_price = guang.zt_priceby(lc, zdf=guang.zdf_from_code(c))
            mdata = {'code': s, 'price': zt_price, 'buy': p >= zt_price}
            mdata['strategies'] = {}
            mdata['strategies']['StrategySellELS'] = {'guardPrice': round(zt_price * 0.92, 2)}
            mdata['strategies']['StrategySellBE'] = {}
            if p < zt_price:
                mdata['watch'] = True
                mdata['strategies']['StrategyBuyZTBoard'] = {}
                iuncfg = iunCloud.iun_str_conf(self.key)
                strategy = guang.generate_strategy_json({'code': s, 'price': zt_price, 'strategies': {'StrategyBuyZTBoard': {}}}, iuncfg)
                if iunCloud.accld:
                    acount = iunCloud.get_hold_account(s, iuncfg['account'])
                    iunCloud.accld.set_account_stock_strategy(acount, s, strategy)

            await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
            self.stock_notified.append(s)

    def on_taskstop(self):
       logger.info(f'zt1bk stopped! {self.stock_notified}')

    def done(self):
        return self.watcher.done() and self.bkwatcher.done()


class StrategyI_EndFundFlow(StrategyI_Listener):
    ''' 尾盘主力净流入
    '''
    key = 'istrategy_endfflow'
    name = '尾盘净流入'
    desc = '尾盘主力资金净流入, 流入额>1000w, 流入占比>10%, 三日连续净流入, 三日累计涨幅<10%, 流通市值<1000亿'
    on_intrade_matched = None
    def __init__(self):
        self.watcher = iunCloud.get_watcher('end_fundflow')

    async def on_watcher(self, main_flows):
        chkdate = main_flows[0][1]
        secids = {}
        for sc, d, f, fp in main_flows:
            code = sc[-6:]
            if fp < 10 or f < 1e7: continue
            if iunCloud.is_stock_blacked(code): continue
            if iunCloud.to_be_divided(code): continue
            secids[code] = sc

        stocks_data = asrt.qklines(list(secids.keys()), 101, 30)
        sstocks = []
        for c, data in stocks_data.items():
            quotes = data['qt']
            if quotes['cmc'] > 1e10:
                continue
            if quotes['change'] > 0.05 or quotes['change'] < -0.05 or quotes['price'] < quotes['high'] * 0.95:
                continue
            allkl = data['klines']
            if allkl['time'].iloc[-1] == chkdate:
                allkl = allkl.iloc[:-1]
            if len(allkl) < 3:
                continue
            allkl = allkl.iloc[-3:]
            if quotes['price'] > 1.1 * allkl['close'].iloc[0] or quotes['price'] < 0.95 * allkl['close'].iloc[0]:
                continue
            pchange1 = (allkl['close'].iloc[1] - allkl['close'].iloc[0]) / allkl['close'].iloc[0]
            pchange2 = (allkl['close'].iloc[2] - allkl['close'].iloc[1]) /  allkl['close'].iloc[1]
            if pchange1 < -0.05 or pchange2 < -0.05:
                continue

            code = c[-6:]
            mfs = iunCloud.get_stock_fflow(code, allkl['time'].iloc[0], allkl['time'].iloc[-1])
            if mfs is None or len(mfs) == 0 or mfs[0][1] > 0:
                # 仅选择连续三日净流入，如果mfs[0]也是净流入说明今天已经是第四天净流入了,排除
                continue
            min_in = min([m[1] for m in mfs[1:]])
            if min_in < 1e6:
                continue

            sstocks.append(code)
            if callable(self.on_intrade_matched):
                mdata = {'code': code, 'price': quotes['price']*1.02}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(quotes['price'] * 1.07, 2), 'guardPrice': round(quotes['price'] * 0.95, 2) }}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
        logger.info('EndFundFlow select %d stocks: %s', len(sstocks), sstocks)


class StrategyI_DeepBigBuy(StrategyI_Listener):
    ''' 热门股深水大单买入
    '''
    key = 'istrategy_bigbuy'
    name = '深水大单买入'
    desc = '近期热门股深水大单买入'
    on_intrade_matched = None
    def __init__(self):
        self.watcher = iunCloud.get_watcher('stkchanges')
        self.hotchanges = None
        self.stock_notified = []

    async def on_watcher(self, params):
        if not self.hotchanges:
            hstks = iunCloud.get_hotstocks()
            self.hotchanges = {hs[0][-6:]: [] for hs in hstks if hs[3] > 3}
            logger.info(f'{self.__class__.name}, hot stocks {self.hotchanges.keys()}')

        for code, t, p, i in params:
            if code not in self.hotchanges or code in self.stock_notified:
                continue
            if p in [8193,8194]:
                self.hotchanges[code].append([t, p, i])
            if p != 8193:
                continue
            if len([h for h in self.hotchanges[code] if h[1] == 8193]) < 2:
                continue

            cinfo = i.split(',')
            if float(cinfo[2]) > -0.06:
                continue

            buy_chgs = [hcg[2].split(',') for hcg in self.hotchanges[code] if hcg[1] == 8193]
            sell_chgs = [hcg[2].split(',') for hcg in self.hotchanges[code] if hcg[1] == 8194]

            buy_count = sum([int(h[0]) for h in buy_chgs])
            sell_count = sum([int(h[0]) for h in sell_chgs])

            if buy_count < 1.2 * sell_count:
                continue

            if callable(self.on_intrade_matched):
                self.stock_notified.append(code)
                mdata = {'code': code, 'price': cinfo[1]}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(float(cinfo[1]) * 1.05, 2), 'guardPrice': round(float(cinfo[1]) * 0.95, 2) }}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)


class StrategyI_3Bull_Breakup(StrategyI_Listener):
    ''' 三阳开泰
    '''
    key = 'istrategy_3brk'
    name = '三阳开泰'
    desc = '连续3根阳线价升量涨 以突破此3根阳线的最高价为买入点 以第一根阳线到买入日期之间的最低价为止损价 止盈设置5%'
    on_intrade_matched = None
    def __init__(self):
        self.watcher = iunCloud.get_watcher('kline1')
        self.prepare_watcher = StrategyI_Watcher_Once('9:30', True)
        self.prepare_watcher.execute_task = self.prepare
        self.stock_notified = []
        self.candidates = None
        self.wdays = 5
        self.skltype = 1

    def done(self):
        watchers = [self.prepare_watcher, self.watcher]
        return all([w.done() for w in watchers])

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.prepare_watcher.start_strategy_tasks()

    async def prepare(self):
        url = guang.join_url(iunCloud.dserver, f'stock?act=getistr&key={self.key}&days={self.wdays}')
        rc = json.loads(guang.get_request(url))
        if self.candidates is None:
            self.candidates = {}
        for c, h, l in rc:
            code = c[-6:]
            self.watcher.add_stock(code)
            self.candidates[code] = {'high': h, 'low': l}
        qq = asrt.rtsource('qq')
        quotes = qq.quotes(list(self.candidates.keys()))
        for c, q in quotes.items():
            klPad.cache(c, quotes=q)


    async def on_watcher(self, params):
        if self.candidates is None:
            return

        for code in params:
            kltypes = params[code]
            if code not in self.candidates or self.skltype not in kltypes:
                continue
            if code in self.stock_notified:
                continue
            klines = klPad.get_klines(code, self.skltype)
            if len(klines) == 0:
                continue
            price = klines['close'].iloc[-1]
            if price < self.candidates[code]['high']:
                continue
            price = min(price+0.02, klPad.get_zt_price(code))
            if price == 0:
                logger.error('StrategyI_3Bull_Breakup no zt price for %s, %s', code, klines)
                continue
            if callable(self.on_intrade_matched):
                mdata = {'code': code, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': self.candidates[code]['low'] }}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
                self.stock_notified.append(code)


class StrategyI_Zt1WbOpen(StrategyI_Listener):
    ''' 烂板1进2
    '''
    key = 'istrategy_zt1wb'
    name = '首板烂板1进2'
    desc = '首板烂板1进2,超预期开盘,开盘>-3%,以开盘价买入'
    on_intrade_matched = None

    def __init__(self):
        self.prepare_watcher = StrategyI_Watcher_Once('9:22', True)
        self.prepare_watcher.execute_task = self.prepare
        self.watcher = StrategyI_Watcher_Once('9:24:56', False)
        self.watcher.execute_task = self.on_watcher
        self.watcher2 = StrategyI_Watcher_Once('9:25:03', False)
        self.watcher2.execute_task = self.on_watcher2
        self.stock_notified = []
        self.candidates = {}
        self.pupfix = 1.03

    def done(self):
        watchers = [self.prepare_watcher, self.watcher, self.watcher2]
        return all([w.done() for w in watchers])

    async def start_strategy_tasks(self):
        await self.prepare_watcher.start_strategy_tasks()
        await self.watcher.start_strategy_tasks()
        await self.watcher2.start_strategy_tasks()

    async def prepare(self):
        url = guang.join_url(iunCloud.dserver, f'stock?act=getistr&key={self.key}')
        rc = json.loads(guang.get_request(url))
        if len(rc) == 0:
            logger.error(f'{self.__class__.name} no candidates')
            return
        iuncfg = iunCloud.iun_str_conf(self.key)
        account = iuncfg.get('account', '')
        for c in rc:
            code = c[-6:]
            if account == '':
                account = 'credit' if iunCloud.is_rzrq(code) else 'normal'
                self.candidates[code] = {'account': account}
            elif account == 'credit':
                if not iunCloud.is_rzrq(code):
                    continue
            self.candidates[code] = {'account': account}

    async def on_watcher(self):
        stocks = [c for c in self.candidates if c not in self.stock_notified]
        if len(stocks) == 0:
            return
        quotes = asrt.quotes(stocks)
        for c, q in quotes.items():
            if q['cmc'] >= 1e11:
                continue
            oprice = q['open'] if q['open'] > 0 else q['price']
            ochange = (oprice - q['lclose']) / q['lclose']
            if (self.pupfix > 1 and ochange < 0) or (self.pupfix == 1 and ochange < -0.03):
                continue
            price = oprice if self.pupfix == 1 else min(round(oprice * self.pupfix, 2), q['top_price'])
            if callable(self.on_intrade_matched):
                mdata = {'code': c, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2)}}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
                self.stock_notified.append(c)

    async def on_watcher2(self):
        self.pupfix = 1
        await self.on_watcher()


class StrategyI_HotrankOpen(StrategyI_Listener):
    ''' 开盘人气排行
    '''
    key = 'istrategy_hotrank0'
    name = '开盘人气排行'
    desc = '不涨停且股价涨跌幅介于[-3, 9] 选人气排行前10中新增粉丝>70%排名最前者'
    on_intrade_matched = None
    def __init__(self):
        self.prepare_watcher = StrategyI_Watcher_Once('9:22', True)
        self.prepare_watcher.execute_task = self.prepare
        self.watcher = StrategyI_Watcher_Once('9:24:56', False)
        self.watcher.execute_task = self.on_watcher
        self.watcher2 = StrategyI_Watcher_Once('9:25:05', False)
        self.watcher2.execute_task = self.on_watcher2
        self.candidates = None
        self.pupfix = 1.05
        self.matched = False
        self.topranks = {}

    def done(self):
        watchers = [self.prepare_watcher, self.watcher, self.watcher2]
        return all([w.done() for w in watchers])

    async def start_strategy_tasks(self):
        await self.prepare_watcher.start_strategy_tasks()
        await self.watcher.start_strategy_tasks()
        await self.watcher2.start_strategy_tasks()

    async def prepare(self):
        self.candidates = {}
        url = guang.join_url(iunCloud.dserver, f'stock?act=getistr&key={self.key}')
        rc = json.loads(guang.get_request(url))
        self.rked = [c[-6:]for c in rc]

        hrks = iunCloud.get_open_hotranks()
        for c, r in hrks.items():
            if c in self.rked:
                continue
            self.candidates[c] = r

        try:
            jqrkUrl = 'https://basic.10jqka.com.cn/api/stockph/popularity/top/'
            headers = guang.em_headers('basic.10jqka.com.cn')
            jdata = json.loads(guang.get_request(jqrkUrl, headers=headers))
            if not jdata or jdata['status_code'] != 0 or 'data' not in jdata or 'list' not in jdata['data']:
                logger.error(f'{self.__class__.name} no jqrk ranks')
                return

            for rk in jdata['data']['list']:
                code = rk['code']
                if code in self.rked:
                    continue
                if code not in self.candidates:
                    self.candidates[code] = {'rkjqka': rk['hot_rank']}
                else:
                    self.candidates[code]['rkjqka'] = rk['hot_rank']
        except Exception as e:
            logger.error(f'fetch jqrk failed: {e}')

    async def on_watcher(self):
        if self.matched:
            return
        stocks = [c for c in self.candidates if 'rank' in self.candidates[c] and self.candidates[c]['rank'] <= 40 and self.candidates[c]['newfans'] >= 70]
        quotes = asrt.quotes(stocks)
        for c, q in quotes.items():
            name = q['name']
            if name.startswith('退市') or name.endswith('退') or 'ST' in name:
                continue

            zdf = q['change'] * 100
            self.topranks[c] = [c, self.candidates[c]['rank'], self.candidates[c]['newfans'], self.candidates[c]['rkjqka'] if 'rkjqka' in self.candidates[c] else 0, 0, zdf]
            if self.candidates[c]['rank'] > 10 or c in self.rked or zdf > 9 or zdf < -3 or q['price'] <= 1:
                continue

            if self.matched:
                continue
            price = q['price'] * self.pupfix
            price = min(round(price, 2), q['top_price'])

            if callable(self.on_intrade_matched):
                mdata = {'code': c, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2)}}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
                self.matched = True

    async def on_watcher2(self):
        self.pupfix = 1.018
        await self.on_watcher()
        if len(self.topranks) > 0:
            turl = guang.join_url(iunCloud.dserver, 'stock')
            logger.info('save hotranks %s', self.topranks)
            data = {
                'act': 'setistr',
                'key': self.key,
                'data': json.dumps(list(self.topranks.values())),
            }
            guang.post_data(turl, data)


class StrategyI_HotStocksOpen(StrategyI_Listener):
    ''' 开盘热门领涨股
    '''
    key = 'istrategy_hotstks_open'
    name = '开盘热门领涨股'
    desc = '最近涨停的高标人气股，最近连板高度前10左右，开盘时选这些票中人气排行前5的股票买入，需择时.'
    on_intrade_matched = None

    def __init__(self):
        self.prepare_watcher = StrategyI_Watcher_Once('9:22', True)
        self.prepare_watcher.execute_task = self.prepare
        self.watcher = StrategyI_Watcher_Once('9:24:55', False)
        self.watcher.execute_task = self.on_watcher
        self.lastzdt = None
        self.candidates = None
        self.pupfix = 1.05
        self.topranks = {}

    def done(self):
        watchers = [self.prepare_watcher, self.watcher]
        return all([w.done() for w in watchers])

    async def start_strategy_tasks(self):
        await self.prepare_watcher.start_strategy_tasks()
        await self.watcher.start_strategy_tasks()

    def done(self):
        watchers = [self.prepare_watcher, self.watcher]
        return all([w.done() for w in watchers])

    async def prepare(self):
        self.candidates = {}
        surl = guang.join_url(iunCloud.dserver, f'stock?act=hotstocks&days=2')
        rc = json.loads(guang.get_request(surl))
        step = max([x[3] for x in rc])
        top_zt_stocks = []
        while step > 0:
            if len([x for x in rc if x[3] == step]) > len(top_zt_stocks) and len(top_zt_stocks) >= 8:
                break
            top_zt_stocks = [x for x in rc if x[3] >= step]
            if len(top_zt_stocks) >= 10:
                break
            step -= 1

        for c, d, days, step in top_zt_stocks:
            code = c[-6:]
            self.candidates[code] = {'ztdate': d, 'days': days, 'step': step}

        rks = iunCloud.get_open_hotranks()
        for c, r in rks.items():
            if c in self.candidates:
                self.candidates[c].update(r)
            else:
                self.candidates[c] = r
        dailyzdt = iunCloud.get_dailyzdt()
        self.lastzdt = dailyzdt[-1] if len(dailyzdt) > 0 else None

    def open_environment_matched(self):
        if self.lastzdt is None:
            # 如果没有上一次的涨跌停数据，直接返回 true
            return True

        try:
            zrks = iunCloud.get_stocks_zdfrank(8)
            drks = iunCloud.get_stocks_zdfrank(-8)
            dtcnt_open = len([r for r in drks if float(r['f2']) <= guang.dt_priceby(float(r['f18']), zdf=guang.zdf_from_code(r['f12']))])
            logger.info('last dtcnt=%d today open dtcnt=%d', self.lastzdt[3], dtcnt_open)

            if self.lastzdt[3] > 10:
                return dtcnt_open < 5 or dtcnt_open < 0.3 * self.lastzdt[3]
            return dtcnt_open <= 3 or dtcnt_open < self.lastzdt[3]
        except Exception as e:
            logger.error(f'Error checking open environment: {e}')
            return False

    async def on_watcher(self):
        stocks = [c for c in self.candidates.keys() if 'rank' in self.candidates[c] and 'ztdate' in self.candidates[c]]
        stocks.sort(key=lambda x: self.candidates[x]['rank'])
        stocks = stocks[:5]

        env_valid = self.open_environment_matched()
        if not env_valid:
            logger.info(f'{self.__class__.name} environment not valid')
            return

        quotes = asrt.quotes5(stocks)
        for c, q in quotes.items():
            # logger.info('%s %s, price=%.2f, change=%.4f, rank=%d', c, q['name'], q['price'], q['change'], self.candidates[c]['rank'])
            logger.info('%s %s', q['name'], q)
            if q['change'] < -0.08:
                continue

            istrdata = iunCloud.iun_str_conf(self.key)
            if q['price'] > 0.013 * float(istrdata['amount']):
                logger.info('%s %s price too high: %.2f amount: %s', c, q['name'], q['price'], istrdata['amount'])
                continue

            price = q['price'] * self.pupfix
            price = min(round(price, 2), q['top_price'] if 'top_price' in q else guang.zt_priceby(q['lclose'], zdf=guang.zdf_from_code(c)))
            hcount = IunCache.get_account_holdcount(istrdata['account'], c)
            if hcount > 0:
                price = min(price, round(q['lclose'] * 1.05, 2))

            if callable(self.on_intrade_matched):
                mdata = {'code': c, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2)}, 'StrategySellBE': {}}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
                logger.info('%s buy %s %s at %s', self.key, c, q['name'], price)

        ohstks = []
        date = guang.today_date('-')
        for c, d in self.candidates.items():
            if 'ztdate' in d and 'rank' in d:
                ohstks.append([date, c, d['ztdate'], d['days'], d['step'], d['rank']])
        logger.info(f'{self.__class__.name} save ohstks {len(ohstks)} {ohstks}')
        url = guang.join_url(iunCloud.dserver, 'stock')
        data = {
            'act': 'setistr',
            'key': self.key,
            'ohstks': json.dumps(ohstks),
        }
        guang.post_data(url, data)


class StrategyI_DtStocksUp(StrategyI_Listener):
    ''' 跌停翘板
    '''
    key = 'istrategy_dtstocks'
    name = '跌停翘板'
    desc = '盘中: 跌停撬板, 优先选封单金额大的,从前高下来换手小, 跌幅大. 早上9:33之后开始监控防止有的票早盘撬板又封死, 下午2:30之后取消。竞价若昨日跌停数>5家,今日竞价无跌停,则选昨日跌停中今日开盘最低的几只.'
    on_intrade_matched = None

    def __init__(self):
        self.prepare_watcher = StrategyI_Watcher_Once('9:24', True)
        self.prepare_watcher.execute_task = self.prepare
        self.watcher = StrategyI_Watcher_Once('9:24:50', False)
        self.watcher.execute_task = self.on_watcher
        self.watcher1 = StrategyI_Watcher_Once('9:33', False)
        self.watcher1.execute_task = self.on_watcher1
        self.watcher2 = StrategyI_Watcher_Once('14:30', False)
        self.watcher2.execute_task = self.cancel
        self.candidates = {}
        self.matched = []

    def done(self):
        watchers = [self.prepare_watcher, self.watcher, self.watcher1, self.watcher2]
        return all([w.done() for w in watchers])

    async def start_strategy_tasks(self):
        await self.prepare_watcher.start_strategy_tasks()
        await self.watcher.start_strategy_tasks()
        await self.watcher1.start_strategy_tasks()
        await self.watcher2.start_strategy_tasks()

    async def prepare(self):
        url = guang.join_url(iunCloud.dserver, 'stock?act=hotstocks&days=5')
        rc = json.loads(guang.get_request(url))
        for c, d, days, step in rc:
            code = c[-6:]
            self.candidates[code] = {'ztdate': d, 'days': days, 'step': step}

    async def on_watcher(self):
        dailyzdt = iunCloud.get_dailyzdt()
        if len(dailyzdt) == 0:
            logger.info(f'{self.__class__.name} no daily zdt data')
            return

        lastdt = dailyzdt[-1][3]
        if lastdt < 5:
            return

        drks = iunCloud.get_stocks_zdfrank(-8)
        dtcnt_open = len([r for r in drks if float(r['f2']) <= guang.dt_priceby(float(r['f18']), zdf=guang.zdf_from_code(r['f12']))])
        logger.info('last dtcnt=%d today open dtcnt=%d', lastdt, dtcnt_open)
        if dtcnt_open > 0:
            logger.info(f'{self.__class__.name} no dtcnt_open, skip')
            return

        date = dailyzdt[-1][0]
        durl = guang.join_url(iunCloud.dserver, f'api/stockdthist?date={date}')
        dthist = json.loads(guang.get_request(durl))
        if dthist['date'] != date:
            logger.error(f'{self.__class__.name} no dthist data for {date}')
            return

        dstocks = [c[0][-6:] for c in dthist['pool']]
        quotes = asrt.quotes(dstocks)
        for c, q in quotes.items():
            if q['change'] > -0.055:
                continue

            price = q['price'] * 1.05
            price = min(round(price, 2), q['lclose'] * 0.95)
            if callable(self.on_intrade_matched):
                mdata = {'code': c, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}}
                # await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
                logger.info('%s %s buy %s at %.2f', self.__class__.name, self.key, c, price)
                self.matched.append(c)

    async def on_watcher1(self):
        # 开盘三分钟
        drks = iunCloud.get_stocks_zdfrank(-8)
        drks = [r for r in drks if r['f3'] <= -8]
        if len([r for r in drks if r['f3'] <= -10]) > 15:
            logger.info(f'{self.__class__.name} more stocks zdf < 10 than 15')
            return
        dstocks = [r for r in drks if float(r['f2']) <= guang.dt_priceby(float(r['f18']), zdf=guang.zdf_from_code(r['f12']))]
        dstocks = [r for r in dstocks if not r['f14'].startswith('退市') and not r['f14'].endswith('退') and 'ST' not in r['f14']]
        if len(dstocks) > 10:
            logger.info(f'{self.__class__.name} more stocks dt than 10')
            return

        dstocks = [r['f12'] for r in dstocks]
        qkls = asrt.qklines(dstocks, 101, 32)
        for c, qk in qkls.items():
            klPad.cache(c, qk['klines'], qk['qt'], kltype=101)

        dstocks = [c for c in dstocks if klPad.continuously_dt_days(c, yz=True) < 3]
        # 封单金额最大前三 封单金额= 0 if bid1_volume > 0 else ask1*ask1_volume
        sell_amount = {}
        for c in dstocks:
            q = klPad.get_quotes(c)
            if q['bid1_volume'] > 0:
                sell_amount[c] = 0
            else:
                sell_amount[c] = q['ask1'] * q['ask1_volume']
        top3sell = sorted(dstocks, key=sell_amount.get, reverse=True)[:3]
        downpv = []
        # 五天内最高点至今跌幅前三
        # 五天内最高点至今有大幅缩量者前三
        for c in dstocks:
            klines = klPad.get_klines(c, 101)
            if len(klines) <= 5:
                continue
            latestPrice = klines['close'].iloc[-1]
            # kl5 = klines[-6:-1]
            mxHigh = klines['high'].iloc[-6:-1].max()
            downp = (mxHigh - latestPrice) / mxHigh
            mxVol = klines['volume'].iloc[-6:-1].max()
            mnVol = klines['volume'].iloc[-2]
            for i in range(-3, -7, -1):
                if klines['volume'].iloc[i] < mnVol:
                    mnVol = klines['volume'].iloc[i]
                if klines['volume'].iloc[i] == mxVol:
                    break
            downv = (mxVol - mnVol) / mxVol
            downpv.append((c, downp, downv))
        p3 = sorted(downpv, key=lambda x: x[1], reverse=True)[:3]
        p3 = [c[0] for c in p3]
        v3 = sorted(downpv, key=lambda x: x[2], reverse=True)[:3]
        v3 = [c[0] for c in v3]
        pv3 = [c for c in set(top3sell + p3 + v3) if c in self.candidates and c not in self.matched]

        for c in pv3:
            self.add_to_planned(c)

    def add_to_planned(self, code):
        logger.info(f'{self.__class__.name} add to planned {code}')
        iuncfg = iunCloud.iun_str_conf(self.key)
        strategy = guang.generate_strategy_json({'code': code, 'strategies': {'StrategyBuyDTBoard': {}}}, iuncfg)
        if iunCloud.accld:
            acount = iunCloud.get_hold_account(code, iuncfg['account'])
            iunCloud.accld.set_account_stock_strategy(acount, code, strategy)

    async def cancel(self):
        logger.info(f'{self.__class__.name} cancel all matched {self.matched}')
        for c in self.matched:
            self.disable_planned(c)

    def disable_planned(self, code):
        logger.info(f'{self.__class__.name} disable planned {code}')
        iuncfg = iunCloud.iun_str_conf(self.key)
        if iunCloud.accld:
            acount = iunCloud.get_hold_account(code, iuncfg['account'])
            iunCloud.accld.disable_account_stock_strategy(acount, code, 'StrategyBuyDTBoard')


def all_intrade_strategies():
    return [
        GlobalStartup(), StrategyI_AuctionUp(), StrategyI_Zt1Bk(), StrategyI_EndFundFlow(), StrategyI_DeepBigBuy(),
        StrategyI_3Bull_Breakup(), StrategyI_Zt1WbOpen(), StrategyI_HotrankOpen(), StrategyI_HotStocksOpen(),
        StrategyI_DtStocksUp()
    ]
