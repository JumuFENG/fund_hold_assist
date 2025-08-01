import os
import sys
import logging
import json
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


delayed_tasks = []
lg_path = os.path.join(os.path.dirname(__file__), '../logs/iun.log')
if not os.path.isdir(os.path.dirname(lg_path)):
    os.mkdir(os.path.dirname(lg_path))

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s | %(asctime)s-%(filename)s@%(lineno)d<%(name)s> %(message)s',
    handlers=[logging.FileHandler(lg_path), logging.StreamHandler(sys.stdout)],
    force=True
)

logger : logging.Logger = logging.getLogger('iun')
