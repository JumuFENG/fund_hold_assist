import os
import sys
import logging
import json
import base64
import random
from functools import lru_cache


class Config:
    @classmethod
    @lru_cache(maxsize=1)
    def _cfg_path(self):
        cpth = os.path.join(os.path.dirname(__file__), '../config/config.json')
        if not os.path.isdir(os.path.dirname(cpth)):
            os.mkdir(os.path.dirname(cpth))
        return cpth

    @classmethod
    @lru_cache(maxsize=None)
    def all_configs(self):
        cfg_path = self._cfg_path()
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
            allconfigs['log_level'] = 'INFO'
            self.save(allconfigs)
            return allconfigs

        with open(cfg_path, 'r') as f:
            allconfigs = json.load(f)

        if not allconfigs['dataservice']['password'].startswith('*'):
            allconfigs['dataservice']['password'] = self.simple_encrypt(allconfigs['dataservice']['password'])
            self.save(allconfigs)

        return allconfigs

    @classmethod
    def save(self, cfg):
        cfg_path = self._cfg_path()
        with open(cfg_path, 'w') as f:
            json.dump(cfg, f, indent=4)

    @classmethod
    def simple_encrypt(self, txt):
        r = random.randint(1, 5)
        x = base64.b64encode(txt.encode('utf-8'))
        for i in range(r):
            x = base64.b64encode(x)
        return '*'*r + x.decode('utf-8')

    @classmethod
    def simple_decrypt(self, etxt):
        r = etxt.rfind('*')
        etxt = etxt[r:]
        x = base64.b64decode(etxt.encode('utf-8'))
        for i in range(r+1):
            x = base64.b64decode(x)
        return x.decode('utf-8')

    @classmethod
    def data_service(self):
        return self.all_configs()['dataservice']

    @classmethod
    def trading_service(self):
        return self.all_configs()['tradeservice']

    @classmethod
    def log_level(self):
        lvl = self.all_configs().get("log_level", "INFO").upper()
        return logging._nameToLevel[lvl]


delayed_tasks = []
lg_path = os.path.join(os.path.dirname(__file__), '../logs/iun.log')
if not os.path.isdir(os.path.dirname(lg_path)):
    os.mkdir(os.path.dirname(lg_path))

logging.basicConfig(
    level=Config.log_level(),
    format='%(levelname)s | %(asctime)s-%(filename)s@%(lineno)d<%(name)s> %(message)s',
    handlers=[logging.FileHandler(lg_path), logging.StreamHandler(sys.stdout)],
    force=True
)

logger : logging.Logger = logging.getLogger('iun')
