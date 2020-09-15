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
            self.sqldb.createTable(self.stocks_table, attrs, constraint)
            self.sqldb.insert(self.stocks_table, {column_code: self.code})
            self.init_user_stock_in_db()
        elif not self.check_code_exists():
            self.init_user_stock_in_db()

        pre_uid = "u" + str(user.id) + "_"
        self.buy_table = pre_uid + self.code + "_buy"
        self.sell_table = pre_uid + self.code + "_sell"

    def check_code_exists(self):
        details = self.sqldb.select(self.stocks_table, "*", "%s = '%s'" % (column_code, self.code))
        if details is None or len(details) == 0:
            self.sqldb.insert(self.stocks_table, {column_code: self.code})
            return False
        elif not len(details[0]) == 10:
            return False
        (i, self.code, self.cost_hold, self.portion_hold, self.average, self.keep_eye_on, self.short_term_rate, self.buy_rate, self.sell_rate, self.fee), = details
        return self.short_term_rate is not None and self.buy_rate is not None and self.sell_rate is not None and self.fee is not None

    def check_table_column(self, tablename, col, tp):
        if not self.sqldb.isExistTableColumn(tablename, col):
            self.sqldb.addColumn(tablename, col, tp)

    def init_user_stock_in_db(self):
        self.check_table_column(self.stocks_table, column_cost_hold, "double(16,2) DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_portion_hold, "int DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_averagae_price, "double(16,4) DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_keepeyeon, "tinyint(1) DEFAULT 1")
        self.check_table_column(self.stocks_table, column_shortterm_rate, "double(16,4) DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_buy_decrease_rate, "double(16,4) DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_sell_increase_rate, "double(16,4) DEFAULT NULL")
        self.check_table_column(self.stocks_table, column_fee, "double(16,6) DEFAULT NULL")

        details = self.sqldb.select(self.stocks_table, "*", "%s = '%s'" % (column_code, self.code))
        (i, self.code, self.cost_hold, self.portion_hold, self.average, self.keep_eye_on, self.short_term_rate, self.buy_rate, self.sell_rate, self.fee), = details
        if self.cost_hold is None:
            self.cost_hold = 0
        if self.portion_hold is None:
            self.portion_hold = 0
        if self.average is None:
            self.average = 0
        if self.keep_eye_on is None:
            self.keep_eye_on = 1
        if self.short_term_rate is None:
            self.short_term_rate =0
        if self.buy_rate is None:
            self.buy_rate = 0
        if self.sell_rate is None:
            self.sell_rate = 0
        if self.fee is None:
            self.fee = 0.00025

        self.sqldb.update(self.stocks_table, {column_cost_hold: str(self.cost_hold), column_portion_hold: str(self.portion_hold), column_averagae_price: str(self.average), column_shortterm_rate: str(self.short_term_rate), column_buy_decrease_rate: str(self.buy_rate), column_sell_increase_rate: str(self.sell_rate), column_fee: str(self.fee)}, {column_code : self.code})

    def setup_buytable(self):
        if not self.sqldb.isExistTable(self.buy_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'int DEFAULT NULL',column_price:'double(16,4) DEFAULT NULL', column_cost:'double(16,2) DEFAULT NULL',column_soldout:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.buy_table, attrs, constraint)
            
        self.check_table_column(self.buy_table, column_soldout, 'tinyint(1) DEFAULT 0')
        self.check_table_column(self.buy_table, column_sold_portion, 'int DEFAULT 0')

    def setup_selltable(self):
        if not self.sqldb.isExistTable(self.sell_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'int DEFAULT NULL', column_price:'double(16,4) DEFAULT NULL', column_money_sold:'double(16,2) DEFAULT NULL', column_cost_sold:'double(16,2) DEFAULT NULL', column_earned:'double(16,2) DEFAULT NULL', column_return_percentage:'double(8,6) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.sell_table, attrs, constraint)

        self.check_table_column(self.sell_table, column_rolled_in, 'int DEFAULT NULL')
        self.check_table_column(self.sell_table, column_roll_in_value, 'double(16,4) DEFAULT NULL')

    def check_exist_in_allstocks(self):
        stocks = AllStocks()
        sg = StockGeneral(self.sqldb, self.code)
        if not sg.name:
            stocks.loadInfo(self.code)

    def fix_cost_portion_hold(self):
        if not self.sqldb.isExistTable(self.buy_table):
            print("UserStock.fix_cost_portion_hold", self.buy_table, "not exists.")
            return

        buy_rec =self.sqldb.select(self.buy_table, [column_price, column_portion, column_sold_portion], "%s = 0" % column_soldout)
        if buy_rec is not None:
            portion = Decimal(0)
            cost = Decimal(0)
            for (pr, p, sp) in buy_rec:
                portion += Decimal(str(p)) - Decimal(str(sp))
                cost += Decimal(pr) * (Decimal(str(p)) - Decimal(str(sp)))

            average = (cost/portion).quantize(Decimal("0.0000")) if not portion == 0 else 0
            newinfo = {column_cost_hold:str(cost), column_portion_hold:str(portion), column_averagae_price:str(average)}
            if portion > 0:
                newinfo[column_keepeyeon] = '1'
            self.sqldb.update(self.stocks_table, newinfo, {column_code: self.code})

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
            column_soldout:'0',
            column_sold_portion:'0'})

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
        (i, nb[column_date], nb[column_portion], nb[column_price], nb[column_cost], s, sp), = buy_rec
        if price:
            nb[column_price] = price
        if portion:
            nb[column_portion] = portion
        nb[column_cost] = int(nb[column_portion]) * float(nb[column_price])
        if date:
            nb[column_date] = date

        self.sqldb.update(self.buy_table, nb, {'id':str(id)})

    def sell(self, date, price, buyids, portion = None):
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

        portion_in_ids = Decimal(0)
        details_for_ids = []
        for d in buyids:
            detail = self.sqldb.select(self.buy_table, [column_portion, column_price, column_cost, column_sold_portion], "id = '%s'" % d)
            if detail is not None:
                (p, pr, c, sp), = detail
                details_for_ids.append([d, p, pr, c, sp])
                portion_in_ids += Decimal(str(p)) - Decimal(str(sp))

        portion_tosell = portion_in_ids
        if portion is not None and Decimal(portion) > 0:
            portion_tosell = Decimal(portion)

        cost_tosell = Decimal(0)
        if portion_tosell >= portion_in_ids:
            for (d,p,pr,c,sp) in details_for_ids:
                cost_tosell += (Decimal(p) - Decimal(sp)) * Decimal(pr)
                self.sqldb.update(self.buy_table, {column_soldout:str(1), column_sold_portion:str(p)}, {'id': str(d)})
        else:
            details_for_ids.sort(key=lambda d:d[2])
            steps_to_sell = Decimal(0)
            for (d,p,pr,c,sp) in details_for_ids:
                if steps_to_sell + Decimal(p) - Decimal(sp) <= portion_tosell:
                    self.sqldb.update(self.buy_table, {column_soldout:str(1), column_sold_portion:str(p)}, {'id': str(d)})
                    steps_to_sell += Decimal(p) - Decimal(sp)
                    cost_tosell += (Decimal(p) - Decimal(sp)) * Decimal(pr)
                else:
                    sold_portion = portion_tosell - steps_to_sell + Decimal(sp)
                    self.sqldb.update(self.buy_table, {column_sold_portion:str(sold_portion)}, {'id': str(d)})
                    cost_tosell += (portion_tosell - steps_to_sell) * Decimal(pr)
                    break

        sg = StockGeneral(self.sqldb, self.code)

        money = portion_tosell * Decimal(price)
        if float(self.fee) > 0:
            money = money * (1 - Decimal(self.fee))
        earned = money - cost_tosell
        return_percent = earned / cost_tosell
        max_value_to_sell = round(price, 4)
        if sg.short_term_rate is not None:
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
        ns[column_money_sold] = int(ns[column_portion]) * float(ns[column_price]) * (1 - float(self.fee))
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

    def ever_hold(self):
        return self.sqldb.isExistTable(self.buy_table)

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
        stock_json_obj["str"] = sg.short_term_rate if self.short_term_rate == 0 else self.short_term_rate # short_term_rate
        stock_json_obj["bgr"] = self.buy_rate if float(self.buy_rate) > 0 else stock_json_obj["str"]
        stock_json_obj["sgr"] = self.sell_rate if float(self.sell_rate) > 0 else stock_json_obj["str"]
        stock_json_obj["cost"] = self.cost_hold
        stock_json_obj["ptn"] = self.portion_hold # portion
        stock_json_obj["avp"] = self.average # average price
        stock_json_obj["fee"] = self.fee

        return stock_json_obj

    def get_buy_arr(self):
        if not self.buy_table or not self.sqldb.isExistTable(self.buy_table):
            return []

        buy_rec = self.sqldb.select(self.buy_table, '*')
        values = []
        date_conv = DateConverter()
        dtoday = datetime.now().strftime("%Y-%m-%d")
        for (i,d,p,pr,c,s,sp) in buy_rec:
            if d == dtoday or s == 0:
                values.append({'id':i, 'date': date_conv.days_since_2000(d), 'price':pr, 'cost':c, 'ptn': p - sp, 'sold': s})
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
            values.append({'id':i, 'date': date_conv.days_since_2000(d), 'price':pr, 'ptn': p, 'cost': c})
        return values

    def get_cost_sold_stats(self, sell_recs):
        if sell_recs is None or len(sell_recs) == 0:
            return 0
            
        cost_sold = 0
        for (m, c) in sell_recs:
            cost_sold += c
        return cost_sold

    def get_money_sold_stats(self, sell_recs):
        if sell_recs is None or len(sell_recs) == 0:
            return 0
        m_s = 0
        for (m, c) in sell_recs:
            m_s += m
        return m_s

    def get_holding_stats(self):
        stock_stats_obj = {}
        sg = StockGeneral(self.sqldb, self.code)

        stock_stats_obj["name"] = sg.name
        stock_stats_obj["cost"] = self.cost_hold
        
        sell_recs = self.sqldb.select(self.sell_table, [column_money_sold, column_cost_sold])
        stock_stats_obj["cs"] = self.get_cost_sold_stats(sell_recs)
        stock_stats_obj["ms"] = self.get_money_sold_stats(sell_recs)
        stock_stats_obj['srct'] = (len(sell_recs) if sell_recs else 0) + (1 if self.cost_hold > 0 else 0) # sell record count

        return stock_stats_obj
