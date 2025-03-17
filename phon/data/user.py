# Python 3
# -*- coding:utf-8 -*-

import json
from decimal import Decimal
from peewee import fn
from phon.hu.hu import DateConverter, datetime, timedelta
from phon.data.tables import User as UserDb
from phon.data.tables import UserFunds, UserStocks, UserEarned, UserEarning, UserDeals, UserStockBuy, UserStockSell
from phon.data.tables import AllStocks, UserStrategy, UserOrders
from phon.data.db import create_model, read_context, write_context, insert_or_update


class lazy_property:
    def __init__(self, func):
        self.func = func
        self.name = None

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        target = owner if instance is None else instance
        name = self.func.__name__ if self.name is None else self.name
        cache_name = f"_{name}_cached" if instance is None else f"_{name}_cached_{id(instance)}"
        if hasattr(target, cache_name):
            return getattr(target, cache_name)

        # 缓存值
        value = self.func(target)
        setattr(target, cache_name, value)
        return value


class User:
    @classmethod
    @lazy_property
    def db(cls):
        return create_model(UserDb)

    @classmethod
    @lazy_property
    def all_stocks(cls):
        return create_model(AllStocks)

    @classmethod
    def add_user(cls, name, password, email):
        with write_context(cls.db):
            u = cls.db.create(name=name, password=password, email=email)
        return cls.from_dict(**u)

    @classmethod
    def user_by_id(cls, id):
        with read_context(cls.db):
            u = cls.db.get_or_none(cls.db.id == id)
        return cls.from_dict(u.__data__) if u is not None else None

    @classmethod
    def user_by_email(cls, email):
        with read_context(cls.db):
            u = cls.db.get_or_none(cls.db.email == email)
        return cls.from_dict(u.__data__) if u is not None else None

    @classmethod
    def all_users(cls):
        with read_context(cls.db):
            ul = list(cls.db.select())
        return [cls.from_dict(u.__data__) for u in ul]

    @classmethod
    def get_parent(self, email):
        user = self.user_by_email(email)
        if user.parent:
            u = self.user_by_id(user.parent)
            return self.from_dict(u.__data__) if u is not None else None
        return None

    @classmethod
    def from_dict(self, data):
        return User(**data)

    @classmethod
    def is_exist_in_allstocks(self, code):
        with read_context(self.all_stocks):
            e = self.all_stocks.select().where(self.all_stocks.code == code).exists()
        return e

    def __init__(self, id, name, email, password=None, parent_account = None, realcash=None):
        self.id = id
        self.name = name
        self.email = email
        self.password = password
        self.parent = parent_account
        self.realcash = realcash

    @lazy_property
    def funds_info_table(self):
        return create_model(UserFunds, f'u{self.id}_funds')

    @lazy_property
    def stocks_info_table(self):
        return create_model(UserStocks, f'u{self.id}_stocks')

    @lazy_property
    def stock_strategy_table(self):
        return create_model(UserStrategy, f'u{self.id}_strategy')

    @lazy_property
    def stock_order_table(self):
        return create_model(UserOrders, f'u{self.id}_orders')

    @lazy_property
    def stock_fullorder_table(self):
        return create_model(UserOrders, f'u{self.id}_fullorders')

    @lazy_property
    def stocks_earned_table(self):
        return create_model(UserEarned, f'u{self.id}_earned')

    @lazy_property
    def stocks_earning_table(self):
        return create_model(UserEarning, f'u{self.id}_earning')

    @lazy_property
    def unknown_deals_table(self):
        return create_model(UserDeals, f'u{self.id}_unknown_deals')

    @lazy_property
    def archived_deals(self):
        return create_model(UserDeals, f'u{self.id}_archived_deals')

    @lazy_property
    def buy_table(self):
        return create_model(UserStockBuy, f'u{self.id}_buy')

    @lazy_property
    def sell_table(self):
        return create_model(UserStockSell, f'u{self.id}_sell')

    def is_admin(self):
        return self.id == 11

    def to_string(self):
        return f'id: {self.id} name: {self.name} email: {self.email}'

    def set_password(self, password):
        self.password = password
        with write_context(self.db):
            self.db.update(password=password).where(self.db.id == self.id).execute()

    def check_password(self, password):
        return password == self.password

    def get_bind_accounts(self):
        with read_context(self.db):
            slvs = list(self.db.select().where(self.db.parent_account == self.id))
        return [self.from_dict(s.__data__) for s in slvs]

    def get_all_combined_users(self):
        users = []
        if self.parent:
            with read_context(self.db):
                u = self.db.get(self.db.id == self.parent)
            parent = self.from_dict(u.__data__)
            subs = parent.get_bind_accounts()
            return [parent] + subs

        users.append(self)
        subs = self.get_bind_accounts()
        return users + subs

    def is_combined(self, u1):
        if self.id == u1.id:
            return True

        if self.parent is None and u1.parent is None:
            return False

        if self.parent is None:
            return u1.parent == self.id

        if u1.parent is None:
            return self.parent == u1.id

        return self.parent == u1.parent

    def bind_account(self, sid):
        with write_context(self.db):
            self.db.update(parent_account = self.id).where(self.db.id == sid).execute()

    def sub_account(self, acc, autocreate=False):
        if acc == 'normal':
            return self

        realcashs = ['collat', 'credit']
        fake_email = f'{acc}@{self.name}_{self.id}'
        subuser = self.user_by_email(fake_email)
        if subuser:
            return subuser

        if autocreate:
            with write_context(self.db):
                subuser = self.db.create(**{
                    self.db.name.name: acc,
                    self.db.password.name:'sub123',
                    self.db.email.name:fake_email,
                    self.db.parent_account.name: self.id,
                    self.db.realcash.name: 1 if acc in realcashs else 0
                })

            return self.from_dict(**subuser.__data__)

    def forget_stock(self, code):
        with write_context(self.stocks_info_table):
            self.stocks_info_table.update(keep_eye = 0).where(self.stocks_info_table.code == code).execute()

    def forget_stocks(self):
        with write_context(self.stocks_info_table):
            self.stocks_info_table.update(keep_eye = 0).where(self.stocks_info_table.portion_hold == 0, self.stocks_info_table.keep_eye == 1).execute()

    def get_stock_summary(self, code):
        stock_json_obj = {}
        with read_context(self.all_stocks):
            sg = self.all_stocks.get_or_none(self.all_stocks.code == code)

        with read_context(self.stocks_info_table):
            si = self.stocks_info_table.get_or_none(self.stocks_info_table, self.stocks_info_table.code == code)

        if not si or not sg:
            return stock_json_obj

        short_term_rate = 0.02
        stock_json_obj["name"] = sg.name
        stock_json_obj["str"] = short_term_rate
        stock_json_obj["bgr"] = short_term_rate
        stock_json_obj["sgr"] = short_term_rate
        stock_json_obj["cost"] = si.cost_hold
        stock_json_obj["ptn"] = si.portion_hold # portion
        stock_json_obj["avp"] = si.aver_price # average price
        stock_json_obj["fee"] = si.手续费

        return stock_json_obj

    def get_buy_arr(self, code):
        with read_context(self.buy_table):
            buy_rec = list(self.buy_table.select().where(self.buy_table.code == code))
        values = []
        dtoday = datetime.now().strftime("%Y-%m-%d")
        for br in buy_rec:
            if br.date == dtoday or br.soldout == 0:
                values.append({'id':br.id, 'date': DateConverter.days_since_2000(br.date), 'price':br.price, 'cost':br.cost, 'ptn': br.portion - br.soldptn, 'sold': br.soldout})
        return values

    def get_sell_arr(self, code):
        values = []
        short_term_rate = 0.02
        with read_context(self.sell_table):
            sell_rec = list(self.sell_table.select().where(self.sell_table.code == code))
        for sr in sell_rec:
            to_rollin = sr.portion - sr.rolled_in
            max_price_to_buy = sr.rollin_netvalue
            if to_rollin > 0 and not max_price_to_buy:
                max_price_to_buy = round(sr.price * (1 - short_term_rate), 4)
            fee = sr.手续费
            fee += sr.印花税
            fee += sr.过户费
            values.append({'id':sr.id, 'date': DateConverter.days_since_2000(sr.date), 'price':sr.price, 'ptn': sr.portion, 'cost': sr.cost})
        return values

    def _all_user_stocks(self):
        with read_context(self.stocks_info_table):
            us = list(self.stocks_info_table.select())
        return tuple([s.code for s in us])

    def _archived(self, deal):
        if 'fee' not in deal:
            return False

        dsid = '0' if deal['sid'] == '' else deal['sid']
        with read_context(self.archived_deals):
            ad = self.archived_deals.get_or_none(self.archived_deals.code==deal['code'], self.archived_deals.type==deal['tradeType'], self.archived_deals.委托编号==dsid)
        if ad is None:
            return False

        if dsid == '0' and ad.date.partition(' ')[0] != deal['time'].partition(' ')[0]:
            return False

        if ad.portion > int(deal['count']):
            raise Exception(f'Archived count > deal count, please check the database, table:{self.archived_deals}, {deal["code"]}, 委托编号={deal["sid"]}')
        us = UStock(self, ad.code)
        us.fix_buy_deal(deal, ad.portion)
        if ad.手续费 != float(deal['fee']) or ad.印花税 != float(deal['feeYh']) or ad.过户费 != float(deal['feeGh']) or ad.price != float(deal['price']):
            upfee = {'price': deal['price'], '手续费': deal['fee'], '印花税': deal['feeYh'], '过户费': deal['feeGh']}
            with write_context(self.archived_deals):
                self.archived_deals.update(**upfee).where(self.archived_deals.id == ad.id).execute()
        return True

    def add_deals(self, hdeals):
        cdeals = {}
        for deal in hdeals:
            if self._archived(deal):
                continue
            if deal['code'] in cdeals:
                cdeals[deal['code']]['deals'].append(deal)
            else :
                cdeals[deal['code']] = {'deals': []}
                cdeals[deal['code']]['deals'].append(deal)

        updatefee = False
        for k, v in cdeals.items():
            if not self.is_exist_in_allstocks(k):
                self.add_unknown_code_deal(v['deals'])
            else:
                deals = []
                udeals = []
                for deal in v['deals']:
                    if deal['tradeType'] == 'B' or deal['tradeType'] == 'S':
                        if deal['sid'] == '':
                            deal['sid'] = '0'
                        deals.append(deal)
                    else:
                        udeals.append(deal)
                if len(udeals) > 0:
                    self.add_unknown_code_deal(udeals)
                us = UStock(self, k)
                us.add_deals(deals)
                if not updatefee:
                    updatefee = len(deals) > 0 and 'fee' in deals[0]

        self.update_earned()
        if updatefee:
            self.forget_stocks()

    def remove_repeat_unknown_deals_配售缴款(self, existdeals, deal):
        id = 0
        code = deal['code']
        for edeal in existdeals:
            if edeal.date < deal['time']:
                continue
            if edeal.code[-6:] != deal['code'][-6:]:
                continue
            if edeal.委托编号 != '0' and edeal.委托编号 != deal['sid']:
                continue
            if len(edeal.code) > len(code):
                code = edeal.code
            if id == 0:
                id = edeal.id
            else:
                with write_context(self.unknown_deals_table):
                    edeal.delete_instance()

        if id == 0:
            for edeal in existdeals:
                if edeal.委托编号 == deal['sid']:
                    return
            dtype = 'B'
            with write_context(self.unknown_deals_table):
                self.unknown_deals_table.create(**{
                    self.unknown_deals_table.date.name: deal['time'],
                    self.unknown_deals_table.code.name: code,
                    self.unknown_deals_table.type.name: dtype,
                    self.unknown_deals_table.委托编号.name: deal['sid'],
                    self.unknown_deals_table.price.name: deal['price'],
                    self.unknown_deals_table.portion.name: deal['count'],
                    self.unknown_deals_table.手续费.name: deal['fee'],
                    self.unknown_deals_table.印花税.name: deal['feeYh'],
                    self.unknown_deals_table.过户费.name: deal['feeGh']
                })
        else:
            with write_context(self.unknown_deals_table):
                self.unknown_deals_table.update(code=code, 委托编号=deal['sid']).where(self.unknown_deals_table.id == id).execute()

    def remove_repeat_unknown_deals_新股入帐(self, existdeals, deal):
        id = 0
        code = deal['code']
        for edeal in existdeals:
            if edeal.date < deal['time']:
                continue
            if edeal.委托编号 != deal['sid']:
                continue
            if len(edeal.code) > len(code) and edeal.code[-6:] == deal['code']:
                code = edeal.code
            if id == 0:
                id = edeal.id
            else:
                with write_context(self.unknown_deals_table):
                    edeal.delete_instance()

        with write_context(self.unknown_deals_table):
            if id == 0:
                dtype = 'B'
                self.unknown_deals_table.create(**{
                    self.unknown_deals_table.date.name: deal['time'],
                    self.unknown_deals_table.code.name: code,
                    self.unknown_deals_table.type.name: dtype,
                    self.unknown_deals_table.委托编号.name: deal['sid'],
                    self.unknown_deals_table.price.name: deal['price'],
                    self.unknown_deals_table.portion.name: deal['count'],
                    self.unknown_deals_table.手续费.name: deal['fee'],
                    self.unknown_deals_table.印花税.name: deal['feeYh'],
                    self.unknown_deals_table.过户费.name: deal['feeGh']
                })
            else:
                self.unknown_deals_table.update(code=code, 委托编号=deal['sid']).where(self.unknown_deals_table.id == id).execute()

    def remove_repeat_unknown_deals_commontype(self, existdeals, deal):
        eid = 0
        sqldb = self.stock_center_db()
        # for id,date,code,type,sid,price,count,fee,fYh,fGh in existdeals:
        for edeal in existdeals:
            if edeal.date != deal['time']:
                continue
            if eid == 0:
                eid = edeal.id
            else:
                with write_context(self.unknown_deals_table):
                    edeal.delete_instance()

        with write_context(self.unknown_deals_table):
            if eid == 0:
                self.unknown_deals_table.create(**{
                    self.unknown_deals_table.date.name: deal['time'],
                    self.unknown_deals_table.code.name: deal['code'],
                    self.unknown_deals_table.type.name: deal['tradeType'],
                    self.unknown_deals_table.委托编号.name: deal['sid'],
                    self.unknown_deals_table.price.name: deal['price'],
                    self.unknown_deals_table.portion.name: deal['count'],
                    self.unknown_deals_table.手续费.name: deal['fee'],
                    self.unknown_deals_table.印花税.name: deal['feeYh'],
                    self.unknown_deals_table.过户费.name: deal['feeGh']
                })
            else:
                self.unknown_deals_table.update(code=deal['code'], 委托编号=deal['sid']).where(self.unknown_deals_table.id == id).execute()

    def add_unknown_code_deal(self, deals):
        '''
        无法识别的成交记录，新股新债...
        '''
        values = []
        commontype = ['利息归本', '银行转证券', '证券转银行', '红利入账', '扣税', '融资利息']
        for deal in deals:
            if 'fee' in deal:
                if deal['tradeType'] == '配售缴款':
                    with read_context(self.unknown_deals_table):
                        existdeals = list(self.unknown_deals_table.select().where(self.unknown_deals_table.委托编号 == 0))
                        existdeals += list(self.unknown_deals_table.select().where(self.unknown_deals_table.委托编号 == deal['sid']))
                    self.remove_repeat_unknown_deals_配售缴款(existdeals, deal)
                    continue
                if deal['tradeType'] == '新股入帐':
                    with read_context(self.unknown_deals_table):
                        existdeals = list(self.unknown_deals_table.select().where(self.unknown_deals_table.委托编号 == deal['sid']))
                    self.remove_repeat_unknown_deals_新股入帐(existdeals, deal)
                    continue
                if deal['tradeType'] in commontype:
                    with read_context(self.unknown_deals_table):
                        existdeals = list(self.unknown_deals_table.select().where(self.unknown_deals_table.date == deal['time']))
                    self.remove_repeat_unknown_deals_commontype(existdeals, deal)
                    continue
                if deal['tradeType'] == 'B' or deal['tradeType'] == 'S':
                    print('unknown deal', deal)
                values.append({
                    self.unknown_deals_table.date: deal['time'],
                    self.unknown_deals_table.code: deal['code'],
                    self.unknown_deals_table.type: deal['tradeType'],
                    self.unknown_deals_table.委托编号: deal['sid'],
                    self.unknown_deals_table.price: deal['price'],
                    self.unknown_deals_table.portion: deal['count'],
                    self.unknown_deals_table.手续费: deal['fee'],
                    self.unknown_deals_table.印花税: deal['feeYh'],
                    self.unknown_deals_table.过户费: deal['feeGh']
                })

        if len(values) > 0:
            with write_context(self.unknown_deals_table):
                self.unknown_deals_table.insert_many(values).execute()

    def update_earned(self):
        self.calc_earned()

    def calc_earned(self, date=None):
        '''
        从买卖成交记录计算历史收益详情
        '''
        codes = self._all_user_stocks()
        earndic = {}
        for c in codes:
            us = UStock(self, c)
            cearn = us.get_each_sell_earned() if date is None else us.get_sell_earned_after(date)
            if cearn is None:
                continue
            for k in cearn:
                if k in earndic:
                    earndic[k] += cearn[k]
                else:
                    earndic[k] = cearn[k]

        for k in sorted(earndic.keys()):
            self.set_earned(DateConverter.date_by_delta(k), earndic[k])

    def set_earned(self, date, earned):
        totalEarned = 0
        with read_context(self.stocks_earned_table):
            lastEarned = self.stocks_earned_table.select().order_by(self.stocks_earned_table.date.desc()).first()
        if lastEarned is None:
            return
        dt, ed, totalEarned = lastEarned.date, lastEarned.earned, lastEarned.total_earned
        if dt > date:
            print('can not set earned for date earlier than', dt)
            return
        if dt == date:
            print('earned already exists:', dt, ed, totalEarned)
            totalEarned += earned - ed
            print('update to:', earned, totalEarned)
            with write_context(self.stocks_earned_table):
                lastEarned.earned = earned
                lastEarned.total_earned = totalEarned
                lastEarned.save()
            return

        totalEarned += earned
        with write_context(self.stocks_earned_table):
            self.stocks_earned_table.create(**{
                self.stocks_earned_table.date.name: date,
                self.stocks_earned_table.earned.name: earned,
                self.stocks_earned_table.total_earned.name: totalEarned
            })

    def archive_deals(self, edate):
        codes = self._all_user_stocks()
        consumed = ()
        for c in codes:
            us = UStock(self, c)
            ucsmd = us.deals_before(edate)
            if len(ucsmd) > 0:
                consumed += ucsmd

        if len(consumed) > 0:
            self.add_to_archive_deals_table(consumed)

    def add_to_archive_deals_table(self, values):
        valdics = []  # 需要插入的记录
        with read_context(self.archived_deals):
            for code, date, type, portion, price, 手续费, 印花税, 过户费, 委托编号 in values:
                nval = {
                    'code': code, 'date': date, 'type': type, 'portion': portion, 'price': price,
                    '手续费': 手续费, '印花税': 印花税, '过户费': 过户费, '委托编号': 委托编号
                }
                existing_record = self.archived_deals.select().where(
                    (self.archived_deals.code == code) &
                    (self.archived_deals.date == date) &
                    (self.archived_deals.type == type) &
                    (self.archived_deals.委托编号 == 委托编号)
                ).first()
                if existing_record:
                    nval['portion'] = portion + existing_record.portion
                valdics.append(nval)
        insert_or_update(self.archived_deals, valdics, ['code', 'date', 'type', '委托编号'])


    def save_strategy(self, code, strdata):
        us = UStock(self, code)
        us.save_strategy(strdata)

    def load_strategy(self, code):
        us = UStock(self, code)
        return us.load_strategy()

    def remove_strategy(self, code):
        us = UStock(self, code)
        return us.remove_strategy()

class UStock():
    def __init__(self, user, code):
        self.code = code
        self.user = user

    @lazy_property
    def buy_table(self):
        return self.user.buy_table

    @lazy_property
    def sell_table(self):
        return self.user.sell_table

    @lazy_property
    def stocks_table(self):
        return self.user.stocks_info_table

    @lazy_property
    def udeals_table(self):
        return self.user.unknown_deals_table

    @lazy_property
    def strategy_table(self):
        return self.user.stock_strategy_table

    @lazy_property
    def order_table(self):
        return self.user.stock_order_table

    @lazy_property
    def fullorder_table(self):
        return self.user.stock_fullorder_table

    @lazy_property
    def fee(self):
        with read_context(self.stocks_table):
            f = self.stocks_table.get(UserStocks.code == self.code)
        return f.手续费

    @lazy_property
    def cost_hold(self):
        with read_context(self.stocks_table):
            f = self.stocks_table.get(UserStocks.code == self.code)
        return f.cost_hold

    @lazy_property
    def average(self):
        with read_context(self.stocks_table):
            f = self.stocks_table.get(UserStocks.code == self.code)
        return f.aver_price

    @lazy_property
    def ever_hold(self):
        with read_context(self.stocks_table):
            f = self.stocks_table.get(UserStocks.code == self.code)
        return len(f) > 0

    def _get_sell_info(self, sm):
        sm[self.sell_table.earned.name] = float(sm[self.sell_table.money_sold.name]) - float(sm[self.sell_table.cost_sold.name])
        sm[self.sell_table.return_percent.name] = sm[self.sell_table.earned.name] / float(sm[self.sell_table.cost_sold.name])
        return sm

    def _fix_buy_sell_portion(self, buys, sells):
        if len(buys) == 0 and len(sells) == 0:
            return

        buycount = 0
        sellcount = 0
        if buys is not None:
            for bid, bdate, bprice, bportion, bsoldportion, bcost in buys:
                buycount += (bportion - bsoldportion)
        if sells is not None:
            for sid, sdate, sprice, sportion, smoney in sells:
                sellcount += sportion
        if sellcount > buycount:
            with write_context(self.stocks_table):
                self.stocks_table.update(portion_hold=buycount - sellcount, keep_eye=1).where(self.stocks_table.code == self.code).execute()
            return

        portion = Decimal(0)
        cost = Decimal(0)
        remsell = None
        soldcost = 0
        for (bid, bdate, bprice, bportion, bsoldportion, bcost) in buys:
            if bcost is None:
                with write_context(self.buy_table):
                    self.buy_table.update(cost = bprice * bportion).where(self.buy_table.id == bid, self.buy_table.code == self.code).execute()

            rembportion = bportion - bsoldportion
            while rembportion > 0:
                if remsell is None or remsell[3] == 0:
                    if remsell is not None and soldcost > 0:
                        sinfo = self._get_sell_info({self.sell_table.cost_sold.name: soldcost, self.sell_table.money_sold.name: remsell[4]})
                        with write_context(self.sell_table):
                            self.sell_table.update(**sinfo).where(self.sell_table.id == remsell[0], self.sell_table.code == self.code).execute()
                    soldcost = 0
                    if sells is None or len(sells) == 0:
                        break
                    remsell = list(sells.pop(0))
                    (sid, sdate, sprice, sportion, smoney) = remsell
                    remsell[4] = Decimal(sprice) * Decimal(sportion)

                (sid, sdate, sprice, sportion, smoney) = remsell
                if sportion >= rembportion:
                    with write_context(self.buy_table):
                        self.buy_table.update(soldptn=bportion, soldout=1).where(self.buy_table.id == bid, self.buy_table.code == self.code).execute()
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
                    with write_context(self.buy_table):
                        self.buy_table.update(soldptn=bportion - rembportion).where(self.buy_table.id == bid, self.buy_table.code == self.code).execute()

                portion += rembportion
                cost += Decimal(rembportion * bprice)

        if remsell is not None and remsell[3] == 0 and soldcost > 0:
            sinfo = self._get_sell_info({self.sell_table.cost_sold.name: soldcost, self.sell_table.money_sold.name: remsell[4]})
            with write_context(self.sell_table):
                self.sell_table.update(**sinfo).where(self.sell_table.id == remsell[0], self.sell_table.code == self.code).execute()
            soldcost = 0
        if remsell is not None and remsell[3] > 0:
            portion -= remsell[3]
        if sells is not None:
            for sr in sells:
                portion -= sr[3]
                cost -= Decimal(sr[2] * sr[3])

        average = (cost/portion).quantize(Decimal("0.0000")) if not portion == 0 else 0
        upinfo = {
            self.stocks_table.cost_hold.name: cost,
            self.stocks_table.portion_hold.name: portion,
            self.stocks_table.aver_price.name: average
        }
        if portion != 0:
            upinfo[self.stocks_table.keep_eye.name] = 1
        with write_context(self.stocks_table):
            if self.stocks_table.select().where(self.stocks_table.code == self.code).exists():
                self.stocks_table.update(**upinfo).where(self.stocks_table.code == self.code).execute()
            else:
                upinfo[self.stocks_table.code.name] = self.code
                upinfo[self.stocks_table.keep_eye.name] = 1
                self.stocks_table.create(**upinfo)

    def fix_cost_portion_hold(self):
        with read_context(self.buy_table):
            buy_rec = [[b.id, b.date, b.price, b.portion, b.soldptn, b.cost] for b in list(self.buy_table.select().where(self.buy_table.code == self.code))]
        if len(buy_rec) == 0:
            return

        with read_context(self.sell_table):
            sell_rec = [[b.id, b.date, b.price, b.portion, b.money_sold] for b in list(self.sell_table.select().where(self.sell_table.code == self.code))]

        self._fix_buy_sell_portion(buy_rec, sell_rec)

    def update_rollin(self, portion, rid):
        short_term_rate = 0.02
        with read_context(self.sell_table):
            rolled_in = self.sell_table.get(self.sell_table.id == rid, self.sell_table.code == self.code)

        if rolled_in:
            p_s, rolled_in, r_v = rolled_in.portion, rolled_in.rolled_in, rolled_in.rolled_in_value
        if not rolled_in:
            rolled_in = 0

        portion_remain = portion - (int(p_s) - int(rolled_in))
        portion_remain = 0 if portion_remain < 0 else portion_remain
        next_value_to_sell = 0
        if portion_remain == 0:
            next_value_to_sell = round(float(r_v) * (1 - float(short_term_rate)), 4)
            rolled_in = int(rolled_in) + portion
        else:
            rolled_in = p_s
        if rolled_in == p_s:
            next_value_to_sell = 0
        with write_context(self.sell_table):
            self.sell_table.update(rolled_in=rolled_in, rolled_in_value=next_value_to_sell).where(self.sell_table.id == rid, self.sell_table.code == self.code).execute()

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
        fixedPrice = price * (1 + float(self.fee)) if float(self.fee) > 0 else price
        with write_context(self.buy_table):
            self.buy_table.create(**{
                self.buy_table.date.name: date,
                self.buy_table.code.name: self.code,
                self.buy_table.price.name: fixedPrice,
                self.buy_table.portion.name: portion,
                self.buy_table.cost.name: fixedPrice * portion,
                self.buy_table.soldout.name:'0',
                self.buy_table.soldptn.name:'0'})

        self.rollin_sold(portion, rollins)
        self.fix_cost_portion_hold()

    def fix_buy(self, id, price, portion = None, date = None):
        with write_context(self.buy_table):
            buy_rec = self.buy_table.get(self.buy_table.id == id, self.buy_table.code == self.code)
            if not buy_rec:
                print("no buy record found, use UserStock.buy() directly.")
                return
            if price:
                buy_rec.price = price
            if portion:
                buy_rec.portion = portion
            buy_rec.cost = int(portion) * float(price)
            if date:
                buy_rec.date = date
            buy_rec.save()

    def sell(self, date, price, buyids, portion = None):
        if isinstance(buyids, int) or isinstance(buyids, str):
            buyids = [buyids]
        if not isinstance(buyids, list):
            print("UserStock.sell buyids should be list, but get", buyids)
            return

        portion_in_ids = Decimal(0)
        details_for_ids = []
        for d in buyids:
            with read_context(self.buy_table):
                detail = self.buy_table.get(self.buy_table.id == d, self.buy_table.code == self.code)
            if detail is not None:
                details_for_ids.append([detail.id, detail.portion, detail.price, detail.cost, detail.soldptn])
                portion_in_ids += Decimal(str(detail.portion)) - Decimal(str(detail.soldptn))

        portion_tosell = portion_in_ids
        if portion is not None and Decimal(portion) > 0:
            portion_tosell = Decimal(portion)

        cost_tosell = Decimal(0)
        if portion_tosell >= portion_in_ids:
            for (d,p,pr,c,sp) in details_for_ids:
                cost_tosell += (Decimal(p) - Decimal(sp)) * Decimal(pr)
                with write_context(self.buy_table):
                    self.buy_table.update(soldout=1, soldptn=p).where(self.buy_table.id == d, self.buy_table.code == self.code).execute()
        else:
            details_for_ids.sort(key=lambda d:d[2])
            steps_to_sell = Decimal(0)
            for (d,p,pr,c,sp) in details_for_ids:
                if steps_to_sell + Decimal(p) - Decimal(sp) <= portion_tosell:
                    with write_context(self.buy_table):
                        self.buy_table.update(soldout=1, soldptn=p).where(self.buy_table.id == d, self.buy_table.code == self.code).execute()
                    steps_to_sell += Decimal(p) - Decimal(sp)
                    cost_tosell += (Decimal(p) - Decimal(sp)) * Decimal(pr)
                else:
                    sold_portion = portion_tosell - steps_to_sell + Decimal(sp)
                    with write_context(self.buy_table):
                        self.buy_table.update(soldptn=sold_portion).where(self.buy_table.id == d, self.buy_table.code == self.code).execute()
                    cost_tosell += (portion_tosell - steps_to_sell) * Decimal(pr)
                    break


        short_term_rate = 0.02
        money = portion_tosell * Decimal(price)
        if float(self.fee) > 0:
            money = money * (1 - Decimal(self.fee))
        earned = money - cost_tosell
        return_percent = earned / cost_tosell
        max_value_to_sell = round(price, 4)
        if short_term_rate is not None:
            max_value_to_sell = round(price * (1.0 - float(short_term_rate)), 4)

        with write_context(self.sell_table):
            self.sell_table.create(**{
                self.sell_table.date.name: date,
                self.sell_table.code.name: self.code,
                self.sell_table.portion.name: portion_tosell,
                self.sell_table.price.name: price,
                self.sell_table.money_sold.name: money,
                self.sell_table.cost_sold.name: cost_tosell,
                self.sell_table.earned.name: earned,
                self.sell_table.return_percent.name: return_percent,
                self.sell_table.rolled_in.name: 0,
                self.sell_table.rollin_netvalue.name: max_value_to_sell
            })

        self.fix_cost_portion_hold()

    def fix_sell(self, id, price, portion = None, cost = None, date = None):
        with read_context(self.buy_table):
            sell_rec = self.sell_table.get(self.sell_table.id == id, self.sell_table.code == self.code)
        if not sell_rec:
            print("no sell record found, use UserStock.sell() instead.")
            return

        ns = {}
        if price:
            ns[self.sell_table.price.name] = price
        if portion:
            ns[self.sell_table.portion.name] = portion
        if cost:
            ns[self.sell_table.cost.name] = cost
        if date:
            ns[self.sell_table.date.name] = date
        ns[self.sell_table.money_sold.name] = int(portion) * float(price) * (1 - float(self.fee))
        ns = self._get_sell_info(ns)
        with write_context(self.sell_table):
            self.sell_table.update(**ns).where(self.sell_table.id == sell_rec.id).execute()

    def still_hold(self):
        if self.cost_hold and self.average:
            return True

        with read_context(self.buy_table):
            if not self.buy_table.select().where(self.buy_table.code == self.code).exists():
                return False

        self.fix_cost_portion_hold()
        return True

    def set_fee(self, fee):
        if not fee:
            return
        self.fee = fee
        with write_context(self.stocks_table):
            self.stocks_table.update(手续费=fee).where(UserStocks.code == self.code).execute()

    def fix_buy_deal(self, deal, count):
        # deal: to be fixed deal
        # count: archived count
        if int(deal['count']) == count:
            return

        soldptn = 0
        with read_context(self.buy_table):
            od = self.buy_table.get(委托编号=deal['sid'], code=self.code)
        if od is None:
            if int(deal['count']) == count:
                return
        else:
            ptn, soldptn = od.portion, od.soldptn
            if ptn == int(deal['count']) - count:
                return

        bdict = {
            'code': self.code, 'date': deal['time'], 'price': deal['price'], 'portion': int(deal['count']) - count, 
            'cost': str(float(deal['price']) * float(deal['count'])), 'soldptn': soldptn,
            '委托编号': deal['sid'], '手续费': deal['fee'] if 'fee' in deal else 0,
            '印花税': deal['feeYh'] if 'feeYh' in deal else 0, '过户费': deal['feeGh'] if 'feeYh' in deal else 0
        }
        with write_context(self.buy_table):
            if od is None:
                self.buy_table.create(**bdict)
            else:
                self.buy_table.update(**bdict).where(self.buy_table.id == od.id).execute()

    def get_each_sell_earned(self):
        with read_context(self.sell_table):
            sell_rec = list(self.sell_table.select().where(self.sell_table.code == self.code))
        if len(sell_rec) == 0:
            return None

        sells = []
        for sr in list(sell_rec):
            fee = 0 if sr.手续费 is None else sr.手续费
            fee += 0 if sr.印花税 is None else sr.印花税
            fee += 0 if sr.过户费 is None else sr.过户费
            sells.append({'date': DateConverter.days_since_2000(sr.date), 'price':sr.price, 'ptn': sr.portion, 'fee': fee})

        with read_context(self.buy_table):
            buy_rec = list(self.buy_table.select().where(self.buy_table.code == self.code))
        buys = []
        for br in buy_rec:
            fee = 0 if br.手续费 is None else br.手续费
            fee += 0 if br.印花税 is None else br.印花税
            fee += 0 if br.过户费 is None else br.过户费
            buys.append({'date': DateConverter.days_since_2000(br.date), 'price':br.price, 'ptn': br.portion, 'fee': fee})
        return self.sell_earned_by_day(buys, sells)

    def get_sell_earned_after(self, date):
        date = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        with read_context(self.sell_table):
            sell_rec = self.sell_table.select().where(self.sell_table.code == self.code)
        if sell_rec is None:
            return None

        sells = []
        for sr in list(sell_rec):
            if sr.date < date:
                continue
            fee = 0 if sr.手续费 is None else sr.手续费
            fee += 0 if sr.印花税 is None else sr.印花税
            fee += 0 if sr.过户费 is None else sr.过户费
            sells.append({'date': DateConverter.days_since_2000(sr.date), 'price':sr.price, 'ptn': sr.portion, 'fee': fee})

        if len(sells) == 0:
            return None

        with read_context(self.buy_table):
            buy_rec = self.buy_table.select().where(self.buy_table.code == self.code)
        buys = []
        for br in list(buy_rec):
            fee = 0 if br.手续费 is None else br.手续费
            fee += 0 if br.印花税 is None else br.印花税
            fee += 0 if br.过户费 is None else br.过户费
            buys.append({'date': DateConverter.days_since_2000(br.date), 'price':br.price, 'ptn': br.portion, 'fee': fee})
        return self.sell_earned_by_day(buys, sells)

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
            self._add_or_update_deals(self.buy_table, bvalues)

        if len(svalues) > 0:
            self._add_or_update_deals(self.sell_table, svalues)

        with read_context(self.buy_table):
            buy_rec = [[b.id, b.date, b.price, b.portion, b.soldptn, b.cost] for b in list(self.buy_table.select().where(self.buy_table.soldout == 0))]

        with read_context(self.sell_table):
            sell_rec = [[b.id, b.date, b.price, b.portion, b.money_sold] for b in list(self.sell_table.select().where(self.sell_table.cost_sold == 0))]

        self._fix_buy_sell_portion(buy_rec, sell_rec)

    def _add_or_update_deals(self, buy_table, values):
        nvalues = []
        for val in values:
            odls = None
            if val[1] == '0':
                # 委托编号为0可能是未确认的记录，可能有多条
                dealtime = val[0].partition(' ')[0]
                val[0] = dealtime
                with read_context(buy_table):
                    odls = list(buy_table.select().where(buy_table.date == dealtime, buy_table.code == self.code))
            else:
                # 委托编号如果重复需要删除重复只保留一条.
                with read_context(buy_table):
                    odls = list(buy_table.select().where(buy_table.委托编号 == val[1], buy_table.code == self.code))
            vdic = {
                buy_table.date.name: val[0].partition(' ')[0] if val[1] == '0' else val[0],
                buy_table.price.name: val[2],
                buy_table.portion.name: val[3],
                buy_table.手续费.name: val[4],
                buy_table.印花税.name: val[5],
                buy_table.过户费.name: val[6]
            }
            updated = False
            for odl in odls:
                if odl.date.split()[0] == val[0].split()[0]:
                    with write_context(buy_table):
                        buy_table.update(**vdic).where(buy_table.id == odl.id).execute()

                    updated = True
                    break
            if not updated:
                vdic[buy_table.code.name] = self.code
                vdic[buy_table.委托编号.name] = val[1]
                nvalues.append(vdic)

        if len(nvalues) > 0:
            with write_context(buy_table):
                buy_table.insert_many(nvalues).execute()

    def deals_before(self, date):
        '''
        获取卖出日期早于date的所有卖出记录以及对应的买入记录
        '''
        with read_context(self.sell_table):
            sell_rec = list(self.sell_table.select().where(self.sell_table.code == self.code, self.sell_table.date < date))
        if len(sell_rec) == 0:
            return ()

        with read_context(self.buy_table):
            bexists = self.buy_table.select().where(self.buy_table.code == self.code, self.buy_table.date < date).exists()
        if not bexists:
            with read_context(self.udeals_table):
                buy_rec = list(self.udeals_table.select().where(self.udeals_table.code == self.code, self.unknown_deals_table.date < date))
            bvalues = []
            for br in buy_rec:
                bvalues.append({'date': br.date, '委托编号': br.委托编号, 'price': br.price, 'portion': br.portion, '手续费': br.手续费, '印花税': br.印花税, '过户费': br.过户费})
            if len(bvalues) > 0:
                self._add_or_update_deals(self.buy_table, bvalues)
                uids = [br.id for br in buy_rec]
                with write_context(self.udeals_table):
                    self.udeals_table.delete().where(self.udeals_table.id.in_(uids)).execute()
        with read_context(self.buy_table):
            buy_rec = list(self.buy_table.select().where(self.buy_table.code == self.code, self.buy_table.date < date))
        consumed = ()
        rembuy = None
        bportion = 0
        delbuy = []
        for srec in sell_rec:
            consumed += (self.code, srec.date, 'S', srec.portion, srec.price, srec.手续费, srec.印花税, srec.过户费, srec.委托编号),
            with write_context(self.sell_table):
                self.sell_table.delete().where(self.sell_table.id == srec.id).execute()
            sportion = srec.portion
            while sportion > 0:
                if bportion == 0:
                    if rembuy is not None:
                        consumed += (self.code, rembuy.date, 'B', rembuy.portion, rembuy.price, rembuy.手续费, rembuy.印花税, rembuy.过户费, rembuy.委托编号),
                        delbuy.append(rembuy.id)
                    rembuy = buy_rec.pop(0)
                    bportion = rembuy.portion
                if bportion <= sportion:
                    sportion -= bportion
                    bportion = 0
                    consumed += (self.code, rembuy.date, 'B', rembuy.portion, rembuy.price, rembuy.手续费, rembuy.印花税, rembuy.过户费, rembuy.委托编号),
                    delbuy.append(rembuy.id)
                    rembuy = None
                else:
                    bportion -= sportion
                    sportion = 0

        if rembuy is not None:
            if bportion > 0:
                consumed += (self.code, rembuy.date, 'B', rembuy.portion - bportion, rembuy.price, rembuy.手续费, rembuy.印花税, rembuy.过户费, rembuy.委托编号),
                with write_context(self.buy_table):
                    rembuy.soldptn += bportion - rembuy.portion
                    rembuy.portion = bportion
                    rembuy.save()
        with write_context(self.buy_table):
            self.buy_table.delete().where(self.buy_table.id.in_(delbuy)).execute()

        return consumed

    def replace_orders(self, ordtable, orders):
        with read_context(ordtable):
            # 查询现有订单
            existing_orders = list(ordtable.select().where(ordtable.code == self.code))

        with write_context(ordtable):
            # 按顺序更新或插入订单
            for i, order in enumerate(orders):
                if i < len(existing_orders):
                    # 如果 existing_orders 中有对应的订单，则更新
                    existing_order = existing_orders[i]
                    for key, value in order.items():
                        setattr(existing_order, key, value)
                    existing_order.save()
                else:
                    break

        if len(existing_orders) < len(orders):
            new_orders = orders[len(existing_orders):]
            for order in new_orders:
                if 'sid' not in order:
                    order['sid'] = '0'
                order['code'] = self.code
            with write_context(ordtable):
                ordtable.insert_many(new_orders).execute()

        if len(existing_orders) > len(orders):
            with write_context(ordtable):
                for i in range(len(orders), len(existing_orders)):
                    existing_orders[i].delete()

    def save_strategy(self, strdata):
        with write_context(self.stocks_table):
            ustk = self.stocks_table.get_or_none(self.stocks_table.code == self.code)
            if ustk:
                if 'amount' in strdata:
                    ustk.amount = strdata['amount']
                if 'uramount' in strdata:
                    ustk.uramount = json.dumps(strdata['uramount'])
                ustk.save()
            else:
                udic = {'code': self.code}
                if 'amount' in strdata:
                    udic['amount'] = strdata['amount']
                if 'uramount' in strdata:
                    udic['uramount'] = json.dumps(strdata['uramount'])
                self.stocks_table.create(**udic)
        svalues = []
        for i, s in strdata['strategies'].items():
            vdic = {
                'code': self.code,
                'id': i,
                'skey': s['key'],
                'data': json.dumps(s)
            }
            if 'transfers' in strdata and i in strdata['transfers']:
                vdic['trans'] = strdata['transfers'][i]['transfer']
            svalues.append(vdic)
        insert_or_update(self.strategy_table, svalues, ['code', 'id'])
        if 'buydetail' in strdata:
            self.replace_orders(self.order_table, strdata['buydetail'])
        if 'buydetail_full' in strdata:
            self.replace_orders(self.fullorder_table, strdata['buydetail_full'])

    def load_strategy(self):
        strdata = {'grptype': 'GroupStandard', 'strategies': {}, 'transfers': {}, 'amount': 0}
        with read_context(self.stocks_table):
            ustk = self.stocks_table.get_or_none(self.stocks_table.code == self.code)
        if ustk:
            strdata['amount'] = ustk.amount
            if ustk.uramount:
                strdata['uramount'] = json.loads(ustk.uramount)

        with read_context(self.strategy_table):
            strlst = list(self.strategy_table.select().where(self.strategy_table.code == self.code))
        for sl in strlst:
            strdata['strategies'][sl.id] = json.loads(sl.data)
            strdata['transfers'][sl.id] =  {"transfer": sl.trans}
        with read_context(self.order_table):
            oex = list(self.order_table.select().where(self.order_table.code == self.code))
        if oex:
            strdata['buydetail'] = [x.__data__ for x in oex]
        with read_context(self.fullorder_table):
            foex = list(self.fullorder_table.select().where(self.fullorder_table.code == self.code))
        if foex:
            strdata['buydetail_full'] = [x.__data__ for x in foex]
        return strdata

    def remove_strategy(self):
        with write_context(self.stocks_table):
            ustk = self.stocks_table.get_or_none(self.stocks_table.code == self.code)
            if ustk:
                ustk.amount = 0
                ustk.uramount = ''
                ustk.save()

        with write_context(self.strategy_table):
            self.strategy_table.delete().where(self.strategy_table.code == self.code).execute()
        with write_context(self.order_table):
            self.order_table.delete().where(self.order_table.code == self.code).execute()
        with write_context(self.fullorder_table):
            self.fullorder_table.delete().where(self.fullorder_table.code == self.code).execute()
