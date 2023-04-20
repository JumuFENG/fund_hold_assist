# Python 3
# -*- coding:utf-8 -*-
import math

class DealSpace():
    def __init__(self) -> None:
        self.finishedeals = []
        self.deals = []
        self.spaceEarned = []
        self.recharges = []
        self.replayMode = 1 # 买入金额设置，0: 使用原始数据。1: 使用固定数值。2: 满仓轮动 3: 固定数值，回撤每增加10%仓位增加10%
        self.singleBuyAmount = 10000
        self.maxearn = 0
        self.drawback = 0
        self.availableMoney = 0
        self.taxRate = 0.005

    def recharge(self, m, d='0'):
        self.recharges.append([d, m])
        self.availableMoney += m

    def __rolling_available_money(self):
        if len(self.deals) == 0:
            return self.availableMoney / 2

    def totalCharged(self):
        return sum([rc[1] for rc in self.recharges])

    def totalHoldings(self):
        return round(sum(hd['price'] * hd['count'] for hd in self.deals), 2)

    def totalAmount(self):
        return round(self.totalHoldings() + self.availableMoney, 2)

    def __replay_buy_deal(self, deal, amount=None):
        assert deal['tradeType'] == 'B'
        if amount is not None:
            deal['count'] = math.floor(amount / 100 / deal['price']) * 100

        self.deals.append(deal)
        self.availableMoney -= deal['count'] * deal['price']
        while self.availableMoney < 0:
            self.recharge(self.singleBuyAmount, deal['time'])

    def __merge_finished_deal(self, deal):
        for d in self.finishedeals:
            if d['code'] == deal['code'] and d['time'] == deal['time'] and d['sid'] == deal['sid']:
                d['count'] += deal['count']
                return
        self.finishedeals.append(deal)

    def __replay_sell_deal(self, deal):
        assert deal['tradeType'] == 'S'
        bdeals = list(filter(lambda x: x['code'] == deal['code'], self.deals))
        if self.replayMode == 0:
            count = deal['count']
            while count > 0:
                bdeal = bdeals.pop(0)
                bcount = bdeal['count']
                if bcount <= count:
                    self.__merge_finished_deal(bdeal)
                    self.deals.remove(bdeal)
                else:
                    rcount = bcount - count
                    fbdeal = {k:v for k,v in bdeals[0].items()}
                    fbdeal['count'] = count
                    self.__merge_finished_deal(fbdeal)
                    bdeal['count'] = rcount
                count -= bcount
        else:
            count = 0
            cost = 0
            for bd in bdeals:
                self.finishedeals.append(bd)
                count += bd['count']
                cost += bd['count'] * bd['price']
                self.deals.remove(bd)
            deal['count'] = count

        self.availableMoney += round(deal['count'] * deal['price'] * (1 - self.taxRate), 2)
        self.finishedeals.append(deal)

    def __add_space_earned(self, earn):
        if len(self.spaceEarned) > 0 and earn[0] == self.spaceEarned[-1][0]:
            self.spaceEarned.pop()
        self.spaceEarned.append(earn)

    def __drawback_factor(self):
        if self.drawback < 0.1:
            return 0
        return round(self.drawback / 0.1) / 10

    def replayDeals(self, deals):
        deals = sorted(deals, key=lambda x:(x['time'], x['tradeType']))
        assert isinstance(deals, list)

        while len(deals) > 0:
            cdeals = [deals[0]]
            deals.pop(0)
            while len(deals) > 0:
                if cdeals[0]['time'] != deals[0]['time'] or cdeals[0]['tradeType'] != deals[0]['tradeType']:
                    break
                cdeals.append(deals[0])
                deals.pop(0)

            tradeType = cdeals[0]['tradeType']
            if tradeType == 'B':
                amount = None
                if self.replayMode == 2:
                    amount = self.__rolling_available_money() / len(cdeals)
                elif self.replayMode == 1:
                    amount = self.singleBuyAmount
                elif self.replayMode == 3:
                    amount = self.singleBuyAmount * (1 + self.__drawback_factor())

            for dl in cdeals:
                mdeal = {
                    'code': dl['code'], 'time': dl['time'], 'tradeType': tradeType,
                    'sid': dl['sid'], 'count': int(dl['count']), 'price': float(dl['price'])
                }

                if tradeType == 'B':
                    self.__replay_buy_deal(mdeal, amount)
                else:
                    self.__replay_sell_deal(mdeal)

            date = cdeals[0]['time']
            total = self.totalAmount()
            charged = self.totalCharged()
            holding = self.totalHoldings()
            earn = total - charged
            if self.maxearn < earn:
                self.maxearn = earn
            if self.maxearn > 0:
                self.drawback = round((self.maxearn - earn) / self.maxearn, 4)
            else:
                self.drawback = round((self.maxearn - earn) / charged, 4)
            self.__add_space_earned([date, charged, holding, total, round(self.availableMoney, 2), round(total - charged, 2), round(earn / charged, 4), self.drawback])

    def displayDeals(self):
        # for d in self.finishedeals:
        #     print(d['time'], d['code'], d['price'], d['count'], d['price'] * d['count'])

        for d in self.spaceEarned:
            print(d)

        rc = {}
        for t, n in self.recharges:
            if t not in rc:
                rc[t] = n
            else:
                rc[t] += n
        print(rc)
