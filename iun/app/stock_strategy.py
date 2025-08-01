import pandas as pd
from app.lofig import logger
from app.guang import guang
from app.intrade_base import BaseStrategy, iunCloud, StockStrategy
from app.klpad import klPad
from app.trade_interface import TradeInterface
from app.accounts import accld


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
        if selltype == 'xsingle':
            # 保留最少买入的一次
            return min(count_avail, sum([rec['count'] for rec in buyrecs]) - min([rec['count'] for rec in buyrecs]))
        if selltype == 'x100':
            # 保留100股
            return min(count_avail, sum([rec['count'] for rec in buyrecs]) - 100)
        return min(count_avail, buyrecs[-1]['count'])

    @staticmethod
    def buy_details_average_price(buyrecs):
        if len(buyrecs) == 0:
            return 0
        total = sum([rec['count'] * rec['price'] for rec in buyrecs])
        count = sum([rec['count'] for rec in buyrecs])
        return total / count if count > 0 else 0


class StrategyGE(StockStrategy):
    key = 'StrategyGE'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.k15listener = BaseStrategy()
        self.k15watcher = iunCloud.get_watcher('kline15')
        self.k15listener.on_watcher = self.on_watcher
        self.watchers = [self.watcher, self.k15watcher]
        self.skltype = 1

    async def check_kline(self, acc, code, kltypes):
        buydetails = accld.get_buy_details(acc, code)
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta['enabled']:
            return
        if len(buydetails) > 0 and ('guardPrice' not in smeta or smeta['guardPrice'] < FnPs.min_buy_price(buydetails)):
            smeta['guardPrice'] = FnPs.min_buy_price(buydetails)

        lkltype = int(smeta['kltype'])
        klPad.calc_indicators(code, lkltype)
        klines = klPad.get_klines(code, lkltype)
        if len(klines) > 0 and lkltype in kltypes and not buydetails:
            if FnPs.bss18_buy_match(klines):
                # 建仓
                tacc = smeta['account'] if 'account' in smeta else acc
                accld.planned_strategy_trade(acc, code, 'B', klines['close'].iloc[-1], 0, tacc)
                logger.info('建仓 %s %s %d %s %s', acc, code, lkltype, smeta, klines)
                return

        if len(buydetails) > 0 and self.skltype in kltypes:
            # check ma1 buy
            klines1 = klPad.get_klines(code, self.skltype)
            if len(klines1) > 0:
                klclose1 = klines1['close'].iloc[-1]
                mxprice = FnPs.max_buy_price(buydetails)
                if 'inCritical' in smeta and smeta['inCritical']:
                    if klclose1 - (smeta['guardPrice'] - mxprice * smeta['stepRate'] * 0.16) > 0:
                        smeta['inCritical'] = False
                        accld.update_strategy_meta(acc, code, self.key, smeta)
                        return
                    if klPad.continuously_increase_days(code, self.skltype) > 2:
                        tacc = smeta['account'] if 'account' in smeta else acc
                        logger.info('加仓 %s %s %d %s %s', acc, code, self.skltype, smeta, klines1)
                        smeta['guardPrice'] = klclose1
                        smeta['inCritical'] = False
                        accld.update_strategy_meta(acc, code, self.key, smeta)
                        accld.planned_strategy_trade(acc, code, 'B', klclose1, 0, tacc)
                        return
                if klclose1 <= smeta['guardPrice'] - mxprice * smeta['stepRate'] / 5:
                    smeta['inCritical'] = True
                    accld.update_strategy_meta(acc, code, self.key, smeta)
                    return

        if len(klines) > 0 and len(buydetails) > 0 and lkltype in kltypes and FnPs.bss18_sell_match(klines):
            klclose = klines['close'].iloc[-1]
            if 'cutselltype' not in smeta:
                smeta['cutselltype'] = 'egate'
            count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], klclose, smeta['stepRate'])
            if count > 0:
                logger.info('卖出 %s %s %d %s %s', acc, code, lkltype, smeta, klines)
                del smeta['guardPrice']
                smeta['inCritical'] = False
                accld.update_strategy_meta(acc, code, self.key, smeta)
                accld.planned_strategy_trade(acc, code, 'S', klclose, count)
                return


class StrategyBuySellBeforeEnd(StockStrategy):
    key = 'StrategyBSBE'
    def __init__(self):
        ''' 波段策略，尾盘减仓加仓
        收盘价连续2天低于MA5时，减仓(仅保留底仓或留1手)，收盘价连续2天高于MA5时加仓使亏损幅度为8%
        '''
        super().__init__()
        self.watcher = iunCloud.get_watcher('klineday')
        self.watchers = [self.watcher]
        self.kltype = 101

    async def check_kline(self, acc, code, kltypes):
        if self.kltype not in kltypes:
            return

        klPad.calc_ma(code, self.kltype, 5)

        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta or not smeta['enabled']:
            return

        klines = klPad.get_klines(code, self.kltype)
        if len(klines) == 0:
            return

        if self.check_buy_before_end(acc, code):
            return

        self.check_sell_before_end(acc, code)


    def check_buy_before_end(self, acc, code):
        klines = klPad.get_klines(code, self.kltype)
        buydetails = accld.get_buy_details(acc, code)
        smeta = accld.get_strategy_meta(acc, code, self.key)

        klclose = klines['close'].iloc[-1]
        if 'guardPrice' not in smeta:
            smeta['guardPrice'] = FnPs.buy_details_average_price(buydetails)
        if klclose > smeta['guardPrice'] * 0.92:
            return False

        if klines['close'].iloc[-1] <= klines['ma5'].iloc[-1] or klines['close'].iloc[-2] < klines['ma5'].iloc[-2]:
            return False

        if klines['close'].iloc[-1] > klines['ma5'].iloc[-1] * 1.06:
            return False

        if max(klines['close'].iloc[-3:-1]) > klines['ma5'].iloc[-1] * 1.1:
            return False

        ztprice = klPad.get_zt_price(code)
        hcount = sum([b['count'] for b in buydetails])
        lost = (smeta['guardPrice'] - klclose) * hcount if hcount > 0 else smeta['guardPrice']
        amount = lost / 0.08 - klclose * hcount
        sobj = accld.get_stock_strategy_group(acc, code)
        if sobj and 'amount' in sobj:
            amount = min(25*sobj['amount'], amount)
        count = guang.calc_buy_count(amount, klclose)
        price = round(min(ztprice, klclose * 1.01), 2)
        smeta['guardPrice'] = round((klclose * count + hcount * smeta['guardPrice']) / (count + hcount), 2)
        accld.planned_strategy_trade(acc, code, 'B', price, count)
        return True

    def check_sell_before_end(self, acc, code):
        klines = klPad.get_klines(code, self.kltype)
        buydetails = accld.get_buy_details(acc, code)
        smeta = accld.get_strategy_meta(acc, code, self.key)

        if smeta['disable_sell']:
            return False

        if 'selltype' not in smeta:
            smeta['selltype'] = 'xsingle'
        klclose = klines['close'].iloc[-1]
        count = FnPs.get_sell_count_matched(buydetails, smeta['selltype'], klclose)
        if count == 0:
            return False

        if klines['close'].iloc[-1] > klines['ma5'].iloc[-1] or klines['close'].iloc[-2] > klines['ma5'].iloc[-2]:
            return False

        dtprice = klPad.get_dt_price(code)
        price = round(max(dtprice, klclose * 0.99), 2)
        if 'guardPrice' not in smeta:
            smeta['guardPrice'] = FnPs.buy_details_average_price(buydetails)
        hcount = sum([b['count'] for b in buydetails])
        if hcount == count:
            smeta['guardPrice'] = (smeta['guardPrice'] - klclose) * hcount
        else:
            smeta['guardPrice'] = round((smeta['guardPrice'] - klclose) * hcount / (hcount - count) + klclose, 2)
        accld.update_strategy_meta(acc, code, self.key, smeta)
        accld.planned_strategy_trade(acc, code, 'S', price, count)
        return True



class StrategySellMA(StockStrategy):
    key = 'StrategySellMA'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.k15listener = BaseStrategy()
        self.k15watcher = iunCloud.get_watcher('kline15')
        self.k15listener.on_watcher = self.on_watcher
        self.watchers = [self.watcher]

    def add_stock(self, acc, code):
        if (acc, code) not in self.accstocks:
            self.accstocks.append((acc, code))
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if 'kltype' in smeta:
            kltype = int(smeta['kltype'])
            if kltype < 15:
                self.watcher.add_stock(code)
            else:
                self.k15watcher.add_stock(code)

    def remove_stock(self, acc, code):
        if (acc, code) in self.accstocks:
            self.accstocks.remove((acc, code))
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if 'kltype' in smeta:
            kltype = smeta['kltype']
            if kltype < 15:
                self.watcher.remove_stock(code)
            else:
                self.k15watcher.remove_stock(code)

    async def check_kline(self, acc, code, kltypes):
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta['enabled']:
            return

        if 'kltype' not in smeta or smeta['kltype'] not in kltypes:
            return

        klPad.calc_indicators(code, smeta['kltype'])
        klines = klPad.get_klines(code, smeta['kltype'])
        klclose = klines['close'].iloc[-1]
        buydetails = accld.get_buy_details(acc, code)
        if FnPs.bss18_sell_match(klines):
            count = FnPs.get_sell_count_matched(buydetails, smeta['selltype'], klclose, smeta['upRate'])
            if count > 0:
                smeta['enabled'] = False
                accld.update_strategy_meta(acc, code, self.key, smeta)
                accld.planned_strategy_trade(acc, code, 'S', klclose, count)
                self.remove_stock(acc, code)


class StrategySellELShort(StockStrategy):
    key = 'StrategySellELS'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('kline1')
        self.qlistener = BaseStrategy()
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
        # TODO: switch to highspeed watcher if change > 6.5%
        # if quotes['change'] > 0.065:
        #     self.qwatcher.remove_stock(code)
        #     self.qickwatcher.add_stock(code)
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if smeta is None or quotes is None:
            logger.error('check_quotes meta is None %s %s %s %s', acc, code, smeta, quotes)
            return
        if not smeta['enabled']:
            return
        if 'topprice' in smeta and quotes['price'] < smeta['topprice']:
            return

        if 'cutselltype' not in smeta:
            smeta['cutselltype'] = 'all'

        buydetails = accld.get_buy_details(acc, code)
        ztprice = klPad.get_zt_price(code)
        if quotes['high'] == ztprice:
            quotes = klPad.get_quotes5(code)
            if quotes['bid1'] == quotes['ask1']:
                return
            if 'tmpmaxb1count' not in smeta or smeta['tmpmaxb1count'] < quotes['bid1_volume']:
                smeta['tmpmaxb1count'] = quotes['bid1_volume']
                accld.update_strategy_meta(acc, code, self.key, smeta)
            if smeta['tmpmaxb1count'] < 1e6:
                return
            # 涨停之后 打开或者封单减少到当日最大封单量的1/10 卖出.
            if quotes['ask1'] > 0 or quotes['bid1_volume'] < smeta['tmpmaxb1count'] * 0.1:
                count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], quotes['price'])
                if count > 0:
                    if 'tmpmaxb1count' in smeta:
                        del smeta['tmpmaxb1count']
                    smeta['enabled'] = False
                    accld.update_strategy_meta(acc, code, self.key, smeta)
                    accld.planned_strategy_trade(acc, code, 'S', quotes['bid2'] if quotes['bid2'] > 0 else quotes['bottom_price'], count)
                    self.remove_stock(acc, code)

        if 'guardPrice' in smeta and quotes['price'] < smeta['guardPrice']:
            count = FnPs.get_sell_count_matched(buydetails, smeta['cutselltype'], quotes['price'])
            if count > 0:
                quotes = klPad.get_quotes5(code)
                if 'tmpmaxb1count' in smeta:
                    del smeta['tmpmaxb1count']
                smeta['enabled'] = False
                accld.update_strategy_meta(acc, code, self.key, smeta)
                accld.planned_strategy_trade(acc, code, 'S', quotes['bid2'] if quotes['bid2'] > 0 else quotes['price'], count)
                self.remove_stock(acc, code)

    async def check_kline(self, acc, code, kltypes):
        if self.skltype not in kltypes:
            return

        klines = klPad.get_klines(code, self.skltype)
        if len(klines) == 0:
            return

        klclose = klines['close'].iloc[-1]
        buydetails = accld.get_buy_details(acc, code)
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if smeta is None:
            logger.error('check_kline meta is None %s %s %s', acc, code, smeta)
            return
        if not smeta['enabled']:
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
            smeta['enabled'] = False
            accld.update_strategy_meta(acc, code, self.key, smeta)
            accld.planned_strategy_trade(acc, code, 'S', klclose-0.05, count)
            self.remove_stock(acc, code)
            return

        troughprice = klPad.get_last_trough(code, self.skltype)
        ztprice = klPad.get_zt_price(code)
        if klclose == klines['low'].iloc[-1] and klclose >= ztprice and klclose * 0.98 >troughprice:
            troughprice = klclose * 0.96
        if troughprice > 0 and troughprice > smeta['guardPrice']:
            smeta['guardPrice'] = troughprice
            accld.update_strategy_meta(acc, code, self.key, smeta)


class StrategySellBeforeEnd(StockStrategy):
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
        buydetails = accld.get_buy_details(acc, code)
        if FnPs.get_sell_count_matched(buydetails, 'all', klclose) == 0:
            return

        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta['enabled']:
            return
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
        smeta['enabled'] = False
        accld.update_strategy_meta(acc, code, self.key, smeta)
        accld.planned_strategy_trade(acc, code, 'S', round(price * 0.99, 2), count)
        self.remove_stock(acc, code)


class StrategyBuyZTBoard(StockStrategy):
    key = 'StrategyBuyZTBoard'
    def __init__(self):
        super().__init__()
        self.watcher = iunCloud.get_watcher('quotes')
        self.watchers = [self.watcher]
        self.notified = []
        self.buy_hurry = False
        self.max_notify = 9999
        self.hmatched = []

    async def on_watcher(self, params):
        for acc, acode in self.accstocks:
            if acode in params:
                await self.check_quotes(acc, acode)

    async def check_quotes(self, acc, code):
        quotes = klPad.get_quotes(code)
        if not quotes:
            return

        if quotes['time'] < '09:30:00' or quotes['time'] > '15:00:00':
            # 集合竞价
            return

        ztprice = klPad.get_zt_price(code)
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta or not smeta['enabled'] or code in self.notified:
            return

        if quotes['open'] == ztprice:
            if quotes['price'] == ztprice:
                if 'keepztsinceopen' not in smeta:
                    smeta['keepztsinceopen'] = True
                    accld.update_strategy_meta(acc, code, self.key, smeta)
                    return
                if smeta['keepztsinceopen']:
                    return
            else:
                smeta['keepztsinceopen'] = False

        if 'keepztsinceopen' in smeta and smeta['keepztsinceopen']:
            return

        quotes = klPad.get_quotes5(code)
        if not self.hurry_buy_match(code, quotes) and not self.is_zt_reaching(quotes, ztprice):
            return

        if len(self.notified) >= self.max_notify:
            logger.info('%s too many stocks notified, skip %s, notified %s, max_notify %d', self.key, code, self.notified, self.max_notify)
            return

        self.notified.append(code)
        tacc = smeta['account'] if 'account' in smeta else acc
        smeta['enabled'] = False
        accld.update_strategy_meta(acc, code, self.key, smeta)
        accld.planned_strategy_trade(acc, code, 'B', ztprice, 0, tacc)
        if self.max_notify != 9999:
            logger.info('%s %s %s', self.key, code, quotes)
        self.remove_stock(acc, code)

    def hurry_buy_match(self, code, quotes):
        if quotes['change'] > 0.09 and code not in self.hmatched:
            self.hmatched.append(code)
            logger.info('%s %s change > 0.09 %s', self.key, code, quotes)
        return self.buy_hurry and quotes['change'] > 0.09

    @staticmethod
    def is_zt_reaching(quotes, ztprice):
        ''' 判断是否接近涨停价
        '''
        if not quotes:
            return False
        if quotes['price'] == ztprice and quotes['ask1'] == 0:
            return True
        if quotes['ask1'] == ztprice and quotes['ask1_volume'] < 1e6:
            return True
        if quotes['ask1'] == quotes['bid1']:
            return quotes['price'] == ztprice
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
            # 卖盘不足2万手或卖盘金额低于4百万
            return scount < 2e6 or scount * ztprice < 4e6
        return False


class StrategyBuyDTBoard(StockStrategy):
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

        if quotes['time'] < '09:30:00' or quotes['time'] > '15:00:00':
            # 集合竞价
            return

        dtprice = klPad.get_dt_price(code)
        smeta = accld.get_strategy_meta(acc, code, self.key)
        if not smeta or not smeta['enabled']:
            return

        quotes = klPad.get_quotes5(code)
        if quotes['price'] == dtprice and quotes['bid1_volume'] == 0:
            if 'fdcount' not in smeta or smeta['fdcount'] < quotes['ask1_volume']:
                smeta['fdcount'] = quotes['ask1_volume']

        if quotes['price'] > dtprice or quotes['ask1_volume'] < 3e5 or quotes['ask1_volume'] < smeta['fdcount'] * 0.2:
            tacc = smeta['account'] if 'account' in smeta else acc
            smeta['enabled'] = False
            accld.update_strategy_meta(acc, code, self.key, smeta)
            accld.planned_strategy_trade(acc, code, 'B', dtprice + 0.02, 0, tacc)
            self.remove_stock(acc, code)


