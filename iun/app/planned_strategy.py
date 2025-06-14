import asyncio, time, json
import stockrt as asrt
import pandas as pd
from functools import lru_cache
from app.logger import logger
from app.config import IunCache
from app.guang import guang
from app.intrade_base import StrategyI_Listener, iunCloud, StrategyI_Watcher_Once
from app.klpad import klPad
from app.tradeInterface import TradeInterface


class FnPs:
    @staticmethod
    def min_buy_price(buyrecs):
        if len(buyrecs) == 0:
            return 0
        return min([rec['price'] for rec in buyrecs])

    @staticmethod
    def max_buy_price(buyrecs):
        if len(buyrecs) == 0:
            return 0
        return max([rec['price'] for rec in buyrecs])
    
    @staticmethod
    def bss18_buy_match(klines: pd.DataFrame):
        if f'bss18' not in klines.columns:
            return False
        return klines['bss18'].iloc[-1] == 'b'

    @staticmethod
    def bss18_sell_match(klines: pd.DataFrame):
        if f'bss18' not in klines.columns:
            return False
        return klines['bss18'].iat[-1] == 's'

    @staticmethod
    def get_sell_count_matched(buyrecs, selltype, price, fac=0):
        if len(buyrecs) == 0:
            return 0
        count_avail = sum([rec['count'] for rec in buyrecs if rec['date'] < guang.today_date('-')])
        if selltype == 'all':
            return count_avail
        if selltype == 'earned':
            return min(count_avail,
                sum([rec['count'] for rec in buyrecs if rec['price'] * (1 + fac) < price])
            )
        if selltype == 'egate':
            if fac == 0 or FnPs.min_buy_price(buyrecs) * (1 + fac) < price:
                return FnPs.get_sell_count_matched(buyrecs, 'earned', price, fac)
            return 0
        if selltype == 'half_all':
            return min(count_avail, sum([rec['count'] for rec in buyrecs]) // 2)
        if selltype == 'half':
            return min(count_avail, buyrecs[-1]['count'] // 2)
        return min(count_avail, buyrecs[-1]['count'])

    @staticmethod
    def consume_buy_details(buyrecs, count):
        if len(buyrecs) == 0:
            return []
        for i in range(len(buyrecs)):
            if count <= 0:
                break
            if buyrecs[i]['count'] > count:
                buyrecs[i]['count'] -= count
                count = 0
            else:
                count -= buyrecs[i]['count']
                buyrecs[i]['count'] = 0
        return [rec for rec in buyrecs if rec['count'] > 0]

    @staticmethod
    def buy_details_average_price(buyrecs):
        if len(buyrecs) == 0:
            return 0
        total = sum([rec['count'] * rec['price'] for rec in buyrecs])
        count = sum([rec['count'] for rec in buyrecs])
        return total / count if count > 0 else 0


class PlannedStrategy(StrategyI_Listener):
    def __init__(self):
        self.accstocks = []
        self.watchers = []

    def add_stock(self, acc, code):
        if (acc, code) not in self.accstocks:
            self.accstocks.append((acc, code))
        for w in self.watchers:
            w.add_stock(code)

    def remove_stock(self, acc, code, watcher=None):
        if (acc, code) in self.accstocks:
            self.accstocks.remove((acc, code))
        if watcher is not None:
            watcher.remove_stock(code)
        else:
            for w in self.watchers:
                w.remove_stock(code)

    async def start_strategy_tasks(self):
        for w in self.watchers:
            w.add_listener(self)
            await w.start_strategy_tasks()

    async def on_watcher(self, params):
        for code in params:
            kltypes = params[code]
            if not kltypes:
                logger.error('kltypes is empty %s', code)
                continue
            for acc, acode in self.accstocks:
                if code == acode:
                    await self.check_kline(acc, code, kltypes)

    async def check_kline(self, acc, code, kltypes):
        # 这里可以添加K线检查的代码
        pass


class StrategyGE(PlannedStrategy):
    key = 'StrategyGE'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.k15listener = StrategyI_Listener()
        self.k15watcher = iunCloud.get_watcher('kline15')
        self.k15listener.on_watcher = self.on_watcher
        self.watchers = [self.watcher, self.k15watcher]
        self.skltype = 1

    async def check_kline(self, acc, code, kltypes):
        buydetails = IunCache.get_buy_details(acc, code)
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if len(buydetails) > 0 and ('guardPrice' not in smeta or smeta['guardPrice'] < FnPs.min_buy_price(buydetails)):
            smeta['guardPrice'] = FnPs.min_buy_price(buydetails)

        lkltype = int(smeta['kltype'])
        klines = klPad.get_klines(code, lkltype)
        if len(klines) > 0 and lkltype in kltypes and not buydetails:
            if FnPs.bss18_buy_match(klines):
                # 建仓
                tacc = smeta['account'] if 'account' in smeta else acc
                StrategyFac.planned_strategy_trade(acc, code, 'B', klines['close'].iloc[-1], 0, tacc)
                logger.info('建仓 %s %s %d %s %s', acc, code, lkltype, smeta, klines)
                return

        if len(buydetails) > 0 and self.skltype in kltypes:
            # check ma1 buy
            klines1 = klPad.get_klines(code, self.skltype)
            if len(klines1) > 0:
                klclose1 = klines1['close'].iloc[-1]
                mxprice = FnPs.max_buy_price(buydetails)
                if 'inCritical' in smeta and smeta['inCritical']:
                    if klclose1 - (smeta['guardPrice'] - mxprice * smeta['stepRate'] * 0.8) > 0:
                        smeta['inCritical'] = False
                        IunCache.update_strategy_meta(acc, code, self.key, smeta)
                        return
                    if klPad.continuously_increase_days(code, self.skltype) > 2:
                        tacc = smeta['account'] if 'account' in smeta else acc
                        StrategyFac.planned_strategy_trade(acc, code, 'B', klclose1, 0, tacc)
                        logger.info('加仓 %s %s %d %s %s', acc, code, self.skltype, smeta, klines1)
                        smeta['guardPrice'] = klclose1
                        smeta['inCritical'] = False
                        IunCache.update_strategy_meta(acc, code, self.key, smeta)
                        return
                if klclose1 <= smeta['guardPrice'] - mxprice * smeta['stepRate'] / 5:
                    smeta['inCritical'] = True
                    IunCache.update_strategy_meta(acc, code, self.key, smeta)
                    return

        if len(klines) > 0 and len(buydetails) > 0 and lkltype in kltypes and FnPs.bss18_sell_match(klines):
            klclose = klines['close'].iloc[-1]
            if 'cutselltype' not in smeta:
                smeta['cutselltype'] = 'egate'
            count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], klclose, smeta['stepRate'])
            if count > 0:
                StrategyFac.planned_strategy_trade(acc, code, 'S', klclose, count)
                logger.info('卖出 %s %s %d %s %s', acc, code, lkltype, smeta, klines)
                del smeta['guardPrice']
                smeta['inCritical'] = False
                IunCache.update_strategy_meta(acc, code, self.key, smeta)
                return


class StrategySellMA(PlannedStrategy):
    key = 'StrategySellMA'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.k15listener = StrategyI_Listener()
        self.k15watcher = iunCloud.get_watcher('kline15')
        self.k15listener.on_watcher = self.on_watcher
        self.watchers = [self.watcher]

    def add_stock(self, acc, code):
        if (acc, code) not in self.accstocks:
            self.accstocks.append((acc, code))
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if 'kltype' in smeta:
            kltype = int(smeta['kltype'])
            if kltype < 15:
                self.watcher.add_stock(code)
            else:
                self.k15watcher.add_stock(code)

    def remove_stock(self, acc, code):
        if (acc, code) in self.accstocks:
            self.accstocks.remove((acc, code))
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if 'kltype' in smeta:
            kltype = smeta['kltype']
            if kltype < 15:
                self.watcher.remove_stock(code)
            else:
                self.k15watcher.remove_stock(code)

    async def check_kline(self, acc, code, kltypes):
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if 'kltype' not in smeta or smeta['kltype'] not in kltypes:
            return

        klines = klPad.get_klines(code, smeta['kltype'])
        klclose = klines['close'].iloc[-1]
        buydetails = IunCache.get_buy_details(acc, code)
        if FnPs.bss18_sell_match(klines):
            count = FnPs.get_sell_count_matched(buydetails, smeta['selltype'], klclose, smeta['upRate'])
            if count > 0:
                StrategyFac.planned_strategy_trade(acc, code, 'S', klclose, count)
                smeta['enabled'] = False
                self.remove_stock(acc, code)
                IunCache.update_strategy_meta(acc, code, self.key, smeta)


class StrategySellELShort(PlannedStrategy):
    key = 'StrategySellELS'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.qlistener = StrategyI_Listener()
        self.qlistener.on_watcher = self.on_quotes
        self.qwatcher = iunCloud.get_watcher('quotes')
        self.watchers = [self.watcher, self.qwatcher]
        self.skltype = 1

    async def start_strategy_tasks(self):
        self.watcher.add_listener(self)
        self.qwatcher.add_listener(self.qlistener)
        await self.watcher.start_strategy_tasks()
        await self.qwatcher.start_strategy_tasks()

    async def on_quotes(self, params):
        for acc, acode in self.accstocks:
            if acode in params:
                await self.check_quotes(acc, acode)

    async def check_quotes(self, acc, code):
        quotes = klPad.get_quotes(code)
        if not quotes:
            return
        # TODO: switch to highspeed watcher if change > 6.5%
        # if quotes['change'] > 0.065:
        #     self.qwatcher.remove_stock(code)
        #     self.qickwatcher.add_stock(code)
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if smeta is None or quotes is None:
            logger.error('check_quotes meta is None %s %s %s %s', acc, code, smeta, quotes)
            return
        if 'topprice' in smeta and quotes['price'] < smeta['topprice']:
            return

        if 'cutselltype' not in smeta:
            smeta['cutselltype'] = 'all'

        buydetails = IunCache.get_buy_details(acc, code)
        ztprice = klPad.get_zt_price(code)
        if quotes['high'] == ztprice:
            if quotes['bid1'] == quotes['ask1']:
                return
            if 'tmpmaxb1count' not in smeta or smeta['tmpmaxb1count'] < quotes['bid1_volume']:
                smeta['tmpmaxb1count'] = quotes['bid1_volume']
                IunCache.update_strategy_meta(acc, code, self.key, smeta)
            if smeta['tmpmaxb1count'] < 1e6:
                return
            # 涨停之后 打开或者封单减少到当日最大封单量的1/10 卖出.
            if quotes['ask1'] > 0 or quotes['bid1_volume'] < smeta['tmpmaxb1count'] * 0.1:
                count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], quotes['price'])
                if count > 0:
                    StrategyFac.planned_strategy_trade(acc, code, 'S', quotes['bid2'] if quotes['bid2'] > 0 else quotes['bottom_price'], count)
                    self.remove_stock(acc, code)
                    if 'tmpmaxb1count' in smeta:
                        del smeta['tmpmaxb1count']
                    smeta['enabled'] = False
                    IunCache.update_strategy_meta(acc, code, self.key, smeta)

        if 'guardPrice' in smeta and quotes['price'] < smeta['guardPrice']:
            count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], quotes['price'])
            if count > 0:
                StrategyFac.planned_strategy_trade(acc, code, 'S', quotes['price'], count)
                self.remove_stock(acc, code)
                if 'tmpmaxb1count' in smeta:
                    del smeta['tmpmaxb1count']
                smeta['enabled'] = False
                IunCache.update_strategy_meta(acc, code, self.key, smeta)

    async def check_kline(self, acc, code, kltypes):
        if self.skltype not in kltypes:
            return

        klines = klPad.get_klines(code, self.skltype)
        if len(klines) == 0:
            return

        klclose = klines['close'].iloc[-1]
        buydetails = IunCache.get_buy_details(acc, code)
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if smeta is None:
            logger.error('check_kline meta is None %s %s %s %s', acc, code, smeta)
            return

        if 'cutselltype' not in smeta:
            smeta['cutselltype'] = 'all'
        if 'topprice' in smeta:
            if klclose <= smeta['topprice'] and ('guardPrice' not in smeta or smeta['guardPrice'] <= klclose):
                return
            del smeta['topprice']
            if 'guardPrice' not in smeta:
                smeta['guardPrice'] = 0
        count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], klclose)
        if count > 0 and klclose < smeta['guardPrice']:
            StrategyFac.planned_strategy_trade(acc, code, 'S', klclose, count)
            smeta['enabled'] = False
            self.remove_stock(acc, code)
            IunCache.update_strategy_meta(acc, code, self.key, smeta)
            return

        troughprice = klPad.get_last_trough(code, self.skltype)
        ztprice = klPad.get_zt_price(code)
        if klclose == klines['low'].iloc[-1] and klclose >= ztprice and klclose * 0.98 >troughprice:
            troughprice = klclose * 0.96
        if troughprice > 0 and troughprice > smeta['guardPrice']:
            smeta['guardPrice'] = troughprice
            IunCache.update_strategy_meta(acc, code, self.key, smeta)


class StrategySellBeforeEnd(PlannedStrategy):
    key = 'StrategySellBE'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('klineday')
        self.watchers = [self.watcher]
        self.kltype = 101

    async def check_kline(self, acc, code, kltypes):
        if self.kltype not in kltypes:
            return

        klines = klPad.get_klines(code, self.kltype)
        if len(klines) == 0:
            return

        klclose = klines['close'].iloc[-1]
        buydetails = IunCache.get_buy_details(acc, code)
        if FnPs.get_sell_count_matched(buydetails, 'all', klclose) == 0:
            return

        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if 'selltype' not in smeta:
            smeta['selltype'] = 'single'
        count = FnPs.get_sell_count_matched(buydetails, smeta['selltype'], klclose)
        if count == 0:
            return

        ztprice = klPad.get_zt_price(code)
        conditions = {'not_zt': 1,  'h_and_l_dec': 1<<1, 'h_or_l_dec':1<<2, 'p_ge': 1<<3};
        if smeta['sell_conds'] & conditions['not_zt']:
            if klclose < ztprice:
                self.dosell(acc, code, klclose, count, smeta)
                return
            
        zt = klclose == ztprice
        if len(klines) < 2:
            return

        hinc = klines['high'].iloc[-1] > klines['high'].iloc[-2] or zt
        linc = klines['low'].iloc[-1] > klines['low'].iloc[-2]
        klopen = klines['open'].iloc[-1]
        if smeta['sell_conds'] & conditions['h_and_l_dec']:
            # 最高价和最低价都不增加时卖出 阴线也卖出
            if (not hinc and not linc) or klclose < klopen:
                self.dosell(acc, code, klclose, count, smeta)
                return
        if smeta['sell_conds'] & conditions['h_or_l_dec']:
            # 最高价和最低价都不增加时卖出 阴线也卖出
            if (not hinc or not linc) or klclose < klopen:
                self.dosell(acc, code, klclose, count, smeta)
                return
        if smeta['sell_conds'] & conditions['p_ge']:
            # 收益率>=, 涨停不适用
            if zt:
                return
            if klclose > FnPs.buy_details_average_price(buydetails) * (1 + smeta['upRate']):
                self.dosell(acc, code, klclose, count, smeta)
                return

    def dosell(self, acc, code, price, count, smeta):
        StrategyFac.planned_strategy_trade(acc, code, 'S', round(price * 0.99, 2), count)
        smeta['enabled'] = False
        self.remove_stock(acc, code)
        IunCache.update_strategy_meta(acc, code, self.key, smeta)


class StrategyBuyZTBoard(PlannedStrategy):
    key = 'StrategyBuyZTBoard'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('quotes')
        self.watchers = [self.watcher]

    async def on_watcher(self, params):
        for acc, acode in self.accstocks:
            if acode in params:
                await self.check_quotes(acc, acode)

    async def check_quotes(self, acc, code):
        quotes = klPad.get_quotes(code)
        if not quotes:
            return

        if quotes['bid1'] == quotes['ask1']:
            # 集合竞价
            return

        ztprice = klPad.get_zt_price(code)
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if quotes['price'] == ztprice:
            if quotes['open'] == ztprice and 'tmpztbroken' not in smeta:
                smeta['tmpztbroken'] = False
            if 'tmpztbroken' not in smeta or not smeta['tmpztbroken']:
                return
        else:
            smeta['tmpztbroken'] = True

        if (quotes['price'] == ztprice and ('tmpztbroken' not in smeta or smeta['tmpztbroken'])) or \
            (quotes['ask2'] == 0 and quotes['ask1'] == ztprice) or self.is_zt_reaching(quotes, ztprice):
            tacc = smeta['account'] if 'account' in smeta else acc
            StrategyFac.planned_strategy_trade(acc, code, 'B', ztprice, 0, tacc)
            smeta['enabled'] = False
            self.remove_stock(acc, code)
            IunCache.update_strategy_meta(acc, code, self.key, smeta)

    def is_zt_reaching(self, quotes, ztprice):
        topshown = False
        for i in range(5, 0, -1):
            if quotes[f'ask{i}'] == 0:
                topshown = True
                break
        if not topshown:
            topshown = quotes['ask5'] == ztprice
        if topshown:
            scount = 0
            for i in range(1, 6):
                scount += quotes[f'ask{i}_volume']
            return scount < 2e6
        return False


class StrategyBuyDTBoard(PlannedStrategy):
    key = 'StrategyBuyDTBoard'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('quotes')
        self.watchers = [self.watcher]

    async def on_watcher(self, params):
        for acc, acode in self.accstocks:
            if acode in params:
                await self.check_quotes(acc, acode)

    async def check_quotes(self, acc, code):
        quotes = klPad.get_quotes(code)
        if not quotes:
            return

        if quotes['bid1'] == quotes['ask1']:
            # 集合竞价
            return

        dtprice = klPad.get_dt_price(code)
        smeta = IunCache.get_strategy_meta(acc, code, self.key)
        if quotes['price'] == dtprice and quotes['bid1_volume'] == 0:
            if 'fdcount' not in smeta or smeta['fdcount'] < quotes['ask1_volume']:
                smeta['fdcount'] = quotes['ask1_volume']

        if quotes['price'] > dtprice or quotes['ask1_volume'] < 3e5 or quotes['ask1_volume'] < smeta['fdcount'] * 0.2:
            tacc = smeta['account'] if 'account' in smeta else acc
            StrategyFac.planned_strategy_trade(acc, code, 'B', dtprice + 0.02, 0, tacc)
            smeta['enabled'] = False
            self.remove_stock(acc, code)
            IunCache.update_strategy_meta(acc, code, self.key, smeta)


class StrategyFac():
    @classmethod
    @lru_cache(maxsize=None)
    def get_strategy(self, k):
        s = None
        if k == StrategyGE.key:
            s = StrategyGE()
        elif k == StrategySellELShort.key:
            s = StrategySellELShort()
        elif k == StrategySellBeforeEnd.key:
            s = StrategySellBeforeEnd()
        elif k == StrategySellMA.key:
            s = StrategySellMA()
        elif k == StrategyBuyZTBoard.key:
            s = StrategyBuyZTBoard()
        elif k == StrategyBuyDTBoard.key:
            s = StrategyBuyDTBoard()
        else:
            logger.error('Strategy not implemented: %s', k)

        if s:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(s.start_strategy_tasks())
            else:
                loop.call_soon(asyncio.ensure_future, s.start_strategy_tasks())

        return s

    @classmethod
    def planned_strategy_trade(self, acc: str, code: str, tradeType: str, price: float, count: int, tacc: str=None) -> None:
        '''
        :param acc str: 持仓账户
        :param code str: 股票代码
        :param tradeType str: 'B'/'S'
        :param price float: 价格
        :param count int: 股数
        :param tacc str: 交易账户(买入时设置), 不设置则与持仓账户相同acc
        :return: None
        '''
        buydetails = IunCache.get_buy_details(acc, code)
        tacc = acc if tacc is None else tacc
        if tradeType == 'B':
            if count == 0:
                sobj = IunCache.get_stock_strategy(acc, code)
                if not sobj or 'amount' not in sobj:
                    logger.error('No stock strategy found for %s %s', acc, code)
                    return
                amount = sobj['amount']
                count = guang.calc_buy_count(amount, price)
            buydetails.append({'code': code, 'count': count, 'price': price, 'date': guang.today_date('-'), 'type': 'B'})
        else:
            buydetails = FnPs.consume_buy_details(buydetails, count)
        TradeInterface.submit_trade({'account': tacc, 'code': code, 'tradeType': tradeType, 'count': count, 'price': price})
        logger.info('Strategy trade: %s %s %s %f %d', tacc, code, tradeType, price, count)
        IunCache.update_buy_details(acc, code, buydetails)

