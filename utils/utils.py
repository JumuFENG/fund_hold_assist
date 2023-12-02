# Python 3
# -*- coding:utf-8 -*-
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
import sys
import os
import time
import requests
import logging


class Utils:
    logger = None
    Err = logging.ERROR
    Warn = logging.WARN
    Dbg = logging.DEBUG
    Fatal = logging.FATAL

    @classmethod
    def setup_logger(self, name=None):
        a0 = sys.argv[0]
        if os.path.isfile(a0):
            script_file = os.path.abspath(a0)
            if name is None:
                name = os.path.basename(script_file)
            self.logger = logging.Logger(name)
            lfile = os.path.join(os.path.dirname(script_file), 'logs', f'{name}.log')
            handler = logging.FileHandler(lfile)
            handler.setFormatter(logging.Formatter('[%(levelname)s] %(asctime)s-%(name)s: %(message)s'))
            self.logger.addHandler(handler)
        else:
            print(a0, 'not a file name.')

    @classmethod
    def log(self, msg, level=None):
        if self.logger is None:
            print(msg)
            return
        if level is None:
            self.logger.info(msg)
        else:
            self.logger.log(level, msg)

    @classmethod
    def precious_decimal(self, precious):
        exp = '0.'
        for i in range(0, precious):
            exp += '0'
        return Decimal(exp)

    @classmethod
    def zt_priceby(self, lclose, precious=2, zdf=10):
        ''' 以昨日收盘价计算涨停价格
        '''
        # exp = self.precious_decimal(precious)
        # return round(lclose + round(lclose * 0.1, precious), precious)
        pdec = self.precious_decimal(precious)
        return float(Decimal(str(lclose * (100 + zdf) / 100)).quantize(pdec, ROUND_HALF_UP))

    @classmethod
    def dt_priceby(self, lclose, precious=2, zdf=10):
        ''' 以昨日收盘价计算涨停价格
        '''
        pdec = self.precious_decimal(precious)
        return float(Decimal(str(lclose * (100 - zdf) / 100)).quantize(pdec, ROUND_HALF_UP))

    @classmethod
    def calc_buy_count(self, amount, price):
        amount = float(amount)
        price = float(price)
        count = int(amount / (100 * price))
        return 100 * (count if count * 100 * price > amount * 0.85 else (count + 1))

    @classmethod
    def today_date(self, fmt='%Y-%m-%d'):
        return datetime.now().strftime(fmt)

    @classmethod
    def trade_finished(self):
        return datetime.now().hour > 17

    @classmethod
    def time_stamp(self):
        curTime = datetime.now()
        return int(time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond)

    @classmethod
    def get_request(self, url, headers=None, params=None, proxies=None):
        rsp = requests.get(url, headers=headers, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.content.decode('utf-8')

    @classmethod
    def get_em_equest(self, url, host=None):
        headers = {
            'Host': 'fund.eastmoney.com' if host is None else host,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        return self.get_request(url, headers)
