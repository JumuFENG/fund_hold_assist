# Python 3
# -*- coding:utf-8 -*-
import requests
import time
import json
from datetime import datetime

class EmDataCenterRequest():
    def __init__(self):
        self.page = 1
        self.pageSize = 50
        self.fecthed = []

    def getRequest(self, params=None, proxies=None):
        rsp = requests.get(self.getUrl(), params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getTimeStamp(self):
        curTime = datetime.now()
        stamp = time.mktime(curTime.timetuple()) * 1000 + curTime.microsecond
        return int(stamp)

    def setFilter(self, filter):
        self._filter = filter

    def getUrl(self):
        pass

    def getNext(self):
        bonus = json.loads(self.getRequest())
        if not bonus['success']:
            print('getBonusHis Error, message', bonus['message'], 'code', bonus['code'])
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
