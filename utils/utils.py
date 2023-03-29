# Python 3
# -*- coding:utf-8 -*-
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

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
