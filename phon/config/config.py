import json
import os

class Config:
    __allconfigs = None
    @classmethod
    def all_configs(self):
        if self.__allconfigs is None:
            cfg_path = os.path.join(os.path.dirname(__file__), 'config.json')
            if not os.path.isfile(cfg_path):
                self.__allconfigs = {}
                self.__allconfigs['dbconfig'] = {
                    'host': 'localhost',
                    'port': 3306,
                    'user': 'root',
                    'password': '123'
                }
                with open(cfg_path, 'w') as f:
                    json.dump(self.__allconfigs, f, indent=4)
            else:
                with open(cfg_path, 'r') as f:
                    self.__allconfigs = json.load(f)

        return self.__allconfigs

    @classmethod
    def db_config(self):
        return self.all_configs()['dbconfig']
