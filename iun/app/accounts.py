import requests
import json
from stockrt import get_fullcode, quotes
from app.lofig import logger
from app.guang import guang
from app.intrade_base import iunCloud
from app.trade_interface import TradeInterface
from app.klpad import klPad


class Account(object):
    recycle_strs = ['StrategyGE', 'StrategyBSBE']
    def __init__(self, acc):
        self.keyword = acc
        self.stocks = {}
        self.trading_remarks = {}

    def load_watchings(self) -> None:
        surl = f"{accld.dserver}stock?act=watchings&acc={self.keyword}"
        sresponse = requests.get(surl, headers=accld.headers)
        if sresponse.status_code != 200:
            logger.error('Error:', sresponse.status_code, sresponse.text)
            return None
        stocks = sresponse.json()
        for c, v in stocks.items():
            if c in iunCloud.get_suspend_stocks():
                logger.info('%s is suspended', c)
                continue
            code = c[-6:]
            if not v['strategies']['strategies']:
                logger.error('%s %s has no strategy', self.keyword, c)
                continue

            self.cache_stock(code, v)

            for sobj in v['strategies']['strategies'].values():
                if not sobj['enabled']:
                    continue
                s = iunCloud.strFac.stock_strategy(sobj['key'])
                if s:
                    s.add_stock(self.keyword, code)
        logger.info('%s Loaded stocks: %d', self.keyword, len(self.stocks))

    def cache_stock(self, code, data):
        strategy = data['strategies']
        strategy['strategies'] = accld.parse_number_in_strategies(strategy['strategies'])
        if code not in self.stocks:
            count = data.get('holdCount', 0)
            price = data.get('holdCost', 0)
            self.stocks[code] = {
                'holdCost': price,
                'holdCount': count,
                'strategies': strategy,
                'buydetail': strategy.get('buydetail', []),
                'buydetail_full': strategy.get('buydetail_full', [])
            }
            return
        else:
            self.stocks[code]['strategies'] = strategy

    def get_strategy_meta(self, code, skey):
        try:
            for s in self.stocks[code]['strategies']['strategies'].values():
                if s['key'] == skey:
                    return s
        except KeyError:
            return None

    def verify_strategies(self):
        today = guang.today_date('-')
        stocks = iunCloud.get_account_latest_stocks(self.keyword)
        holding = [s['code'] for s in stocks if s['holdCount'] > 0]
        if holding:
            logger.info('%s trading remarks %s', self.keyword, self.trading_remarks)
            hquotes = quotes(holding)
            for c in hquotes:
                klPad.cache(c, quotes=hquotes[c])

        for stock in stocks:
            if 'strategies' not in stock or 'strategies' not in stock['strategies'] or not stock['strategies']['strategies']:
                logger.info('%s %s has no strategy %s', self.keyword, stock['code'], stock)
                continue
            code = stock['code']
            buydetails = stock['strategies'].get('buydetail', [])
            buydetails_full = stock['strategies'].get('buydetail_full', [])
            traded = False
            for rec in buydetails_full:
                if rec['date'].split(' ')[0] == today and rec['count'] > 0:
                    traded = True
                    break

            if 'strategies' in stock['strategies']:
                dkeys = []
                for k, sobj in stock['strategies']['strategies'].items():
                    if sobj['key'] == 'StrategyBuyZTBoard':
                        dkeys.append(k)
                        continue

                if dkeys:
                    for k in dkeys:
                        del stock['strategies']['strategies'][k]

            if not traded:
                self.verify_not_traded(stock)
                continue

            count = stock['holdCount']
            if count == 0:
                self.verify_recycle_strategies(stock)
                continue
            if self.verify_track_buysell(stock):
                continue
            if self.verify_zt_top_reached(stock):
                continue

            if code in self.trading_remarks:
                if self.trading_remarks[code] == 'istrategy_zt1bk':
                    self.verify_zt1bk_strategies(stock)
                if self.trading_remarks[code] == 'istrategy_hsrzt0':
                    self.verify_hrszt0_strategies(stock)
                if self.trading_remarks[code] == 'istrategy_hotstks_open':
                    self.verify_hotstks_open_strategies(stock)
                if self.trading_remarks[code] == 'istrategy_zt1wb':
                    self.verify_zt1wb_strategies(stock)
                continue
            if 'strategies' in stock['strategies']:
                dkeys = []
                for k, sobj in stock['strategies']['strategies'].items():
                    if sobj['key'] == 'StrategyBSBE':
                        smeta = self.get_strategy_meta(code, sobj['key'])
                        if not smeta:
                            continue
                        logger.info('set guardPrice for %s with meta %s', code, smeta)
                        sobj['guardPrice'] = smeta['guardPrice']
                        continue
                    if sobj['key'] == 'StrategyGE':
                        smeta = self.get_strategy_meta(code, sobj['key'])
                        if not smeta:
                            continue
                        logger.info('set guardPrice for %s with meta %s', code, smeta)
                        if 'guardPrice' in smeta:
                            sobj['guardPrice'] = smeta['guardPrice']
                        else:
                            del sobj['guardPrice']
                        continue

            self.save_stock_strategy(code, stock['strategies'])

    def verify_not_traded(self, stock):
        return self.verify_zt_top_reached(stock)

    def verify_zt_top_reached(self, stock):
        '''
        如果当日涨停或接近目标价，调整卖出策略
        '''
        code = stock['code']
        sqt = klPad.get_quotes(code)
        if not sqt:
            return False

        old_top = 0
        enable_strategies = []
        if 'strategies' in stock['strategies']:
            for k, sobj in stock['strategies']['strategies'].items():
                if sobj['key'] == 'StrategySellELS':
                    old_top = float(sobj['topprice'])
                if sobj['enabled']:
                    enable_strategies.append(sobj['key'])
        if old_top > sqt['price']*1.05:
            return False

        if len(enable_strategies) == 1 and enable_strategies[0] in self.recycle_strs:
            return False

        smeta = None
        if sqt['price'] == klPad.get_zt_price(code):
            # 涨停
            smeta = {
                'StrategySellELS':{'enabled': True, 'topprice': round(sqt['price']*1.05, 2), 'guardPrice': round(sqt['price']*0.95, 2)},
                'StrategySellBE':{'enabled': True}
            }
        elif sqt['price'] * 1.03 > old_top:
            smeta = {
                'StrategySellELS':{'enabled': True, 'topprice': round(sqt['price']*1.03, 2), 'guardPrice': round(sqt['price']*0.95, 2)},
                'StrategySellBE':{'enabled': True, 'sell_conds': 4}
            }

        if smeta:
            strategies = guang.generate_strategy_json({'code': code, 'strategies': smeta}, {'amount': stock['strategies'].get('amount', 10000)})
            strategies['buydetail'] = stock['strategies'].get('buydetail', [])
            strategies['buydetail_full'] = stock['strategies'].get('buydetail_full', [])
            self.save_stock_strategy(code, strategies)
            return True

    def verify_zt1bk_strategies(self, stock):
        if stock['holdCount'] <= 0:
            return
        code = stock['code']
        if 'strategies' not in stock['strategies']:
            logger.error('%s %s has no strategy %s', self.keyword, code, stock)
            return
        sqt = klPad.get_quotes(code)
        if not sqt:
            logger.error('%s %s has no quotes %s', self.keyword, code, stock)
            return
        if sqt['high'] < sqt['lclose'] * 1.09:
            return
        top = sqt['price'] * 1.05 if sqt['price'] == sqt['high'] else min(sqt['high']*1.03, sqt['price']*1.05)
        guard = sqt['price'] * 0.95
        smeta = {
            'StrategySellELS':{'enabled': True, 'topprice': round(top, 2), 'guardPrice': round(guard, 2)},
            'StrategySellBE':{'enabled': True}
        }
        strategies = guang.generate_strategy_json({'code': code, 'strategies': smeta}, {'amount': stock['strategies'].get('amount', 10000)})
        strategies['buydetail'] = stock['strategies'].get('buydetail', [])
        strategies['buydetail_full'] = stock['strategies'].get('buydetail_full', [])
        ikey = 2
        for s in self.recycle_strs:
            sobj = self.get_strategy_meta(stock['code'], s)
            if sobj:
                strategies['strategies'][ikey] = sobj
                ikey += 1
        self.save_stock_strategy(code, strategies)

    def verify_hrszt0_strategies(self, stock):
        if self.keyword not in ('normal', 'collat'):
            return self.verify_zt1bk_strategies(stock)

        if stock['holdCount'] <= 0:
            return
        code = stock['code']
        if 'strategies' not in stock['strategies']:
            logger.error('%s %s has no strategy %s', self.keyword, code, stock)
            return
        sqt = klPad.get_quotes(code)
        if not sqt:
            logger.error('%s %s has no quotes %s', self.keyword, code, stock)
            return
        if sqt['high'] < sqt['lclose'] * 1.09:
            return
        top = sqt['price'] * 1.08
        smeta = {
            'StrategySellELS':{'enabled': True, 'topprice': round(top, 2)},
            'StrategySellBE':{'enabled': True, 'sell_conds': 1 if sqt['price'] == sqt['high'] else 8}
        }
        strategies = guang.generate_strategy_json({'code': code, 'strategies': smeta}, {'amount': stock['strategies'].get('amount', 10000)})
        strategies['buydetail'] = stock['strategies'].get('buydetail', [])
        strategies['buydetail_full'] = stock['strategies'].get('buydetail_full', [])
        self.save_stock_strategy(code, strategies)

    def verify_hotstks_open_strategies(self, stock):
        return self.verify_hrszt0_strategies(stock)

    def verify_zt1wb_strategies(self, stock):
        if stock['holdCount'] <= 0:
            logger.info('%s %s has no holdCount %s', self.keyword, stock['code'], stock)
            return
        code = stock['code']
        sqt = klPad.get_quotes(code)
        if not sqt:
            logger.error('%s %s has no quotes %s', self.keyword, code, stock)
            return
        if sqt['price'] == klPad.get_zt_price(code):
            top = sqt['price'] * 1.05
            guard = sqt['price'] * 0.95
            smeta = {
                'StrategySellELS':{'enabled': True, 'topprice': round(top, 2), 'guardPrice': round(guard, 2)},
                'StrategySellBE':{'enabled': True}
            }
        else:
            today = guang.today_date('-')
            rec = next((r for r in stock['strategies'].get('buydetail', []) if r['date'].split(' ')[0] == today), None)
            price = rec['price'] if rec else sqt['open']
            earn = sqt['price'] * 1.03 > price * 1.05
            top = sqt['price'] * 1.03 if earn else price * 1.05
            guard = sqt['price'] * 0.95 if earn else price * 0.92
            smeta = {
                'StrategySellELS':{'enabled': True, 'topprice': round(top, 2), 'guardPrice': round(guard, 2)}
            }
            if earn:
                smeta['StrategySellBE'] = {'enabled': True, 'sell_conds': 4}
        strategies = guang.generate_strategy_json({'code': code, 'strategies': smeta}, {'amount': stock['strategies'].get('amount', 10000)})
        strategies['buydetail'] = stock['strategies'].get('buydetail', [])
        strategies['buydetail_full'] = stock['strategies'].get('buydetail_full', [])
        self.save_stock_strategy(code, strategies)

    def verify_recycle_strategies(self, stock):
        '''
        当日清仓的票，如果策略是'StrategyGE'或'StrategyBSBE'，清理可能的中间变量
        '''
        if stock['holdCount'] > 0 or 'strategies' not in stock['strategies']:
            return
        remain_strs = []
        for k, sobj in stock['strategies']['strategies'].items():
            if sobj['key'] not in self.recycle_strs:
                continue
            remain_strs.append(k)
            if sobj['key'] == 'StrategyGE':
                smeta = self.get_strategy_meta(stock['code'], sobj['key'])
                if not smeta:
                    continue
                if 'guardPrice' in sobj:
                    del sobj['guardPrice']
                sobj['inCritical'] = False
            if sobj['key'] == 'StrategyBSBE':
                smeta = self.get_strategy_meta(stock['code'], sobj['key'])
                if smeta and 'guardPrice' in smeta:
                    sobj['guardPrice'] = smeta['guardPrice']
                    continue
                logger.info('StrategyBSBE guardPrice not set for %s', stock)
        stock['strategies']['strategies'] = {k:v for k,v in stock['strategies']['strategies'].items() if k in remain_strs}
        stock['strategies']['transfers'] = {k:v for k,v in stock['strategies']['transfers'].items() if k in remain_strs}
        self.save_stock_strategy(stock['code'], stock['strategies'])

    def verify_track_buysell(self, stock):
        '''
        模拟账户检查买卖点，9:30之前买入的按开盘价，14:57之后买入的按收盘价，当天全天一字板涨停的无法买入需舍弃
        已处理并保存策略返回True, 无法处理后续也无法处理的也返回True, 需后续操作的返回False
        '''
        if self.keyword in ('normal', 'collat', 'credit'):
            return False

        code = stock['code']
        sqt = klPad.get_quotes(code)
        if not sqt:
            return True
        buydetails = stock['strategies'].get('buydetail', [])
        buydetails_full = stock['strategies'].get('buydetail_full', [])
        if not buydetails or not buydetails_full:
            return True

        today = guang.today_date('-')
        zt_price = klPad.get_zt_price(code)
        zt1yzb = zt_price == sqt['price'] and zt_price == sqt['low']
        if zt1yzb:
            buydetails = [rec for rec in buydetails if rec['date'].split(' ')[0] != today]
            buydetails_full = [rec for rec in buydetails_full if rec['date'].split(' ')[0] != today]
            stock['strategies']['strategies'] = {}
            self.save_stock_strategy(code, stock['strategies'])
            return True

        for rec in buydetails:
            if rec['date'].split(' ')[0] == today:
                if rec['date'] < today + ' ' + '09:30':
                    rec['price'] = sqt['open']
                elif rec['date'] > today + ' ' + '14:57':
                    rec['price'] = sqt['price']
                rec['date'] = today
        for rec in buydetails_full:
            if rec['date'].split(' ')[0] == today:
                if rec['date'] < today + ' ' + '09:30':
                    rec['price'] = sqt['open']
                elif rec['date'] > today + ' ' + '14:57':
                    rec['price'] = sqt['price']
                rec['date'] = today
        return False

    def save_stock_strategy(self, code, strategy):
        logger.info('set strategy for %s %s', self.keyword, strategy)
        url = guang.join_url(accld.dserver, 'stock')
        data = {
            'act': 'strategy',
            'acc': self.keyword,
            'code': get_fullcode(code).upper(),
            'data': json.dumps(strategy)
        }

        guang.post_data(url, data, accld.headers)


class accld:
    dserver = None
    headers = None
    all_accounts: dict[str, Account] = {}

    @classmethod
    def load_accounts(self):
        url = f"{self.dserver}userbind?onlystock=1"
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            logger.error('Error:', response.status_code, response.text)
            return None

        accs = response.json()
        accs = [{'name': 'normal', 'email': '', 'realcash': 1}] + [x for x in accs if x['name'] == 'collat' or x['realcash'] == 0]
        for acc in accs:
            account = Account(acc['name'])
            account.load_watchings()
            self.all_accounts[acc['name']] = account

    @classmethod
    def parse_number_in_strategies(self, strdata):
        for k, v in strdata.items():
            for i, val in v.items():
                if isinstance(val, str):
                    if val.isdigit():
                        strdata[k][i] = int(val)
                    else:
                        try:
                            strdata[k][i] = float(val)
                        except:
                            pass
            strdata[k] = {i: val for i,val in strdata[k].items() if val is not None}
        return strdata

    @classmethod
    def cache_stock_data(self, acc, code, data):
        if not acc in self.all_accounts:
            self.all_accounts[acc] = Account(acc)
        self.all_accounts[acc].cache_stock(code, data)

    @classmethod
    def get_buy_details(self, acc, code):
        if not acc in self.all_accounts or not code in self.all_accounts[acc].stocks:
            return []
        return self.all_accounts[acc].stocks[code]['buydetail']

    @classmethod
    def update_buy_details(self, acc, code, buydetails):
        if acc not in self.all_accounts:
            return
        if code not in self.all_accounts[acc].stocks:
            self.all_accounts[acc].stocks[code] = {}
        self.all_accounts[acc].stocks[code]['buydetail'] = buydetails

    @classmethod
    def get_strategy_meta(cls, acc, code, skey):
        if acc not in cls.all_accounts or code not in cls.all_accounts[acc].stocks:
            return None
        return cls.all_accounts[acc].get_strategy_meta(code, skey)

    @classmethod
    def update_strategy_meta(self, acc, code, skey, dmeta):
        if acc not in self.all_accounts:
            return
        if code not in self.all_accounts[acc].stocks:
            self.all_accounts[acc].stocks[code] = {'strategies': {'strategies': {'0': dmeta}}}
            return

        for s in self.all_accounts[acc].stocks[code]['strategies']['strategies'].values():
            if s['key'] == skey:
                s.update(dmeta)

    @classmethod
    def get_stock_strategy_group(cls, acc, code):
        if acc in cls.all_accounts and code in cls.all_accounts[acc].stocks:
            return cls.all_accounts[acc].stocks[code]['strategies']
        return None

    @classmethod
    def get_account_holdcount(cls, acc, code):
        if acc == '':
            acc = 'normal' if code in cls.all_accounts['normal'].stocks else 'collat'
        if acc == 'credit':
            acc = 'collat'
        if code in cls.all_accounts[acc].stocks:
            return cls.all_accounts[acc].stocks[code].get('holdCount', 0)
        return 0

    @classmethod
    def all_stocks_cached(self):
        return sum([list(acc.stocks.keys()) for acc in self.all_accounts.values()], [])

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
        buydetails = accld.get_buy_details(acc, code)
        tacc = acc if tacc is None else tacc
        sobj = accld.get_stock_strategy_group(acc, code)
        if tradeType == 'B':
            if count == 0:
                if not sobj or 'amount' not in sobj:
                    logger.error('No stock strategy found for %s %s', acc, code)
                    return
                amount = sobj['amount']
                count = guang.calc_buy_count(amount, price)
            buydetails.append({'code': code, 'count': count, 'price': price, 'date': guang.today_date('-'), 'type': 'B'})
        else:
            buydetails = self.consume_buy_details(buydetails, count)
        tradeparam = {'account': tacc, 'code': code, 'tradeType': tradeType, 'count': count, 'price': price,}
        if sobj:
            tradeparam['strategies'] = {k: v for k,v in sobj.items() if k not in ['buydetail', 'buydetail_full']}
        TradeInterface.submit_trade(tradeparam)
        logger.info('Strategy trade: %s %s %s %f %d', tacc, code, tradeType, price, count)
        accld.update_buy_details(acc, code, buydetails)

    @classmethod
    def verify_strategies(self):
        # 收盘后根据今日成交设置买入策略
        for acc in self.all_accounts.values():
            try:
                acc.verify_strategies()
            except Exception as e:
                import traceback
                logger.error(f'Error verifying strategies for {acc.keyword}: {e}')
                logger.error(traceback.format_exc())

    @classmethod
    def add_trading_remarks(self, acc, code, remark):
        hacc = acc if acc != 'credit' else 'collat'
        if acc not in self.all_accounts:
            return
        self.all_accounts[hacc].trading_remarks[code] = remark
