# Python 3
# -*- coding:utf-8 -*-

from flask import Flask, flash, redirect, render_template, request, session, abort, url_for
import json
import requests
import urllib.parse
import sys
sys.path.append("..")
from utils import *
from user import *

app = Flask(__name__)
app.secret_key = "any_string_make_secret_key"
#app.config["SECRET_KEY"] = "any_string_make_secret_key"

@app.route('/guest', methods=['GET'])
def guest():
    session['logged_in'] = False
    session['useremail'] = None
    session['username'] = "Guest"
    return render_template('home.html')

@app.route('/logout', methods=['GET'])
def logout():
    session['logged_in'] = False
    session['useremail'] = None
    session['username'] = "Guest"
    return redirect(url_for('guest'))

@app.route('/login', methods=['GET','POST'])
def login():
    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    if request.method == 'GET':
        if not session.get('logged_in'):
            return render_template('login.html', loginsignup = True)
        else:
            return render_template('home.html')
    elif request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        user = usermodel.user_by_email(email)

        if user and usermodel.check_password(user, request.form['password']):
            session['logged_in'] = True
            session['useremail'] = user.email
            session['username'] = user.name
            return render_template('home.html')
        else:
            #print(user.to_string(), request.form['password'], user.password)
            flash('wrong username or password')
            return render_template('login.html', loginsignup = True) 

@app.route("/signup", methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        gen_db = SqlHelper(password = db_pwd, database = "general")
        usermodel = UserModel(gen_db)
        existing_user = usermodel.user_by_email(email)

        if password == request.form['confirm']:
            if existing_user is None:
                user = usermodel.add_new(username, password, email)
                session['logged_in'] = True
                session['useremail'] = user.email
                session['username'] = user.name
                return render_template('home.html')

            flash('A user already exists with that email address.')
            return redirect(url_for('signup'))
    return render_template('/signup.html',
                           title='Create an Account.',
                           loginsignup = True,
                           template='signup-page',
                           body="Sign up for a user account.")

def split_combined_dates(strDates):
    if not strDates:
        return None
        
    dates = []
    for i in range(0, int(len(strDates)/10)):
        dates.append(strDates[i*10:i * 10 + 10])
    return dates

@app.route('/fundbuy', methods=['POST'])
def fundbuy():
    if not session.get('logged_in'):
        return "Please login."

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    if request.method == 'POST':
        code = request.form.get("code", type=str,default=None)
        date = request.form.get("date", type=str,default=None)
        cost = request.form.get("cost", type=str,default=None)
        combined_dates = request.form.get("budget_dates", type=list,default=None)
        budget_dates = split_combined_dates(combined_dates)
        rollin_date = request.form.get("rollin_date", type=str,default=None)
        print("fundbuy form")
        print(type(request.form))
        print(code, date, cost, budget_dates, rollin_date)
        user.buy_not_confirm(code, date, cost, budget_dates, rollin_date)
        user.confirm_buy(code, date)
        return "OK", 200

@app.route('/fundsell', methods=['POST'])
def fundsell():
    if not session.get('logged_in'):
        return "Please login."

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    if request.method == 'POST':
        code = request.form.get("code", type=str, default=None)
        date = request.form.get("date", type=str, default=None)
        combined_dates = request.form.get("buydates", type=str, default=None)
        buydates = split_combined_dates(combined_dates)
        print("fundsell form")
        print(code, date, buydates)
        user.sell_not_confirm(code, date, buydates)
        user.confirm_sell(code, date)
        return "OK", 200

@app.route('/fundsummary', methods=['GET'])
def fundsummary():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    user.update_funds()
    fundsjson = user.get_holding_funds_json()
    hist_data = user.get_holding_funds_hist_data()
    return render_template('/fundsummary.html', 
        title = "持基表",
        fundsJson = fundsjson,
        hist_data_arr = hist_data
        )


@app.route('/dashboard', methods=['GET'])
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return "login success!"

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
    return render_template('login.html', loginsignup = True)

if __name__ == '__main__':
    app.run(debug=True)

