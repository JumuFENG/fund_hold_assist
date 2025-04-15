# Python 3
# -*- coding:utf-8 -*-

import sys
import os
import requests
import time
import subprocess
from datetime import datetime


def check_network():
    retry = 0
    max_retries = 100

    while True:
        try:
            nw = requests.get('http://quote.eastmoney.com/newapi/sczm', timeout=2)
            if nw is not None or retry > max_retries:
                print(nw.content.decode())
                break
        except Exception as e:
            print(f'Network error: {e}')
            if retry > max_retries:
                break
            time.sleep(5)
            retry += 1

    if retry > max_retries:
        print(f'Network not available, retry = {retry}')
        return False
    return True

if __name__ == '__main__':
    dnow = datetime.now()
    print(f'startup.access {dnow}')
    print(f'------------------------------------------------------------------------')

    task_files = ['start_tasks.py']
    time.sleep(5)
    if check_network():
        if dnow.weekday() < 5 and dnow.hour < 15:
            task_files += ['trade_closed.py', 'trade_opening.py']

    for tfile in task_files:
        task_spath = os.path.join(os.path.dirname(__file__), 'tasks', tfile)
        log_path = os.path.join(os.path.dirname(task_spath), 'logs', f'{tfile}.log')
        err_path = os.path.join(os.path.dirname(task_spath), 'logs', f'{tfile}.err.log')
        cmd = f'{sys.executable} {task_spath} 1>>{log_path} 2>>{err_path} &'
        os.system(cmd)

    task_spath = os.path.join(os.path.dirname(__file__), 'ws', 'start_ws_server.py')
    log_path = os.path.join(os.path.dirname(task_spath), 'logs', 'ws_server.log')
    err_path = os.path.join(os.path.dirname(task_spath), 'logs', 'ws_server.err.log')
    wscmd = f'{sys.executable} {task_spath} 1>>{log_path} 2>>{err_path}'
    ws = subprocess.Popen(wscmd, shell=True)
    while True:
        x = ws.poll()
        if ws.poll():
            break
        time.sleep(5)
