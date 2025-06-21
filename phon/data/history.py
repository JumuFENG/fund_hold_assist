# Python 3
# -*- coding:utf-8 -*-

import abc
import json
import bisect
import requests
from functools import lru_cache, cached_property
from concurrent.futures import ThreadPoolExecutor
from peewee import fn
from playhouse.pool import PooledMySQLDatabase
from phon.hu import lazy_property, classproperty, convert_dict_data
from phon.hu.hu import DateConverter, datetime, timedelta
from phon.data.tables import AllStockTbl, AllIndice, KHistory, FlowHistory
from phon.data.db import get_database, create_model, read_context, write_context, insert_or_update
import stockrt as srt


class BaseKHistory:
    def __init__(self, code):
        self.code = code[-6:]

    @property
    def saved_kltypes(self):
        return ('d', 'w', 'm')

    @property
    @abc.abstractmethod
    def full_code(self):
        pass

    @lru_cache(maxsize=None)
    def get_ktable(self, period='d') -> KHistory:
        return create_model(KHistory, self.get_ktablename(period))

    @abc.abstractmethod
    def get_ktablename(self, period='d'):
        pass

    @staticmethod
    def guess_bars_since(last_date, period='d'):
        if last_date is None:
            return 10000

        days = (datetime.now() - datetime.strptime(last_date, "%Y-%m-%d")).days
        if period == 'd':
            return days
        if period == 'w':
            return days // 7
        if period == 'm':
            return days // 30
        if period.isdigit():
            if int(period) == 1:
                return days * 240
            if int(period) % 5 == 0:
                return days * 240 / int(period)
        return 0

    def count_bars_to_updated(self, period='d'):
        if period not in self.saved_kltypes:
            return 0
        ktable = self.get_ktable(period)
        with read_context(ktable):
            mxdate = ktable.select().order_by(ktable.id.desc()).get().date
        return self.guess_bars_since(mxdate, period)

    def save_klines_todb(self, kltype, klines):
        if kltype not in self.saved_kltypes:
            return

        ktable = self.get_ktable(kltype)
        with read_context(ktable):
            mxdate = ktable.select(fn.MAX(ktable.date)).scalar()

        klines_with_col = []
        for i in range(1, len(klines)):
            if mxdate is None or klines[i]['time'] >= mxdate:
                kl = {
                    'date': klines[i]['time'],
                    'open': klines[i]['open'],
                    'close': klines[i]['close'],
                    'high': klines[i]['high'],
                    'low': klines[i]['low'],
                    'volume': klines[i]['volume'] / 100,
                    'amount': klines[i]['amount'] / 10000,
                }
                kl['p_change'] = klines[i]['change'] * 100 if 'change' in klines[i] \
                    else (klines[i]['close'] - klines[i-1]['close']) * 100 / klines[i-1]['close']
                kl['price_change'] = klines[i]['change_px'] if 'change_px' in klines[i] \
                    else klines[i]['close'] - klines[i-1]['close']
                klines_with_col.append(kl)

        if len(klines_with_col) == 0:
            return

        with write_context(ktable):
            upkl = klines_with_col[0] if DateConverter.is_same_period(klines_with_col[0]['date'], mxdate, kltype) else None
            updated_date = mxdate if mxdate else ''
            if upkl:
                ktable.update(**upkl).where(ktable.date == mxdate).execute()
                updated_date = upkl['date']
            newkls = [kl for kl in klines_with_col if kl['date'] > updated_date]
            if len(newkls) > 0:
                ktable.insert_many(newkls).execute()

    def get_index_hist_data(self, kltype, length = 60, start = None, columns=[], fmt='dict'):
        ktable = self.get_ktable(kltype)
        with read_context(ktable):
            if start is not None:
                his_data = ktable.select(*columns).where(ktable.date >= start)
                his_data = his_data.dicts()
            else:
                his_data = ktable.select(*columns)
                his_data = his_data.dicts()[-length:]
        if not columns:
            columns = ktable._meta.columns
        return convert_dict_data(his_data, columns, fmt)


class IndexHistory(BaseKHistory):
    def __init__(self, code):
        super().__init__(code)

    @property
    def full_code(self):
        if self.code.startswith('00'):
            return 'sh' + self.code
        return 'sz' + self.code

    def get_ktablename(self, period='d'):
        return AllIndexes.get_ktablename(self.code, period)


class TradingDate():
    @classproperty
    def dbsha(self):
        return create_model(KHistory, AllIndexes.get_ktablename('000001'))

    @staticmethod
    def today(sep='-'):
        return datetime.now().strftime(f'%Y{sep}%m{sep}%d')

    @classproperty
    def trading_dates(self):
        with read_context(self.dbsha):
            return list(self.dbsha.select(self.dbsha.date).order_by(self.dbsha.date).scalars())

    @classmethod
    @lru_cache(maxsize=1)
    def max_trading_date(self):
        with read_context(self.dbsha):
            mxdate = self.dbsha.select(fn.MAX(self.dbsha.date)).scalar()
        if mxdate != self.today():
            sysdate, tradeday = self.get_today_system_date()
            if tradeday:
                return sysdate
        return mxdate

    @classmethod
    @lru_cache(maxsize=1)
    def max_traded_date(self):
        with read_context(self.dbsha):
            mxdate = self.dbsha.select(fn.MAX(self.dbsha.date)).scalar()
        return mxdate

    @classmethod
    def is_trading_date(self, date):
        if date == self.max_trading_date():
            return True
        return date in self.trading_dates

    @classmethod
    @lru_cache(maxsize=1)
    def get_today_system_date(self):
        url = 'http://www.sse.com.cn/js/common/systemDate_global.js'
        sse = requests.get(url)
        if sse.status_code == 200:
            if 'var systemDate_global' in sse.text:
                sys_date = sse.text.partition('var systemDate_global')[2].strip(' =;')
                sys_date = sys_date.split()[0].strip(' =;"')
            if 'var whetherTradeDate_global' in sse.text:
                istrading_date = sse.text.partition('var whetherTradeDate_global')[2].strip(' =;')
                istrading_date = istrading_date.split()[0].strip(' =;')

            return sys_date, json.loads(istrading_date.lower())
        return None, None

    @classmethod
    def is_holiday(self, date):
        if self.is_trading_date(date):
            return False

        if date == self.today():
            sys_date, tradeday = self.get_today_system_date()
            return not tradeday

        return True

    @classmethod
    @lru_cache(maxsize=10)
    def prev_trading_date(self, date, ndays=1):
        """
        获取指定日期前第N个交易日
        :param date: 基准日期
        :param ndays: 向前偏移的天数（默认1）
        :return: 前第N个交易日日期，如果不存在返回第一天
        """
        dates = self.trading_dates
        idx = bisect.bisect_left(dates, date)
        return self.trading_dates[max(idx - ndays, 0)]

    @classmethod
    @lru_cache(maxsize=10)
    def next_trading_date(self, date, ndays=1):
        """
        获取指定日期后第N个交易日
        :param date: 基准日期
        :param ndays: 向后偏移的天数（默认1）
        :return: 后第N个交易日日期，如果不存在返回最后一天
        """
        idx = bisect.bisect_right(self.trading_dates, date)  # 找到第一个>date的索引
        return self.trading_dates[min(idx + ndays, len(self.trading_dates)) - 1]

    @classmethod
    def calc_trading_days(self, bdate, edate):
        """
        计算两个日期(含)之间的交易日数
        :param bdate: 起始日期
        :param edate: 结束日期
        :return: 交易日数
        """
        return bisect.bisect_right(self.trading_dates, edate) - bisect.bisect_left(self.trading_dates, bdate)

    @classmethod
    def clear_cache(cls):
        """强制刷新缓存"""
        cls.max_traded_date.cache_clear()
        cls.max_trading_date.cache_clear()


class StockHistory(BaseKHistory):
    def __init__(self, code):
        super().__init__(code)

    @property
    def full_code(self):
        return srt.get_fullcode(self.code)

    @property
    def saved_kltypes(self):
        return ('d', 'w', 'm', '15')

    def get_ktablename(self, period='d'):
        return AllStocks.get_ktablename(self.full_code.upper(), period)


class AllIndexes:
    @classproperty
    def db(cls):
        return create_model(AllIndice)

    @classproperty
    def hisdb(cls) -> PooledMySQLDatabase:
        return get_database('history_db')

    @classmethod
    def read_all(self):
        with read_context(self.db):
            alldata = self.db.select()
        return convert_dict_data(alldata.dicts(), self.db._meta.columns, 'list')

    @classmethod
    def load_info(self, code):
        fcode = code
        if len(code) == 6:
            fcode = ('sh' if code.startswith('00') else 'sz') + code
        qt = srt.quotes(fcode)
        insert_or_update(self.db, [{'code': code, 'name': qt[fcode]['name']}], ['code'])

    @classmethod
    def index_name(self, code):
        code = code[-6:]
        with read_context(self.db):
            return self.db.select(self.db.name).where(self.db.code == code).scalar()

    @classmethod
    def get_ktablename(self, code, period='d'):
        code = code[-6:]
        assert len(code) == 6, f'index code should be 6 digits not {code}'
        if period == 'd':
            return f'i_k_his_{code}'
        if period == 'w':
            return f'i_kw_his_{code}'
        if period == 'm':
            return f'i_km_his_{code}'
        return None

    @classmethod
    def update_kline_data(self, kltype='d'):
        '''
        更新表中所有指数的K线数据
        Args:
            kltype: K线类型 (d, w, m) 指数只保存这几种K线数据
        '''
        with read_context(self.db):
            codequery = self.db.select(self.db.code)
        indice_code = [IndexHistory(r.code).full_code for r in codequery]
        if not indice_code:
            return

        self.update_klines_by_code(indice_code, kltype)

    @classmethod
    def update_klines_by_code(self, stocks, kltype: str='d'):
        uplens = {c: self.count_bars_to_updated(c, kltype) for c in stocks}
        fixlens = {}
        for c,l in uplens.items():
            if l == 0:
                continue
            if l not in fixlens:
                fixlens[l] = []
            fixlens[l].append(c)
        if not fixlens:
            return

        ofmt = srt.set_array_format('dict')
        srt.set_default_sources('dklines', 'dklines', ('xueqiu', 'ths', 'eastmoney', 'tdx', 'sina'), True)
        klines = {}
        for l, codes in fixlens.items():
            if l == 10000:
                klines.update(srt.fklines(codes, kltype, 0))
            else:
                klines.update(srt.klines(codes, kltype, l+2, 0))
        for c in klines:
            if c in stocks:
                self.save_kline_data_todb(c, kltype, klines[c])
        srt.set_array_format(ofmt)

    @classmethod
    def read_index_daily_price_change(self, code):
        his_data = IndexHistory(code).get_index_hist_data('d', ['date', 'close', 'p_change'])
        index_hist_data = ("date", "zs" + self.code),
        for (date, close, p_change) in his_data:
            index_hist_data += (DateConverter.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        return index_hist_data

    @classmethod
    def table_exists(self, name):
        with read_context(self.hisdb):
            cur = self.hisdb.cursor()
            cur.execute(f"select count(*) from information_schema.tables where table_name = '{name}'")
            return cur.fetchone()[0] > 0

    @classmethod
    def read_mxdate(self, name):
        with read_context(self.hisdb):
            cur = self.hisdb.cursor()
            try:
                cur.execute(f"select max(date) from {name}")
                return cur.fetchone()[0]
            except:
                return None

    @classmethod
    def count_bars_to_updated(self, code, period='d'):
        mxdate = self.read_mxdate(self.get_ktablename(code, period))
        return self.guess_bars_since(mxdate, period)

    @staticmethod
    def guess_bars_since(last_date, period='d'):
        if last_date is None:
            return 10000

        days = (datetime.now() - datetime.strptime(last_date, "%Y-%m-%d")).days
        if period == 'd':
            return days
        if period == 'w':
            return days // 7
        if period == 'm':
            return days // 30
        if period.isdigit():
            if int(period) == 1:
                return days * 240
            if int(period) % 5 == 0:
                return days * 240 / int(period)
        return 0

    @classmethod
    def save_kline_data_todb(self, code, kltype, klines):
        """使用原生SQL保存K线数据到数据库"""
        table_name = self.get_ktablename(code, kltype)
        mxdate = self.read_mxdate(table_name)
        klines_with_col = []

        # 1. 预处理数据
        for i in range(0, len(klines)):
            if mxdate is None or klines[i]['time'] >= mxdate:
                kl = {
                    'date': klines[i]['time'],
                    'open': klines[i]['open'],
                    'close': klines[i]['close'],
                    'high': klines[i]['high'],
                    'low': klines[i]['low'],
                    'volume': klines[i]['volume'] / 100,
                    'amount': klines[i]['amount'] / 10000,
                }
                # 计算涨跌幅
                if 'change' in klines[i]:
                    kl['p_change'] = klines[i]['change'] * 100
                else:
                    prev_close = klines[i-1]['close'] if i > 0 else klines[i]['close']
                    kl['p_change'] = (klines[i]['close'] - prev_close) * 100 / prev_close if prev_close != 0 else 0

                # 计算价格变化
                kl['price_change'] = klines[i].get('change_px', klines[i]['close'] - klines[i-1]['close'] if i > 0 else 0)

                klines_with_col.append(kl)

        if not klines_with_col or klines_with_col[-1]['date'] == mxdate:
            return

        if mxdate is None and not self.table_exists(table_name):
            create_model(KHistory, table_name)

        self.update_to_history_table(table_name, mxdate, klines_with_col, kltype)

    @classmethod
    def update_to_history_table(self, table_name, mxdate, newdata, period):
        cols = [c.name for c in self.hisdb.get_columns(table_name) if c.name != 'id']
        with write_context(self.hisdb):
            cur = self.hisdb.cursor()

            try:
                # 3. 处理需要更新的记录
                updated_date = mxdate if mxdate else ''
                upkl = newdata[0] if (mxdate and DateConverter.is_same_period(newdata[0]['date'], mxdate, period)) else None

                if upkl:
                    # 使用参数化查询防止SQL注入
                    set_clause = ','.join([f"{c}=%s" for c in cols])
                    params = [upkl[c] for c in cols] + [mxdate]
                    cur.execute(
                        f"UPDATE {table_name} SET {set_clause} WHERE date=%s",
                        params
                    )
                    updated_date = upkl['date']

                # 4. 处理需要插入的新记录
                newkls = [kl for kl in newdata if kl['date'] > updated_date]
                if newkls:
                    placeholders = ','.join(['%s'] * len(cols))
                    sql = f"INSERT INTO {table_name} ({','.join(cols)}) VALUES ({placeholders})"
                    cur.executemany(sql, [tuple(kl[c] for c in cols) for kl in newkls])

                self.hisdb.commit()

            except Exception as e:
                self.hisdb.rollback()
                raise Exception(f"保存K线数据失败: {str(e)}")


class AllStocks(AllIndexes):
    @classproperty
    def db(cls) -> AllStockTbl:
        return create_model(AllStockTbl)

    @classmethod
    def get_ktablename(self, code, period='d'):
        code = srt.get_fullcode(code).upper()
        assert len(code) == 8 and code.startswith(('SH', 'SZ', 'BJ')), f'code should starts with SH/SZ/BJ not {code}'
        if period == 'd':
            return f's_k_his_{code}'
        if period == 'w':
            return f's_kw_his_{code}'
        if period == 'm':
            return f's_km_his_{code}'
        if period == '15':
            return f's_k15_his_{code}'

    @classmethod
    def get_fflow_tablename(self, code):
        code = srt.get_fullcode(code).upper()
        assert len(code) == 8 and code.startswith(('SH', 'SZ', 'BJ')), f'code should starts with SH/SZ/BJ not {code}'
        return f's_fflow_{code}'

    @classmethod
    def save_fflow_todb(self, code, fflow):
        mxdate = self.read_mxdate(self.get_fflow_tablename(code))
        if mxdate is None:
            return

        flow_with_cols = []
        fcols = ['main', 'mainp', 'small', 'smallp', 'middle', 'midllep', 'big', 'bigp', 'super', 'superp']
        for i in range(0, len(fflow)):
            if mxdate is None or fflow[i]['time'] >= mxdate:
                flow_with_cols.append({
                    'date': fflow[i]['time'],
                    ** {k: v[k] for k,v in fflow[i].items() if k in fcols}
                })
        table_name = self.get_fflow_tablename(code)
        if mxdate is None and not self.table_exists(table_name):
            create_model(FlowHistory, table_name)
        self.update_to_history_table(table_name, mxdate, flow_with_cols, 'd')

    @classmethod
    def update_stock_daily_kline_and_fflow(self):
        '''
        通过涨幅榜更新当日K线数据和资金流数据，必须盘后执行，盘中获取的收盘价为当时的最新价

        :return: 有最新价但是与数据库中保存的数据不连续的股票列表，需单独获取股票K线
        '''
        from stockrt.sources.eastmoney import EastMoney
        class EmRank(EastMoney):
            pgsize = 200
            dtoday = datetime.now().strftime("%Y-%m-%d")
            def get_fullcode(self, x):
                return x

            def get_rkurl(self, i):
                url = (
                    'http://33.push2.eastmoney.com/api/qt/clist/get?pn=%d&pz=%d&po=1&np=1&'
                    '&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3'
                    '&fs=m:0+t:6+f:!2,m:0+t:13+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2,m:0+t:81+s:2048'
                    '&fields=f1,f2,f3,f4,f5,f6,f15,f16,f17,f12,f13,f14,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f124'
                ) % (i, self.pgsize)
                headers = {
                    **self._get_headers(),
                    'Host': '33.push2.eastmoney.com',
                }
                return url, headers

            @staticmethod
            def merge_ranks(rkres):
                return {
                    rk['f12']: {
                        'name': rk['f14'],
                        'time': EmRank.dtoday,
                        'close': rk['f2'],
                        'high': rk['f15'],
                        'low': rk['f16'],
                        'open': rk['f17'],
                        'change_px': rk['f4'],
                        'change': rk['f3'],
                        'volume': rk['f5'],
                        'amount': rk['f6'] / 10000,
                        'main': rk['f62'],
                        'mainp': rk['f184'],
                        'small': rk['f84'], 'middle': rk['f78'], 'big': rk['f72'], 'super': rk['f66'],
                        'smallp': rk['f87'], 'midllep': rk['f81'], 'bigp': rk['f75'], 'superp': rk['f69']
                    } for rk in rkres['data']['diff'] if rk['f3'] != '-'
                }

            def format_response(self, response):
                rks = {}
                for i, r in response:
                    rks.update(self.merge_ranks(json.loads(r)))
                return rks

            def fetchranks(self, pages):
                return self._fetch_concurrently(pages, self.get_rkurl, self.format_response)

        emrk = EmRank()
        url, headers = emrk.get_rkurl(1)
        r1 = emrk.session.get(url, headers=headers)
        data = r1.json()
        result = emrk.merge_ranks(data)
        emrk.pgsize = len(data['data']['diff'])
        pages = data['data']['total'] // emrk.pgsize + 2
        result.update(emrk.fetchranks([i for i in range(2, pages)]))
        with read_context(self.db):
            codequery = self.db.select(self.db.code, self.db.name, self.db.type).where(self.db.quit_date == None)
            stock_cns = {r.code[-6:]: r.name for r in codequery if r.code.startswith(('SH', 'SZ', 'BJ')) and r.type in ('ABStock', 'BJStock')}
        unconfirmed = []
        for c, kl in result.items():
            mxdate = self.read_mxdate(self.get_ktablename(c, 'd'))
            if TradingDate.prev_trading_date(emrk.dtoday) == mxdate:
                self.save_kline_data_todb(c, 'd', [kl])
                self.save_fflow_todb(c, [kl])
            elif mxdate is None or mxdate < TradingDate.prev_trading_date(emrk.dtoday):
                unconfirmed.append(c)
            if c in stock_cns and stock_cns[c] != kl['name']:
                with write_context(self.db):
                    self.db.update({self.db.name: kl['name']}).where(self.db.code == c).execute()
        return unconfirmed


    @classmethod
    def update_kline_data(self, kltype: str='d'):
        '''
        更新表中所有有效股票的K线数据
        Args:
            kltype: K线类型 (d, w, m, 15)
        '''
        if kltype == 'd':
            stocks = self.update_stock_daily_kline_and_fflow()
        else:
            with read_context(self.db):
                codequery = self.db.select(self.db.code, self.db.name, self.db.type).where(self.db.quit_date == None)
                stocks = [r.code[-6:] for r in codequery if r.code.startswith(('SH', 'SZ', 'BJ')) and r.type in ('ABStock', 'BJStock')]
        if not stocks:
            return

        self.update_klines_by_code(stocks, kltype)

