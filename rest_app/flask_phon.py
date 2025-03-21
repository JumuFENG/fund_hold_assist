# Python 3
# -*- coding:utf-8 -*-

import json
from flask import session
from phon.data.user import User


def verify_authorization(auth):
    uemail = auth.username
    upwd = auth.password
    if uemail is None:
        return False

    user = User.user_by_email(uemail)
    if user.check_password(upwd):
        session['logged_in'] = True
        session['useremail'] = user.email
        session['username'] = user.name
        return True
    return False

def actual_user(own, acc, subid, autocreate=False):
    if subid == own.id or (subid is None and acc is None):
        return own
    return own.sub_account(acc, autocreate) if subid is None else User.user_by_id(subid)


def save_user_strategy(own, pform, strdata):
    acc = pform.get('acc', type=str, default=None)
    subid = pform.get('accid', type=int, default=None)
    user = actual_user(own, acc, subid, True)
    if user is None:
        return 'Forbidden', 403

    code = pform.get('code', type=str, default=None)
    strdata = pform.get('data', type=str, default=None)
    if strdata is None or strdata == '':
        user.remove_strategy(code)
        return 'OK', 200

    user.save_strategy(code, json.loads(strdata))
    return 'OK', 200

def add_user_deals(own, pform):
    acc = pform.get('acc', type=str, default=None)
    subid = pform.get('accid', type=int, default=None)
    user = actual_user(own, acc, subid, True)
    if user is None:
        return 'Forbidden', 403
    deals = pform.get('data', type=str, default=None)
    user.add_deals(json.loads(deals))
    return 'OK', 200

def forget_user_stock(own, pform):
    acc = pform.get('acc', type=str, default=None)
    subid = pform.get('accid', type=int, default=None)
    user = actual_user(own, acc, subid, False)
    if not user:
        return 'Forbidden', 404

    code = pform.get('code', type=int, default=None)
    user.forget_stock(code)
    return 'OK', 200

def user_request_get(request):
    user = User.user_by_email(session['useremail'])
    actype = request.args.get("act", None, str)
    code = request.args.get('code', None, str)
    subid = request.args.get('accid', None, int)
    if actype == 'getearned':
        if code is None:
            dates = request.args.get('days', None, int)
            return json.dumps(user.get_earned(dates))
        else:
            return str(round(user.get_earned_of(code), 2))
    if actype == 'buy':
        return json.dumps(user.get_buy_arr(code))
    if actype == 'sell':
        return json.dumps(user.get_sell_arr(code))
    if actype == 'summary':
        if code:
            return json.dumps({code: user.get_stock_summary(code)})
    acc = request.args.get('acc')
    sub = user.sub_account(acc) if subid is None else User.user_by_id(subid)
    if actype == 'strategy':
        if sub is None:
            return ''
        return json.dumps(sub.load_strategy(code))
    if actype == 'watchings':
        if sub is None:
            return '{}'
        return json.dumps(sub.watchings_with_strategy())
    return "Not implement yet", 403

def user_request_post(request):
    user = User.user_by_email(session['useremail'])
    actype = request.form.get("act", type=str, default=None)

    if actype == 'deals':
        return add_user_deals(user, request.form)
    if actype == 'strategy':
        return save_user_strategy(user, request.form)
    if actype == 'forget':
        return forget_user_stock(user, request.form)

def user_accounts(parent=False, onlystock=True):
    if parent:
        return json.dumps(User.get_parent(session['useremail']))
    user = User.user_by_email(session['useremail'])
    return json.dumps(user.get_bind_accounts(onlystock))

