# Python 3
# -*- coding:utf-8 -*-
import requests
import time
import json
from datetime import datetime

class EmRequest():
    def __init__(self) -> None:
        pass

    def getTodayString(self, fmt = "%Y-%m-%d"):
        return datetime.now().strftime(fmt)

    def getTimeStamp(self):
        curTime = datetime.now()
        stamp = time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond
        return int(stamp)

    def getRequest(self, params=None, proxies=None):
        url = self.getUrl()
        print('EmRequest, getRequest of', url)
        rsp = requests.get(url, params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getUrl(self):
        pass

    def getNext(self):
        pass

    def saveFetched(self):
        pass


class EmDataCenterRequest(EmRequest):
    def __init__(self):
        super().__init__()
        self.page = 1
        self.pageSize = 50
        self.fecthed = []

    def setFilter(self, filter):
        self._filter = filter

    def getUrl(self):
        pass

    def getNext(self):
        bonus = json.loads(self.getRequest())
        if not bonus['success']:
            print('EmDataCenterRequest Error, message', bonus['message'], 'code', bonus['code'])
            return

        if (bonus['result'] and bonus['result']['data']):
            self.fecthed += bonus['result']['data']

        if (bonus['result']['pages'] == self.page):
            self.saveFecthed()

        if (bonus['result']['pages'] > self.page):
            self.page += 1
            self.getNext()

    def saveFecthed(self):
        print(self.fecthed)
