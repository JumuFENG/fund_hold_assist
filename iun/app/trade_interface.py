import requests
import json
from functools import lru_cache
from app.lofig import logger
from app.guang import guang

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
            return response.status_code == 200
        # and (tstatus['tradingday'] or tstatus['running'])
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

    @classmethod
    def get_account_latest_stocks(cls, account):
        """
        获取账户最新的股票列表
        :param account: 账户名称
        :return: 股票列表
        """
        url = guang.join_url(cls.tserver, f'stocks?account={account}')
        response = requests.get(url)
        if response.status_code != 200:
            logger.error(f'Error fetching latest stocks for {account}: {response.status_code} {response.text}')
            return []
        robj = response.json()
        if 'account' in robj and robj['account'] == account:
            return robj['stocks']
        return []

