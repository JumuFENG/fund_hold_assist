# Python 3
# -*- coding:utf-8 -*-

from commons import *
from decimal import *
from datetime import datetime, timedelta
from sql_helper import SqlHelper

class TradeFund():
    """
    The class to remember the trade info for some fund
    """
    def __init__(self, fund_code, dbname, dbpws):
        self.fund_code = fund_code
        self.sqldb = SqlHelper(password = dbpws, database = dbname)
        tableColNames = [column_table_history]
        if self.sqldb.isExistTableColumn(gl_all_info_table, column_buy_table):
            tableColNames.append(column_buy_table)
        else:
            self.sqldb.addColumn(gl_all_info_table, column_buy_table, "varchar(20) DEFAULT NULL")
            self.buy_table = self.fund_code + "_buy"
            self.sqldb.update(gl_all_info_table, {column_buy_table : self.buy_table}, {column_code : self.fund_code})

        if self.sqldb.isExistTableColumn(gl_all_info_table, column_sell_table):
            tableColNames.append(column_sell_table)
        else:
            self.sqldb.addColumn(gl_all_info_table, column_sell_table, "varchar(20) DEFAULT NULL")
            self.sell_table = self.fund_code + "_sell"
            self.sqldb.update(gl_all_info_table, {column_sell_table : self.sell_table}, {column_code : self.fund_code})
        

        fund_db_tables = self.sqldb.select(gl_all_info_table, fields = tableColNames, conds = "%s = '%s'" % (column_code, self.fund_code))[0]
        self.fund_history_table = fund_db_tables[0]
        if len(fund_db_tables) > 1:
            self.buy_table = fund_db_tables[1]
        if len(fund_db_tables) > 2:
            self.sell_table = fund_db_tables[2]

        if not self.sqldb.isExistTableColumn(gl_all_info_table, column_cost_hold):
            self.sqldb.addColumn(gl_all_info_table, column_cost_hold, "double(12,2) DEFAULT NULL")
            self.sqldb.update(gl_all_info_table, {column_cost_hold : "0"}, {column_code : self.fund_code})

        if not self.sqldb.isExistTableColumn(gl_all_info_table, column_portion_hold):
            self.sqldb.addColumn(gl_all_info_table, column_portion_hold, "double(16,4) DEFAULT NULL")
            self.sqldb.update(gl_all_info_table, {column_portion_hold : "0"}, {column_code : self.fund_code})

        holdSum = self.sqldb.select(gl_all_info_table, fields = [column_cost_hold, column_portion_hold], conds = "%s = '%s'" % (column_code, self.fund_code))[0]
        if holdSum[0]:
            self.cost_hold = Decimal(str(holdSum[0]))
        else:
            self.cost_hold = Decimal("0")
        if holdSum[1]:
            self.portion_hold = Decimal(holdSum[1]).quantize(Decimal('0.0000'))
            #print("portion_hold", self.portion_hold)
        else:
            self.portion_hold = Decimal("0")

        if not self.sqldb.isExistTableColumn(gl_all_info_table, column_averagae_price):
            self.sqldb.addColumn(gl_all_info_table, column_averagae_price, "double(16,4) DEFAULT NULL")
            if self.portion_hold > Decimal("0"):
                self.sqldb.update(gl_all_info_table, {column_averagae_price : str(self.cost_hold/self.portion_hold)}, {column_code : self.fund_code})

    def getToady(self):
        return datetime.now().strftime("%Y-%m-%d")
        
    def buy(self, cost, date = ""):
        if cost <= 0:
            return

        buyDate = date
        if date == "":
            buyDate = self.getToady()

        net_value = self.sqldb.select(self.fund_history_table, fields = [column_net_value], conds = "%s = '%s'" % (column_date, buyDate))
        if not net_value:
            print("date wrong, net_value is null in:", buyDate)
            return

        if not self.sqldb.isExistTable(self.buy_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_cost:'double(8,4) DEFAULT NULL',column_portion:'double(8,4) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.buy_table, attrs, constraint)

        portion = Decimal(cost) / Decimal(str(net_value[0][0]))
        self.sqldb.insert(self.buy_table, {column_date:buyDate, column_cost:str(cost), column_portion : str(portion)})

        self.cost_hold += Decimal(cost)
        #print("self.portion_hold", self.portion_hold)
        self.portion_hold += portion.quantize(Decimal('0.0000'))
        self.sqldb.update(gl_all_info_table, {column_cost_hold : str(self.cost_hold), column_portion_hold : str(self.portion_hold), column_averagae_price:str(self.cost_hold/self.portion_hold)}, {column_code: self.fund_code})

    def sell(self, portion, date = ""):
        if portion <= Decimal("0"):
            return

        sellDate = date
        if date == "":
            sellDate = self.getToady()

        net_value = self.sqldb.select(self.fund_history_table, fields = [column_net_value], conds = "%s = '%s'" % (column_date, sellDate))
        if not net_value:
            print("date wrong, net_value is null in:", sellDate)
            return

        #print(portion)
        #portion = portion.quantize(Decimal("0"), ROUND_DOWN)
        if self.portion_hold < portion :
            print("no enough portion to sell. total:", self.portion_hold, portion)
            return

        if not self.sqldb.isExistTable(self.sell_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'double(16,4) DEFAULT NULL', column_money_sold:'double(16,4) DEFAULT NULL', column_cost_sold:'double(16,4) DEFAULT NULL', column_earned:'double(16,4) DEFAULT NULL', column_return_percentage:'double(8,6) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.sell_table, attrs, constraint)

        remain_portion = self.portion_hold - portion
        price = self.cost_hold / self.portion_hold
        cost_sold = Decimal(portion) * price
        remain_cost = self.cost_hold - cost_sold
        money = Decimal(portion) * Decimal(str(net_value[0][0]))
        earned = money - cost_sold
        #print(
        #    "sold:", money.quantize(Decimal('0.0000')),
        #    "earned:", earned.quantize(Decimal('0.0000')))
        self.updateSellData(portion, money, cost_sold, earned, sellDate, remain_cost, remain_portion)

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
        self.sqldb.update(gl_all_info_table, {column_cost_hold : str(self.cost_hold), column_portion_hold : str(self.portion_hold)}, {column_code: self.fund_code})

    def portions_available_to_sell(self, reDays, finalDate=""):
        fdate = finalDate
        if finalDate == "":
            fdate = self.getToady()
        bdate = (datetime.strptime(fdate, "%Y-%m-%d") + timedelta(days=-reDays)).strftime("%Y-%m-%d")
        fdate = max(fdate, self.getToady())
        #print(bdate, fdate)
        sum_re = self.sqldb.select(self.buy_table, "sum(%s)" % column_portion, ["%s >= '%s'" % (column_date, bdate), "%s < '%s'" % (column_date, fdate)])
        portion_remain = Decimal("0")
        if sum_re and sum_re[0][0]:
            portion_remain = Decimal(str(sum_re[0][0])).quantize(Decimal("0.0000"))
        #print(sum_re[0][0], portion_remain)

        if portion_remain >= self.portion_hold :
            return Decimal("0")
        else :
            return self.portion_hold - portion_remain

    def reset_trade_data(self):
        if self.sqldb.isExistTable(self.buy_table):
            self.sqldb.deleteTable(self.buy_table)
        if self.sqldb.isExistTable(self.sell_table):
            self.sqldb.deleteTable(self.sell_table)
        self.sqldb.update(gl_all_info_table, {column_cost_hold : str(0), column_portion_hold : str(0), column_averagae_price:str(0)}, {column_code : self.fund_code})

    def print_summery(self):
        summery = self.sqldb.select(gl_all_info_table, [column_cost_hold, column_portion_hold, column_averagae_price], "%s = '%s'" % (column_code, self.fund_code))
        print(summery)
