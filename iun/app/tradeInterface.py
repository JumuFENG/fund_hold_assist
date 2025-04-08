import requests
import json

class TradeInterface:
    tserver = None
    @classmethod
    def submit_trade(cls, account, bsinfo):
        """
        提交交易请求
        :param bsinfo: 买卖详情信息
        :return: None
        """
        if cls.tserver is None:
            return False
        url = cls.tserver + '/trade'
        headers = {'Content-Type': 'application/json'}
        bsinfo['account'] = account
        response = requests.post(url, data=json.dumps(bsinfo), headers=headers)
        return response.status_code == 200
