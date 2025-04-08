import json
import os

class Config:
    __allconfigs = None
    @classmethod
    def all_configs(self):
        if self.__allconfigs is None:
            cfg_path = os.path.join(os.path.dirname(__file__), '../config/config.json')
            if not os.path.isfile(cfg_path):
                self.__allconfigs = {}
                self.__allconfigs['dataservice'] = {
                    'server': 'http://localhost/5000/',
                    'user': 'test@test.com',
                    'password': '123'
                }
                self.__allconfigs['tradeservice'] = {
                    'server': 'http://localhost:5888/'
                }
                self.__allconfigs['iun'] = {
                    'enable_rtp_check': True,
                    'enable_kl_check': False,
                }
                with open(cfg_path, 'w') as f:
                    json.dump(self.__allconfigs, f, indent=4)
            else:
                with open(cfg_path, 'r') as f:
                    self.__allconfigs = json.load(f)

        return self.__allconfigs

    @classmethod
    def data_service(self):
        return self.all_configs()['dataservice']

    @classmethod
    def trading_service(self):
        return self.all_configs()['tradeservice']

    @classmethod
    def iun_config(self):
        return self.all_configs()['iun']

