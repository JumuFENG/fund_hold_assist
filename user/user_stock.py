# Python 3
# -*- coding:utf-8 -*-

from phon.hu.hu import DateConverter
from datetime import datetime, timedelta
from decimal import Decimal
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

        self.buy_table = f'u{user.id}_{self.code}_buy'
        self.sell_table = f'u{user.id}_{self.code}_sell'
        self.unknown_deals_table = user.stocks_unknown_deals_table()

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
            attrs = {
                column_date:'varchar(20) DEFAULT NULL',
                column_portion:'int DEFAULT NULL',
                column_price:'double(16,4) DEFAULT NULL',
                column_cost:'double(16,2) DEFAULT NULL',
                column_soldout:'tinyint(1) DEFAULT 0'
            }
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.buy_table, attrs, constraint)

        self.check_table_column(self.buy_table, column_soldout, 'tinyint(1) DEFAULT 0')
        self.check_table_column(self.buy_table, column_sold_portion, 'int DEFAULT 0')
        self.check_table_column(self.buy_table, '委托编号', 'varchar(10) DEFAULT NULL')
        self.check_table_column(self.buy_table, column_fee, 'double(8,2) DEFAULT NULL')
        self.check_table_column(self.buy_table, '印花税', 'double(8,2) DEFAULT NULL')
        self.check_table_column(self.buy_table, '过户费', 'double(8,2) DEFAULT NULL')

    def setup_selltable(self):
        if not self.sqldb.isExistTable(self.sell_table):
            attrs = {
                column_date:'varchar(20) DEFAULT NULL',
                column_portion:'int DEFAULT NULL',
                column_price:'double(16,4) DEFAULT NULL',
                column_money_sold:'double(16,2) DEFAULT NULL',
                column_cost_sold:'double(16,2) DEFAULT NULL',
                column_earned:'double(16,2) DEFAULT NULL',
                column_return_percentage:'double(8,6) DEFAULT NULL'
            }
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.sell_table, attrs, constraint)

        self.check_table_column(self.sell_table, column_rolled_in, 'int DEFAULT NULL')
        self.check_table_column(self.sell_table, column_roll_in_value, 'double(16,4) DEFAULT NULL')
        self.check_table_column(self.sell_table, '委托编号', 'varchar(10) DEFAULT NULL')
        self.check_table_column(self.sell_table, column_fee, 'double(8,2) DEFAULT NULL')
        self.check_table_column(self.sell_table, '印花税', 'double(8,2) DEFAULT NULL')
        self.check_table_column(self.sell_table, '过户费', 'double(8,2) DEFAULT NULL')

    def check_exist_in_allstocks(self):
        stocks = AllStocks()
        sg = StockGlobal.stock_general(self.code)
        if not sg.name:
            stocks.loadInfo(self.code)

    def _fix_buy_sell_portion(self, buys, sells):
        if buys is None and sells is None:
            return

        sells = None if sells is None else list(sells)
        buycount = 0
        sellcount = 0
        if buys is not None:
            for bid, bdate, bprice, bportion, bsoldportion, bcost in buys:
                buycount += (bportion - bsoldportion)
        if sells is not None:
            for sid, sdate, sprice, sportion, smoney in sells:
                sellcount += sportion
        if sellcount > buycount:
            newinfo = {column_portion_hold:str(buycount - sellcount), column_keepeyeon:1}
            self.sqldb.update(self.stocks_table, newinfo, {column_code: self.code})
            return

        portion = Decimal(0)
        cost = Decimal(0)
        remsell = None
        soldcost = 0
        for (bid, bdate, bprice, bportion, bsoldportion, bcost) in buys:
            if bcost is None:
                binfo = {column_cost: Decimal(str(bprice * bportion))}
                self.sqldb.update(self.buy_table, binfo, {'id':f'{bid}'})

            rembportion = bportion - bsoldportion
            while rembportion > 0:
                if remsell is None or remsell[3] == 0:
                    if remsell is not None and soldcost > 0:
                        sinfo = self._get_sell_info({column_cost_sold: str(Decimal(soldcost)), column_money_sold:remsell[4]})
                        self.sqldb.update(self.sell_table, sinfo, {'id':f'{remsell[0]}'})
                    soldcost = 0
                    if sells is None or len(sells) == 0:
                        break
                    remsell = list(sells.pop(0))
                    (sid, sdate, sprice, sportion, smoney) = remsell
                    remsell[4] = Decimal(sprice) * Decimal(sportion)

                (sid, sdate, sprice, sportion, smoney) = remsell
                if sportion >= rembportion:
                    binfo = {column_sold_portion: str(bportion), column_soldout:'1'}
                    self.sqldb.update(self.buy_table, binfo, {'id':f'{bid}'})
                    if sportion == rembportion:
                        remsell[3] = 0
                    else:
                        remsell = list(remsell)
                        remsell[3] = sportion - rembportion
                    soldcost += (rembportion * bprice)
                    rembportion -= sportion
                    break
                else:
                    remsell[3] = 0
                    soldcost += (sportion * bprice)
                    rembportion -= sportion

            if rembportion > 0:
                if bportion > rembportion:
                    binfo = {column_sold_portion: str(bportion - rembportion)}
                    self.sqldb.update(self.buy_table, binfo, {'id':f'{bid}'})

                portion += rembportion
                cost += Decimal(rembportion * bprice)

        if remsell is not None and remsell[3] == 0 and soldcost > 0:
            sinfo = self._get_sell_info({column_cost_sold: str(Decimal(soldcost)), column_money_sold: remsell[4]})
            self.sqldb.update(self.sell_table, sinfo, {'id':f'{remsell[0]}'})
            soldcost = 0
        if remsell is not None and remsell[3] > 0:
            portion -= remsell[3]
        if sells is not None:
            for sr in sells:
                portion -= sr[3]
                cost -= Decimal(sr[2] * sr[3])

        average = (cost/portion).quantize(Decimal("0.0000")) if not portion == 0 else 0
        newinfo = {column_cost_hold:str(cost), column_portion_hold:str(portion), column_averagae_price:str(average)}
        if portion != 0:
            newinfo[column_keepeyeon] = '1'

        self.sqldb.update(self.stocks_table, newinfo, {column_code: self.code})

    def fix_cost_portion_hold(self):
        if not self.sqldb.isExistTable(self.buy_table):
            print("UserStock.fix_cost_portion_hold", self.buy_table, "not exists.")
            return

        buy_rec = self.sqldb.select(self.buy_table, ['id', column_date, column_price, column_portion, column_sold_portion, column_cost])
        if buy_rec is None or len(buy_rec) == 0:
            return

        sell_rec = None
        if self.sqldb.isExistTable(self.sell_table):
            sell_rec = self.sqldb.select(self.sell_table, ['id', column_date, column_price, column_portion, column_money_sold])

        self._fix_buy_sell_portion(buy_rec, sell_rec)

    def update_rollin(self, portion, rid):
        rolled_in = self.sqldb.select(self.sell_table, [column_portion, column_rolled_in, column_roll_in_value], "id = '%s'" % str(rid))
        if rolled_in:
            (p_s, rolled_in, r_v), = rolled_in
        if not rolled_in:
            rolled_in = 0

        sg = StockGlobal.stock_general(self.code)
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
        (i, nb[column_date], nb[column_portion], nb[column_price], nb[column_cost], s, sp, sid, sxf, yh, gh), = buy_rec
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

        sg = StockGlobal(self.code)

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

    def _get_sell_info(self, ns):
        ns[column_earned] = float(ns[column_money_sold]) - float(ns[column_cost_sold])
        ns[column_return_percentage] = float(ns[column_earned]) / float(ns[column_cost_sold])
        return ns

    def fix_sell(self, id, price, portion = None, cost = None, date = None):
        if not self.sqldb.isExistTable(self.sell_table):
            return

        sell_rec = self.sqldb.select(self.sell_table, ['id', column_date, column_price, column_portion, column_money_sold, column_cost_sold], conds = "id = '%s'" % str(id))
        if not sell_rec:
            print("no sell record found, use UserStock.sell() instead.")
            return
        ns = {}
        (_, ns[column_date], ns[column_price], ns[column_portion], _, ns[column_cost_sold]), = sell_rec
        if price:
            ns[column_price] = price
        if portion:
            ns[column_portion] = portion
        if cost:
            ns[column_cost_sold] = cost
        if date:
            ns[column_date] = date
        ns[column_money_sold] = int(ns[column_portion]) * float(ns[column_price]) * (1 - float(self.fee))
        ns = self._get_sell_info(ns)

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
        sg = StockGlobal.stock_general(self.code)

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
        dtoday = datetime.now().strftime("%Y-%m-%d")
        for (i,d,p,pr,c,s,sp,sid,sxf,yh,gh) in buy_rec:
            if d == dtoday or s == 0:
                values.append({'id':i, 'date': DateConverter.days_since_2000(d), 'price':pr, 'cost':c, 'ptn': p - sp, 'sold': s})
        return values

    def get_sell_arr(self):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return []

        values = []
        sg = StockGlobal.stock_general(self.code)
        sell_rec = self.sqldb.select(self.sell_table, '*')
        for (i, d, p, pr, m, c, e, per, r, np, sid, sxf, yh, gh) in sell_rec:
            if not r:
                r = 0
            to_rollin = p - r
            max_price_to_buy = np if np else None
            if to_rollin > 0 and not max_price_to_buy:
                max_price_to_buy = round(pr * (1 - sg.short_term_rate), 4)
            fee = 0 if sxf is None else sxf
            fee += 0 if yh is None else yh
            fee += 0 if gh is None else gh
            values.append({'id':i, 'date': DateConverter.days_since_2000(d), 'price':pr, 'ptn': p, 'cost': c})
        return values

    def sell_earned_by_day(self, buys, sells):
        rembuy = None
        earndic = {}
        for s in sells:
            if s['date'] not in earndic:
                earndic[s['date']] = 0

            remsold = s['ptn']
            earned = s['ptn'] * s['price'] - s['fee']
            while remsold > 0:
                if rembuy is None or rembuy['ptn'] == 0:
                    if len(buys) == 0:
                        earned = 0
                        break
                    rembuy = buys.pop(0)
                if remsold >= rembuy['ptn']:
                    earned -= rembuy['fee']
                    earned -= rembuy['ptn'] * rembuy['price']
                    remsold -= rembuy['ptn']
                    rembuy = None
                else:
                    earned -= remsold * rembuy['price']
                    rembuy['ptn'] -= remsold
                    remsold = 0
                if remsold == 0:
                    earndic[s['date']] += earned
        return earndic

    def get_sell_earned_after(self, date):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return None

        if not self.buy_table or not self.sqldb.isExistTable(self.buy_table):
            return None

        date = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        sell_rec = self.sqldb.select(self.sell_table, [column_date, column_portion, column_price, column_fee, '印花税', '过户费'], f'{column_date} > "{date}"')
        if sell_rec is None or len(sell_rec) == 0:
            return None

        sells = []
        for (d, p, pr, sxf, yh, gh) in sell_rec:
            if (d < date):
                continue
            fee = 0 if sxf is None else sxf
            fee += 0 if yh is None else yh
            fee += 0 if gh is None else gh
            sells.append({'date': DateConverter.days_since_2000(d), 'price':pr, 'ptn': p, 'fee': fee})

        if len(sells) == 0:
            return None

        buy_rec = self.sqldb.select(self.buy_table, [column_date, column_portion, column_price, column_sold_portion, column_fee, '印花税', '过户费'], f'{column_soldout} = 0')
        buys = []
        for (d,p,pr,sp,sxf,yh,gh) in buy_rec:
            fee = 0 if sxf is None else sxf
            fee += 0 if yh is None else yh
            fee += 0 if gh is None else gh
            buys.append({'date': DateConverter.days_since_2000(d), 'price':pr, 'ptn': p - sp, 'fee': fee})
        return self.sell_earned_by_day(buys, sells)

    def get_each_sell_earned(self):
        if not self.sell_table or not self.sqldb.isExistTable(self.sell_table):
            return None

        if not self.buy_table or not self.sqldb.isExistTable(self.buy_table):
            return None

        sells = []
        sell_rec = self.sqldb.select(self.sell_table, [column_date, column_portion, column_price, column_fee, '印花税', '过户费'])
        if sell_rec is None:
            return None

        for (d, p, pr, sxf, yh, gh) in sell_rec:
            fee = 0 if sxf is None else sxf
            fee += 0 if yh is None else yh
            fee += 0 if gh is None else gh
            sells.append({'date': DateConverter.days_since_2000(d), 'price':pr, 'ptn': p, 'fee': fee})

        buy_rec = self.sqldb.select(self.buy_table, [column_date, column_portion, column_price, column_fee, '印花税', '过户费'])
        buys = []
        for (d,p,pr,sxf,yh,gh) in buy_rec:
            fee = 0 if sxf is None else sxf
            fee += 0 if yh is None else yh
            fee += 0 if gh is None else gh
            buys.append({'date': DateConverter.days_since_2000(d), 'price':pr, 'ptn': p, 'fee': fee})
        return self.sell_earned_by_day(buys, sells)

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
        sg = StockGlobal.stock_general(self.code)

        stock_stats_obj["name"] = sg.name
        stock_stats_obj["cost"] = self.cost_hold
        stock_stats_obj['ptn'] = self.portion_hold
        
        sell_recs = self.sqldb.select(self.sell_table, [column_money_sold, column_cost_sold])
        stock_stats_obj["cs"] = self.get_cost_sold_stats(sell_recs)
        stock_stats_obj["ms"] = self.get_money_sold_stats(sell_recs)
        stock_stats_obj['srct'] = (len(sell_recs) if sell_recs else 0) + (1 if self.cost_hold > 0 else 0) # sell record count

        return stock_stats_obj

    def get_sold_earned(self):
        if not self.sqldb.isExistTable(self.sell_table):
            return 0

        se = self.get_each_sell_earned()
        if se is None:
            print(self.sell_table, 'no se data')
            return 0

        sum_earn = 0
        for v in se.values():
            sum_earn += v
        return sum_earn

    def _add_or_update_deals(self, buy_table, values):
        attrs = [column_date, '委托编号', column_price, column_portion, column_fee, '印花税', '过户费']

        nvalues = []
        for val in values:
            odls = None
            if val[1] == '0':
                dealtime = val[0].partition(' ')[0]
                val[0] = dealtime
                odls = self.sqldb.select(buy_table, ['id', column_date], f'{column_date}="{dealtime}"')
            else:
                odls = self.sqldb.select(buy_table, ['id', column_date], f'委托编号="{val[1]}"')
            if odls is None or len(odls) == 0:
                nvalues.append(val)
            else:
                updated = False
                for id, date in odls:
                    if date.split()[0] == val[0].split()[0]:
                        atrdic = {
                            column_date: (val[0].partition(' ')[0] if val[1] == '0' else val[0]), '委托编号': val[1], column_price: val[2], column_portion: val[3],
                            column_fee: val[4], '印花税': val[5], '过户费': val[6]
                        }
                        self.sqldb.update(buy_table, atrdic, {'id':id})
                        updated = True
                        break
                if not updated:
                    nvalues.append(val)

        if len(nvalues) > 0:
            self.sqldb.insertMany(buy_table, attrs, nvalues)

    def add_deals(self, deals):
        bvalues = []
        svalues = []
        for deal in deals:
            if deal['tradeType'] == 'B':
                bvalues.append(
                    [deal['time'], deal['sid'], deal['price'], deal['count'],
                    deal['fee'] if 'fee' in deal else '0',
                    deal['feeYh'] if 'feeYh' in deal else '0',
                    deal['feeGh'] if 'feeYh' in deal else '0'
                ])
            else:
                svalues.append(
                    [deal['time'], deal['sid'], deal['price'], deal['count'],
                    deal['fee'] if 'fee' in deal else '0',
                    deal['feeYh'] if 'feeYh' in deal else '0',
                    deal['feeGh'] if 'feeYh' in deal else '0'
                ])

        if len(bvalues) > 0:
            if not self.sqldb.isExistTable(self.buy_table):
                self.setup_buytable()

            self._add_or_update_deals(self.buy_table, bvalues)

        if len(svalues) > 0:
            if not self.sqldb.isExistTable(self.sell_table):
                self.setup_selltable()

            self._add_or_update_deals(self.sell_table, svalues)

        buy_rec = self.sqldb.select(self.buy_table, ['id', column_date, column_price, column_portion, column_sold_portion, column_cost], f'{column_soldout} = 0')
        # if buy_rec is None or len(buy_rec) == 0:
        #     return

        sell_rec = None
        if self.sqldb.isExistTable(self.sell_table):
            sell_rec = self.sqldb.select(self.sell_table, ['id', column_date, column_price, column_portion, column_money_sold], f'{column_cost_sold} is NULL')

        self._fix_buy_sell_portion(buy_rec, sell_rec)

    def fix_buy_deal(self, deal, count):
        # deal: to be fixed deal
        # count: archived count
        soldptn = 0
        if not self.sqldb.isExistTable(self.buy_table):
            if int(deal['count']) == count:
                return
            self.setup_buytable()
        else:
            od = self.sqldb.select(self.buy_table, f'{column_portion},{column_sold_portion}', conds=f'''委托编号="{deal['sid']}"''')
            if od is None or len(od) == 0:
                if int(deal['count']) == count:
                    return
            if len(od) == 1:
                (ptn,soldptn),= od
                if ptn == int(deal['count']) - count:
                    return
            if len(od) > 1:
                raise Exception(f'more than one deals found: 委托编号={deal["sid"]}')

        ad = self.sqldb.select(self.buy_table, conds=f'''委托编号="{deal['sid']}"''')
        dealfix = {
            column_date: deal['time'],
            column_price: deal['price'],
            column_portion: int(deal['count']) - count,
            column_cost: str(float(deal['price']) * float(deal['count'])),
            column_soldout:'0',
            column_sold_portion:str(soldptn),
            '委托编号': deal['sid'],
            column_fee: deal['fee'] if 'fee' in deal else '0',
            '印花税': deal['feeYh'] if 'feeYh' in deal else '0',
            '过户费': deal['feeGh'] if 'feeYh' in deal else '0'
        }

        if ad is None or len(ad) == 0:
            self.sqldb.insert(self.buy_table, dealfix)
        else:
            self.sqldb.update(self.buy_table, dealfix, {'委托编号':deal['sid']})

    def sort_buysell(self):
        if self.sqldb.isExistTable(self.buy_table):
            self.sqldb.sortTable(self.buy_table, column_date)
        if self.sqldb.isExistTable(self.sell_table):
            self.sqldb.sortTable(self.sell_table, column_date)

    def deals_before(self, date):
        '''
        获取卖出日期早于date的所有卖出记录以及对应的买入记录
        '''
        if not self.sqldb.isExistTable(self.sell_table):
            return ()

        sell_rec = self.sqldb.select(self.sell_table, ['id', column_date, column_portion, column_price, column_fee, '印花税', '过户费', '委托编号'], f'{column_date} < "{date}"')
        if sell_rec is None or len(sell_rec) == 0:
            return ()

        if not self.sqldb.isExistTable(self.buy_table):
            buy_rec = self.sqldb.select(self.unknown_deals_table, ['id', column_date, '委托编号', column_price, column_portion, column_fee, '印花税', '过户费'], [f'{column_date} < "{date}"', f'{column_code}="{self.code}"'])
            self.setup_buytable()
            bvalues = []
            for br in buy_rec:
                bvalues.append(br[1:])
            if len(bvalues) > 0:
                self._add_or_update_deals(self.buy_table, bvalues)
            for uid, *_ in buy_rec:
                self.sqldb.delete(self.unknown_deals_table, f'id="{uid}"')
        buy_rec = self.sqldb.select(self.buy_table, ['id', column_date, column_portion, column_price, column_fee, '印花税', '过户费', '委托编号', column_sold_portion], f'{column_date} < "{date}"')
        buy_rec = list(buy_rec)
        consumed = ()
        rembuy = None
        bportion = 0
        delbuy = []
        for srec in sell_rec:
            consumed += (self.code, srec[1], 'S', srec[2], srec[3], srec[4], srec[5], srec[6], srec[7]),
            self.sqldb.delete(self.sell_table, {'id': srec[0]})
            sportion = srec[2]
            while sportion > 0:
                if bportion == 0:
                    if rembuy is not None:
                        consumed += (self.code, rembuy[1], 'B', rembuy[2], rembuy[3], rembuy[4], rembuy[5], rembuy[6], rembuy[7]),
                        delbuy.append(rembuy[0])
                    rembuy = buy_rec.pop(0)
                    bportion = rembuy[2]
                if bportion <= sportion:
                    sportion -= bportion
                    bportion = 0
                    consumed += (self.code, rembuy[1], 'B', rembuy[2], rembuy[3], rembuy[4], rembuy[5], rembuy[6], rembuy[7]),
                    delbuy.append(rembuy[0])
                    rembuy = None
                else:
                    bportion -= sportion
                    sportion = 0

        if rembuy is not None:
            if bportion > 0:
                consumed += (self.code, rembuy[1], 'B', rembuy[2] - bportion, rembuy[3], rembuy[4], rembuy[5], rembuy[6], rembuy[7]),
                self.sqldb.update(self.buy_table, {column_portion: bportion, column_sold_portion: rembuy[8] - rembuy[2] + bportion}, {'id': rembuy[0]})
        for d in delbuy:
            self.sqldb.delete(self.buy_table, {'id': d})

        return consumed

    def remove_empty_table(self):
        if self.sqldb.isExistTable(self.buy_table):
            bt = self.sqldb.select(self.buy_table)
            if bt is None or len(bt) == 0:
                self.sqldb.dropTable(self.buy_table)
        if self.sqldb.isExistTable(self.sell_table):
            st = self.sqldb.select(self.sell_table)
            if st is None or len(st) == 0:
                self.sqldb.dropTable(self.sell_table)
