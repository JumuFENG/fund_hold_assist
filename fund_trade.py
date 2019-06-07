# Python 3
# -*- coding:utf-8 -*-

from utils import *
from decimal import *
from datetime import datetime, timedelta

class TradeFund():
    """
    The class to remember the trade info for some fund
    """
    def __init__(self, fund_code, dbname, dbpws):
        self.fund_code = fund_code
        self.sqldb = SqlHelper(password = dbpws, database = dbname)

        tbl_mgr = TableManager(self.sqldb, gl_fund_info_table, self.fund_code)
        self.fund_history_table = tbl_mgr.GetTableColumnInfo(column_table_history, None)
        self.buy_table = tbl_mgr.GetTableColumnInfo(column_buy_table, self.fund_code + "_buy")
        self.sell_table = tbl_mgr.GetTableColumnInfo(column_sell_table, self.fund_code + "_sell")
        cost_hold = tbl_mgr.GetTableColumnInfo(column_cost_hold, "0", "double(16,2) DEFAULT NULL")
        self.cost_hold = Decimal(str(cost_hold))
        portion_hold = tbl_mgr.GetTableColumnInfo(column_portion_hold, "0", "double(16,4) DEFAULT NULL")
        self.portion_hold = Decimal(str(portion_hold))
        tbl_mgr.GetTableColumnInfo(column_averagae_price, "0", "double(16,4) DEFAULT NULL")

    def getToady(self):
        return datetime.now().strftime("%Y-%m-%d")

    def initBuytable(self):
        self.buy_table = self.fund_code + "_buy"
        self.sqldb.update(gl_fund_info_table, {column_buy_table : self.buy_table}, {column_code : self.fund_code})

    def initSelltable(self):
        self.sell_table = self.fund_code + "_sell"
        self.sqldb.update(gl_fund_info_table, {column_sell_table : self.sell_table}, {column_code : self.fund_code})

    def buy(self, cost, date = "", budget_dates = None):
        if cost <= 0:
            return

        buyDate = date
        if date == "":
            buyDate = self.getToady()

        ((net_value,),) = self.sqldb.select(self.fund_history_table, fields = [column_net_value], conds = "%s = '%s'" % (column_date, buyDate))
        if not net_value:
            print("date wrong, net_value is null in:", buyDate)
            return

        if not self.sqldb.isExistTable(self.buy_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_cost:'double(16,4) DEFAULT NULL',column_portion:'double(16,4) DEFAULT NULL',column_soldout:'tinyint(1) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.buy_table, attrs, constraint)

        buy_rec = self.sqldb.select(self.buy_table, conds = "%s = '%s'" % (column_date, buyDate))
        if buy_rec:
            ((buy_rec),) = buy_rec
            if buy_rec:
                print("find buy record:", buy_rec, "ignore.")
                return

        if not self.sqldb.isExistTableColumn(self.buy_table, column_soldout):
            self.sqldb.addColumn(self.buy_table, column_soldout, 'tinyint(1) DEFAULT 0')

        portion = Decimal(cost) / Decimal(str(net_value))
        #print(cost, buyDate, cost, portion)
        self.sqldb.insert(self.buy_table, {column_date:buyDate, column_cost:str(cost), column_portion : str(portion), column_soldout:str(0)})

        self.cost_hold += Decimal(cost)
        #print("self.portion_hold", self.portion_hold)
        self.portion_hold += portion.quantize(Decimal('0.0000'))
        self.sqldb.update(gl_fund_info_table, {column_cost_hold : str(self.cost_hold), column_portion_hold : str(self.portion_hold), column_averagae_price:str(self.cost_hold/self.portion_hold)}, {column_code: self.fund_code})
        self.update_average_price()
        if not budget_dates:
            return
        ((budget_table,),) = self.sqldb.select(gl_fund_info_table, [column_budget_table], "%s = '%s'" % (column_code, self.fund_code))
        if budget_table and self.sqldb.isExistTable(budget_table):
            if isinstance(budget_dates, str):
                self.sqldb.update(budget_table, {column_consumed:'1'},{column_date:budget_dates})
            elif isinstance(budget_dates, list):
                for d in budget_dates:
                    self.sqldb.update(budget_table, {column_consumed:'1'},{column_date:d})

    def undo_buy(self, date, removeall = False):
        if not date or date == "":
            print("no date to undo.")
            return

        buy_rec = self.sqldb.select(self.buy_table, conds = "%s = '%s'" % (column_date, date))
        if not removeall and len(buy_rec) == 1:
            return

        cost = 0
        portion = 0
        for x in range(0, len(buy_rec) if removeall else len(buy_rec) - 1):
            (idx, d,c,p,u) = buy_rec[x]
            cost += c
            portion += p
            self.sqldb.delete(self.buy_table, {"id":str(idx)})

    def update_average_price(self):
        buy_rec =self.sqldb.select(self.buy_table, ["sum(%s)" % column_cost, "sum(%s)" % column_portion], "%s = 0" % column_soldout)
        if buy_rec:
            ((cost,portion),) = buy_rec
            self.sqldb.update(gl_fund_info_table, {column_averagae_price:str((Decimal(str(cost))/Decimal(str(portion))).quantize(Decimal("0.0000")))}, {column_code: self.fund_code})

    def sell_by_day(self, buy_dates, date = ""):
        if date == "":
            date = self.getToady()

        tosell = ()
        for d in buy_dates:
            detail = self.sqldb.select(self.buy_table, [column_date, column_cost, column_portion], "%s = '%s'" % (column_date, d))
            if detail:
                tosell += detail
        self.sell(tosell, date)

    def sell(self, details_tosell, date = ""):
        if date == "":
            date = self.getToady()

        ((net_value,),) = self.sqldb.select(self.fund_history_table, fields = [column_net_value], conds = "%s = '%s'" % (column_date, date))
        if not net_value:
            print("date wrong, net_value is null in:", date)
            return

        cost_sold = Decimal(0)
        portion = Decimal(0)
        dates_for_sell = []
        for (d,c,p) in details_tosell:
            cost_sold += Decimal(str(c))
            portion += Decimal(str(p))
            dates_for_sell.append(d)

        if portion <= Decimal("0"):
            return

        if self.portion_hold < portion :
            print("no enough portion to sell. total:", self.portion_hold, portion)
            return

        for d in dates_for_sell:
            self.sqldb.update(self.buy_table, {column_soldout:str(1)}, {column_date:d})

        if not self.sqldb.isExistTable(self.sell_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'double(16,4) DEFAULT NULL', column_money_sold:'double(16,4) DEFAULT NULL', column_cost_sold:'double(16,4) DEFAULT NULL', column_earned:'double(16,4) DEFAULT NULL', column_return_percentage:'double(8,6) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.sell_table, attrs, constraint)

        remain_portion = self.portion_hold - portion
        remain_cost = self.cost_hold - cost_sold
        money = Decimal(portion) * Decimal(str(net_value))
        earned = money - cost_sold
        self.updateSellData(portion, money, cost_sold, earned, date, remain_cost, remain_portion)

    def updateSellData(self, portion, money, cost = Decimal("0"), earned = Decimal("0"), sellDay = "", remain_cost = Decimal("0"), remain_portion = Decimal("0")):
        if portion <= Decimal("0"):
            return

        if money <= Decimal("0"):
            self.sell(portion, sellDay)
            return

        if sellDay == "":
            sellDay = self.getToady()
        if cost <= Decimal("0"):
            cost = portion * self.cost_hold / self.portion_hold
        if earned <= Decimal("0"):
            earned = money - cost
        return_percent = earned / cost
        self.sqldb.insert(self.sell_table, {column_date:sellDay, column_portion : str(portion), column_money_sold:str(money),column_cost_sold:str(cost), column_earned : str(earned),column_return_percentage : str(return_percent)})

        if remain_cost <= Decimal("0"):
            remain_cost = self.cost_hold - cost
        if remain_portion <= Decimal("0"):
            remain_portion = self.portion_hold - portion

        self.cost_hold = remain_cost
        self.portion_hold = remain_portion
        price = Decimal("0")
        if self.portion_hold != Decimal("0"):
            price = self.cost_hold / self.portion_hold
        self.sqldb.update(gl_fund_info_table, {column_cost_hold : str(self.cost_hold), column_portion_hold : str(self.portion_hold), column_averagae_price : str(price.quantize(Decimal("0.000000")))}, {column_code: self.fund_code})

    def portions_available_to_sell(self, reDays, finalDate=""):
        fdate = finalDate
        if finalDate == "":
            fdate = self.getToady()
        bdate = (datetime.strptime(fdate, "%Y-%m-%d") + timedelta(days=-reDays)).strftime("%Y-%m-%d")
        #print(bdate, fdate)
        ((sum_re,),) = self.sqldb.select(self.buy_table, "sum(%s)" % column_portion, ["%s >= '%s'" % (column_date, bdate), "%s < '%s'" % (column_date, fdate)])
        portion_remain = Decimal("0")
        if sum_re:
            portion_remain = Decimal(str(sum_re)).quantize(Decimal("0.0000"))
        #print(sum_re, portion_remain)

        if portion_remain >= self.portion_hold :
            return Decimal("0")
        else :
            return self.portion_hold - portion_remain

    def buy_dates_available_to_sell(self, reDays, finalDate=""):
        if not self.sqldb.isExistTable(self.buy_table):
            return []

        fdate = finalDate
        if finalDate == "":
            fdate = self.getToady()
        bdate = (datetime.strptime(fdate, "%Y-%m-%d") + timedelta(days=-reDays)).strftime("%Y-%m-%d")
        buy_dates = self.sqldb.select(self.buy_table, column_date, ["%s < '%s'" % (column_date, bdate), "%s = 0" % column_soldout])
        return [d[0] for d in buy_dates]

    def reset_trade_data(self):
        if self.sqldb.isExistTable(self.buy_table):
            self.sqldb.dropTable(self.buy_table)
        if self.sqldb.isExistTable(self.sell_table):
            self.sqldb.dropTable(self.sell_table)
        self.sqldb.update(gl_fund_info_table, {column_cost_hold : str(0), column_portion_hold : str(0), column_averagae_price:str(0)}, {column_code : self.fund_code})

    def print_summery(self):
        ((money,cost),) = self.sqldb.select(self.sell_table, ["sum(%s)" % column_money_sold, "sum(%s)" % column_cost_sold])
        if money and cost:
            earned = money - cost
            return_percent = (earned / cost).quantize(Decimal("0.0000"))
            print("sold:", money, "cost:", cost, "earned:", earned, "return_rate:", return_percent)
        else:
            print("no sell data")

        sell_data = self.sqldb.select(self.sell_table, ["%s" % column_cost_sold, "%s" % column_date], order = " ORDER BY %s DESC" % column_cost_sold)
        if sell_data:
            print(sell_data)

        summery = self.sqldb.select(gl_fund_info_table, [column_cost_hold, column_portion_hold, column_averagae_price], "%s = '%s'" % (column_code, self.fund_code))
        print("remain:  ",summery)
