# Python 3
# -*- coding:utf-8 -*-

import sys
sys.path.append("..")
from flask import Flask
from flask import Flask, flash, redirect, render_template, request, session, abort
from utils import *
import requests
import urllib.parse

app = Flask(__name__)
app.secret_key = "any_string_make_secret_key"
#app.config["SECRET_KEY"] = "any_string_make_secret_key"

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'GET':
        if not session.get('logged_in'):
            return render_template('login.html')
        else:
            return "login success!"
    elif request.method == 'POST':
        if request.form['password'] == 'password' and request.form['username'] == 'admin':
            session['logged_in'] = True
        else:
            flash('wrong username or password')
        return render_template('login.html') 

@app.route('/api/')
def index():
    return "this is a root for api."

@app.route('/api/get')
def get_http_request():
    url = urllib.parse.unquote(request.args.get('url',''))
    if not url:
        return "No url specified."

    rsp = requests.get(url)
    return rsp.content.decode('utf-8')

@app.route('/api/v1/fund/buy', methods=['POST'])
def add_fund_buy_rec():
    return "OK", 200

@app.route('/api/v1/fund/test', methods=['GET'])
def test_get():
    sqldb = SqlHelper(password = db_pwd, database = "fund_center")
    r = sqldb.select("funds_info", "*", "code=000217")
    print(r)
    return str(r)

if __name__ == '__main__':
    app.run(debug=True)

