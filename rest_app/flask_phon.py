# Python 3
# -*- coding:utf-8 -*-

import json
from phon.data.user import User

def save_user_strategy(ownid, acc, code, strategy):
    own = User.user_by_id(ownid)
    user = own.sub_account(acc, True)
    if not user:
        return 'Forbidden', 404

    user.save_strategy(code, json.loads(strategy))
    return 'OK', 200

def dump_user_strategy(ownid, acc, code):
    own = User.user_by_id(ownid)
    user = own.sub_account(acc)
    if not user:
        return 'Forbidden', 404

    return json.dumps(user.load_strategy(code))
