# Python 3
# -*- coding:utf-8 -*-

import sys
sys.path.append("../..")
from utils import *

class User():
    def __init__(self, id, name, email, password=None):
        self.id = id
        self.name = name
        self.email = email
        self.password = None
        

class UserModel():
    def __init__(self, sqldb):
        self.tablename = 'users'
        self.sqldb = sqldb

    def add_new(self, name, password, email):
        if not self.sqldb.isExistTable(self.tablename):
            attrs = {'name':'varchar(255) DEFAULT NULL', 'password':"varchar(255) DEFAULT NULL",  'email':"varchar(255) DEFAULT NULL"}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.creatTable(self.tablename, attrs, constraint)
        (result,), = self.sqldb.select(self.tablename, 'count(*)', ["email = '%s'" % email])
        if result and result != 0:
            print("email: %s alread exists for: " % email, self.id, self.name)
            return
        self.sqldb.insert(self.tablename, {'name':name, 'password':password, 'email':email})

    def user_by_id(self, id):
        (id, name, password, email), = self.sqldb.select(self.tablename, "*", ["id = '%s'" % id])
        return User(id, name, email, password)

    def user_by_email(self, email):
        (id, name, password, email), = self.sqldb.select(self.tablename, "*", ["email = '%s'" % email])
        return User(id, name, email, password)

    def set_password(self, user, password):
        user.password = password
        self.sqldb.update(self.tablename, {'password':password}, {'id' : str(user.id)})

    def check_password(self, user, password):
        return password == user.password
