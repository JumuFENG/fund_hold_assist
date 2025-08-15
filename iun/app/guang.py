import requests
import time
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR, ROUND_CEILING
from datetime import datetime
from types import SimpleNamespace

class guang:
    @staticmethod
    def today_date(sep=''):
        return datetime.now().strftime(f"%Y{sep}%m{sep}%d")

    @staticmethod
    def time_stamp():
        curTime = datetime.now()
        return int(time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond)

    @staticmethod
    def calc_buy_count(amount, price):
        amount = float(amount)
        price = float(price)
        count = int(amount / (100 * price))
        if amount > (100 * count + 50) * price:
            # amout > price * 100 * (2 * count + 1) / 2
            count += 1
        return 100 * count

    @staticmethod
    def delay_seconds(daytime):
        '''计算当前时间到daytime的时间间隔'''
        dnow = datetime.now()
        dtarr = daytime.split(':')
        hr = int(dtarr[0])
        minutes = int(dtarr[1])
        secs = 0 if len(dtarr) < 3 else int(dtarr[2])
        target_time = dnow.replace(hour=hr, minute=minutes, second=secs)
        return (target_time - dnow).total_seconds()

    @staticmethod
    def precious_decimal(precious):
        exp = '0.'
        for i in range(0, precious):
            exp += '0'
        return Decimal(exp)

    @classmethod
    def zt_priceby(self, lclose, precious=2, zdf=10):
        ''' 以昨日收盘价计算涨停价格
        '''
        if zdf == 30:
            return float(Decimal(str(lclose * 1.3)).quantize(Decimal('0.00'), ROUND_FLOOR))
        pdec = self.precious_decimal(precious)
        zprc = float(Decimal(str((int(round(lclose * 100, 0)) + lclose * zdf) / 100.0)).quantize(pdec, ROUND_HALF_UP))
        return zprc

    @classmethod
    def dt_priceby(self, lclose, precious=2, zdf=10):
        ''' 以昨日收盘价计算涨停价格
        '''
        if zdf == 30:
            return float(Decimal(str(lclose * 0.7)).quantize(Decimal('0.00'), ROUND_CEILING))
        pdec = self.precious_decimal(precious)
        dprc = float(Decimal(str((int(round(lclose * 100, 0)) - lclose * zdf) / 100.0)).quantize(pdec, ROUND_HALF_UP))
        return dprc

    @staticmethod
    def zdf_from_code(code):
        if code.startswith(('SZ30', 'SH68', '68', '30')):
            return 20
        if code.startswith(('BJ', '92', '43', '83', '87')):
            return 30
        return 10

    @staticmethod
    def join_url(srv, path):
        return f"{srv.rstrip('/')}/{path.lstrip('/')}"

    @staticmethod
    def generate_strategy_json(match_data, subscribe_detail):
        amount = subscribe_detail['amount']
        strategies = {
            "grptype": "GroupStandard",
            "strategies": {},
            "transfers": {},
            "amount": amount
        }
        strobjs = {
            "StrategyBuyZTBoard": { "key": "StrategyBuyZTBoard", "enabled": True },
            "StrategyBuyDTBoard": { "key": "StrategyBuyDTBoard", "enabled": True },
            "StrategySellELS": {"key": "StrategySellELS", "enabled": False, "cutselltype": "all", "selltype":"all" },
            "StrategyGrid": { "key": "StrategyGrid", "enabled": False, "buycnt": 1, "stepRate": 0.05 },
            "StrategySellBE": { "key":"StrategySellBE", "enabled": False, "upRate": -0.03, "selltype":"all", 'sell_conds': 1}
        }
        if 'price' in match_data:
            strobjs['StrategySellELS']["topprice"] = round(float(match_data['price']) * 1.05, 2)
        if 'account' in subscribe_detail and subscribe_detail['account'] == 'collat':
            strobjs['StrategyBuyZTBoard']['account'] = 'collat'
            strobjs['StrategyBuyDTBoard']['account'] = 'collat'
        if 'strategies' in match_data:
            mstrategies = match_data['strategies']
            for i, mk in enumerate(mstrategies):
                strategies['strategies'][i] = strobjs[mk]
                for k, v in mstrategies[mk].items():
                    strategies['strategies'][i][k] = v
                strategies['transfers'][i] = { "transfer": "-1" }
        if 'amtkey' in subscribe_detail:
            strategies['uramount'] = {"key": subscribe_detail['amtkey']}
        return strategies

    @classmethod
    def create_buy_message(cls, match_data: dict, subscription: dict) -> dict:
        code = match_data['code'][-6:]
        price = round(float(match_data['price']), 2)
        message = {
            'code': code,
            'account': subscription['account'],
            'price': price,
            'count': 0
        }

        if 'watch' not in match_data or not match_data['watch']:
            message['tradeType'] = 'B'

        if 'amtkey' not in subscription:
            message['count'] = cls.calc_buy_count(subscription['amount'], price)

        message['strategies'] = cls.generate_strategy_json(match_data, subscription)
        return message

    @staticmethod
    def get_request(url, headers=None, params=None, proxies=None):
        rsp = requests.get(url, headers=headers, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

    @staticmethod
    def em_headers(host=None):
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0',
            'Host': host if host else 'quote.eastmoney.com',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        return headers

    @staticmethod
    def post_data(url, data=None, headers=None, proxies=None):
        rsp = requests.post(url, data=data, headers=headers, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

    @staticmethod
    def ochl(kl):
        return SimpleNamespace(
            date=kl[0],
            open=float(kl[1]),
            close=float(kl[2]),
            high=float(kl[3]),
            low=float(kl[4]),
            vol=float(kl[5])
        )

