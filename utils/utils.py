# Python 3
# -*- coding:utf-8 -*-
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR, ROUND_CEILING
from datetime import datetime
import sys
import os
import time
import requests
import json
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
            if not os.path.exists(os.path.dirname(lfile)):
                os.mkdir(os.path.dirname(lfile))
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

    @classmethod
    def zdf_from_code(self, code):
        zdf = 10
        if code.startswith('SZ30') or code.startswith('SH68') or code.startswith('30') or code.startswith('68'):
            zdf = 20
        elif code.startswith('BJ'):
            zdf = 30
        return zdf

    @classmethod
    def calc_buy_count(self, amount, price):
        amount = float(amount)
        price = float(price)
        count = int(amount / (100 * price))
        if amount > (100 * count + 50) * price:
            # amout > price * 100 * (2 * count + 1) / 2
            count += 1
        return 100 * count

    @classmethod
    def today_date(self, fmt='%Y-%m-%d'):
        return datetime.now().strftime(fmt)

    @classmethod
    def delay_seconds(self, daytime):
        '''计算当前时间到daytime的时间间隔'''
        dnow = datetime.now()
        dtarr = daytime.split(':')
        hr = int(dtarr[0])
        minutes = int(dtarr[1])
        secs = 0 if len(dtarr) < 3 else int(dtarr[2])
        target_time = dnow.replace(hour=hr, minute=minutes, second=secs)
        return (target_time - dnow).total_seconds()

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
    def convert_stock_code_to_secid(self, stock_code):
        if stock_code.startswith('SH') or stock_code.startswith('SZ'):
            return stock_code.replace('SH', '1.').replace('SZ', '0.')
        elif stock_code.startswith('BJ'):
            return stock_code.replace('BJ', '0.')
        return stock_code

    @classmethod
    def to_cls_secucode(self, code):
        return code[2:] + '.BJ' if code.startswith('BJ') else code.lower()

    @classmethod
    def cls_secucode_back(self, secu):
        return 'BJ' + secu[0:6] if secu.endswith('BJ') else secu.upper()

    @classmethod
    def get_em_request(self, url, host=None):
        headers = {
            'Host': 'fund.eastmoney.com' if host is None else host,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        return self.get_request(url, headers)

    @classmethod
    def get_em_snapshot(self, code):
        quote_url = f'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id={code}&callback=jSnapshotBack'
        responsetext = Utils.get_em_request(quote_url, host='emhsmarketwg.eastmoneysec.com')
        snapshot_data = responsetext.replace('jSnapshotBack(', '').rstrip(');')
        return json.loads(snapshot_data)

    @classmethod
    def get_cls_basics(self, codes):
        if isinstance(codes, str):
            codes = [codes]
        codes = [self.to_cls_secucode(c) for c in codes]
        fields = 'open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px'
        sbasics = {}
        for i in range(0, len(codes), 200):
            gcodes = codes[i: i+200]
            burl = f'https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields={fields}&os=web&secu_codes={",".join(gcodes)}&sv=7.7.5'
            nbasics = json.loads(self.get_em_request(burl, 'x-quote.cls.cn'))
            sbasics = {**sbasics, **nbasics['data']}

        return {self.cls_secucode_back(k):v for k, v in sbasics.items()}
