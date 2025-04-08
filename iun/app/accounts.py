import requests
from app.logger import logger
from app.tradeInterface import TradeInterface


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
    normalAccount = None
    all_accounts = {}

    @classmethod
    def loadAccounts(self):
        url = f"{self.dserver}userbind?onlystock=1"
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            logger.error('Error:', response.status_code, response.text)
            return None

        accs = response.json()
        accs = [{'name': 'normal', 'email': '', 'realcash': 1}] + accs
        for acc in accs:
            a = Account(acc)
            a.loadWatchings()
            accld.all_accounts[a.keyword] = a
