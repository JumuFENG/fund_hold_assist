import requests
import json
from functools import lru_cache
from app.logger import logger
from app.guang import guang
from app.config import IunCache


class TradeInterface:
    tserver = None
    @classmethod
    def submit_trade(cls, bsinfo):
        """
        提交交易请求
        :param bsinfo: 买卖详情信息
        :return: None
        """
        if cls.tserver is None:
            return False
        url = guang.join_url(cls.tserver, 'trade')
        headers = {'Content-Type': 'application/json'}
        response = requests.post(url, data=json.dumps(bsinfo), headers=headers)
        logger.info(f'{cls.__name__} {bsinfo}')
        return response.status_code == 200

    @classmethod
    def check_trade_server(cls):
        if cls.tserver is None:
            return False

        url = guang.join_url(cls.tserver, 'status')
        try:
            response = requests.get(url)
            tstatus = response.json()
            logger.info(f'trade server status: {tstatus}')
            return response.status_code == 200 and tstatus['tradingday']
        except Exception as e:
            logger.error(e)
            return False

    @classmethod
    @lru_cache(maxsize=1)
    def iun_str(cls):
        url = guang.join_url(cls.tserver, 'iunstrs')
        response = requests.get(url)
        response.raise_for_status()
        return response.json()

    @classmethod
    @lru_cache(maxsize=None)
    def is_rzrq(cls, code):
        """
        检查股票是否支持融资融券
        :param code: 股票代码
        :return: bool
        """
        url = guang.join_url(cls.tserver, f'rzrq?code={code}')
        response = requests.get(url)
        response.raise_for_status()
        return response.text == 'true'

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
        buydetails = IunCache.get_buy_details(acc, code)
        tacc = acc if tacc is None else tacc
        sobj = IunCache.get_stock_strategy(acc, code)
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
            tradeparam['strategies'] = sobj
        TradeInterface.submit_trade(tradeparam)
        logger.info('Strategy trade: %s %s %s %f %d', tacc, code, tradeType, price, count)
        IunCache.update_buy_details(acc, code, buydetails)
