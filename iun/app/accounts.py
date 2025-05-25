import requests
from app.logger import logger
from app.tradeInterface import TradeInterface
from app.planned_strategy import StrategyFac


class Account(object):
    def __init__(self, accinfo):
        self.keyword = accinfo['name']
        self.email = accinfo['email']
        self.realcash = accinfo['realcash']
        self.stocks = {}

    def loadWatchings(self) -> None:
        surl = f"{accld.dserver}stock?act=watchings&acc={self.keyword}"
        sresponse = requests.get(surl, headers=accld.headers)
        if sresponse.status_code != 200:
            logger.error('Error:', sresponse.status_code, sresponse.text)
            return None
        stocks = sresponse.json()
        for c, v in stocks.items():
            self.stocks[c] = v
        logger.info('%s Loaded stocks: %d', self.keyword, len(self.stocks))


class accld:
    dserver = None
    headers = None
    accstocks = {}

    @classmethod
    def loadAccounts(self):
        url = f"{self.dserver}userbind?onlystock=1"
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            logger.error('Error:', response.status_code, response.text)
            return None

        accs = response.json()
        accs = [{'name': 'normal', 'email': '', 'realcash': 1}] + accs
        for acc in [x['name'] for x in accs]:
            self.loadWatchings(acc)

    @classmethod
    def loadWatchings(self, keyacc) -> None:
        surl = f"{self.dserver}stock?act=watchings&acc={keyacc}"
        sresponse = requests.get(surl, headers=self.headers)
        if sresponse.status_code != 200:
            logger.error('Error:', sresponse.status_code, sresponse.text)
            return None
        stocks = sresponse.json()
        for c, v in stocks.items():
            StrategyFac.cache_strategy_data(keyacc, c[-6:], v)
            for sobj in v['strategies']['strategies'].values():
                if not sobj['enabled']:
                    continue
                s = StrategyFac.get_strategy(sobj['key'])
                if s:
                    s.add_stock(keyacc, c[-6:])
