# Python 3
# -*- coding:utf-8 -*-

from datetime import datetime, timedelta
from decimal import Decimal
import sys
sys.path.append("../..")
from utils import *

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
        return gl_fund_info_table

    def budget_table(self, code):
        return code + "_inv_budget"

    def buy_table(self, code):
        return code + "_buy"

    def sell_table(self, code):
        return code + "_sell"

    def cost_hold(self, code):
        sqldb = self.fund_center_db()
        details = sqldb.select(self.funds_info_table(), "*", "%s = '%s'" % (column_code, code))
        (i, name, code, history_table, buy_table, sell_table, 
            cost_hold, portion_hold, average, budget_table), = details
        return cost_hold

    def average(self, code):
        sqldb = self.fund_center_db()
        details = sqldb.select(self.funds_info_table(), "*", "%s = '%s'" % (column_code, code))
        (i, name, code, history_table, buy_table, sell_table, 
            cost_hold, portion_hold, average, budget_table), = details
        return average

    def portion_hold(self, code):
        sqldb = self.fund_center_db()
        details = sqldb.select(self.funds_info_table(), "*", "%s = '%s'" % (column_code, code))
        (i, name, code, history_table, buy_table, sell_table, 
            cost_hold, portion_hold, average, budget_table), = details
        return portion_hold

    def last_day_earned(self, code):
        sqldb = self.fund_center_db()
        fg = FundGeneral(sqldb, code)
        history_dvs = sqldb.select(fg.history_table, [column_date, column_net_value, column_growth_rate], order = " ORDER BY %s ASC" % column_date);
        (lastd, n, grate) = history_dvs[-1]
        (d, nv, g) = history_dvs[-2]
        latest_earned_per_portion = float(nv) * float(grate)

        pre_portion = float(self.portion_hold(code))
        if self.buy_table:
            last_portion = sqldb.select(self.buy_table(code), [column_portion], "%s = '%s'" % (column_date, lastd))
            if last_portion:
                (last_portion,), = last_portion
            if not last_portion:
                last_portion = 0
            pre_portion -= float(last_portion)

        return round(latest_earned_per_portion * pre_portion, 2)


    def to_string(self):
        return 'id: ' + str(self.id) + ' name: ' + self.name + ' email: ' + self.email;

    def delete_cosumed(self, sqldb, budget_table):
        if not sqldb.isExistTable(budget_table):
            return

        sqldb.delete(budget_table, {column_consumed:'1'})

    def get_roll_in_arr(self, sqldb, fg, ppg):
        sell_table = self.sell_table(fg.code)
        if not sell_table or not sqldb.isExistTable(sell_table):
            return
        if not sqldb.isExistTableColumn(sell_table, column_rolled_in) or not sqldb.isExistTableColumn(sell_table, column_roll_in_value):
            print("table column not complete.")
            return

        sell_recs = sqldb.select(sell_table, [column_date, column_cost_sold, column_rolled_in, column_roll_in_value])
        if not sell_recs:
            return

        values = []
        for (d, c, r, v) in sell_recs:
            if not r:
                r = 0
            if c <= float(r):
                continue
            max_price_to_buy = 0
            if not v:
                netvalue = fg.netvalue_by_date(d)
                max_price_to_buy = round(netvalue * (1.0 - float(fg.short_term_rate)) * ppg, 4)
            else:
                max_price_to_buy = round(float(v) * ppg, 4)
            values.append({"date":d, "max_price_to_buy":max_price_to_buy, "to_rollin":str(int(c - float(r)))})

        return values

    def get_buy_arr(self, sqldb, fg):
        buy_table = self.buy_table(fg.code)
        if not buy_table:
            return

        dcp_not_sell = sqldb.select(buy_table, [column_date, column_cost, column_portion], "%s = 0" % column_soldout)
        values = []
        for (d,c,p) in dcp_not_sell:
            v = fg.netvalue_by_date(d)
            values.append({"date":d, "netvalue":v, "cost":c, "portion":p})
        return values

    def get_portions_morethan_7day(self, sqldb, fg, ppg):
        dateToday = datetime.now().strftime("%Y-%m-%d")
        dateBegin = (datetime.strptime(dateToday, "%Y-%m-%d") + timedelta(days=-7)).strftime("%Y-%m-%d")
        history_table = fg.history_table

        buy_table = self.buy_table(fg.code)
        if not buy_table:
            return 0
        (portion_cannot_sell,), = sqldb.select(buy_table, "sum(%s)" % column_portion, "%s > '%s'" % (column_date, dateBegin))
        if not portion_cannot_sell:
            portion_cannot_sell = 0
        return round((self.portion_hold(fg.code) - portion_cannot_sell) / ppg, 4)

    def get_holding_funds_json(self):
        sqldb = SqlHelper(password = db_pwd, database = "fund_center")
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        fund_json = {}
        for (c, ) in fund_codes:
            fund_json_obj = {}
            ppg = 1 if not ppgram.__contains__(c) else ppgram[c]
            fg = FundGeneral(sqldb, c)
            budget_table = self.budget_table(c)
            if budget_table and sqldb.isExistTable(budget_table):
                self.delete_cosumed(sqldb, budget_table)

                budget = sqldb.select(budget_table, [column_date, column_net_value, column_budget])
                values = []
                for (d,v,b) in budget:
                    values.append({"date":d, "max_price_to_buy":str(Decimal(str(v)) * ppg), "budget":b})
                if len(values) > 0:
                    fund_json_obj["budget"] = values

            if self.cost_hold(c) and self.average(c):
                fund_json_obj["name"] = fg.name
                fund_json_obj["ppg"] = ppg
                fund_json_obj["short_term_rate"] = fg.short_term_rate
                fund_json_obj["cost"] = self.cost_hold(c)
                fund_json_obj["averprice"] = str(Decimal(str(self.average(c))) * ppg)
                fund_json_obj["latest_netvalue"] = fg.latest_netvalue()
                fund_json_obj["last_day_earned"] = self.last_day_earned(c)
                fund_json_obj["earned_while_holding"] = round((float(fg.latest_netvalue()) - float(self.average(c))) * float(self.portion_hold(c)), 2)

                rollin_arr = self.get_roll_in_arr(sqldb, fg, ppg)
                if rollin_arr and len(rollin_arr) > 0:
                    fund_json_obj["rollin"] = rollin_arr

                fund_json_obj["morethan7day"] = self.get_portions_morethan_7day(sqldb, fg, ppg)
                buy_arr = self.get_buy_arr(sqldb, fg)
                if buy_arr and len(buy_arr) > 0:
                    fund_json_obj["buy_table"] = buy_arr

            if fund_json_obj:
                fund_json[c] = fund_json_obj

        return fund_json

    def get_holding_funds_hist_data(self):
        sqldb = SqlHelper(password = db_pwd, database = "fund_center")
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        funds_holding = []
        for (c, ) in fund_codes:
            fg = FundGeneral(sqldb, c)
            if self.cost_hold(c) and self.average(c):
                funds_holding.append((fg.code, fg.history_table))

        szzs_code = "sz000001"
        szzs_his_tbl = "i_ful_his_000001"
        all_hist_data = [["date", szzs_code]]
        if not sqldb.isExistTable(szzs_his_tbl):
            print(szzs_his_tbl,"not exist.")
            return

        szzs_his_data = sqldb.select(szzs_his_tbl, [column_date, column_close, column_p_change])
        funds_his_data = []
        for (c, t) in funds_holding:
            all_hist_data[0].append(c)
            funds_his_data.append(sqldb.select(t, [column_date, column_net_value, column_growth_rate]))

        for (date, close, p_change) in szzs_his_data:
            row = [date, round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else '']
            for fund_his in funds_his_data:
                find_netvalue_same_date = False
                for (fdate, netvalue, growth) in fund_his:
                    if fdate == date:
                        row.append(netvalue)
                        row.append(round(float(100 * growth), 2))
                        find_netvalue_same_date = True
                        break
                    if fdate < date:
                        continue
                    if fdate > date:
                        break
                if not find_netvalue_same_date:
                    row.append('')
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
