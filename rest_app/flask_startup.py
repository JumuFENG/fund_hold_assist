# Python 3
# -*- coding:utf-8 -*-

from flask import Flask
from flask import Flask, flash, redirect, render_template, request, session, abort

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

@app.route('/api/v1/fund/buy', methods=['POST'])
def add_fund_buy_rec():
    return "OK", 200

if __name__ == '__main__':
    app.run(debug=True)

