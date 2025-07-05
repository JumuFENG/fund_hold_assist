import json
import os
from functools import lru_cache


class Config:
    @classmethod
    @lru_cache(maxsize=None)
    def all_configs(self):
        cfg_path = os.path.join(os.path.dirname(__file__), '../config/config.json')
        allconfigs = None
        if not os.path.isfile(cfg_path):
            allconfigs = {}
            allconfigs['dataservice'] = {
                'server': 'http://localhost/5000/',
                'user': 'test@test.com',
                'password': '123'
            }
            allconfigs['tradeservice'] = {
                'server': 'http://localhost:5888/'
            }
            allconfigs['iun'] = {
            }
            with open(cfg_path, 'w') as f:
                json.dump(allconfigs, f, indent=4)
            return allconfigs

        with open(cfg_path, 'r') as f:
            allconfigs = json.load(f)
        return allconfigs

    @classmethod
    def data_service(self):
        return self.all_configs()['dataservice']

    @classmethod
    def trading_service(self):
        return self.all_configs()['tradeservice']

    @classmethod
    def iun_config(self):
        return self.all_configs()['iun']


class IunCache:
    cached_strategies = {}
    delayed_tasks = []
    @classmethod
    def cache_strategy_data(self, acc, code, data):
        for k, v in data['strategies']['strategies'].items():
            for i, val in v.items():
                if isinstance(val, str):
                    if val.isdigit():
                        data['strategies']['strategies'][k][i] = int(val)
                    else:
                        try:
                            data['strategies']['strategies'][k][i] = float(val)
                        except:
                            pass
            data['strategies']['strategies'][k] = {i: val for i, val in data['strategies']['strategies'][k].items() if val is not None}
        self.cached_strategies[(acc, code)] = data

    @classmethod
    def get_buy_details(self, acc, code):
        if (acc, code) not in self.cached_strategies or 'buydetail' not in self.cached_strategies[(acc, code)]['strategies']:
            return []
        return self.cached_strategies[(acc, code)]['strategies']['buydetail']

    @classmethod
    def update_buy_details(self, acc, code, buydetails):
        if (acc, code) not in self.cached_strategies:
            return
        self.cached_strategies[(acc, code)]['strategies']['buydetail'] = buydetails

    @classmethod
    def get_strategy_meta(self, acc, code, skey):
        if (acc, code) not in self.cached_strategies:
            return None
        for s in self.cached_strategies[(acc, code)]['strategies']['strategies'].values():
            if s['key'] == skey:
                return s

    @classmethod
    def update_strategy_meta(self, acc, code, skey, dmeta):
        if (acc, code) not in self.cached_strategies:
            return
        for s in self.cached_strategies[(acc, code)]['strategies']['strategies'].values():
            if s['key'] == skey:
                s.update(dmeta)

    @classmethod
    def get_stock_strategy(cls, acc, code):
        if (acc, code) in cls.cached_strategies:
            return cls.cached_strategies[(acc, code)]['strategies']
        return None

    @classmethod
    def get_account_holdcount(cls, acc, code):
        if acc == '':
            acc = 'normal' if ('normal', code) in cls.cached_strategies else 'collat'
        if acc == 'credit':
            acc = 'collat'
        if (acc, code) in cls.cached_strategies:
            return cls.cached_strategies[(acc, code)].get('holdCount', 0)
        return 0

    @classmethod
    def all_stocks_cached(self):
        return [c for a,c in self.cached_strategies.keys()]
