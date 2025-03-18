# Python 3
# -*- coding:utf-8 -*-

import json
from phon.data.user import User

def save_user_strategy(own, acc, code, strategy):
    user = own.sub_account(acc, True)
    if not user:
        return 'Forbidden', 404

    if strategy is None or strategy == '':
        user.remove_strategy(code)
        return 'OK', 200

    user.save_strategy(code, json.loads(strategy))
    return 'OK', 200

def add_user_deals(own, acc, deals):
    user = own.sub_account(acc, True) if acc else own
    user.add_deals(deals)
    return 'OK', 200

def dump_user_strategy(ownid, acc, code):
    own = User.user_by_id(ownid)
    user = own.sub_account(acc)
    if not user:
        return 'Forbidden', 404

    return json.dumps(user.load_strategy(code))

def user_request_get(session, request):
    user = User.user_by_email(session['useremail'])
    actype = request.args.get("act", None, str)
    code = request.args.get('code', None, str)
    if actype == 'getearned':
        if code is None:
            dates = request.args.get('days',type=int, default=None)
            return json.dumps(user.get_earned(dates))
        else:
            return str(round(user.get_earned_of(code), 2))
    if actype == 'buy':
        return json.dumps(user.get_buy_arr(code))
    if actype == 'sell':
        return json.dumps(user.get_sell_arr(code))
    if actype == 'strategy':
        acc = request.args.get('acc')
        return dump_user_strategy(user.id, acc, code)
    if actype == 'summary':
        if code:
            return json.dumps({code: user.get_stock_summary(code)})
    return "Not implement yet", 403

def user_request_post(session, request):
    user = User.user_by_email(session['useremail'])
    actype = request.form.get("act", type=str, default=None)
    if actype == 'deals':
        deals = request.form.get('data', type=str, default=None)
        acc = request.form.get('acc', type=str, default=None)
        return add_user_deals(user, acc, json.loads(deals))
    if actype == 'strategy':
        strdata = request.form.get('data', type=str, default=None)
        code = request.form.get('code', type=str, default=None)
        acc = request.form.get('acc', type=str, default=None)
        return save_user_strategy(user, acc, code, strdata)
