# Python 3
# -*- coding:utf-8 -*-

from peewee import Model, CharField, IntegerField, AutoField, CompositeKey, DoubleField, SmallIntegerField

class User(Model):
    id = AutoField(primary_key=True)
    name = CharField(max_length=255)
    password = CharField(max_length=255)
    email = CharField(max_length=255)
    parent_account = IntegerField()
    realcash = SmallIntegerField(default=1)

    class Meta:
        db_name = 'general'
        table_name = 'users'


class UserFunds(Model):
    id = AutoField(primary_key=True)
    code = CharField(max_length=10)
    cost_hold = DoubleField()
    portion_hold = DoubleField()
    aver_price = DoubleField()
    keep_eye = SmallIntegerField(default=1)

    class Meta:
        db_name = 'fund_center'


class UserStocks(Model):
    id = AutoField(primary_key=True)
    code = CharField(max_length=10)
    cost_hold = DoubleField()
    portion_hold = DoubleField()
    aver_price = DoubleField()
    keep_eye = SmallIntegerField(default=1)
    手续费 = DoubleField()
    amount = IntegerField()
    uramount = CharField(max_length=255)

    class Meta:
        db_name = 'stock_center'


class UserStrategy(Model):
    code = CharField(max_length=10)
    id = IntegerField()
    skey = CharField(max_length=64)
    trans = SmallIntegerField()
    data = CharField(max_length=255)

    class Meta:
        db_name = 'stock_center'
        primary_key = CompositeKey('code', 'id')

class UserCostdog(Model):
    ckey = CharField(max_length=20, primary_key=True)
    data = CharField(max_length=255)

    class Meta:
        db_name = 'stock_center'

class UcostdogUrque(Model):
    ckey = CharField(max_length=20)
    id = IntegerField()
    urdata = CharField(max_length=255)

    class Meta:
        db_name = 'stock_center'
        primary_key = CompositeKey('ckey', 'id')


class UserOrders(Model):
    code = CharField(max_length=10)
    date = CharField(max_length=20)
    count = IntegerField()
    price = DoubleField()
    sid = CharField(max_length=10)
    type = CharField(max_length=10)

    class Meta:
        db_name = 'stock_center'


class UserEarned(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    earned = DoubleField()
    total_earned = DoubleField()

    class Meta:
        db_name = 'stock_center'


class UserEarning(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    cost = DoubleField()
    市值 = DoubleField()

    class Meta:
        db_name = 'stock_center'


class UserDeals(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    code = CharField(max_length=10)
    type = CharField(max_length=10)
    委托编号 = CharField(max_length=10)
    price = DoubleField()
    portion = IntegerField()
    手续费 = DoubleField()
    印花税 = DoubleField()
    过户费 = DoubleField()

    class Meta:
        db_name = 'stock_center'


class UserStockBuy(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    code = CharField(max_length=10)
    portion = IntegerField()
    price = DoubleField()
    cost = DoubleField()
    soldout = SmallIntegerField(default=0)
    soldptn = IntegerField()
    委托编号 = CharField(max_length=10)
    手续费 = DoubleField()
    印花税 = DoubleField()
    过户费 = DoubleField()

    class Meta:
        db_name = 'stock_center'


class UserStockSell(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    code = CharField(max_length=10)
    portion = IntegerField()
    price = DoubleField()
    money_sold = DoubleField()
    cost_sold = DoubleField()
    earned = DoubleField()
    return_percent = DoubleField()
    rolled_in = IntegerField()
    rollin_netvalue = DoubleField()
    委托编号 = CharField(max_length=10)
    手续费 = DoubleField()
    印花税 = DoubleField()
    过户费 = DoubleField()

    class Meta:
        db_name = 'stock_center'


class AllStocks(Model):
    id = AutoField(primary_key=True)
    code = CharField(max_length=20)
    name = CharField(max_length=255)
    type = CharField(max_length=20)
    setup_date = CharField(max_length=20)
    quit_date = CharField(max_length=20)

    class Meta:
        db_name = 'stock_center'
        table_name = 'all_stocks'


class AllIndice(Model):
    id = AutoField(primary_key=True)
    code = CharField(max_length=20)
    name = CharField(max_length=255)

    class Meta:
        db_name = 'fund_center'
        table_name = 'index_info'


class KHistory(Model):
    id = AutoField(primary_key=True)
    date = CharField(max_length=20)
    close = DoubleField()
    high = DoubleField()
    low = DoubleField()
    open = DoubleField()
    price_change = DoubleField()
    p_change = DoubleField() # 百分数
    volume = IntegerField() # 手
    amount = DoubleField() # 万元

    class Meta:
        db_name = 'history_db'

