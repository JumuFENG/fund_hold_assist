# Python 3
# -*- coding:utf-8 -*-
import requests
import json


class EmRequest():
    def __init__(self) -> None:
        pass

    def getRequest(self, params=None, proxies=None):
        rsp = requests.get(self.getUrl(), params=params, proxies=proxies)
        rsp.raise_for_status()
        return rsp.text

    def getUrl(self):
        pass

    def getNext(self, params=None, proxies=None):
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

    def getNext(self, params=None, proxies=None):
        bonus = json.loads(self.getRequest(params, proxies))
        if not bonus['success']:
            print('EmDataCenterRequest getUrl', self.getUrl())
            print('EmDataCenterRequest Error, message', bonus['message'], 'code', bonus['code'])
            return

        if (bonus['result'] and bonus['result']['data']):
            self.fecthed += bonus['result']['data']

        if (bonus['result']['pages'] == self.page):
            self.saveFecthed()

        if (bonus['result']['pages'] > self.page):
            self.page += 1
            self.getNext(params, proxies)

    def saveFecthed(self):
        print(self.fecthed)
