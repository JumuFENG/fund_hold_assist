# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/../..'))

import signal,requests,json
from timer_task import TimerTask
from time import sleep
from datetime import datetime
from daily_update import DailyUpdater
from weekly_update import WeeklyUpdater
from monthly_update import MonthlyUpdater

from history.stock_history import *
from user.models import *

perCount = 200


def schedule_pmset(now=None):
    if now is None:
        now = datetime.now()

    po1 = 'wakeorpoweron MTWRF 8:25:0'
    shut1 = 'shutdown MTWRF 15:15:0'
    po2 = 'wakeorpoweron MTWRF 18:0:0'
    shut2 = 'shutdown MTWRF 18:45:0'
    pmcmd = 'pmset repeat'
    dayminutes = now.hour * 60 + now.minute
    if now.weekday() >= 5:
        pmcmd += ' ' + po1 + ' ' + shut1
    elif dayminutes < 6 * 60 or dayminutes > 18 * 60 + 35:
        pmcmd += ' ' + po1 + ' ' + shut1
    elif dayminutes < 15 * 60 + 15:
        pmcmd += ' ' + shut1 + ' ' + po2
    elif dayminutes < 18 * 60 + 0:
        pmcmd += ' ' + po2 + ' ' + shut2
    elif dayminutes < 18 * 60 + 45:
        pmcmd += ' ' + shut2 + ' ' + po1
    TimerTask.logger.info(f'os.system({pmcmd})')
    os.system(pmcmd)

def kill_old_proc():
    fpid = os.path.realpath(os.path.join(os.path.dirname(__file__), '../', 'gunicorn.pid'))
    with open(fpid) as f:
        pid = f.read().strip()
        TimerTask.logger.info(f'kill old proc {pid}')
        os.kill(int(pid), signal.SIGKILL)

def check_local_server():
    while True:
        try:
            sleep(5)
            tr = requests.get('http://localhost/stock?act=test', timeout=3)
            if tr.status_code == 200:
                TimerTask.logger.info('local server works fine!')
                return
        except requests.ConnectionError as ce:
            TimerTask.logger.error(str(ce))
            continue
        except requests.RequestException as ce:
            TimerTask.logger.error(str(ce))
            continue
        except Exception as e:
            TimerTask.logger.error(type(e))
            TimerTask.logger.error(e)
        sleep(180)
        kill_old_proc()

def check_network():
    retry = 0
    max_retries = 100

    while True:
        try:
            nw = requests.get('http://quote.eastmoney.com/newapi/sczm', timeout=2)
            if nw is not None or retry > max_retries:
                TimerTask.logger.info(nw.content.decode())
                break
        except Exception as e:
            TimerTask.logger.error(f'Network error: {e}')
            if retry > max_retries:
                break
            retry += 1

    if retry > max_retries:
        TimerTask.logger.error(f'Network not available, retry = {retry}')
        return False
    return True

def daily_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, f"%Y-%m-%d %H:%M")
    if now.day != lt.day:
        return True

    if now.day == lt.day and now.hour > 15 and lt.hour <= 9:
        return True

    return False

def weekly_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, "%Y-%m-%d %H:%M")
    days_difference = (now - lt).days

    if days_difference >= 7:
        return True

    if now.weekday() == 5 and days_difference > 1:
        return True

    return False

def monthly_should_run(lastrun, now):
    if lastrun == '':
        return True

    lt = datetime.strptime(lastrun, f"%Y-%m-%d %H:%M")
    days_difference = (now - lt).days
    if days_difference >= 31:
        return True

    if now.day == 1 and days_difference > 1:
        return True

    return False

def run_regular_tasks(dnow):
    startuplogfile = os.path.realpath(os.path.join(os.path.dirname(__file__), 'start_tasks.log'))
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
            if t == 'TSStock' or qt is not None:
                continue
            sh.getKHistoryFromSohuTillToday(c)

        if len(StockGlobal.klupdateFailed) > 0:
            sa = StockAnnoucements()
            Utils.log(StockGlobal.klupdateFailed)
            sa.check_stock_quit(StockGlobal.klupdateFailed)
            StockGlobal.klupdateFailed.clear()

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

    TimerTask.logger.info(f'run_regular_tasks done, time used: {datetime.now() - dnow}')


def startup_task():
    dnow = datetime.now()
    schedule_pmset(dnow)

    check_local_server()

    if check_network():
        run_regular_tasks(dnow)

    TimerTask.logger.info('startup task done!')

class StartupTask(TimerTask):
    def __init__(self, _task) -> None:
        super().__init__(None, _task)


if __name__ == '__main__':
    Utils.setup_logger()
    TimerTask.setup_logger(Utils.logger)
    Utils.logger.info('start!')
    tasks = [StartupTask(startup_task)]
    TimerTask.run_tasks(tasks)
