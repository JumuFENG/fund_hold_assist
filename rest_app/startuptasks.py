# Python 3
# -*- coding:utf-8 -*-

import sys
import os,signal
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from datetime import datetime, timedelta
from threading import Timer
from time import sleep
import json

from rest_app.daily_update import DailyUpdater
from rest_app.weekly_update import WeeklyUpdater
from rest_app.monthly_update import MonthlyUpdater
from history.stock_history import *
from user.models import *
from user.user_stock import *

startuplogfile = os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/startuptasks.log')
perCount = 200

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
            tr = requests.get('http://localhost/stock?act=test', timeout=3)
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

def schedule_pmset(now=None):
    if now is None:
        now = datetime.now()

    po1 = 'wakeorpoweron MTWRF 8:25:0'
    shut1 = 'shutdown MTWRF 15:15:0'
    po2 = 'wakeorpoweron MTWRF 18:15:0'
    shut2 = 'shutdown MTWRF 18:35:0'
    pmcmd = 'pmset repeat'
    dayminutes = now.hour * 60 + now.minute
    if now.weekday() >= 5:
        pmcmd += ' ' + po1 + ' ' + shut1
    elif dayminutes < 6 * 60 or dayminutes > 18 * 60 + 35:
        pmcmd += ' ' + po1 + ' ' + shut1
    elif dayminutes < 15 * 60 + 15:
        pmcmd += ' ' + shut1 + ' ' + po2
    elif dayminutes < 18 * 60 + 15:
        pmcmd += ' ' + po2 + ' ' + shut2
    elif dayminutes < 18 * 60 + 35:
        pmcmd += ' ' + shut2 + ' ' + po1
    print(f'os.system({pmcmd})')
    os.system(pmcmd)

def daily_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, f"%Y-%m-%d %H:%M")
    if (now - lt).days >= 1:
        return True

    if now.timetuple().tm_mday > lt.timetuple().tm_mday:
        return True

    if now.timetuple().tm_mday == lt.timetuple().tm_mday and now.timetuple().tm_hour > 15 and lt.timetuple().tm_hour <= 9:
        return True

    return False

def weekly_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, f"%Y-%m-%d %H:%M")
    if (now - lt).days >= 7:
        return True

    if now.timetuple().tm_wday == 5 and (now - lt).days > 1:
        return True

    return False

def monthly_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, f"%Y-%m-%d %H:%M")
    if (now - lt).days >= 31:
        return True

    if now.timetuple().tm_mday == 1 and (now - lt).days > 1:
        return True

    return False

def trade_closed_task():
    dnow = datetime.now()
    print('trade_closed_task', dnow.strftime(f"%Y-%m-%d %H:%M:%s"))
    um = UserModel()
    user = um.user_by_id(11)
    user.save_stocks_eaning_html(shared_cloud_foler)
    print('\n')

def run_regular_tasks(dnow):
    print('run_regular_tasks begin', datetime.now().strftime(f"%Y-%m-%d %H:%M"))
    retry = 0
    while True:
        try:
            nw = requests.get('http://quote.eastmoney.com/newapi/sczm', timeout=2)
            if nw is not None or retry > 100:
                print(nw)
                break
        except Exception as e:
            print(e)
            if retry > 100:
                break
            retry += 1

    if retry > 100:
        print('network not available, retry = ', retry)
        return

    startconfig = {'lastdaily_run_at':'', 'lastweekly_run_at':'', 'lastmonthly_run_at':'', 'last_updated_id':0}
    if os.path.isfile(startuplogfile):
        with open(startuplogfile, 'r') as cfgfile:
            startconfig = json.load(cfgfile)

    startIstk = 0
    if 'last_updated_id' in startconfig:
        startIstk = startconfig['last_updated_id']

    anyrun = False
    if daily_should_run(startconfig['lastdaily_run_at'], dnow):
        du = DailyUpdater()
        du.update_all()
        sh = Stock_history()
        stocks = StockGlobal.all_stocks()
        for i in range(0, perCount):
            upid = startIstk + i
            if upid >= len(stocks):
                upid -= len(stocks)
            (i, c, n, s, t, sn, m, st, qt) = stocks[upid]
            if t == 'TSSTOCK' or qt is not None:
                continue
            sh.getKHistoryFromSohuTillToday(c)

        startconfig['last_updated_id'] = startIstk + perCount
        if len(stocks) < startconfig['last_updated_id']:
            startconfig['last_updated_id'] -= len(stocks)
        startconfig['lastdaily_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if weekly_should_run(startconfig['lastweekly_run_at'], dnow):
        wu = WeeklyUpdater()
        wu.update_all()
        startconfig['lastweekly_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if monthly_should_run(startconfig['lastmonthly_run_at'], dnow):
        # mu = MonthlyUpdater()
        # mu.update_all()
        um = UserModel()
        user = um.user_by_id(11)
        user.archive_deals(dnow.strftime(f"%Y-%m"))
        startconfig['lastmonthly_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if anyrun:
        with open(startuplogfile, 'w') as cfgfile:
            json.dump(startconfig, cfgfile)

    print('run_regular_tasks done', datetime.now().strftime(f"%Y-%m-%d %H:%M"), 'time used', datetime.now() - dnow)


if __name__ == '__main__':
    dnow = datetime.now()
    print('------------------------------------------------------------------------')
    print('startuptasks', dnow.strftime(f"%Y-%m-%d %H:%M"))

    schedule_pmset(dnow)
    check_local_server()
    run_regular_tasks(dnow)

    mtd = TradingDate.maxTradingDate()
    if dnow.weekday() < 5 and dnow.hour < 15 and Utils.today_date() == mtd:
        print('start timer task!')
        secs = (datetime.strptime(dnow.strftime('%Y-%m-%d') + ' 15:01', '%Y-%m-%d %H:%M') - dnow).seconds
        ttask = Timer(secs, trade_closed_task)
        ttask.start()

    print('startuptasks exit!')
    print('------------------------------------------------------------------------\n')
