# Python 3
# -*- coding:utf-8 -*-

import os, signal
import requests
from time import sleep

def kill_old_proc():
    fpid = os.path.join(os.path.dirname(__file__), 'gunicorn.pid')
    with open(fpid) as f:
        pid = f.read().strip()
        print('kill old proc',pid)
        os.kill(int(pid), signal.SIGKILL)

def check_local_server():
    while True:
        try:
            sleep(5)
            tr = requests.get('http://localhost/5000/stock?act=test', timeout=3)
            if tr.status_code == 200:
                print('local server works fine!')
                return
        except requests.ConnectionError as ce:
            print(str(ce))
            continue
        except requests.RequestException as ce:
            print(str(ce))
            continue
        except Exception as e:
            print(type(e))
            print(e)
        sleep(180)
        kill_old_proc()

if __name__ == '__main__':
    check_local_server()
    
