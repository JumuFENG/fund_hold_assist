# Python 3
# -*- coding:utf-8 -*-

from datetime import datetime, timedelta
from decimal import Decimal
import sys
sys.path.append("../..")
from utils import *
from history import *

class UserStock():
    """the stock basic info for user"""
    def __init__(self, user, code):
        self.sqldb = user.stock_center_db()
        self.code = code
        self.stocks_table = user.stocks_info_table()
        if not self.sqldb.isExistTable(self.stocks_table):
            attrs = {column_code:'varchar(10) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.stocks_table, attrs, constraint)
            self.sqldb.insert(self.stocks_table, {column_code: self.code})
            self.init_user_stock_in_db()
        else:
            details = self.sqldb.select(self.stocks_table, "*", "%s = '%s'" % (column_code, code))
            if not details:
                self.sqldb.insert(self.stocks_table, {column_code: self.code})
                self.init_user_stock_in_db()
            elif len(details) == 10:
                (i, self.code, self.cost_hold, self.portion_hold, self.average, self.keep_eye_on, self.short_term_rate, self.buy_rate, self.sell_rate, self.fee), = details
            else:
                self.init_user_stock_in_db()
        pre_uid = "u" + str(user.id) + "_"
        self.buy_table = pre_uid + self.code + "_buy"
        self.sell_table = pre_uid + self.code + "_sell"

    def init_user_stock_in_db(self):
        tbl_mgr = TableManager(self.sqldb, self.stocks_table, self.code)
        self.cost_hold = tbl_mgr.GetTableColumnInfo(column_cost_hold, "0", "double(16,2) DEFAULT NULL")
        self.portion_hold = tbl_mgr.GetTableColumnInfo(column_portion_hold, "0", "int DEFAULT NULL")
        self.average = tbl_mgr.GetTableColumnInfo(column_averagae_price, "0", "double(16,4) DEFAULT NULL")
        self.keep_eye_on = tbl_mgr.GetTableColumnInfo(column_keepeyeon, "1", 'tinyint(1) DEFAULT 1')
        self.short_term_rate = tbl_mgr.GetTableColumnInfo(column_shortterm_rate, "0", "double(16,4) DEFAULT NULL")
        self.buy_rate = tbl_mgr.GetTableColumnInfo(column_buy_decrease_rate, "0", "double(16,4) DEFAULT NULL")
        self.sell_rate = tbl_mgr.GetTableColumnInfo(column_sell_increase_rate, "0", "double(16,4) DEFAULT NULL")
        self.fee = tbl_mgr.GetTableColumnInfo(column_fee, '0', "double(16,6) DEFAULT NULL")
        self.sqldb.update(self.stocks_table, {column_cost_hold: str(self.cost_hold), column_portion_hold: str(self.portion_hold), column_averagae_price: str(self.average), column_shortterm_rate: str(self.short_term_rate), column_buy_decrease_rate: str(self.buy_rate), column_sell_increase_rate: str(self.sell_rate), column_fee: str(self.fee)}, {column_code : self.code})

    def setup_buytable(self):
        if not self.sqldb.isExistTable(self.buy_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'int DEFAULT NULL',column_price:'double(16,4) DEFAULT NULL', column_cost:'double(16,2) DEFAULT NULL',column_soldout:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.buy_table, attrs, constraint)
            
        if not self.sqldb.isExistTableColumn(self.buy_table, column_soldout):
            self.sqldb.addColumn(self.buy_table, column_soldout, 'tinyint(1) DEFAULT 0')

    def setup_selltable(self):
        if not self.sqldb.isExistTable(self.sell_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'int DEFAULT NULL', column_price:'double(16,4) DEFAULT NULL', column_money_sold:'double(16,2) DEFAULT NULL', column_cost_sold:'double(16,2) DEFAULT NULL', column_earned:'double(16,2) DEFAULT NULL', column_return_percentage:'double(8,6) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.sell_table, attrs, constraint)

        if not self.sqldb.isExistTableColumn(self.sell_table, column_rolled_in):
            self.sqldb.addColumn(self.sell_table, column_rolled_in, 'int DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(self.sell_table, column_roll_in_value):
            self.sqldb.addColumn(self.sell_table, column_roll_in_value, 'double(16,4) DEFAULT NULL')

    def check_exist_in_allstocks(self):
        sg = None
        if not self.sqldb.isExistTable(gl_all_stocks_info_table):
            stocks = AllStocks(self.sqldb)
        else:
            sg = self.sqldb.select(gl_all_stocks_info_table, "*", "%s = '%s'" % (column_code, self.code))

        if not sg:
            self.sqldb.insert(gl_all_stocks_info_table, {column_code: self.code})

    def fix_cost_portion_hold(self):
        if not self.sqldb.isExistTable(self.buy_table):
            print("UserStock.fix_cost_portion_hold", self.buy_table, "not exists.")
            return

        buy_sum =self.sqldb.select(self.buy_table, ["sum(%s)" % column_cost, "sum(%s)" % column_portion], "%s = 0" % column_soldout)
        if buy_sum:
            (cost,portion), = buy_sum
            average = 0
            if not cost:
                cost = 0
            if not portion:
                portion = 0

            if portion:
                average = (Decimal(str(cost))/Decimal(str(portion))).quantize(Decimal("0.0000")) if not portion == 0 else 0
            self.sqldb.update(self.stocks_table, {column_cost_hold:str(cost), column_portion_hold:str(portion), column_averagae_price:str(average)}, {column_code: self.code})

    def update_rollin(self, portion, rid):
        rolled_in = self.sqldb.select(self.sell_table, [column_portion, column_rolled_in, column_roll_in_value], "id = '%s'" % str(rid))
        if rolled_in:
            (p_s, rolled_in, r_v), = rolled_in
        if not rolled_in:
            rolled_in = 0

        sg = StockGeneral(self.sqldb, self.code)
        portion_remain = portion - (int(p_s) - int(rolled_in))
        portion_remain = 0 if portion_remain < 0 else portion_remain
        next_value_to_sell = 0
        if portion_remain == 0:
            next_value_to_sell = round(float(r_v) * (1 - float(sg.short_term_rate)), 4)
            rolled_in = int(rolled_in) + portion
        else:
            rolled_in = p_s
        if rolled_in == p_s:
            next_value_to_sell = 0
        self.sqldb.update(self.sell_table, {column_rolled_in: str(rolled_in), column_roll_in_value:str(next_value_to_sell)}, {'id': str(rid)})

        return portion_remain

    def rollin_sold(self, portion, rollins):
        if isinstance(rollins, list):
            portion_remain = portion
            for r in rollins:
                portion_remain = self.update_rollin(portion_remain, r)
                if portion_remain == 0:
                    break
        elif rollins:
            self.update_rollin(portion, rollins)

    def buy(self, date, price, portion, rollins = None):
        if not self.sqldb.isExistTable(self.buy_table):
            self.setup_buytable()
            self.check_exist_in_allstocks()

        fixedPrice = price * (1 + float(self.fee)) if float(self.fee) > 0 else price
        self.sqldb.insert(self.buy_table, {
            column_date: date,
            column_price: str(fixedPrice),
            column_portion: str(portion),
            column_cost: str(fixedPrice * portion),
            column_soldout:'0'})

        self.rollin_sold(portion, rollins)
        self.fix_cost_portion_hold()

    def fix_buy(self, id, price, portion = None, date = None):
        if not self.sqldb.isExistTable(self.buy_table):
            return

        buy_rec = self.sqldb.select(self.buy_table, conds = "id = '%s'" % str(id))
        if not buy_rec:
            print("no buy record found, use UserStock.buy() directly.")
            return

        nb = {}
        (i, nb[column_date], nb[column_portion], nb[column_price], nb[column_cost], s), = buy_rec
        if price:
            nb[column_price] = price
        if portion:
            nb[column_portion] = portion
        nb[column_cost] = int(nb[column_portion]) * float(nb[column_price])
        if date:
            nb[column_date] = date

        self.sqldb.update(self.buy_table, nb, {'id':str(id)})

    def sell(self, date, price, buyids):
        if isinstance(buyids, int) or isinstance(buyids, str):
            buyids = [buyids]
        if not isinstance(buyids, list):
            print("UserStock.sell buyids should be list, but get", buyids)
            return

        if not self.sqldb.isExistTable(self.buy_table):
            print("UserStock.sell no buy record to sell.", self.code)
            return

        if not self.sqldb.isExistTable(self.sell_table):
            self.setup_selltable()

        cost_tosell = Decimal(0)
        portion_tosell = Decimal(0)
        for d in buyids:
            detail = self.sqldb.select(self.buy_table, [column_portion, column_cost], "id = '%s'" % d)
            if detail:
                (p, c), = detail
                cost_tosell += Decimal(str(c))
                portion_tosell += Decimal(str(p))
                self.sqldb.update(self.buy_table, {column_soldout:str(1)}, {'id': str(d)})
        sg = StockGeneral(self.sqldb, self.code)

        money = portion_tosell * Decimal(price)
        earned = money - cost_tosell
        return_percent = earned / cost_tosell
        max_value_to_sell = round(price, 4)
        if sg.short_term_rate:
            max_value_to_sell = round(price * (1.0 - float(sg.short_term_rate)), 4)

        self.sqldb.insert(self.sell_table, {
            column_date: date,
            column_portion: str(portion_tosell),
            column_price: str(price),
            column_money_sold: str(money),
            column_cost_sold: str(cost_tosell),
            column_earned: str(earned),
            column_return_percentage: str(return_percent),
            column_rolled_in: str(0),
            column_roll_in_value: str(max_value_to_sell)
            })

        self.fix_cost_portion_hold()

    def fix_sell(self, id, price, portion = None, cost = None, date = None):
        if not self.sqldb.isExistTable(self.sell_table):
            return

        sell_rec = self.sqldb.select(self.sell_table, [column_date, column_portion, column_price, column_cost_sold], conds = "id = '%s'" % str(id))
        if not sell_rec:
            print("no sell record found, use UserStock.sell() instead.")
            return
        ns = {}
        (ns[column_date], ns[column_portion], ns[column_price], ns[column_cost_sold]), = sell_rec
        if price:
            ns[column_price] = price
        if portion:
            ns[column_portion] = portion
        if cost:
            ns[column_cost_sold] = cost
        if date:
            ns[column_date] = date
        ns[column_money_sold] = int(ns[column_portion]) * float(ns[column_price])
        ns[column_earned] = float(ns[column_money_sold]) - float(ns[column_cost_sold])
        ns[column_return_percentage] = float(ns[column_earned]) / float(ns[column_cost_sold])

        self.sqldb.update(self.sell_table, ns, {'id':str(id)})

    def still_hold(self):
        if self.cost_hold and self.average:
            return True

        if not self.sqldb.isExistTable(self.buy_table):
            return False

        self.fix_cost_portion_hold()
        return True

    def set_rates(self, buyrate, sellrate, short_term_rate):
        if buyrate:
            self.buy_rate = buyrate
        if sellrate:
            self.sell_rate = sellrate
        if short_term_rate:
            self.short_term_rate = short_term_rate
        self.sqldb.update(self.stocks_table, {column_shortterm_rate: str(self.short_term_rate), column_buy_decrease_rate: str(self.buy_rate), column_sell_increase_rate: str(self.sell_rate)}, {column_code : self.code})

    def set_fee(self, fee):
        if fee:
            self.fee = fee
        self.sqldb.update(self.stocks_table, {column_fee: str(self.fee)}, {column_code: self.code})

    def get_stock_summary(self):
        stock_json_obj = {}
        sg = StockGeneral(self.sqldb, self.code)

        stock_json_obj["name"] = sg.name
        stock_json_obj["str"] = sg.short_term_rate if float(self.short_term_rate) == 0 else self.short_term_rate # short_term_rate
        stock_json_obj["bgr"] = self.buy_rate if float(self.buy_rate) > 0 else stock_json_obj["str"]
        stock_json_obj["sgr"] = self.sell_rate if float(self.sell_rate) > 0 else stock_json_obj["str"]
        stock_json_obj["cost"] = self.cost_hold
        stock_json_obj["ptn"] = self.portion_hold # portion
        stock_json_obj["avp"] = self.average # average price

        return stock_json_obj

    def get_buy_arr(self):
        if not self.buy_table or not self.sqldb.isExistTable(self.buy_table):
            return []

        buy_rec = self.sqldb.select(self.buy_table, '*')
        values = []
        date_conv = DateConverter()
        dtoday = datetime.now().strftime("%Y-%m-%d")
        for (i,d,p,pr,c,s) in buy_rec:
            if d == dtoday or s == 0:
                values.append({'id':i, 'date': date_conv.days_since_2000(d), 'price':pr, 'cost':c, 'ptn': p, 'sold': s})
        return values

    def get_sell_arr(self):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return []

        values = []
        sg = StockGeneral(self.sqldb, self.code)
        sell_rec = self.sqldb.select(self.sell_table, '*')
        date_conv = DateConverter()
        for (i, d, p, pr, m, c, e, per, r, np) in sell_rec:
            if not r:
                r = 0
            to_rollin = p - r
            max_price_to_buy = np if np else None
            if to_rollin > 0 and not max_price_to_buy:
                max_price_to_buy = round(pr * (1 - sg.short_term_rate), 4)
            values.append({'id':i, 'date': date_conv.days_since_2000(d), 'price':pr, 'ptn': p, 'cost': c, 'tri': to_rollin, 'mptb': max_price_to_buy})
        return values

