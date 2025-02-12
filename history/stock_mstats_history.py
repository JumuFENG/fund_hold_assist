# Python 3
# -*- coding:utf-8 -*-
import re
import json
import gzip
from utils import *


class StockMarkerStats(TableBase):
    def __init__(self):
        super().__init__()

    def initConstrants(self):
        self.dbname = history_db_name
        self.tablename = 'stock_market_stats_history'
        self.colheaders = [
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'time', 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'stats', 'type':'blob DEFAULT NULL'}
        ]

    def saveDailyStats(self, stats):
        values = []
        for d,t,s in stats:
            sstr = json.dumps(s)
            cmpsstr = gzip.compress(sstr.encode('utf-8'))
            values.append([d, t, cmpsstr])

        if len(values) > 0:
            self.sqldb.insertUpdateMany(self.tablename, [col['col'] for col in self.colheaders], [column_date, 'time'], values)

    def getDumpKeys(self):
        return 'stats'

    def getDumpCondition(self, date=None):
        if date is None:
            date = self._max_date()
        return f'{column_date}="{date}"'

    def dumpDataByDate(self, date=None):
        dstats = super().dumpDataByDate(date)
        stats = []
        for s, in dstats:
            stats.append(json.loads(gzip.decompress(s).decode('utf-8')))
        return stats
