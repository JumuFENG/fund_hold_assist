import json
import importlib.util
import pandas as pd
import stockrt as srt
from emxg import search_emxg
from phon.hu import classproperty
from phon.data.tables import StockList
from phon.data.db import create_model, read_context, write_context


class PureLost4Up:
    '''
    连续4个季度亏损大于1000万元
    '''
    @classproperty
    def db(cls):
        return create_model(StockList, 'stock_purelost4up')

    @classmethod
    def all_stocks(cls):
        with read_context(cls.db):
            d = list(cls.db.select())
        return [r.code for r in d]

    @classmethod
    def update_em(cls):
        pdata = search_emxg('连续4个季度亏损大于1000万元')
        cls.replace([srt.get_fullcode(code[:6]).upper() for code in pdata['代码']])

    @classmethod
    def update_from_json(cls, file):
        with open(file) as f:
            data = json.load(f)
        cls.replace([srt.get_fullcode(code[0][:6]).upper() for code in data])

    @classmethod
    def replace(cls, data):
        with write_context(cls.db):
            cls.db.delete().execute()
            cls.db.insert_many([ {cls.db.code: d} for d in data]).execute()

