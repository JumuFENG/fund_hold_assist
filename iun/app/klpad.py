import time
import datetime
import json
import pandas as pd
from functools import lru_cache
import stockrt as srt
from stockrt.sources.rtbase import requestbase
from app.guang import guang
from app.logger import logger


class klPad:
    __stocks = {}
    __factors = [2, 4, 8]

    @classmethod
    def dump(self):
        # return self.__stocks
        return {c: v for c,v in self.__stocks.items() if 'klines' in v and 15 in v['klines']}

    @classmethod
    def cache(self, code, klines=[], quotes={}, kltype=1):
        if code not in self.__stocks:
            self.__stocks[code] = {
                'klines': {},
                'quotes': {}
            }
        if quotes:
            self.__stocks[code]['quotes'].update(quotes)
            if 'bid5' in quotes:
                self.__stocks[code]['quotes']['q5time'] = time.time()

        if len(klines) == 0:
            return []
        mcount = self.merge_klines(code, kltype, klines)
        if mcount > 0:
            efacs = self.expand_kltypes(code, kltype)
            fac = [1] + efacs
            return [kltype * f for f in fac]
        return []

    @classmethod
    def merge_klines(cls, code: str, kltype: int, klines: pd.DataFrame) -> int:
        """
        将K线数据合并到存储中（DataFrame版本）

        Args:
            code: 股票代码
            kltype: K线类型（1: 分钟K线, 15: 15分钟K线等）
            klines: 输入的K线数据（需包含time/volume/amount列）
        Returns:
            更新的K线数量
        """
        if kltype <= 60 and len(klines) >= 2:
            # 如果最后一根K线的时间-当前时间>80%以上的周期，合并到上一根K线
            last_kl = klines.iloc[-1]
            time_diff = (pd.to_datetime(last_kl['time'])-datetime.datetime.now()).total_seconds()
            if time_diff > kltype * 60 * 0.8:
                klines.at[klines.index[-2], 'close'] = last_kl['close']
                klines.at[klines.index[-2], 'high'] = max(klines.iloc[-2]['high'], last_kl['high'])
                klines.at[klines.index[-2], 'low'] = min(klines.iloc[-2]['low'], last_kl['low'])
                klines.at[klines.index[-2], 'volume'] += last_kl['volume']
                if 'amount' in klines.columns:
                    klines.at[klines.index[-2], 'amount'] += last_kl['amount']
                klines = klines[:-1]

        if kltype == 1:
            # 预处理：处理1分钟K线的09:30特殊逻辑
            mask_0930 = klines['time'].str.endswith('09:30')
            if mask_0930.any():
                mask_next = klines.index[mask_0930] + 1
                mask_next = mask_next[mask_next.isin(klines.index)]
                mask_0931 = klines.index.isin(mask_next) & klines['time'].str.endswith('09:31')
                klines.loc[mask_0931, 'volume'] += klines.loc[mask_0930, 'volume'].values
                if 'amount' in klines.columns:
                    klines.loc[mask_0931, 'amount'] += klines.loc[mask_0930, 'amount'].values
                klines = klines[~mask_0930].reset_index(drop=True)

        # 检查是否已有该类型的K线数据
        stored_klines = cls.__stocks[code]['klines'].get(kltype, pd.DataFrame())
        if len(stored_klines) == 0:
            # 初始化逻辑
            if kltype == 1:
                start_idx = klines['time'].str.endswith(('09:31', '13:01')).idxmax()
                klines = klines.iloc[start_idx:].reset_index(drop=True)
            elif kltype == 15:
                start_idx = klines['time'].str.endswith('09:45').idxmax()
                klines = klines.iloc[start_idx:].reset_index(drop=True)

            cls.__stocks[code]['klines'][kltype] = klines
            return len(klines)

        # 增量更新逻辑
        if klines['time'].iloc[0] <= stored_klines['time'].iloc[-1]:
            stored_klines = stored_klines.iloc[:-1]  # 删除最后一行（假设需要替换）
        last_time = stored_klines.iloc[-1]['time'] if len(stored_klines) > 0 else ''
        mask_new = klines['time'] > last_time
        new_data = klines[mask_new].reset_index(drop=True)

        if len(new_data) > 0:
            cls.__stocks[code]['klines'][kltype] = pd.concat(
                [stored_klines, new_data],
                ignore_index=True
            ) if len(stored_klines) > 0 else new_data
        return len(new_data)

    @classmethod
    def expand_kltypes(cls, code: str, base_kltype: int) -> None:
        """
        根据基础K线周期推导更大周期的K线（DataFrame版本）

        Args:
            code: 股票代码
            base_kltype: 基础K线周期（分钟数）
        """
        base_klines = cls.__stocks[code]['klines'][base_kltype]

        efacs = []
        for fac in cls.__factors:
            ex_kltype = base_kltype * fac

            # 初始化更大周期的K线存储
            if ex_kltype not in cls.__stocks[code]['klines']:
                cls.__stocks[code]['klines'][ex_kltype] = pd.DataFrame(columns=base_klines.columns)

            # 获取已有K线的最后时间
            ex_klines = cls.__stocks[code]['klines'][ex_kltype]
            last_time = ex_klines['time'].iloc[-1] if len(ex_klines) > 0 else ''

            # 获取需要处理的新数据
            new_data = base_klines[base_klines['time'] > last_time].copy()

            # 检查是否有足够数据生成新K线
            if len(new_data) == 0:
                continue
            new_last_time = new_data['time'].iloc[-1].split()[-1]
            expand_unfinished = base_kltype <= 15 and new_last_time >= '14:56'
            if len(new_data) >= fac or expand_unfinished:
                # 删除最后一条可能不完整的K线
                if len(ex_klines) > 0:
                    ex_klines = ex_klines.iloc[:-1]
                    last_time = ex_klines['time'].iloc[-1] if len(ex_klines) > 0 else ''
                    new_data = base_klines[base_klines['time'] > last_time].copy()

                # 生成更大周期的K线
                expanded_klines = []
                for i in range(0, len(new_data), fac):
                    group = new_data.iloc[i:i+fac]
                    if len(group) == fac or expand_unfinished:
                        new_kline = {
                            'time': group['time'].iloc[-1],
                            'open': group['open'].iloc[0],
                            'close': group['close'].iloc[-1],
                            'high': group['high'].max(),
                            'low': group['low'].min(),
                            'volume': group['volume'].sum()
                        }
                        if 'amount' in group.columns:
                            new_kline['amount'] = group['amount'].sum()
                        expanded_klines.append(new_kline)

                # 合并新K线
                if expanded_klines:
                    cls.__stocks[code]['klines'][ex_kltype] = pd.concat(
                        [ex_klines, pd.DataFrame(expanded_klines)],
                        ignore_index=True
                    ) if len(ex_klines) > 0 else pd.DataFrame(expanded_klines)

                    efacs.append(fac)
        return efacs

    @classmethod
    def calc_indicators(self, code, kltype):
        if code not in self.__stocks:
            return
        exkltypes = [kltype]
        if kltype == 1 or kltype == 15:
            exkltypes += [kltype * fa for fa in self.__factors]
        for ex_kltype in exkltypes:
            if ex_kltype not in self.__stocks[code]['klines']:
                continue
            self.calc_ma(code, ex_kltype, 18)
            self.calc_bss(code, ex_kltype, 18)

    @classmethod
    def calc_ma(cls, code: str, kltype: int, n: int) -> None:
        """
        计算/增量更新移动平均线（MA）
        
        Args:
            code: 股票代码
            kltype: K线类型
            n: MA周期（如5、10等）
        """
        klines = cls.__stocks[code]['klines'][kltype]
        col_name = f'ma{n}'

        # 初始化MA列（首次计算）
        if col_name not in klines.columns:
            klines[col_name] = klines['close'].rolling(window=n, min_periods=1).mean()
            return

        # 增量计算：找到最后一个有效MA的索引（跳过NaN）
        last_valid = klines[col_name].last_valid_index()
        if last_valid is None:
            start_idx = 0
        else:
            start_idx = klines.index.get_loc(last_valid)
        start_idx = max(0, start_idx)
        if start_idx <= n:
            # 窗口未填满时，直接重新计算
            klines[col_name] = klines['close'].rolling(window=n, min_periods=1).mean()
            return

        # 增量计算：从需要更新的起始位置开始
        for i in range(start_idx, len(klines)):
            window_closes = klines['close'].iloc[i - n + 1 : i + 1]  # 取当前窗口内的收盘价
            klines.at[klines.index[i], col_name] = window_closes.mean()  # 直接计算均值

    @classmethod
    def calc_bss(cls, code: str, kltype: int, n: int) -> None:
        """
        计算/增量更新 BSS 指标
        
        Args:
            code: 股票代码
            kltype: K线类型
            n: MA周期
        """
        klines = cls.__stocks[code]['klines'][kltype]
        if len(klines) < 2:
            return

        col_name = f'bss{n}'
        ma_col = f'ma{n}'

        # 初始化bss列（保留历史值）
        if col_name not in klines.columns:
            klines[col_name] = None

        # 确定起始位置
        last_valid = klines[col_name].last_valid_index()
        start_idx = 2 if last_valid is None else klines.index.get_loc(last_valid)

        # 边界检查
        if start_idx >= len(klines):
            return

        # 向量化条件判断
        above_ma = (klines['low'] > klines[ma_col]) | (
            (klines[['open', 'close']].min(axis=1) > klines[ma_col]) & 
            ((klines['high'] - klines['low']) * 0.8 <= abs(klines['open'] - klines['close']))
        )

        below_ma = (klines['high'] < klines[ma_col]) | (
            (klines[['open', 'close']].max(axis=1) < klines[ma_col]) & 
            ((klines['high'] - klines['low']) * 0.8 <= abs(klines['open'] - klines['close']))
        )

        # 准备批量更新
        updates = {0: 'u', 1: 'u'} if start_idx == 2 else {}
        prev_bss = 'u' if start_idx == 2 else klines.at[klines.index[start_idx-1], col_name]

        for i in range(start_idx, len(klines)):
            if above_ma.iloc[i] and above_ma[i-1]:
                new_bss = 'b' if prev_bss in ('u', 'w') else 'h'
            elif below_ma.iloc[i] and below_ma[i-1]:
                new_bss = 's' if prev_bss in ('u', 'h') else 'w'
            else:
                new_bss = 'h' if prev_bss in ('b', 'h') else 'w' if prev_bss in ('s', 'w') else 'u'

            updates[klines.index[i]] = new_bss
            prev_bss = new_bss

        # 批量更新
        for idx, val in updates.items():
            klines.at[idx, col_name] = val

    @classmethod
    def get_klines(self, code, kltype=1):
        if code not in self.__stocks or kltype not in self.__stocks[code]['klines']:
            return []
        return self.__stocks[code]['klines'][kltype]

    @classmethod
    @lru_cache(maxsize=1)
    def dsvr_source(self):
        return DsvrKSource()

    @classmethod
    def load_dsvr_klines(self, stocks, kltype=101, length=1000, fq=1):
        klines = self.dsvr_source().klines(stocks, kltype, length, fq)
        for c, k in klines.items():
            self.cache(c, k, kltype=kltype)

    @classmethod
    def resize_cached_klines(self, code, n):
        if code not in self.__stocks:
            return
        for kltype in self.__stocks[code]['klines'].keys():
            self.__stocks[code]['klines'][kltype] = self.__stocks[code]['klines'][kltype].tail(n)

    @classmethod
    def get_quotes(self, code):
        if code not in self.__stocks:
            return {}
        return self.__stocks[code]['quotes']

    @classmethod
    def get_quotes5(self, code):
        if code not in self.__stocks or time.time() - self.__stocks[code]['quotes']['q5time'] > 3:
            q5 = srt.quotes5(code)
            q5['q5time'] = time.time()
            self.__stocks[code]['quotes'] = q5
        return self.__stocks[code]['quotes']

    @classmethod
    def get_lclose_from_klines(self, code):
        if code not in self.__stocks:
            return 0
        today = guang.today_date('-')
        for klines in self.__stocks[code]['klines'].values():
            if len(klines) > 0:
                msk = klines['time'].str.startswith(today)
                if msk.any():
                    first_idx = msk.idxmax()
                    if first_idx > 0:
                        return klines.loc[first_idx - 1, 'close']
        return 0

    @classmethod
    def get_zt_price(self, code):
        if code not in self.__stocks:
            return 0
        quotes = self.__stocks[code]['quotes']
        if 'top_price' not in quotes:
            lclose = quotes['lclose'] if 'lclose' in quotes else self.get_lclose_from_klines(code)
            if lclose == 0:
                return 0
            return guang.zt_priceby(lclose, zdf=guang.zdf_from_code(code))
        return quotes['top_price']

    @classmethod
    def get_dt_price(self, code):
        if code not in self.__stocks:
            return 0
        quotes = self.__stocks[code]['quotes']
        if 'bottom_price' not in quotes:
            lclose = quotes['lclose'] if 'lclose' in quotes else self.get_lclose_from_klines(code)
            if lclose == 0:
                return 0
            return guang.dt_priceby(lclose, zdf=guang.zdf_from_code(code))
        return quotes['bottom_price']

    @staticmethod
    def continuously_increase_days(code, kltype):
        klines = klPad.get_klines(code, kltype)
        if len(klines) == 0:
            return 0

        n = 0
        closes = klines['close'].values

        # 从倒数第二天开始向前比较（因为最后一天没有后一天数据）
        for i in range(len(closes)-1, 0, -1):
            if closes[i] < closes[i-1]:
                break
            if closes[i] == closes[i-1]:
                continue
            n += 1

        return n

    @staticmethod
    def continuously_dt_days(code, yz=False):
        klines = klPad.get_klines(code, 101)
        if len(klines) == 0:
            return 0

        n = 0
        highs = klines['high'].values
        lows = klines['low'].values
        closes = klines['close'].values
        for i in range(len(closes) - 1, 0, -1):
            if yz and highs[i] - lows[i] > 0:
                break
            if closes[i] <= guang.dt_priceby(closes[i-1], zdf=guang.zdf_from_code(code)):
                n += 1
        return n

    @staticmethod
    def get_last_trough(code, kltype):
        klines = klPad.get_klines(code, kltype)
        if len(klines) == 0:
            return 0

        lows = klines['low'].values
        down_num = 0
        up_num = 0
        tprice = lows[-1]
        for i in range(len(lows) - 1, 0, -1):
            if down_num < 2:
                if lows[i] < lows[i-1]:
                    continue
                if lows[i] > lows[i-1]:
                    down_num += 1
                    tprice = lows[i-1]
            else:
                if lows[i] > lows[i-1]:
                    if up_num >= 2:
                        break
                    if tprice > lows[i-1]:
                        down_num += 1
                        tprice = lows[i-1]
                    up_num = 0
                    continue
                if lows[i] < lows[i-1]:
                    up_num += 1
        if up_num >= 2 and down_num > 2:
            return tprice
        return 0


class DsvrKSource(requestbase):
    dserver = 'http://localhost/5000/'
    def __init__(self):
        super().__init__()

    @property
    def qtapi(self):
        pass

    @property
    def qt5api(self):
        pass

    @property
    def tlineapi(self):
        pass

    @property
    def mklineapi(self):
        return self.dserver + 'api/stockhist?code=%s&kltype=%s&fqt=%s&len=%s'

    @property
    def dklineapi(self):
        return self.dserver + 'api/stockhist?code=%s&kltype=%s&fqt=%s&len=%s'

    @property
    def fklineapi(self):
        return self.dserver + 'api/stockhist?code=%s&kltype=%s&fqt=%s&start=0'

    def get_quote_url(self, stocks):
        pass

    def get_tline_url(self, stock):
        pass

    def get_mkline_url(self, stock, kltype='1', length=320, fq=1):
        kltype = self.to_int_kltype(kltype)
        return self.mklineapi % (stock.upper(), kltype, fq, length), self._get_headers()

    def get_dkline_url(self, stock, kltype='101', length=320, fq=1):
        return self.get_mkline_url(stock, kltype, length, fq)

    def get_fkline_url(self, stock, kltype='101', fq=0):
        kltype = self.to_int_kltype(kltype)
        return self.fklineapi % (stock.upper(), kltype, fq), self._get_headers()

    def format_kline_response(self, rep_data, **kwargs):
        result = {}
        for c, d in rep_data:
            d = json.loads(d)
            if not d:
                continue
            karr = []
            for x in d:
                dx = [x[1]] + [float(_x) for _x in x[2:]]
                dx[6] /= 100
                dx[7] = int(dx[7]*100)
                dx[8] *= 10000
                karr.append(dx)
            result[c] = self.format_array_list(karr, ['time', 'close', 'high', 'low', 'open', 'change_px', 'change', 'volume', 'amount'])
        return result
