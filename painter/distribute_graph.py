# Python 3
# -*- coding:utf-8 -*-

import matplotlib as mpl
import matplotlib.pyplot as plt
from utils import *

class Distribute():
    """
    Moved to painter.show_distribute()
    """
    def __init__(self, sqldb):
        self.sqldb = sqldb
        self.rateCounts = {}
        self.netvalCounts = {}
        