# Python 3
# -*- coding:utf-8 -*-
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
import time
import requests


class Utils:
    @classmethod
    def precious_decimal(self, precious):
        exp = '0.'
        for i in range(0, precious):
            exp += '0'
        return Decimal(exp)

    @classmethod
    def zt_priceby(self, lclose, precious=2):
        ''' 以昨日收盘价计算涨停价格
        '''
        # exp = self.precious_decimal(precious)
        # return round(lclose + round(lclose * 0.1, precious), precious)
        pdec = self.precious_decimal(precious)
        return float(Decimal(str(lclose * 1.1)).quantize(pdec, ROUND_HALF_UP))

    @classmethod
    def dt_priceby(self, lclose, precious=2):
        ''' 以昨日收盘价计算涨停价格
        '''
        pdec = self.precious_decimal(precious)
        return float(Decimal(str(lclose * 0.9)).quantize(pdec, ROUND_HALF_UP))

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
    def get_request(self, url, params=None, proxies=None):
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        # return rsp.text
        return rsp.content.decode('utf-8')

    @classmethod
    def get_em_equest(self, url):
        headers = {
            'Host': 'fund.eastmoney.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        return self.get_request(url, headers)
