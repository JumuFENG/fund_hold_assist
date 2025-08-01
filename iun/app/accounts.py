import requests
import json
from stockrt import get_fullcode
from app.lofig import logger
from app.guang import guang
from app.intrade_base import iunCloud
from app.trade_interface import TradeInterface


class Account(object):
    def __init__(self, acc):
        self.keyword = acc
        self.stocks = {}

    def load_watchings(self) -> None:
        surl = f"{accld.dserver}stock?act=watchings&acc={self.keyword}"
        sresponse = requests.get(surl, headers=accld.headers)
        if sresponse.status_code != 200:
            logger.error('Error:', sresponse.status_code, sresponse.text)
            return None
        stocks = sresponse.json()
        for c, v in stocks.items():
            # if c in iunCloud.get_suspend_stocks():
            #     logger.info('%s is suspended', c)
            #     continue
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
        for stock in stocks:
            if 'strategies' not in stock:
                continue
            code = stock['code']
            buydetails = stock['strategies'].get('buydetail', [])
            buydetails_full = stock['strategies'].get('buydetail_full', [])
            traded = False
            for rec in buydetails_full:
                if rec['date'] == today and rec['count'] > 0:
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
                        if 'guardPrice' not in smeta:
                            sobj['guardPrice'] = smeta['guardPrice']
                        else:
                            del sobj['guardPrice']
                        continue

            logger.info('set strategy for %s %s', self.keyword, stock)
            # self.save_stock_strategy(code, stock['strategies'])

    def save_stock_strategy(self, code, strategy):
        url = guang.join_url(accld.dserver, 'stock')
        data = {
            'act': 'strategy',
            'acc': self.keyword,
            'code': get_fullcode(code).upper(),
            'data': json.dumps(strategy)
        }

        guang.post_data(url, data, self.headers)



class accld:
    dserver = None
    headers = None
    all_accounts = {}

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
            acc.verify_strategies()

