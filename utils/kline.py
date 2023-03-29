# Python 3
# -*- coding:utf-8 -*-

class KNode():
    '''
    单个K线数据
    '''
    def __init__(self, kl) -> None:
        self.date = kl[1]
        self.close = float(kl[2])
        self.high = float(kl[3])
        self.low = float(kl[4])
        self.open = float(kl[5])
        self.prcchange = float(kl[6])
        self.pchange = float(kl[7])
        self.vol = int(kl[8])
        self.amount = float(kl[9])
