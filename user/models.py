# Python 3
# -*- coding:utf-8 -*-

from datetime import datetime, timedelta
from phon.hu.hu import DateConverter
from decimal import Decimal
from utils import *
from history import *
from user.user_fund import *
from user.user_stock import *

class User():
    def __init__(self, id, name, email, password=None, st = None, parent = None):
        self.id = id
        self.name = name
        self.email = email
        self.password = password
        self.sub_table = st
        self.parent = parent
        self.funddb = None
        self.stockdb = None

    def fund_center_db(self):
        if not self.funddb:
            self.funddb = SqlHelper(password = db_pwd, database = fund_db_name)
        return self.funddb

    def stock_center_db(self):
        if not self.stockdb:
            self.stockdb = SqlHelper(password = db_pwd, database = stock_db_name)
        return self.stockdb

    def is_admin(self):
        return self.id == 11

    def funds_info_table(self):
        return f'u{self.id}_{gl_fund_info_table}'

    def stocks_info_table(self):
        return f'u{self.id}_stocks'

    def stocks_earned_table(self):
        return f'u{self.id}_earned'

    def stocks_earning_table(self):
        return f'u{self.id}_earning'

    def stocks_unknown_deals_table(self):
        return f'u{self.id}_unknown_deals'

    def stocks_archived_deals_table(self):
        return f'u{self.id}_archived_deals'

    def to_string(self):
        return f'id: {self.id} name: {self.name} email: {self.email}'

    def _all_user_stocks(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()):
            print("can not find stock info DB.")
            return ()

        return tuple([c for c, in sqldb.select(self.stocks_info_table(), [column_code])])

    def add_budget(self, code, budget, date = ""):
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

    def forget_fund(self, code):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()) or not sqldb.isExistTableColumn(self.funds_info_table(), column_keepeyeon):
            return

        sqldb.update(self.funds_info_table(), {column_keepeyeon:str(0)}, {column_code: str(code)})

    def confirm_buy_sell(self):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()):
            return
            
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
            return {}

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        fund_json = {}
        for (c, ) in fund_codes:
            uf = UserFund(self, c)
            fund_json_obj = None
            if uf.still_hold() and uf.keep_eye_on:
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

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        funds_holding = []
        for (c, ) in fund_codes:
            uf = UserFund(self, c)
            if uf.keep_eye_on and uf.still_hold():
                funds_holding.append(c)

        indexs_holding = set()
        all_hist_data = []
        for c in funds_holding:
            fg = FundGeneral(sqldb, c)
            if fg.index_code:
                indexs_holding.add(fg.index_code)
            fund_his_data = fg.get_fund_hist_data()
            all_hist_data = self.merge_hist_data(all_hist_data, fund_his_data)
            
        for c in indexs_holding:
            ig = IndexGeneral(sqldb, c)
            index_his_data = ig.get_index_hist_data()
            all_hist_data = self.merge_hist_data(all_hist_data, index_his_data)

        return all_hist_data

    def merge_hist_data(self, hist_data1, hist_data2):
        if len(hist_data2) < 1:
            return hist_data1
        if len(hist_data1) < 1:
            return hist_data2

        basic_his_data = hist_data1
        extend_his_data = hist_data2
        if len(hist_data1) < len(hist_data2):
            basic_his_data = hist_data2
            extend_his_data = hist_data1

        all_dates = [];
        for i in range(1, len(basic_his_data)):
            all_dates.append(basic_his_data[i][0])

        for i in range(1,len(extend_his_data)):
            if extend_his_data[i][0] in all_dates:
                continue
            d = extend_his_data[i][0]
            for j in range(0, len(all_dates)):
                if d > all_dates[j]:
                    if j == len(all_dates) - 1:
                        all_dates.append(d)
                        break
                    if d < all_dates[j+1]:
                        all_dates.insert(j+1, d)
                        break
                else:
                    all_dates.insert(0, d)
                    break;
        all_data = [["date"]]
        for x in all_dates:
            all_data.append([x])
        all_data = self.merge_to_basic(all_data, basic_his_data)
        all_data = self.merge_to_basic(all_data, extend_his_data)
        return all_data

    def merge_to_basic(self, basic_his_data, extend_his_data):
        header = basic_his_data[0]
        for x in extend_his_data[0]:
            if x != 'date':
                header += x,

        all_hist_data = []
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

    def get_holding_funds_stats(self):
        sqldb = self.fund_center_db()
        if not sqldb.isExistTable(self.funds_info_table()):
            print("can not find fund info DB.")
            return {}

        fund_codes = sqldb.select(self.funds_info_table(), [column_code])

        fund_stats = {}
        for (c, ) in fund_codes:
            uf = UserFund(self, c)
            fund_stats_obj = None
            if uf.ever_hold():
                fund_stats_obj = uf.get_holding_stats()

            if fund_stats_obj:
                fund_stats[c] = fund_stats_obj

        return fund_stats

    def get_holding_stocks_summary(self):
        codes = self._all_user_stocks()
        stocks_json = {}
        for c in codes:
            us = UserStock(self, c)
            stock_json_obj = None
            if us.keep_eye_on:
                stock_json_obj = us.get_stock_summary()

            if stock_json_obj:
                stocks_json[c] = stock_json_obj

        return stocks_json

    def get_holding_stocks_portions(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()):
            print("can not find stock info DB.")
            return

        stocks = sqldb.select(self.stocks_info_table(), f'{column_code},{column_portion_hold}', f'{column_portion_hold}>0')
        return {c:p for c,p in stocks}

    def interest_stock(self, code):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()) or not sqldb.isExistTableColumn(self.stocks_info_table(), column_keepeyeon):
            return

        stk = sqldb.select(self.stocks_info_table(), '*', "%s = '%s'" % (column_code, str(code)))
        if stk is None or len(stk) == 0:
            sqldb.insert(self.stocks_info_table(), {column_code: str(code), column_keepeyeon: str(1)})
        else:
            sqldb.update(self.stocks_info_table(), {column_keepeyeon: str(1)}, {column_code: str(code)})

    def forget_stock(self, code):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()) or not sqldb.isExistTableColumn(self.stocks_info_table(), column_keepeyeon):
            return

        sqldb.update(self.stocks_info_table(), {column_keepeyeon:str(0)}, {column_code: str(code)})

    def forget_stocks(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_earned_table()):
            return

        codes = sqldb.select(self.stocks_info_table(), [column_code], f'{column_portion_hold} = 0 and {column_keepeyeon} = 1')
        for c, in codes:
            sqldb.update(self.stocks_info_table(), {column_keepeyeon:str(0)}, {column_code: str(c)})

    def get_stocks_stats(self):
        stock_codes = self._all_user_stocks()
        stock_stats = {}
        for c in stock_codes:
            us = UserStock(self, c)
            stock_stats_obj = None
            if us.ever_hold():
                stock_stats_obj = us.get_holding_stats()

            if stock_stats_obj:
                stock_stats[c] = stock_stats_obj

        return stock_stats

    def get_interested_stocks_code(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()):
            print("can not find stock info DB.", self.stocks_info_table())
            return None

        codes = sqldb.select(self.stocks_info_table(), [column_code], "%s = '%s'" % (column_keepeyeon, str(1)))
        if codes is None:
            return None
        return [c for (c, ) in codes]

    def set_earned(self, date, earned):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_earned_table()):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_earned:'double(8,2) DEFAULT NULL', column_total_earned:'double(16,2) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            sqldb.createTable(self.stocks_earned_table(), attrs, constraint)
            sqldb.insert(self.stocks_earned_table(), {column_date: date, column_earned: str(earned), column_total_earned:str(earned)})
        else:
            totalEarned = 0
            lastEarned = sqldb.select(self.stocks_earned_table(), [column_date, column_earned, column_total_earned], order = ' ORDER BY %s DESC LIMIT 1' % column_date)
            if lastEarned is None or len(lastEarned) == 0:
                return
            (dt, ed, totalEarned), = lastEarned
            if dt > date:
                print('can not set earned for date earlier than', dt)
                return
            if dt == date:
                print('earned already exists:', dt, ed, totalEarned)
                totalEarned += earned - ed
                print('update to:', earned, totalEarned)
                sqldb.update(self.stocks_earned_table(), {column_earned: str(earned), column_total_earned: str(totalEarned)}, {column_date: date})
                return
            totalEarned += earned
            sqldb.insert(self.stocks_earned_table(), {column_date: date, column_earned: str(earned), column_total_earned: str(totalEarned)})

    def calc_earned(self, date = None):
        '''
        从买卖成交记录计算历史收益详情
        '''
        codes = self._all_user_stocks()
        earndic = {}
        for c in codes:
            us = UserStock(self, c)
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

    def recalc_earned(self):
        '''
        重新计算历史收益详情
        '''
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            print('archive table not exists!', self.stocks_archived_deals_table())
            self.calc_earned()
            return

        if sqldb.isExistTable(self.stocks_earned_table()):
            sqldb.dropTable(self.stocks_earned_table())

        codes = self._all_user_stocks()
        earndic = {}
        archived = sqldb.select(self.stocks_archived_deals_table())
        for c in codes:
            # archived buy records
            abuy = filter(lambda x: x[1] == c and x[3] == 'B', archived)

            us = UserStock(self, c)
            # not archived buy records
            cbuy = []
            if sqldb.isExistTable(us.buy_table):
                cbuy = sqldb.select(us.buy_table)
            buys = []
            arsids = set()
            for _id, _code, _date, _tp, _ptn, _pr, _fee, _fYh, _fGh, _sid in abuy:
                fee = 0 if _fee is None else _fee
                fee += 0 if _fYh is None else _fYh
                fee += 0 if _fGh is None else _fGh
                _cb = filter(lambda x: x[7] == _sid and x[1] == _date and x[3] == _pr, cbuy)
                arsids.add(_sid)
                if _cb is None:
                    buys.append({'date': DateConverter.days_since_2000(_date), 'price': _pr, 'ptn': _ptn, 'fee': fee})
                else:
                    ptn = _ptn
                    # get the total portion of partial archived deals.
                    for _id, _date, _cptn, _pr, _cs, _so, _sp, _sid, _cfee, _cfYh, _cfGh in _cb:
                        ptn += _cptn
                    buys.append({'date': DateConverter.days_since_2000(_date), 'price': _pr, 'ptn': ptn, 'fee': fee})

            for _id, _date, _cptn, _pr, _cs, _so, _sp, _sid, _cfee, _cfYh, _cfGh in cbuy:
                if _sid in arsids:
                    continue

                fee = 0 if _cfee is None else _cfee
                fee += 0 if _cfYh is None else _cfYh
                fee += 0 if _cfGh is None else _cfGh
                buys.append({'date': DateConverter.days_since_2000(_date), 'price': _pr, 'ptn': _cptn, 'fee': fee})

            # archived sell records
            asell = filter(lambda x: x[1] == c and x[3] == 'S', archived)
            sells = []
            for _id, _code, _date, _tp, _ptn, _pr, _fee, _fYh, _fGh, _sid in asell:
                fee = 0 if _fee is None else _fee
                fee += 0 if _fYh is None else _fYh
                fee += 0 if _fGh is None else _fGh
                sells.append({'date': DateConverter.days_since_2000(_date), 'price': _pr, 'ptn': _ptn, 'fee': fee})

            # not archived sell records
            csell = []
            if sqldb.isExistTable(us.sell_table):
                csell = sqldb.select(us.sell_table)
            for _id, _date, _ptn, _pr, _ms, _cs, _e, _rp, _ri, _rn, _sid, _fee, _fYh, _fGh in csell:
                fee = 0 if _fee is None else _fYh
                fee += 0 if _fYh is None else _fYh
                fee += 0 if _fGh is None else _fGh
                sells.append({'date': DateConverter.days_since_2000(_date), 'price': _pr, 'ptn': _ptn, 'fee': fee})

            cearn = us.sell_earned_by_day(buys, sells)
            if cearn is None:
                continue
            for k in cearn:
                if k in earndic:
                    earndic[k] += cearn[k]
                else:
                    earndic[k] = cearn[k]

        for k in sorted(earndic.keys()):
            self.set_earned(DateConverter.date_by_delta(k), earndic[k])

    def update_earned(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_earned_table()):
            return

        self.calc_earned()

    def __get_latest_price(self, code, fqprc):
        if fqprc == 0:
            sd = StockDumps()
            (_id, _dt, prc, *x), = sd.read_kd_data(code, length=1)
            return prc
        return fqprc

    def update_earning(self):
        codes = self._all_user_stocks()
        uss = {}
        for c in codes:
            us = UserStock(self, c)
            if us.cost_hold != 0 or us.portion_hold != 0:
                uss[c] = {'cost': us.cost_hold, 'ptn': us.portion_hold}

        hcodes = [('1.' if uc[0:2] == 'SH' else '0.') + uc[2:] for uc in uss.keys()]
        jcode = ','.join(hcodes)
        quoteUrl = f'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids={jcode}&fields=f2,f12'
        rsp = requests.get(quoteUrl)
        rsp.raise_for_status()
        lpobj = json.loads(rsp.content.decode('utf-8'))
        if 'data' in lpobj and 'diff' in lpobj['data']:
            if lpobj['data']['total'] < len(hcodes):
                print(f'update_earning get latest prices error: fetch {len(hcodes)}, actual {lpobj["data"]["total"]}')
            for qt in lpobj['data']['diff']:
                if 'SH' + qt['f12'] in uss:
                    uss['SH' + qt['f12']]['price'] = self.__get_latest_price('SH' + qt['f12'], qt['f2'])
                elif 'BJ' + qt['f12'] in uss:
                    uss['BJ' + qt['f12']]['price'] = self.__get_latest_price('BJ' + qt['f12'], qt['f2'])
                else:
                    uss['SZ' + qt['f12']]['price'] = self.__get_latest_price('SZ' + qt['f12'], qt['f2'])

        cost = 0
        value = 0
        for v in uss.values():
            cost += v['cost']
            value += v['ptn'] * float(v['price'])

        dnow = datetime.now()
        wday = dnow.weekday()
        if wday > 4:
            dnow -= timedelta(wday - 4)
        elif dnow.hour < 15:
            dnow -= timedelta(1)

        date = dnow.strftime('%Y-%m-%d')
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_earning_table()):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_cost:'double(16,2) DEFAULT NULL', '市值':'double(16,2) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            sqldb.createTable(self.stocks_earning_table(), attrs, constraint)
            sqldb.insert(self.stocks_earning_table(), {column_date: date, column_cost:str(cost), '市值':str(value)})
        else:
            lastEarned = sqldb.select(self.stocks_earning_table(), [column_date], order = ' ORDER BY %s DESC LIMIT 1' % column_date)
            if lastEarned is None or len(lastEarned) == 0:
                sqldb.insert(self.stocks_earning_table(), {column_date: date, column_cost:str(cost), '市值':str(value)})
                return
            (dt,), = lastEarned
            if dt > date:
                print('can not set earning for date earlier than', dt)
                return
            if dt == date:
                print('earned already exists:', dt)
                sqldb.update(self.stocks_earning_table(), {column_cost: cost, '市值':value}, {column_date: date})
                return
            sqldb.insert(self.stocks_earning_table(), {column_date: date, column_cost:str(cost), '市值':str(value)})

    def get_earned_arr(self, all_earned, days = 0):
        startIdx = 0
        if days > 0:
            startIdx = len(all_earned) - days

        earr = []
        for x in range(startIdx, len(all_earned)):
            earr.append({'dt':DateConverter.days_since_2000(all_earned[x][0]), 'ed':all_earned[x][1]})
        return earr

    def get_this_yr_earned(self, all_earned):
        lastRow = all_earned[-1]
        year = datetime.strptime(lastRow[0], "%Y-%m-%d").year
        total = None
        earned_obj = {}
        earr = []
        for (d, e, t) in all_earned:
            if total is None and not datetime.strptime(d, "%Y-%m-%d").year == year:
                continue
            if total is None:
                total = t
                earned_obj['tot'] = total
            earr.append({'dt':DateConverter.days_since_2000(d), 'ed':e})
        earned_obj['e_a'] = earr
        return earned_obj

    def get_earned(self, days):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_earned_table()):
            print('can not find earned table', self.stocks_earned_table())
            return {}

        all_earned = sqldb.select(self.stocks_earned_table(), [column_date, column_earned, column_total_earned])
        earned_obj = {}
        if days < 0 or days >= len(all_earned):
            earned_obj['tot'] = all_earned[0][2]
            earned_obj['e_a'] = self.get_earned_arr(all_earned)
        elif days > 0:
            earned_obj['tot'] = all_earned[len(all_earned) - days][2]
            earned_obj['e_a'] = self.get_earned_arr(all_earned, days)
        else:
            earned_obj = self.get_this_yr_earned(all_earned)

        return earned_obj

    def get_hold_earned(self, code):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_info_table()):
            return 0

        stk = sqldb.select(self.stocks_info_table(), [column_cost_hold, column_portion_hold], f"{column_code} = '{code}'")
        if stk is None or len(stk) == 0:
            return 0

        (cost, portion), = stk
        if portion > 0:
            sd = StockDumps()
            kl = sd.read_kd_data(code, length=1)[0]
            return portion * float(kl[2]) - cost
        return 0

    def get_earned_of(self, code):
        earned = 0
        us = UserStock(self, code)
        earned += us.get_sold_earned()
        earned += self.get_hold_earned(code)

        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            return earned

        bsdeals = sqldb.select(self.stocks_archived_deals_table(), [column_type, column_portion, column_price, column_fee, '印花税', '过户费'], f'{column_code}="{code}"')
        if bsdeals is None or len(bsdeals) == 0:
            return earned

        bmon = 0
        smon = 0
        fee = 0
        for tp, ptn, prc, f, yh, gh in bsdeals:
            if tp == 'B':
                bmon += ptn * prc
            else:
                smon += ptn * prc
            fee += (f + yh + gh)

        return earned + (smon - bmon - fee)

    def get_interested_stocks_his(self):
        sd = StockDumps()
        return sd.get_his(self.get_interested_stocks_code())

    def is_exist_in_allstocks(self, code):
        sg = StockGeneral(self.stock_center_db(), code)
        if not sg.name:
            return False
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
                us = UserStock(self, k)
                us.add_deals(deals)
                if not updatefee:
                    updatefee = len(deals) > 0 and 'fee' in deals[0]

        self.update_earned()
        if updatefee:
            self.forget_stocks()

    def check_unknown_deals_table(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_unknown_deals_table()):
            attrs = {
                column_date:'varchar(20) DEFAULT NULL',
                column_code:'varchar(10) DEFAULT NULL',
                column_type:'varchar(10) DEFAULT NULL',
                '委托编号':'varchar(10) DEFAULT NULL',
                column_price:'double(16,4) DEFAULT NULL',
                column_portion:'int DEFAULT NULL',
                column_fee:'double(8,2) DEFAULT NULL',
                '印花税':'double(8,2) DEFAULT NULL',
                '过户费':'double(8,2) DEFAULT NULL'
            }
            constraint = 'PRIMARY KEY(`id`)'
            sqldb.createTable(self.stocks_unknown_deals_table(), attrs, constraint)

    def remove_repeat_unknown_deals_配售缴款(self, existdeals, deal):
        eid = 0
        ecode = deal['code']
        sqldb = self.stock_center_db()
        for id,date,code,type,sid,price,count,fee,fYh,fGh in existdeals:
            if date < deal['time']:
                continue
            if code[-6:] != deal['code'][-6:]:
                continue
            if sid != '0' and sid != deal['sid']:
                continue
            if len(code) > len(ecode):
                ecode = code
            if eid == 0:
                eid = id
            else:
                sqldb.delete(self.stocks_unknown_deals_table(), {'id': id})

        if eid == 0:
            for id, date,code,type,sid,*x in existdeals:
                if sid == deal['sid']:
                    return
            dtype = 'B'
            sqldb.insert(self.stocks_unknown_deals_table(), {
                f'{column_date}':deal['time'], f'{column_code}':ecode,
                f'{column_type}':dtype, '委托编号':deal['sid'],
                f'{column_price}':deal['price'], f'{column_portion}':deal['count'],
                f'{column_fee}':deal['fee'], '印花税':deal['feeYh'], '过户费':deal['feeGh']})
        else:
            sqldb.update(self.stocks_unknown_deals_table(), {f'{column_code}':ecode, '委托编号':deal['sid']}, {'id': eid})

    def remove_repeat_unknown_deals_新股入帐(self, existdeals, deal):
        eid = 0
        ecode = deal['code']
        sqldb = self.stock_center_db()
        for id,date,code,type,sid,price,count,fee,fYh,fGh in existdeals:
            if date < deal['time']:
                continue
            if sid != deal['sid']:
                continue
            if len(code) > len(ecode) and code[-6:] == deal['code']:
                ecode = code
            if eid == 0:
                eid = id
            else:
                sqldb.delete(self.stocks_unknown_deals_table(), {'id': id})

        if eid == 0:
            dtype = 'B'
            sqldb.insert(self.stocks_unknown_deals_table(), {
                f'{column_date}':deal['time'], f'{column_code}':ecode,
                f'{column_type}':dtype, '委托编号':deal['sid'],
                f'{column_price}':deal['price'], f'{column_portion}':deal['count'],
                f'{column_fee}':deal['fee'], '印花税':deal['feeYh'], '过户费':deal['feeGh']})
        else:
            sqldb.update(self.stocks_unknown_deals_table(), {f'{column_code}':ecode, '委托编号':deal['sid']}, {'id': eid})

    def remove_repeat_unknown_deals_commontype(self, existdeals, deal):
        eid = 0
        sqldb = self.stock_center_db()
        for id,date,code,type,sid,price,count,fee,fYh,fGh in existdeals:
            if date != deal['time']:
                continue
            if eid == 0:
                eid = id
            else:
                sqldb.delete(self.stocks_unknown_deals_table(), {'id': id})

        if eid == 0:
            sqldb.insert(self.stocks_unknown_deals_table(), {
                f'{column_date}':deal['time'], f'{column_code}':deal['code'],
                f'{column_type}':deal['tradeType'], '委托编号':deal['sid'],
                f'{column_price}':deal['price'], f'{column_portion}':deal['count'],
                f'{column_fee}':deal['fee'], '印花税':deal['feeYh'], '过户费':deal['feeGh']})
        else:
            sqldb.update(self.stocks_unknown_deals_table(), {f'{column_code}':deal['code'], '委托编号':deal['sid']}, {'id': eid})

    def add_unknown_code_deal(self, deals):
        '''
        无法识别的成交记录，新股新债
        '''
        self.check_unknown_deals_table()
        sqldb = self.stock_center_db()

        values = []
        commontype = ['利息归本', '银行转证券', '证券转银行', '红利入账', '扣税', '融资利息']
        for deal in deals:
            if 'fee' in deal:
                if deal['tradeType'] == '配售缴款':
                    existdeals = sqldb.select(self.stocks_unknown_deals_table(), conds={'委托编号': 0})
                    existdeals += sqldb.select(self.stocks_unknown_deals_table(), conds={'委托编号': deal['sid']})
                    self.remove_repeat_unknown_deals_配售缴款(existdeals, deal)
                    continue
                if deal['tradeType'] == '新股入帐':
                    existdeals = sqldb.select(self.stocks_unknown_deals_table(), conds={'委托编号': deal['sid']})
                    self.remove_repeat_unknown_deals_新股入帐(existdeals, deal)
                    continue
                if deal['tradeType'] in commontype:
                    existdeals = sqldb.select(self.stocks_unknown_deals_table(), conds={f'{column_date}':deal['time']})
                    self.remove_repeat_unknown_deals_commontype(existdeals, deal)
                    continue
                if deal['tradeType'] == 'B' or deal['tradeType'] == 'S':
                    print('unknown deal', deal)
                values.append([deal['time'], deal['code'], deal['tradeType'], deal['sid'], deal['price'], deal['count'], deal['fee'], deal['feeYh'], deal['feeGh']])

        if len(values) > 0:
            attrs = [column_date, column_code, column_type, '委托编号', column_price, column_portion, column_fee, '印花税', '过户费']
            sqldb.insertMany(self.stocks_unknown_deals_table(), attrs, values)

    def merge_duplicated_unknown_deals(self, dupdeals, code=None):
        # type: (list, str) -> None
        '''
        合并重复记录, 保留第一个, 删除其余, 更新code
        '''
        sqldb = self.stock_center_db()
        if code is not None:
            sqldb.update(self.stocks_unknown_deals_table(), {f'{column_code}': code}, {'id': dupdeals[0][0]})
        for i in range(1, len(dupdeals)):
            sqldb.delete(self.stocks_unknown_deals_table(), {'id': dupdeals[i][0]})
        print(f'update {dupdeals[0]} with code: {code}, and remove the other {len(dupdeals) - 1}')

    def archive_new_stock_in_unknown_table(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_unknown_deals_table()):
            return

        alldeals = list(sqldb.select(self.stocks_unknown_deals_table(), conds=f'{column_type} = "B" or {column_type} = "S"'))
        dupi = 0
        # 去重
        while dupi < len(alldeals):
            id,date,code,dtype,sid,price,count,fee,fYh,fGh = alldeals[dupi]
            dupdeals = [alldeals[dupi]]
            for i in range(dupi + 1, len(alldeals)):
                if alldeals[i][1] == date and alldeals[i][3] == dtype and alldeals[i][5] == price and alldeals[i][6] == count:
                    dupdeals.append(alldeals[i])
            if len(dupdeals) > 1:
                for d in dupdeals:
                    print(d)
                c = input('all the same? q to quit. (y)/n: ')
                if c == 'q':
                    break
                if c == 'n':
                    dupi += 1
                    continue
                c = input(f'input the code: ({dupdeals[-1][2]})? ')
                if not c:
                    c = dupdeals[0][2]
                self.merge_duplicated_unknown_deals(dupdeals, c)
                for j in range(1, len(dupdeals)):
                    alldeals.remove(dupdeals[j])
            dupi += 1
        print('delete archieved deals, (it is not unknown.)')
        dupi = 0
        while dupi < len(alldeals):
            id,date,code,dtype,sid,price,count,fee,fYh,fGh = alldeals[dupi]
            ardeal = sqldb.select(self.stocks_archived_deals_table(), '*', f'{column_date} = "{date}" and 委托编号 = "{sid}"')
            if ardeal is not None and len(ardeal) > 0:
                print(alldeals[dupi])
                print(ardeal)
                c = input('the unknown deal is already archived? q to quit. (y)/n: ')
                if c == 'q':
                    break
                if c == 'n':
                    dupi += 1
                    continue
                sqldb.delete(self.stocks_unknown_deals_table(), {'id': id})
                dupi += 1
            dupi += 1
        print('handle other deals if any\n')
        dupi = len(alldeals) - 1
        while dupi >= 0:
            print(alldeals[dupi])
            id,date,code,dtype,sid,price,count,fee,fYh,fGh = alldeals[dupi]
            c = input('(q)uit, (c)ontinue, (d)elete, (u)pdate, new ipo deal to (t)ransfer. \nplease input operation: ')
            if c == 'q':
                break
            if c == 'd':
                print(f'delete with id = {id}')
                sqldb.delete(self.stocks_unknown_deals_table(), {'id': id})
                dupi -= 1
                continue
            if c == 't':
                stk = input(f'please input long stock code for {code}:')
                stk_start_date = input(f'start date of {stk}:')
                us = UserStock(self, stk)
                us.add_deals([{"time":stk_start_date,"sid":sid,"code":stk,"tradeType":dtype,"price":price,"count":count, 'fee': fee, 'feeYh': fYh, 'feeGh': fGh}])
                print(f'transfer to table: {us.buy_table}')
                dupi -= 1
                continue
            if c == 'u':
                print(f'update, not implemented yet!')
                dupi -= 1
                continue
            if c == 'c':
                dupi -= 1
                continue

    def add_to_archive_deals_table(self, values):
        sqldb = self.stock_center_db()
        cols = [column_code, column_date, column_type, column_portion, column_price, column_fee, '印花税', '过户费', '委托编号']
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            attrs = {
                column_code:'varchar(10) DEFAULT NULL',
                column_date:'varchar(20) DEFAULT NULL',
                column_type:'varchar(10) DEFAULT NULL',
                column_portion:'int DEFAULT NULL',
                column_price:'double(16,4) DEFAULT NULL',
                column_fee:'double(8,2) DEFAULT NULL',
                '印花税':'double(8,2) DEFAULT NULL',
                '过户费':'double(8,2) DEFAULT NULL',
                '委托编号':'varchar(10) DEFAULT NULL'
            }
            constraint = 'PRIMARY KEY(`id`)'
            sqldb.createTable(self.stocks_archived_deals_table(), attrs, constraint)
            sqldb.insertMany(self.stocks_archived_deals_table(), cols, values)
        else:
            newval = []
            for d in values:
                ad = sqldb.select(self.stocks_archived_deals_table(), ['id', column_portion], [f'{column_code}="{d[0]}"', f'{column_date}="{d[1]}"', f'{column_type}="{d[2]}"',f'委托编号="{d[8]}"'])
                if ad is None or len(ad) == 0:
                    newval.append(d)
                else:
                    sqldb.update(self.stocks_archived_deals_table(), {column_portion: ad[0][1] + d[3]}, {'id':ad[0][0]})
            if len(newval) > 0:
                sqldb.insertMany(self.stocks_archived_deals_table(), cols, newval)

    def _archived(self, deal):
        if 'fee' not in deal:
            return False

        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            return False

        dsid = '0' if deal['sid'] == '' else deal['sid']
        ad = sqldb.select(self.stocks_archived_deals_table(), conds=[f'''{column_code} = \"{deal['code']}\"''', f'''{column_type} = "{deal['tradeType']}"''', f'''委托编号="{dsid}"'''])
        if ad is None or len(ad) == 0:
            return False
        (tid, c, t, tt, count, p, f, fYh, fGh, sid), = ad
        if dsid == '0' and t.partition(' ')[0] != deal['time'].partition(' ')[0]:
            return False

        if count > int(deal['count']):
            raise Exception(f'Archived count > deal count, please check the database, table:{self.stocks_archived_deals_table()}, {deal["code"]}, 委托编号={deal["sid"]}')
        us = UserStock(self, c)
        us.fix_buy_deal(deal, count)
        if not f == float(deal['fee']) or not fYh == float(deal['feeYh']) or not fGh == float(deal['feeGh']) or not p == float(deal['price']):
            sqldb.update(self.stocks_archived_deals_table(),
                {f'{column_price}':deal['price'], f'{column_fee}':deal['fee'], '印花税':deal['feeYh'], '过户费':deal['feeGh']},
                {f'id':tid})
        return True

    def get_archived_deals(self):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            return []

        adeals = sqldb.select(self.stocks_archived_deals_table())
        return [{'code':c, 'time':d, 'tradeType':t, 'count':ptn, 'price':pr, 'fee':fee, 'feeYh':fYh, 'feeGh':fGh, 'sid':sid} for _,c,d,t,ptn,pr,fee,fYh,fGh,sid in adeals]

    def get_archived_since(self, date, excludehold=False):
        sqldb = self.stock_center_db()
        if not sqldb.isExistTable(self.stocks_archived_deals_table()):
            return []

        adeals = sqldb.select(self.stocks_archived_deals_table())
        astocks = set([c for _,c,d,t,ptn,pr,fee,fYh,fGh,sid in adeals if d >= date and t == 'S'])
        if excludehold:
            exstocks = []
            hdstks = self.get_holding_stocks_portions()
            for c in astocks:
                if c not in hdstks:
                    exstocks.append(c)
            astocks = exstocks
        return list(astocks)

    def archive_deals(self, edate):
        codes = self._all_user_stocks()
        consumed = ()
        for c in codes:
            us = UserStock(self, c)
            ucsmd = us.deals_before(edate)
            if len(ucsmd) > 0:
                consumed += ucsmd
                us.remove_empty_table()

        if len(consumed) > 0:
            self.add_to_archive_deals_table(consumed)

    def get_stocks_earning_table(self, statstable, year=None):
        if isinstance(year, int):
            year = str(year)

        stats_monthly = []
        monstats = []
        cmon = ''
        for r in statstable:
            r0 = r[0].split('-')
            if year is not None and r0[0] != year:
                continue
            mon = ''.join(r0[0:2])
            if mon != cmon:
                if len(monstats) > 0:
                    stats_monthly.append(monstats)
                    monstats = []
                cmon = mon

            monstats.append([r[0], r[1], r[2], round(r[3], 2), r[4], round(r[5], 2), round(r[6], 2)])

        if len(monstats) > 0:
            stats_monthly.append(monstats)
            monstats = []

        ehtml = ''
        for k in range(0, len(stats_monthly)):
            monstats = stats_monthly[k]
            mearn = 0
            for rmon in monstats:
                if rmon[-1] == 0:
                    mearn = 0
                    break
                mearn += rmon[-1]
            if mearn == 0:
                mearn = monstats[0][5] - (stats_monthly[k+1][0][5] if k < len(stats_monthly) - 2 else 0)
            tr1 = ''
            for r in monstats[0]:
                tr1 += f'''
                    <td>{r}</td>'''
            tr1 += f'''
                    <td rowspan={len(monstats)}>{round(mearn, 2)}</td>'''
            tr1 = f'''
                <tr>{tr1}
                </tr>'''
            ehtml += tr1
            for i in range(1, len(monstats)):
                tr = ''
                for r in monstats[i]:
                    tr += f'''
                    <td>{r}</td>'''
                tr =  f'''
                <tr>{tr}
                </tr>'''
                ehtml += tr
        return ehtml

    def get_stocks_earning_static_html(self, year=None):
        # Type: (string) -> string
        sqldb = self.stock_center_db()
        earnedrecs = list(sqldb.select(self.stocks_earned_table(), [column_date, column_earned, column_total_earned]))
        earningrecs = list(sqldb.select(self.stocks_earning_table(), [column_date, column_cost, '市值']))
        earningrecs.reverse()
        statstable = []
        earned = earnedrecs.pop()
        for d, c, v in earningrecs:
            if earned[0] > d:
                earned = earnedrecs.pop()
            statstable.append([d, c, v, v - c, earned[2], v + earned[2] - c])

        for i in range(0, len(statstable) - 1):
            statstable[i].append(statstable[i][5] - statstable[i + 1][5])

        if len(statstable) > 0:
            statstable[-1].append(0)

        while len(earnedrecs) > 0:
            if earned[0] < statstable[-1][0]:
                statstable.append([earned[0], 0, 0, 0, earned[1], earned[2], 0])
            earned = earnedrecs.pop()

        ehtml = '''<html>
    <head>
        <meta charset="utf-8">
        <style>
            table {
                border: solid 1px;
                border-collapse: collapse;
            }
            table th {
                border: solid 1px;
            }
            table td {
                border: solid 1px lightgray;
            }
        </style>
    </head>
    <body>
        <table>
            <thead>
                <th>日期</th>
                <th>持仓成本</th>
                <th>总市值</th>
                <th>浮盈</th>
                <th>实盈</th>
                <th>总盈亏</th>
                <th>每日盈亏</th>
                <th>每月盈亏</th>
            </thead>
            <tbody>'''
 
        if isinstance(year, int):
            year = str(year)

        if year is None:
            # years = set()
            # for r in statstable:
            #     years.add(r[0].split('-')[0])
            # years = sorted(list(years), reverse=True)
            # for y in years:
            ehtml += self.get_stocks_earning_table(statstable)
        else:
            ehtml += self.get_stocks_earning_table(statstable, year)
        ehtml +='''
            </tbody>
        </table>
    </body>
</html>
'''
        return ehtml

    def save_stocks_eaning_html(self, sfolder):
        self.update_earning()
        year = datetime.now().year
        ehtml = self.get_stocks_earning_static_html(year)
        with open(f'{sfolder}earning_{year}.html', 'w') as f:
            f.write(ehtml)

    def save_all_stocks_earning_html(self, sfolder):
        self.update_earning()
        ehtml = self.get_stocks_earning_static_html()
        with open(f'{sfolder}earning.html', 'w') as f:
            f.write(ehtml)

class UserModel():
    def __init__(self):
        self.tablename = 'users'
        self.sqldb = SqlHelper(password = db_pwd, database = general_db_name)
        if self.sqldb.isExistTable(self.tablename):
            self.check_column('sub_table', "varchar(255) DEFAULT NULL")
            self.check_column('parent_account', "varchar(16) DEFAULT NULL")

    def add_new(self, name, password, email):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {'name':'varchar(255) DEFAULT NULL', 'password':"varchar(255) DEFAULT NULL",  'email':"varchar(255) DEFAULT NULL", 'sub_table':"varchar(255) DEFAULT NULL", 'parent_account':"varchar(16) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.tablename, attrs, constraint)
        result = self.sqldb.selectOneValue(self.tablename, 'count(*)', ["email = '%s'" % email])
        if result and result != 0:
            user = self.user_by_email(email)
            print( user.to_string(), "already exists!")
            return user
        self.sqldb.insert(self.tablename, {'name':name, 'password':password, 'email':email})
        return self.user_by_email(email)

    def check_column(self, col, val):
        if not self.sqldb.isExistTableColumn(self.tablename, col):
            self.sqldb.addColumn(self.tablename, col, val)

    def user_by_id(self, id):
        result = self.sqldb.select(self.tablename, "*", ["id = '%s'" % id])
        if not result:
            return None

        (id, name, password, email, st, parent), = result
        return User(id, name, email, password, st, parent)

    def user_by_email(self, email):
        result = self.sqldb.select(self.tablename, "*", ["email = '%s'" % email])
        if not result:
            return None
        (id, name, password, email, st, parent), = result
        return User(id, name, email, password, st, parent)

    def all_users(self):
        result = self.sqldb.select(self.tablename, ['id'])
        users = []
        for i, in result:
            users.append(self.user_by_id(i))
        return users

    def set_password(self, user, password):
        user.password = password
        self.sqldb.update(self.tablename, {'password':password}, {'id' : str(user.id)})

    def check_password(self, user, password):
        return password == user.password

    def get_bind_accounts(self, email):
        user = self.user_by_email(email)
        sub_table = user.sub_table
        accounts = []
        if sub_table and self.sqldb.isExistTable(sub_table):
            subs = self.sqldb.select(sub_table, 'subid')
            if subs:
                for sid in subs:
                    user = self.user_by_id(sid)
                    accounts.append({'id':user.id, 'name':user.name, 'email':user.email})
        return accounts

    def get_all_combined_users(self, user):
        parent = user
        if user.parent:
            parent = self.user_by_id(user.parent)

        users = [parent]
        sub_table = parent.sub_table
        if sub_table and self.sqldb.isExistTable(sub_table):
            subs = self.sqldb.select(sub_table, 'subid')
            if subs:
                for sid in subs:
                    users.append(self.user_by_id(sid))
        return users

    def is_combined(self, u1, u2):
        users = self.get_all_combined_users(u1)
        for u in users:
            if u.id == u2.id:
                return True
        return False

    def bind_account(self, user, sub):
        if not user or not sub:
            return

        sub_table = user.sub_table
        parent = user.parent

        if not sub_table and not parent:
            sub_table = 'u' + str(user.id) + '_subtable'
            self.sqldb.update(self.tablename, {'sub_table': sub_table}, {'id' : str(user.id)})

        if not sub_table:
            return

        if sub.parent or sub.sub_table:
            return

        if not self.sqldb.isExistTable(sub_table):
            attrs = {'subid':"varchar(16) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(sub_table, attrs, constraint)

        self.sqldb.insert(sub_table, {'subid':str(sub.id)})
        self.sqldb.update(self.tablename, {'parent_account': str(user.id)}, {'id' : str(sub.id)})

    def get_parent(self, email):
        user = self.user_by_email(email)
        if user.parent:
            parent = self.user_by_id(user.parent)
            return {'id': parent.id, 'name': parent.name, 'email': parent.email}
        return {}

    def merge_stats(self, st1, st2):
        st = {}
        st['name'] = st1['name']
        st['cost'] = st1['cost'] + st2['cost']
        st['ewh'] = round(st1['ewh'] + st2['ewh'], 2)
        st['cs'] = st1['cs'] + st2['cs']
        st['acs'] = st1['acs'] + st2['acs']
        st['hds'] = st1['hds'] + st2['hds']
        st['srct'] = st1['srct'] + st2['srct']
        return st

    def get_bind_users_fundstats(self, user):
        users = self.get_all_combined_users(user)
        fund_stats = {}
        for u in users:
            u_stats = u.get_holding_funds_stats()
            for c in u_stats:
                if fund_stats.__contains__(c):
                    fund_stats[c] = self.merge_stats(fund_stats[c], u_stats[c])
                else:
                    fund_stats[c] = u_stats[c]
        return fund_stats
