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
        # username = request.form['username']
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

@app.route('/fundbuy', methods=['GET', 'POST'])
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
        combined_dates = request.form.get("budget_dates", type=str,default=None)
        budget_dates = split_combined_dates(combined_dates)
        rollin_date = request.form.get("rollin_date", type=str,default=None)
        print("fundbuy form")
        print(code, date, cost, budget_dates, rollin_date)
        user.buy_not_confirm(code, date, cost, budget_dates, rollin_date)
        user.confirm_buy(code, date)
        return "OK", 200
    else:
        print("fundbuy GET")
        code = request.args.get("code", type=str, default=None)
        if code == None:
            return "", 404
        print(code)
        fg = FundGeneral(user.fund_center_db(), code)
        uf = UserFund(user, code)
        buy_arr = uf.get_buy_arr(fg)
        return json.dumps(buy_arr)

@app.route('/fundsell', methods=['GET', 'POST'])
def fundsell():
    if not session.get('logged_in'):
        return "Please login."

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    if request.method == 'POST':
        code = request.form.get("code", type=str, default=None)
        date = request.form.get("date", type=str, default=None)
        act = request.form.get('action', type=str, default=None)
        if act == 'fixrollin':
            uf = UserFund(user, code)
            rolledin = request.form.get('rolledin', type=str, default='0')
            uf.fix_roll_in(date, rolledin)
        elif act == 'setsold':
            uf = UserFund(user, code)
            actual_sold = request.form.get('actual_sold', type=str, default='0')
            uf.set_actual_sold(date, actual_sold)
        elif act == 'divident':
            uf = UserFund(user, code)
            bonus = request.form.get('bonus', type=str, default='0')
            uf.add_divident(date, bonus)
        else:
            combined_dates = request.form.get("buydates", type=str, default=None)
            buydates = split_combined_dates(combined_dates)
            print("fundsell form")
            print(code, date, buydates)
            user.sell_not_confirm(code, date, buydates)
            user.confirm_sell(code, date)
        return "OK", 200
    else:
        print("fundsell GET")
        code = request.args.get("code", type=str, default=None)
        if code == None:
            return "", 404
        print(code)
        fg = FundGeneral(user.fund_center_db(), code)
        uf = UserFund(user, code)
        sell_arr = uf.get_roll_in_arr(fg)
        return json.dumps(sell_arr)

@app.route('/fundbudget', methods=['GET', 'POST'])
def fundbudget():
    if not session.get('logged_in'):
        return "Please login."

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    if request.method == 'POST':
        code = request.form.get("code", type=str, default=None)
        budget = request.form.get("budget", type=str, default=None)
        date = request.form.get("date", type=str, default=None)
        user.add_budget(code, budget, date)
        return "OK", 200
    else:
        print("fundbudget GET")
        code = request.args.get("code", type=str, default=None)
        if code == None:
            return "", 404
        print(code)
        uf = UserFund(user, code)
        budget_arr = uf.get_budget_arr()
        return json.dumps(budget_arr)

@app.route('/fundsummary', methods=['GET'])
def fundsummary():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    code = request.args.get("code", type=str, default=None)
    if not code:
        user.confirm_buy_sell()
        fundsjson = user.get_holding_funds_summary()
        hist_data = []
        return render_template('/fundsummary.html',  
            title = "持基表",
            fundsJson = fundsjson,
            hist_data_arr = hist_data
            )
    else:
        uf = UserFund(user, code)
        uf.confirm_buy_sell()
        return json.dumps(uf.get_fund_summary())

def update_history(code, email):
    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(email)
    uf = UserFund(user, code)
    uf.update_history()

@app.route('/fundhist', methods=['GET'])
def fund_hist_data():
    if request.method == 'GET':
        print("fundhist GET")
        code = request.args.get("code", type=str, default=None)
        ftype = request.args.get("type", type=str, default="fund")
        sqldb = SqlHelper(password = db_pwd, database = "fund_center")
        if ftype == "fund":
            fg = FundGeneral(sqldb, code)
            hist_data = fg.get_fund_hist_data()
            if session.get('logged_in') and not hist_data:
                update_history(code, session['useremail'])
            return json.dumps(hist_data)
        elif ftype == "index":
            if code.startswith("sz"):
                code = code[2:]
            ig = IndexGeneral(sqldb, code)
            return json.dumps(ig.get_index_hist_data())
        else:
            return "Error", 500

@app.route('/fundmisc', methods=['GET', 'POST'])
def fundmisc():
    if not session.get('logged_in'):
        return "Please login."

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    if request.method == 'POST':
        code = request.form.get("code", type=str, default=None)
        action = request.form.get("action", type=str, default=None)
        if action == 'forget':
            user.forget_fund(code)
        elif action == 'trackindex':
            icode = request.form.get("trackcode", type=str, default=None)
            uf = UserFund(user, code)
            uf.update_tracking_index(icode)
        return "OK", 200
    else:
        actype = request.args.get("action", type=str, default=None)
        code = request.args.get("code", type=str, default=None)
        if actype == 'trackindex':
            if user.is_admin():
                return "OK", 200
            uf = UserFund(user, code)
            if uf.track_index_empty():
                return "OK", 200
        elif actype == 'fundstats':
            return json.dumps(user.get_holding_funds_stats())
        elif actype == 'allfundstats':
            return json.dumps(usermodel.get_bind_users_fundstats(user))
        return "Not implement yet", 403

@app.route('/stocksummary', methods=['GET'])
def stocksummary():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    return render_template('/stock.html',  
        title = "股记盈"
        )

@app.route('/stock', methods=['GET', 'POST'])
def stock():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    user = usermodel.user_by_email(session['useremail'])
    actype = None
    if request.method == 'POST':
        actype = request.form.get("act", type=str, default=None)
        if actype == 'buy':
            return stock_buy(user, request.form)
        if actype == 'sell':
            return stock_sell(user, request.form)
        if actype == 'fixrollin':
            return stock_fix_rollin(user, request.form)
        if actype == 'fixbuy':
            return stock_fix_buy(user, request.form)
        if actype == 'fixsell':
            return stock_fix_sell(user, request.form)
        if actype == 'setrate':
            return stock_set_rates(user, request.form)
        if actype == 'setfee':
            return stock_set_fee(user, request.form)
        if actype == 'forget':
            code = request.form.get("code", type=str, default=None)
            code = code.upper()
            user.forget_stock(code)
            return 'OK', 200
    else:
        actype = request.args.get("act", type=str, default=None)
        code = request.args.get("code", type=str, default=None)
        if actype == 'summary':
            if code:
                us = UserStock(user, code)
                return json.dumps({code: us.get_stock_summary()})
            else:
                return json.dumps(user.get_holding_stocks_summary())
        if actype == 'stats':
            return json.dumps(user.get_stocks_stats())
        us = UserStock(user, code)
        if actype == 'buy':
            return json.dumps(us.get_buy_arr())
        if actype == 'sell':
            return json.dumps(us.get_sell_arr())
        return "Not implement yet", 403

def stock_buy(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    date = form.get('date', type=str, default=None)
    price = float(form.get('price', type=str, default=None))
    portion = int(form.get('ptn', type=str, default=None))
    rollins = form.get('rid', type=str, default=None)
    if rollins:
        rollins = rollins.strip('_').split('_')
    us = UserStock(user, code)
    us.buy(date, price, portion, rollins)
    return "OK", 200

def stock_fix_buy(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    buyid = int(form.get('id', type=int, default=0))
    price = float(form.get('price', type=str, default=None))
    portion = int(form.get('ptn', type=str, default=None))
    us = UserStock(user, code)
    us.fix_buy(buyid, price, portion)
    return "OK", 200

def stock_sell(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    date = form.get('date', type=str, default=None)
    price = float(form.get('price', type=str, default=None))
    buyids = form.get('id', type=str, default=None)
    portion = form.get('ptn', type=str, default=None)
    if portion is not None:
        portion = int(portion)
    if buyids is not None:
        buyids = buyids.strip('_').split('_')
    us = UserStock(user, code)
    us.sell(date, price, buyids, portion)
    return "OK", 200

def stock_fix_sell(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    sellid = int(form.get('id', type=int, default=0))
    price = float(form.get('price', type=str, default=None))
    portion = int(form.get('ptn', type=str, default=None))
    us = UserStock(user, code)
    us.fix_sell(sellid, price, portion)
    return "OK", 200

def stock_fix_rollin(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    sellid = form.get('id', type=str, default=None)
    rolledin = request.form.get('rolledin', type=int, default=0)
    if sellid:
        us = UserStock(user, code)
        us.update_rollin(rolledin, sellid)
    return "OK", 200

def stock_set_rates(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    buyrate = form.get('buy', type=float, default=None)
    sellrate = form.get('sell', type=float, default=None)
    short_term = form.get('str', type=float, default=None)
    us = UserStock(user, code)
    us.set_rates(buyrate, sellrate, short_term)
    return "OK", 200

def stock_set_fee(user, form):
    code = form.get("code", type=str, default=None)
    code = code.upper()
    fee = form.get('fee', type=float, default=None)
    us = UserStock(user, code)
    us.set_fee(fee)
    return "OK", 200


@app.route('/dashboard', methods=['GET'])
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return render_template('/dashboard.html')

@app.route('/userbind', methods=['GET', 'POST'])
def userbind():
    if not session.get('logged_in'):
        return "Please login."
    gen_db = SqlHelper(password = db_pwd, database = "general")
    usermodel = UserModel(gen_db)
    if request.method == 'GET':
        parent = request.args.get("type", type=str, default=None)
        if parent == 'parent':
            return json.dumps(usermodel.get_parent(session['useremail']))
        return json.dumps(usermodel.get_bind_accounts(session['useremail']))
    else:
        bind_email = request.form.get('email', type=str, default=None)
        bind_user = usermodel.user_by_email(bind_email)
        pwd = request.form.get("password", type=str, default=None)
        action = request.form.get('action', type=str, default=None)
        if action == 'bindsub':
            if not bind_user:
                return '{error1}'
            elif not usermodel.check_password(bind_user, pwd):
                return '{errpwd}'
            else:
                usermodel.bind_account(usermodel.user_by_email(session['useremail']), bind_user)
                return 'OK', 200
        elif action == 'bindparent':
            if not bind_user:
                return '{error}'
            elif not usermodel.check_password(bind_user, pwd):
                return '{errpwd}'
            else:
                usermodel.bind_account(bind_user, usermodel.user_by_email(session['useremail']))
                return 'OK', 200
        elif action == 'switchaccount':
            curUser = usermodel.user_by_email(session['useremail'])
            tarUser = bind_user
            if usermodel.is_combined(curUser, tarUser):
                session['logged_in'] = True
                session['useremail'] = tarUser.email
                session['username'] = tarUser.name
                return 'OK', 200
            else:
                return '{wrongarg}'
        else:
            return json.dumps('{Wrong}')

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

