# Python 3
# -*- coding:utf-8 -*-

import abc
from functools import lru_cache
from peewee import fn
from phon.hu import lazy_property, classproperty, convert_dict_data
from phon.hu.hu import DateConverter, datetime, timedelta
from phon.data.tables import AllStocks, AllIndice, KHistory
from phon.data.db import create_model, read_context, write_context, insert_or_update
import stockrt as srt


class BaseKHistory:
    def __init__(self, code):
        self.code = code

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
            mxdate = ktable.select(fn.MAX(ktable.date)).scalar()
        return self.guess_bars_since(mxdate, period)

    def is_same_period(self, d1, d2, period='d'):
        if period not in self.saved_kltypes:
            return False
        if not d1 or not d2:
            return False

        if period == 'd':
            return d1 == d2
        if period == 'm':
            return d1[:7] == d2[:7]
        elif period == 'w':
            date1 = datetime.strptime(d1, '%Y-%m-%d').date()
            date2 = datetime.strptime(d2, '%Y-%m-%d').date()
            monday1 = date1 - timedelta(days=date1.weekday())
            monday2 = date2 - timedelta(days=date2.weekday())
            return monday1 == monday2

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
            upkl = klines_with_col[0] if self.is_same_period(klines_with_col[0]['date'], mxdate, kltype) else None
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
        super().__init__(code[-6:])

    @property
    def full_code(self):
        if self.code.startswith('00'):
            return 'sh' + self.code
        return 'sz' + self.code

    def get_ktablename(self, period='d'):
        return AllIndexes.get_ktablename(self.code, period)


class StockHistory(BaseKHistory):
    def __init__(self, code):
        super().__init__(code)

    @property
    def full_code(self):
        return srt.get_fullcode(self.code.lower())

    @property
    def saved_kltypes(self):
        return ('d', 'w', 'm', '15')

    def get_ktablename(self, period='d'):
        if period == 'd':
            return f's_k_his_{self.full_code.upper()}'
        if period == 'w':
            return f's_kw_his_{self.full_code.upper()}'
        if period == 'm':
            return f's_km_his_{self.full_code.upper()}'
        if period == '15':
            return f's_k15_his_{self.full_code.upper()}'
        return None


class AllIndexes:
    @classproperty
    def db(cls):
        return create_model(AllIndice)

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
            indice_code = [r.code for r in codequery]
        if not indice_code:
            return
        ihdb = {c: IndexHistory(c) for c in indice_code}
        uplens = {c: ihdb[c].count_bars_to_updated(kltype) for c in indice_code}
        fixlens = {}
        for c,l in uplens.items():
            if l == 0:
                continue
            if l not in fixlens:
                fixlens[l] = []
            fixlens[l].append(ihdb[c].full_code)
        if not fixlens:
            return

        srt.set_array_format('dict')
        srt.set_default_sources('dklines', 'dklines', ('xueqiu', 'ths', 'eastmoney', 'tdx', 'sina'), True)
        klines = {}
        for l, ic in fixlens.items():
            if l == 10000:
                klines.update(srt.fklines(ic, kltype, 0))
            else:
                klines.update(srt.klines(ic, kltype, l+2, 0))
        for c in indice_code:
            if ihdb[c].full_code in klines:
                ihdb[c].save_klines_todb(kltype, klines[ihdb[c].full_code])

    @classmethod
    def read_index_daily_price_change(self, code):
        his_data = IndexHistory(code).get_index_hist_data('d', ['date', 'close', 'p_change'])
        index_hist_data = ("date", "zs" + self.code),
        for (date, close, p_change) in his_data:
            index_hist_data += (DateConverter.days_since_2000(date), round(float(close), 2), round(float(p_change), 2) if not p_change == "None" else ''),

        return index_hist_data
