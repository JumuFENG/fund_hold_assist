# Python 3
# -*- coding:utf-8 -*-

from flask import Flask, flash, redirect, render_template, request, session, abort, url_for
import requests
import urllib.parse
import sys
sys.path.append("..")
from utils import *
from rest_app.user import *

app = Flask(__name__)
app.secret_key = "any_string_make_secret_key"
#app.config["SECRET_KEY"] = "any_string_make_secret_key"

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'GET':
        if not session.get('logged_in'):
            return render_template('login.html')
        else:
            return redirect(url_for('home'))
    elif request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        gen_db = SqlHelper(password = db_pwd, database = "general")
        usermodel = UserModel(gen_db)
        user = usermodel.user_by_email(email)

        if user and usermodel.check_password(user, request.form['password']):
            session['logged_in'] = True
        else:
            flash('wrong username or password')
        return render_template('login.html') 

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
                return redirect(url_for('home'))

            flash('A user already exists with that email address.')
            return redirect(url_for('signup'))
    return render_template('/signup.html',
                           title='Create an Account.',
                           template='signup-page',
                           body="Sign up for a user account.")

@app.route('/home/index.html', methods=['GET'])
def home():
    return "OK", 200

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
    return render_template('login.html')

if __name__ == '__main__':
    app.run(debug=True)

