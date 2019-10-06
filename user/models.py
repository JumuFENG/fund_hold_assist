# Python 3
# -*- coding:utf-8 -*-

from datetime import datetime, timedelta
from decimal import Decimal
import sys
sys.path.append("../..")
from utils import *
from user.user_fund import *

class User():
    def __init__(self, id, name, email, password=None):
        self.id = id
        self.name = name
        self.email = email
        self.password = password
        self.funddb = None

    def fund_center_db(self):
        if not self.funddb:
            self.funddb = SqlHelper(password = db_pwd, database = "fund_center")
        return self.funddb

    def funds_info_table(self):
        return "u"+ str(self.id) + "_" + gl_fund_info_table

    def to_string(self):
        return 'id: ' + str(self.id) + ' name: ' + self.name + ' email: ' + self.email;

    def add_budget(self, code, budget, date = ""):
        sqldb = self.fund_center_db()
        uf = UserFund(self, code)
        uf.add_budget(budget, date)

    def fix_cost_portion_hold(self, code):
        uf = UserFund(self, code)
        uf.fix_cost_portion_hold()

    def buy(self, code, date, cost, budget_dates = None, rollin_date = None):
        uf = UserFund(self, code)
        uf.buy(date, cost, budget_dates, rollin_date)

    def buy_not_confirm(self, code, date, cost, budget_dates = None, rollin_date = None):
        uf = UserFund(self, code)
        uf.add_buy_rec(date, cost, budget_dates, rollin_date)

    def confirm_buy(self, code, date):
        uf = UserFund(self, code)
        uf.confirm_buy_rec(date)

    def fix_buy_rec(self, code, date, cost):
        uf = UserFund(self, code)
        uf.fix_buy_rec(date, cost)

    def sell_by_dates(self, code, date, buydates):
        uf = UserFund(self, code)
        uf.sell_by_dates(date, buydates)

    def sell_not_confirm(self, code, date, buydates):
        uf = UserFund(self, code)
        uf.add_sell_rec(date, buydates)

    def confirm_sell(self, code, date):
        uf = UserFund(self, code)
        uf.confirm_sell_rec(date)

    def update_funds(self):
        sqldb = self.fund_center_db()
        fundcodes = sqldb.select(self.funds_info_table(), [column_code])
        if not fundcodes:
            return

        for c, in fundcodes:
            uf = UserFund(self, c)
            uf.update_history()

    def confirm_buy_sell(self):
        sqldb = self.fund_center_db()
        fundcodes = sqldb.select(self.funds_info_table(), [column_code])
        if not fundcodes:
            return

        for c, in fundcodes:
            uf = UserFund(self, c)
            uf.confirm_buy_sell()

    def get_holding_funds_summary(self):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        fund_json = {}
        for (c, ) in fund_codes:
            uf = UserFund(self, c)
            fund_json_obj = None
            if uf.cost_hold and uf.average:
                fund_json_obj = uf.get_fund_summary()

            if fund_json_obj:
                fund_json[c] = fund_json_obj

        return fund_json

    def get_holding_funds_json(self):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return

        fund_json = self.get_holding_funds_summary()
        if not isinstance(fund_json, dict):
            return fund_json

        for c in fund_json:
            fund_json_obj = fund_json[c]

            fg = FundGeneral(sqldb, c)
            uf = UserFund(self, c)

            budget_arr = uf.get_budget_arr()
            if budget_arr and len(budget_arr) > 0:
                fund_json_obj["budget_table"] = budget_arr

            if uf.cost_hold and uf.average:
                rollin_arr = uf.get_roll_in_arr(fg)
                if rollin_arr and len(rollin_arr) > 0:
                    fund_json_obj["sell_table"] = rollin_arr

                buy_arr = uf.get_buy_arr(fg)
                if buy_arr and len(buy_arr) > 0:
                    fund_json_obj["buy_table"] = buy_arr

        return fund_json

    def get_holding_funds_hist_data(self):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return

        ig = IndexGeneral(sqldb, "000001")
        all_hist_data = ig.get_index_hist_data()

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        funds_holding = []
        for (c, ) in fund_codes:
            uf = UserFund(self, c)
            if uf.cost_hold and uf.average:
                funds_holding.append(c)

        for c in funds_holding:
            fg = FundGeneral(sqldb, c)
            fund_his_data = fg.get_fund_hist_data()
            all_hist_data = self.merge_hist_data(all_hist_data, fund_his_data)

        return all_hist_data

    def merge_hist_data(self, hist_data1, hist_data2):
        if len(hist_data2) < 1:
            return hist_data1
        if len(hist_data1) < 1:
            return hist_data2

        all_hist_data = []
        basic_his_data = hist_data1
        extend_his_data = hist_data2
        if len(hist_data1) < len(hist_data2):
            basic_his_data = hist_data2
            extend_his_data = hist_data1

        header = basic_his_data[0]
        for x in extend_his_data[0]:
            if x != 'date':
                header += x,

        all_hist_data.append(header)
        basic_his_data = basic_his_data[1:]
        extend_his_data = extend_his_data[1:]

        for basic_data in basic_his_data:
            row = list(basic_data)
            date = row[0]
            find_netvalue_same_date = False
            for ext_data in extend_his_data:
                fdate = ext_data[0]
                if fdate == date:
                    for x in ext_data[1:]:
                        row.append(x)
                    find_netvalue_same_date = True
                    break
                if fdate < date:
                    continue
                if fdate > date:
                    break
            if not find_netvalue_same_date:
                for x in extend_his_data[1][1:]:
                    row.append('')

            all_hist_data.append(row)

        return all_hist_data

class UserModel():
    def __init__(self, sqldb):
        self.tablename = 'users'
        self.sqldb = sqldb

    def add_new(self, name, password, email):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {'name':'varchar(255) DEFAULT NULL', 'password':"varchar(255) DEFAULT NULL",  'email':"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.tablename, attrs, constraint)
        (result,), = self.sqldb.select(self.tablename, 'count(*)', ["email = '%s'" % email])
        if result and result != 0:
            user = self.user_by_email(email)
            print( user.to_string(), "already exists!")
            return user
        self.sqldb.insert(self.tablename, {'name':name, 'password':password, 'email':email})
        return self.user_by_email(email)

    def user_by_id(self, id):
        result = self.sqldb.select(self.tablename, "*", ["id = '%s'" % id])
        if not result:
            return None

        (id, name, password, email), = result
        return User(id, name, email, password)

    def user_by_email(self, email):
        result = self.sqldb.select(self.tablename, "*", ["email = '%s'" % email])
        if not result:
            return None
        (id, name, password, email), = result
        return User(id, name, email, password)

    def set_password(self, user, password):
        user.password = password
        self.sqldb.update(self.tablename, {'password':password}, {'id' : str(user.id)})

    def check_password(self, user, password):
        return password == user.password
