# Python 3
# -*- coding:utf-8 -*-

from datetime import datetime, timedelta
from decimal import Decimal
import sys
sys.path.append("../..")
from utils import *
from history import *

class UserFund():
    """the fund basic info for user"""
    def __init__(self, user, code):
        self.sqldb = user.fund_center_db()
        self.code = code
        self.funds_table = user.funds_info_table()
        self.date_conv = DateConverter()
        if not self.sqldb.isExistTable(self.funds_table):
            attrs = {column_code:'varchar(10) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.funds_table, attrs, constraint)
            self.sqldb.insert(self.funds_table, {column_code: self.code})
            self.init_user_fund_in_db(user.id, self.funds_table)
        else:
            details = self.sqldb.select(self.funds_table, "*", "%s = '%s'" % (column_code, code))
            if details:
                if len(details[0]) == 9:
                    (i, self.code, self.buy_table, self.sell_table, self.budget_table, self.cost_hold, self.portion_hold, self.average, self.keep_eye_on), = details
                else:
                    self.init_user_fund_in_db(user.id, self.funds_table)
            else:
                self.sqldb.insert(self.funds_table, {column_code: self.code})
                self.init_user_fund_in_db(user.id, self.funds_table)

    def init_user_fund_in_db(self, id, tablename):
        pre_uid = "u" + str(id) + "_"
        buy_table = pre_uid + self.code + "_buy"
        sell_table = pre_uid + self.code + "_sell"
        budget_table = pre_uid + self.code + "_inv_budget"
        tbl_mgr = TableManager(self.sqldb, tablename, self.code)
        self.buy_table = tbl_mgr.GetTableColumnInfo(column_buy_table, buy_table)
        self.sell_table = tbl_mgr.GetTableColumnInfo(column_sell_table, sell_table)
        self.budget_table = tbl_mgr.GetTableColumnInfo(column_budget_table, budget_table)
        self.cost_hold = tbl_mgr.GetTableColumnInfo(column_cost_hold, "0", "double(16,2) DEFAULT NULL")
        self.portion_hold = tbl_mgr.GetTableColumnInfo(column_portion_hold, "0", "double(16,4) DEFAULT NULL")
        self.average = tbl_mgr.GetTableColumnInfo(column_averagae_price, "0", "double(16,4) DEFAULT NULL")
        self.keep_eye_on = tbl_mgr.GetTableColumnInfo(column_keepeyeon, "1", 'tinyint(1) DEFAULT 1')
        self.sqldb.update(tablename, {column_buy_table:self.buy_table, column_sell_table: self.sell_table, column_budget_table: self.budget_table, column_cost_hold: str(self.cost_hold), column_portion_hold: str(self.portion_hold), column_averagae_price: str(self.average)}, {column_code : self.code})

    def setup_buytable(self):
        if not self.sqldb.isExistTable(self.buy_table) :
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_cost:'double(16,4) DEFAULT NULL',column_portion:'double(16,4) DEFAULT NULL',column_soldout:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.buy_table, attrs, constraint)
            
        if not self.sqldb.isExistTableColumn(self.buy_table, column_soldout):
            self.sqldb.addColumn(self.buy_table, column_soldout, 'tinyint(1) DEFAULT 0')

    def setup_selltable(self):
        if not self.sqldb.isExistTable(self.sell_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_portion:'double(16,4) DEFAULT NULL', column_money_sold:'double(16,4) DEFAULT NULL', column_cost_sold:'double(16,4) DEFAULT NULL', column_earned:'double(16,4) DEFAULT NULL', column_return_percentage:'double(8,6) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.sell_table, attrs, constraint)

        if not self.sqldb.isExistTableColumn(self.sell_table, column_rolled_in):
            self.sqldb.addColumn(self.sell_table, column_rolled_in, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(self.sell_table, column_roll_in_value):
            self.sqldb.addColumn(self.sell_table, column_roll_in_value, 'varchar(20) DEFAULT NULL')
        if not self.sqldb.isExistTableColumn(self.sell_table, column_actual_sold):
            self.sqldb.addColumn(self.sell_table, column_actual_sold, 'varchar(20) DEFAULT 0')

    def setup_budgettable(self):
        if not self.sqldb.isExistTable(self.budget_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'varchar(20) DEFAULT NULL',column_budget:'varchar(10) DEFAULT NULL', column_consumed:'tinyint(1) DEFAULT 0'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.budget_table, attrs, constraint)

    def last_day_earned(self, history_table):
        history_dvs = self.sqldb.select(history_table, [column_date, column_net_value, column_growth_rate], order = " ORDER BY %s ASC" % column_date);
        if not history_dvs:
            return 0

        (lastd, n, grate) = history_dvs[-1]
        (d, nv, g) = history_dvs[-2]
        latest_earned_per_portion = float(nv) * float(grate)

        pre_portion = float(self.portion_hold)
        if self.buy_table:
            last_portion = self.sqldb.select(self.buy_table, [column_portion], "%s = '%s'" % (column_date, lastd))
            if last_portion:
                (last_portion,), = last_portion
            if not last_portion:
                last_portion = 0
            pre_portion -= float(last_portion)

        return round(latest_earned_per_portion * pre_portion, 2)

    def add_budget(self, budget, date):
        fg = FundGeneral(self.sqldb, self.code)
        his_db_table = fg.history_table
        if not his_db_table:
            print("can not get history table.")
            return

        if not self.sqldb.isExistTable(self.budget_table):
            self.setup_budgettable()

        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        bu_rec = self.sqldb.select(self.budget_table, conds = "%s = '%s'" % (column_date, date))
        if bu_rec:
            ((bu_rec),) = bu_rec
        if bu_rec:
            print("already add budget", bu_rec)
            return

        netvalue = fg.netvalue_by_date(date)
        if not netvalue:
            print("no value on", date)
            return

        self.sqldb.insert(self.budget_table, {column_date:date, column_net_value:str(netvalue), column_budget: str(budget)})
        self.delete_cosumed()

    def consume_budget(self, dates):
        if isinstance(dates, str):
            self.sqldb.update(self.budget_table, {column_consumed:'1'},{column_date:dates})
        elif isinstance(dates, list):
            for d in dates:
                self.sqldb.update(self.budget_table, {column_consumed:'1'},{column_date:d})

    def delete_cosumed(self):
        if not self.sqldb.isExistTable(self.budget_table):
            return

        self.sqldb.delete(self.budget_table, {column_consumed:'1'})

    def get_budget_arr(self):
        values = []
        if self.budget_table and self.sqldb.isExistTable(self.budget_table):
            self.delete_cosumed()
            budget = self.sqldb.select(self.budget_table, [column_date, column_net_value, column_budget])
            for (d,v,b) in budget:
                values.append({"date":self.date_conv.days_since_2000(d), "mptb":str(v), "bdt":b})
        return values

    def set_actual_sold(self, date, actual_sold):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return

        if not self.sqldb.isExistTableColumn(self.sell_table, column_actual_sold):
            self.sqldb.addColumn(self.sell_table, column_actual_sold, 'varchar(20) DEFAULT 0')

        self.sqldb.update(self.sell_table, {column_actual_sold:str(actual_sold)}, {column_date: str(date)})

    def fix_roll_in(self, date, rolled_in):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return

        if not self.sqldb.isExistTableColumn(self.sell_table, column_rolled_in):
            print("table column not complete.")
            return

        self.sqldb.update(self.sell_table, {column_rolled_in:str(rolled_in)}, {column_date: str(date)})

    def get_roll_in_arr(self, fg):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return

        if not self.sqldb.isExistTableColumn(self.sell_table, column_rolled_in) or not self.sqldb.isExistTableColumn(self.sell_table, column_roll_in_value):
            print("table column not complete.")
            return

        if not self.sqldb.isExistTableColumn(self.sell_table, column_actual_sold):
            self.sqldb.addColumn(self.sell_table, column_actual_sold, 'varchar(20) DEFAULT 0')

        sell_recs = self.sqldb.select(self.sell_table, [column_date, column_cost_sold, column_money_sold, column_portion, column_rolled_in, column_roll_in_value, column_actual_sold])
        if not sell_recs:
            return

        values = []
        for (d, c, m, p, r, v, a) in sell_recs:
            if not r:
                r = 0
            max_price_to_buy = 0
            if not v:
                netvalue = fg.netvalue_by_date(d)
                if netvalue:
                    max_price_to_buy = round(netvalue * (1.0 - float(fg.short_term_rate)), 4)
            else:
                max_price_to_buy = round(float(v), 4)
            to_rollin = 0;
            if c > float(r):
                to_rollin = int(c - float(r))
            values.append({"date":self.date_conv.days_since_2000(d), "cost":c, "ms":m, "ptn":p, "mptb":max_price_to_buy, "tri":str(to_rollin), "acs": a})

        return values

    def get_buy_arr(self, fg):
        if not self.buy_table:
            return

        dcp_not_sell = self.sqldb.select(self.buy_table, [column_date, column_cost, column_portion, column_soldout])
        values = []
        for (d,c,p,s) in dcp_not_sell:
            v = fg.netvalue_by_date(d)
            values.append({"date":self.date_conv.days_since_2000(d), "nv":v, "cost":c, "ptn":p, "sold":s})
        return values

    def fix_cost_portion_hold(self):
        if not self.sqldb.isExistTable(self.buy_table):
            print("UserFund.fix_cost_portion_hold", self.buy_table, "not exists.")
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
            self.sqldb.update(self.funds_table, {column_cost_hold:str(cost), column_portion_hold:str(portion), column_averagae_price:str(average)}, {column_code: self.code})

    def rollin_sold(self, cost, date):
        rolled_in = self.sqldb.select(self.sell_table, [column_cost_sold, column_rolled_in, column_roll_in_value], "%s = '%s'" % (column_date, date))
        if rolled_in:
            (c_s, rolled_in, r_v), = rolled_in
        if not rolled_in:
            rolled_in = 0
        fg = FundGeneral(self.sqldb, self.code)
        if not r_v:
            r_v = fg.netvalue_by_date(date)
        rolled_in = int(rolled_in) + int(cost)
        next_value_to_sell = 0
        if int(c_s) > rolled_in:
            next_value_to_sell = round(float(r_v) * (1 - float(fg.short_term_rate)), 4)
        self.sqldb.update(self.sell_table, {column_rolled_in: str(rolled_in), column_roll_in_value:str(next_value_to_sell)}, {column_date: date})

    def add_buy_rec(self, date, cost, budget_dates = None, rollin_date = None):
        if not self.sqldb.isExistTable(self.buy_table):
            self.setup_buytable()

        buy_rec = self.sqldb.select(self.buy_table, conds = "%s = '%s'" % (column_date, date))
        if buy_rec:
            ((buy_rec),) = buy_rec
            if buy_rec:
                print("buy record:", buy_rec, "already exists.")
                return

        self.sqldb.insert(self.buy_table, {column_date:date, column_cost:str(cost), column_soldout:'0'})

        if budget_dates:
            self.consume_budget(budget_dates)

        if rollin_date and isinstance(rollin_date, str):
            self.rollin_sold(cost, rollin_date)

    def fix_buy_rec(self, date, cost):
        if not self.sqldb.isExistTable(self.buy_table):
            return

        buy_rec = self.sqldb.select(self.buy_table, conds = "%s = '%s'" % (column_date, date))
        if not buy_rec:
            print("no buy record found, use UserFund.buy() directly.")
            return

        self.sqldb.update(self.buy_table, {column_cost:str(cost)}, {column_date:date})
        self.confirm_buy_rec(date)

    def confirm_buy_rec(self, date):
        buy_rec = self.sqldb.select(self.buy_table, [column_cost], conds = "%s = '%s'" % (column_date, date))
        if not buy_rec:
            print("UserFund.confirm_buy_rec no buy record found. add record firstly.")
            return

        (cost,), = buy_rec
        if not cost or cost == 0:
            print("UserFund.confirm_buy_rec invalid cost.")
            return

        fg = FundGeneral(self.sqldb, self.code)
        netvalue = fg.netvalue_by_date(date)
        if not netvalue:
            print("UserFund.confirm_buy_rec netvalue invalid. try again later.")
            return

        portion = ((Decimal(cost)/Decimal(1 + fg.pre_buy_fee)) / Decimal(str(netvalue))).quantize(Decimal("0.0000"))

        self.sqldb.update(self.buy_table, {column_portion:str(portion)}, {column_date:date})
        self.fix_cost_portion_hold()

    def buy(self, date, cost, budget_dates = None, rollin_date = None):
        self.add_buy_rec(date, cost, budget_dates, rollin_date)
        self.confirm_buy_rec(date)

    def add_sell_rec(self, date, buydates):
        if not isinstance(buydates, list):
            print("UserFund.add_sell_rec buytdates should be list, but get", buytdates)
            return

        if not self.sqldb.isExistTable(self.buy_table):
            print("UserFund.add_sell_rec no buy record to sell.", self.code)
            return

        if not self.sqldb.isExistTable(self.sell_table):
            self.setup_selltable()

        sell_rec = self.sqldb.select(self.sell_table, conds = "%s = '%s'" % (column_date, date))
        if sell_rec:
            ((sell_rec),) = sell_rec
            if sell_rec:
                print("find sell record", sell_rec, "ignore")
                return

        cost_tosell = Decimal(0)
        portion_tosell = Decimal(0)
        for d in buydates:
            detail = self.sqldb.select(self.buy_table, [column_cost, column_portion], "%s = '%s'" % (column_date, d))
            if detail:
                (c, p), = detail
                cost_tosell += Decimal(str(c))
                portion_tosell += Decimal(str(p))
                self.sqldb.update(self.buy_table, {column_soldout:str(1)}, {column_date:d})

        self.sqldb.insert(self.sell_table, {column_date:date, column_portion : str(portion_tosell), column_cost_sold:str(cost_tosell), column_rolled_in:str(0)})

    def confirm_sell_rec(self, date):
        sell_rec = self.sqldb.select(self.sell_table, [column_portion, column_cost_sold], conds = "%s = '%s'" % (column_date, date))
        if not sell_rec:
            print("UserFund.confirm_sell_rec no sell record found. add record firstly.")
            return

        (portion, cost), = sell_rec
        if not portion or portion == 0:
            print("UserFund.confirm_sell_rec invalid portion.")
            return

        fg = FundGeneral(self.sqldb, self.code)
        netvalue = fg.netvalue_by_date(date)
        if not netvalue:
            print("UserFund.confirm_sell_rec netvalue invalid. try again later.")
            return

        money = Decimal(portion) * Decimal(str(netvalue))
        earned = money - Decimal(cost)
        return_percent = earned / Decimal(cost)
        max_value_to_sell = round(netvalue * (1.0 - float(fg.short_term_rate)), 4)
        self.sqldb.update(self.sell_table, {column_money_sold:str(money), column_earned : str(earned), column_return_percentage : str(return_percent), column_roll_in_value:str(max_value_to_sell)}, {column_date:date})

        self.fix_cost_portion_hold()

    def sell_by_dates(self, date, buydates):
        self.add_sell_rec(date, buydates)
        self.confirm_sell_rec(date)

    def confirm_buy_sell(self):
        if self.sqldb.isExistTable(self.buy_table):
            buy_rec = self.sqldb.select(self.buy_table, [column_date], ["%s > 0" % column_cost, "%s is NULL" %column_portion, "%s = 0" % column_soldout])
            if buy_rec:
                for d, in buy_rec:
                    self.confirm_buy_rec(d)

        if self.sqldb.isExistTable(self.sell_table):
            sell_rec = self.sqldb.select(self.sell_table, [column_date], ["%s > 0" % column_cost_sold, "%s is NULL" %column_money_sold])
            if sell_rec:
                for d, in sell_rec:
                    self.confirm_sell_rec(d)

    def update_history(self):
        fh = FundHistoryDataDownloader(self.sqldb)
        fh.fundHistoryTillToday(self.code)
        self.confirm_buy_sell()

    def ever_hold(self):
        return self.sqldb.isExistTable(self.buy_table)

    def still_hold(self):
        if self.cost_hold and self.average:
            return True

        if not self.sqldb.isExistTable(self.buy_table):
            return False

        buy_sum =self.sqldb.select(self.buy_table, ["sum(%s)" % column_cost, "sum(%s)" % column_portion], "%s = 0" % column_soldout)
        if buy_sum:
            (cost, portion), = buy_sum
            average = 0
            if not cost:
                cost = 0
            if not portion:
                portion = 0

            if portion:
                average = (Decimal(str(cost))/Decimal(str(portion))).quantize(Decimal("0.0000")) if not portion == 0 else 0
            self.sqldb.update(self.funds_table, {column_cost_hold:str(cost), column_portion_hold:str(portion), column_averagae_price:str(average)}, {column_code: self.code})
        return True

    def get_fund_summary(self):
        fund_json_obj = {}
        fg = FundGeneral(self.sqldb, self.code)
        ppg = 1 if not ppgram.__contains__(self.code) else ppgram[self.code]

        fund_json_obj["name"] = fg.name
        fund_json_obj["ppg"] = ppg
        fund_json_obj["str"] = fg.short_term_rate # short_term_rate
        fund_json_obj["cost"] = self.cost_hold
        fund_json_obj["avp"] = self.average # average price
        fund_json_obj["lnv"] = fg.latest_netvalue() # latest_netvalue
        fund_json_obj["lde"] = self.last_day_earned(fg.history_table) # last_day_earned
        fund_json_obj["ewh"] = round((float(fg.latest_netvalue()) - float(self.average)) * float(self.portion_hold), 2) # earned_while_holding

        if fg.index_code:
            fund_json_obj["ic"] = 'sz' + fg.index_code # index_code
            ig = IndexGeneral(self.sqldb, fg.index_code)
            fund_json_obj["in"] = ig.name

        return fund_json_obj

    def update_tracking_index(self, index_code):
        af = AllFunds(self.sqldb)
        af.updateTrackIndex(self.code, index_code)

    def track_index_empty(self):
        tc = self.sqldb.select(gl_all_funds_info_table, [column_tracking_index], "%s = '%s'" % (column_code, self.code))
        if tc:
            (tc,), = tc
            return not tc
        return True

    def get_holding_stats(self):
        fund_stats_obj = {}
        fg = FundGeneral(self.sqldb, self.code)

        fund_stats_obj["name"] = fg.name
        fund_stats_obj["cost"] = self.cost_hold
        fund_stats_obj["ewh"] = round((float(fg.latest_netvalue()) - float(self.average)) * float(self.portion_hold), 2)
        sell_recs = self.sqldb.select(self.sell_table, [column_date, column_portion, column_money_sold, column_cost_sold, column_actual_sold], order = " ORDER BY %s ASC" % column_date)
        buy_recs = self.sqldb.select(self.buy_table, [column_date, column_cost, column_portion], order = " ORDER BY %s ASC" % column_date)

        cost_sold = 0;
        actual_sold = 0;
        if not sell_recs:
            fund_stats_obj["cs"] = cost_sold
            fund_stats_obj["acs"] = actual_sold
            fund_stats_obj['hds'] = (datetime.now() - datetime.strptime(buy_recs[0][0], "%Y-%m-%d")).days if sell_recs else 0
            return fund_stats_obj
            
        for (d, p, m, c, a) in sell_recs:
            cost_sold += c
            acs = float(a)
            actual_sold += acs
            if acs == 0:
                actual_sold += (m if m else 0)
        fund_stats_obj["cs"] = cost_sold
        fund_stats_obj["acs"] = actual_sold

        day_num = 0;
        cur_portion = 0;
        bIdx = 0
        start_buy_date = buy_recs[bIdx][0]
        for i in range(0, len(sell_recs)):
            for j in range(bIdx, len(buy_recs)):
                if buy_recs[j][0] < sell_recs[i][0]:
                    cur_portion += buy_recs[j][2]
                else:
                    bIdx = j
                    break;
            cur_portion -= (sell_recs[i][1] if sell_recs[i][1] else 0)
            if cur_portion < 100:
                day_num += (datetime.strptime(sell_recs[i][0], "%Y-%m-%d") - datetime.strptime(start_buy_date, "%Y-%m-%d")).days
                if bIdx < len(buy_recs):
                    start_buy_date = buy_recs[bIdx][0]
        if cur_portion > 100:
            day_num += (datetime.now() - datetime.strptime(start_buy_date, "%Y-%m-%d")).days

        fund_stats_obj['hds'] = day_num # hold days

        return fund_stats_obj
        