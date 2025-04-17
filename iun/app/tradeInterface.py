import requests
import json
from app.logger import logger
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
        return response.status_code == 200

    @classmethod
    def check_trade_server(cls):
        if cls.tserver is None:
            return False

        url = guang.join_url(cls.tserver, 'status')
        try:
            response = requests.get(url)
            return response.status_code == 200
        except Exception as e:
            logger.error(e)
            return False

    __iun_strs = None
    @classmethod
    def iun_str_conf(cls, ikey):
        if cls.__iun_strs is None:
            url = guang.join_url(cls.tserver, 'iunstrs')
            response = requests.get(url)
            response.raise_for_status()
            cls.__iun_strs = response.json()
        return cls.__iun_strs[ikey]

