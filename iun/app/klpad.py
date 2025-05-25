from app.guang import guang


class klPad:
    __stocks = {}
    __factors = [2, 4, 8]

    @classmethod
    def dump(self):
        return self.__stocks

    @classmethod
    def cache(self, code, klines=[], quotes={}, kltype=1):
        if code not in self.__stocks:
            self.__stocks[code] = {
                'klines': {},
                'quotes': {}
            }
        self.__stocks[code]['quotes'].update(quotes)
        mcount = self.merge_klines(code, kltype, klines)
        if mcount > 0:
            self.expand_kltypes(code, kltype)
            self.calc_indicators(code, kltype)
            fac = [1]
            if mcount >= max(self.__factors):
                fac += self.__factors
            else:
                fac += [
                    fac for fac in self.__factors if
                    len(self.__stocks[code]['klines'][fac * kltype]) > 0
                    and self.__stocks[code]['klines'][fac * kltype][-1]['time'] == klines[-1]['time']]
            return [kltype * f for f in fac]
        return []

    @classmethod
    def merge_klines(self, code, kltype, klines):
        if kltype not in self.__stocks[code]['klines']:
            if kltype == 1:
                for i, kl in enumerate(klines):
                    if kl['time'].endswith('09:30'):
                        klines[i+1]['volume'] += kl['volume']
                        if 'amount' in kl:
                            klines[i+1]['amount'] += kl['amount']
                klines = [kl for kl in klines if not kl['time'].endswith('09:30')]
            self.__stocks[code]['klines'][kltype] = klines
            return len(klines)
        ucount = 0
        for i, kl in enumerate(klines):
            if kl['time'] in self.__stocks[code]['klines'][kltype]:
                continue
            if kltype == 1 and kl['time'].endswith('09:30'):
                klines[i+1]['volume'] += kl['volume']
                if 'amount' in kl:
                    klines[i+1]['amount'] += kl['amount']
                continue
            self.__stocks[code]['klines'][kltype].append(kl)
            ucount += 1
        return ucount

    @classmethod
    def expand_kltypes(self, code, base_kltype):
        for fac in self.__factors:
            ex_kltype = base_kltype * fac
            if ex_kltype not in self.__stocks[code]['klines']:
                self.__stocks[code]['klines'][ex_kltype] = []
            last_kltime = self.__stocks[code]['klines'][ex_kltype][-1]['time'] if len(self.__stocks[code]['klines'][ex_kltype]) > 0 else ''
            tail_klines = [kl for kl in self.__stocks[code]['klines'][base_kltype] if kl['time'] > last_kltime]
            for i in range(0, len(tail_klines), fac):
                gkls = tail_klines[i: i + fac]
                if fac == len(gkls):
                    exkl = {
                        'time': gkls[-1]['time'],
                        'open': gkls[0]['open'],
                        'close': gkls[-1]['close'],
                        'high': max([kl['high'] for kl in gkls]),
                        'low': min([kl['low'] for kl in gkls]),
                        'volume': sum([kl['volume'] for kl in gkls])
                    }
                    if all(['amount' in kl for kl in gkls]):
                        exkl['amount'] = sum([kl['amount'] for kl in gkls])
                    self.__stocks[code]['klines'][ex_kltype].append(exkl)

    @classmethod
    def calc_indicators(self, code, kltype):
        if code not in self.__stocks:
            return
        for fa in [1] + self.__factors:
            ex_kltype = kltype * fa
            if ex_kltype not in self.__stocks[code]['klines']:
                continue
            self.calc_ma(code, ex_kltype, 18)
            self.calc_bss(code, ex_kltype, 18)

    @classmethod
    def calc_ma(self, code, kltype, n):
        if len(self.__stocks[code]['klines'][kltype]) == 0:
            return
        if f'ma{n}' not in self.__stocks[code]['klines'][kltype][0]:
            self.__stocks[code]['klines'][kltype][0][f'ma{n}'] = self.__stocks[code]['klines'][kltype][0]['close']
        for i in range(1, len(self.__stocks[code]['klines'][kltype])):
            if f'ma{n}' in self.__stocks[code]['klines'][kltype][i]:
                continue
            if i < n:
                self.__stocks[code]['klines'][kltype][i][f'ma{n}'] = (self.__stocks[code]['klines'][kltype][i - 1][f'ma{n}'] * i + self.__stocks[code]['klines'][kltype][i]['close']) / (i + 1)
                continue
            self.__stocks[code]['klines'][kltype][i][f'ma{n}'] = (self.__stocks[code]['klines'][kltype][i - 1][f'ma{n}'] * n - self.__stocks[code]['klines'][kltype][i - n]['close'] + self.__stocks[code]['klines'][kltype][i]['close']) / n

    @classmethod
    def calc_bss(self, code, kltype, n):
        def klineApproximatelyAboveMa(kl, mlen):
            ma = kl[f'ma{mlen}']
            if kl['low'] > ma:
                return True
            return min(kl['open'], kl['close']) > ma and (kl['high'] - kl['low']) * 0.8 <= abs(kl['open'] - kl['close'])

        def klineApproximatelyBellowMa(kl, mlen):
            ma = kl[f'ma{mlen}']
            if kl['high'] < ma:
                return True

            return max(kl['open'], kl['close']) < ma and (kl['high'] - kl['low']) * 0.8 <= abs(kl['open'] - kl['close'])

        if len(self.__stocks[code]['klines'][kltype]) == 0:
            return

        if f'bss{n}' not in self.__stocks[code]['klines'][kltype][0]:
            self.__stocks[code]['klines'][kltype][0][f'bss{n}'] = 'u'
        for i in range(1, len(self.__stocks[code]['klines'][kltype])):
            if f'bss{n}' in self.__stocks[code]['klines'][kltype][i]:
                continue
            if i < 2:
                self.__stocks[code]['klines'][kltype][i][f'bss{n}'] = 'u'
                continue

            klpre = self.__stocks[code]['klines'][kltype][i - 1]
            kl = self.__stocks[code]['klines'][kltype][i]
            bss = 'u'
            ma = kl[f'ma{n}']
            if kl['low'] > ma and klineApproximatelyAboveMa(klpre, n):
                if klpre[f'bss{n}'] == 'u':
                    bss = 'b'
                else:
                    bss = 'b' if klpre[f'bss{n}'] == 'w' else 'h'
            elif kl['high'] < ma and klineApproximatelyBellowMa(klpre, n):
                if klpre[f'bss{n}'] == 'u':
                    bss = 's'
                else:
                    bss = 's' if klpre[f'bss{n}'] == 'h' else 'w'
            else:
                bss = klpre[f'bss{n}']
                if bss == 'b':
                    bss = 'h'
                elif bss == 's':
                    bss = 'w'

            self.__stocks[code]['klines'][kltype][i][f'bss{n}'] = bss

    @classmethod
    def get_klines(self, code, kltype=1):
        if code not in self.__stocks:
            return []
        return self.__stocks[code]['klines'][kltype]

    @classmethod
    def get_quotes(self, code):
        if code not in self.__stocks:
            return {}
        return self.__stocks[code]['quotes']

    @classmethod
    def get_zt_price(self, code):
        if code not in self.__stocks:
            return 0
        quotes = self.__stocks[code]['quotes']
        if 'top_price' not in quotes:
            return guang.zt_priceby(quotes['lclose'], zdf=guang.zdf_from_code(code))
        return quotes['top_price']

    @staticmethod
    def continuously_increase_days(code, kltype):
        klines = klPad.get_klines(code, kltype)
        if not klines:
            return 0

        n = 0
        for i in range(len(klines) - 1, 0, -1):
            if klines[i]['close'] < klines[i - 1]['close']:
                break
            if klines[i]['close'] == klines[i - 1]['close']:
                continue
            n += 1
        return n

    @staticmethod
    def get_last_trough(code, kltype):
        klines = klPad.get_klines(code, kltype)
        if not klines:
            return 0

        down_num = 0
        up_num = 0
        tprice = klines[-1]['low']
        for i in range(len(klines) - 1, 0, -1):
            kl = klines[i]
            kl0 = klines[i - 1]
            if down_num < 2:
                if kl['low'] < kl0['low']:
                    continue
                if kl['low'] > kl0['low']:
                    down_num += 1
                    tprice = kl0['low']
            else:
                if kl['low'] > kl0['low']:
                    if up_num >= 2:
                        break
                    if tprice > kl0['low']:
                        down_num += 1
                        tprice = kl0['low']
                    up_num = 0
                    continue
                if kl['low'] < kl0['low']:
                    up_num += 1
        if up_num >= 2 and down_num > 2:
            return tprice
        return 0

