import asyncio, time, json
import easyquotation as ezqt
from app.logger import logger
from app.guang import guang
from app.intrade_base import StrategyI_Listener, iunCloud


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
            if qt < '09:22' and quotes[i][1] > bottomprice:
                return False
            if quotes[i][1] < quotes[i-1][1]:
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
            s = c[2:]
            if s in self.stock_notified: continue
            if s not in self.candidates_bkstks: continue
            if not callable(self.on_intrade_matched):
                continue
            price = guang.zt_priceby(lc, zdf=guang.zdf_from_code(c))
            mdata = {'code': s, 'price': price, 'buy': p >= price}
            mdata['strategies'] = {}
            if p < price:
                mdata['strategies']['StrategyBuyZTBoard'] = {}
            mdata['strategies']['StrategySellELS'] = {'guardPrice': round(price * 0.92, 2)}
            mdata['strategies']['StrategySellBE'] = {}
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

        stocks_data = ezqt.use('daykline').get_klines(list(secids.keys()), 30)
        sstocks = []
        for c, data in stocks_data.items():
            if data['qt']['流通市值'] > 100:
                continue
            if data['qt']['涨跌(%)'] > 5 or data['qt']['涨跌(%)'] < -5 or data['qt']['now'] < data['qt']['high'] * 0.95:
                continue
            allkl = data['klines']
            if allkl[-1][0] == chkdate:
                allkl.pop()
            if len(allkl) < 3:
                continue
            allkl = [guang.ochl(k) for k in allkl[-3:]]
            if data['qt']['now'] > 1.1 * allkl[0].close or data['qt']['now'] < 0.95 * allkl[0].close:
                continue
            pchange1 = (allkl[1].close - allkl[0].close) / allkl[0].close
            pchange2 = (allkl[2].close - allkl[1].close) / allkl[1].close
            if pchange1 < -0.05 or pchange2 < -0.05:
                continue

            code = c[-6:]
            mfs = iunCloud.get_stock_fflow(secids[code], allkl[0].date, allkl[-1].date)
            if mfs is None or len(mfs) == 0 or mfs[0][1] > 0:
                # 仅选择连续三日净流入，如果mfs[0]也是净流入说明今天已经是第四天净流入了,排除
                continue
            min_in = min([m[1] for m in mfs[1:]])
            if min_in < 1e6:
                continue

            sstocks.append(code)
            if callable(self.on_intrade_matched):
                mdata = {'code': code, 'price': data['qt']['now']*1.02}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(data['qt']['now'] * 1.07, 2), 'guardPrice': round(data['qt']['now'] * 0.95, 2) }}
                await self.on_intrade_matched(self.key, mdata, guang.create_buy_message)
        logger.info('EndFundFlow select %d stocks: %s', len(sstocks), sstocks)

