# Python 3
# -*- coding:utf-8 -*-

from utils import *
from history import *

class StockAqkSelector(TableBase):
    ''' 'A' 字快速杀跌反弹选股
    '''
    def __init__(self) -> None:
        super().__init__()

    def initConstrants(self):
        self.dbname = stock_db_name
        self.tablename = 'stock_aqk_pickup'
        self.colheaders = [
            {'col':column_code,'type':'varchar(20) DEFAULT NULL'},
            {'col':column_date,'type':'varchar(20) DEFAULT NULL'}, # 入选日期
            {'col':'前低日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'高点日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'上涨比率','type':'float DEFAULT NULL'},
            {'col':'下跌比率','type':'float DEFAULT NULL'}, 
            {'col':'建仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'清仓日期','type':'varchar(20) DEFAULT NULL'},
            {'col':'实盘',   'type':'tinyint DEFAULT 0'},
            {'col':'交易记录','type':'varchar(255) DEFAULT NULL'}
        ]

    def walkOnHistory(self, code):
        sd = StockDumps()
        # if date is not None:
        #     sdate = (datetime.strptime(date, r'%Y-%m-%d') + timedelta(days=-90)).strftime(r"%Y-%m-%d")
        #     klines = sd.read_kd_data(code, start=sdate)
        # else:
        klines = sd.read_kd_data(code, length=0)
        i = 0
        minlist = list()
        picked = list()
        while i < len(klines):
            minlist.append([float(klines[i][4]), i, float(klines[i][3]), i])
            # 最小值队列
            ej = 30
            for j in range(1, 30):
                if i + j >= len(klines):
                    ej = j
                    break
                while len(minlist) > 0 and float(klines[i+j][4]) <= minlist[-1][0]:
                    minlist.pop()
                minlist.append([float(klines[i+j][4]), i+j, float(klines[i+j][3]), i+j])
            i += ej

            while len(minlist) > 0:
                k = minlist[0][3]
                # 查找最小值之后30日内的最大值
                for j in range(1, 30):
                    if k + j < len(klines) and float(klines[k + j][3]) > minlist[0][2]:
                        minlist[0][2] = float(klines[k + j][3])
                        minlist[0][3] = k + j
                # 查找继续上涨的最高点
                k = minlist[0][3] + 1
                while k < len(klines):
                    if float(klines[k][3]) < minlist[0][2]:
                        break
                    minlist[0][2] = float(klines[k][3])
                    minlist[0][3] = k
                    k += 1
                i = k

                # 最小值到最大值的涨幅小于50%则丢弃
                if minlist[0][2] - minlist[0][0] < minlist[0][0] * 0.5:
                    minlist.pop(0)
                    continue

                # 查找最大值之后30日内最小值
                k = minlist[0][3]
                minlist[0].append(float(klines[k][4]))
                minlist[0].append(k)
                for j in range(1, 30):
                    if k + j >= len(klines) or float(klines[k + j][3]) >= minlist[0][2]:
                        break
                    if float(klines[k + j][4]) < minlist[0][4]:
                        minlist[0][4] = float(klines[k + j][4])
                        minlist[0][5] = k + j

                # 查找继续下跌的最低点
                k = minlist[0][5] + 1
                while k < len(klines):
                    if float(klines[k][4]) > minlist[0][4]:
                        break
                    minlist[0][4] = float(klines[k][4])
                    minlist[0][5] = k
                    k += 1

                # 最大值到最小值的跌幅小于28%则丢弃
                if minlist[0][2] - minlist[0][4] < minlist[0][2] * 0.28:
                    minlist.pop(0)
                    continue

                # 最大值相同时选择起涨点更靠后者
                if len(picked) == 0 or minlist[0][3] != picked[-1][3]:
                    picked.append(minlist[0])
                elif minlist[0][1] > picked[-1][1]:
                    if minlist[0][1] - picked[-1][1] > picked[-1][3] - minlist[0][1] or minlist[0][0] <= picked[-1][0]:
                        picked.pop()
                        picked.append(minlist[0])

                if i < minlist[0][3]:
                    i = minlist[0][3] + 1
                minlist.pop(0)

        for i in range(0, len(picked)):
            print(code, klines[picked[i][1]][1], picked[i][0], klines[picked[i][3]][1], picked[i][2], klines[picked[i][5]][1], picked[i][4])
