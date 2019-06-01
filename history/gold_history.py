# Python 3
# -*- coding:utf-8 -*-

from utils import *
import requests
from datetime import datetime, timedelta
from decimal import Decimal
import json

class Gold_history():
     """
     get gold history from dyhjw
     """
     def __init__(self, sqldb):
        self.sqldb = sqldb

