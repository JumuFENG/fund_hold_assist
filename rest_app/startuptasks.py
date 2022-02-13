# Python 3
# -*- coding:utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/..'))
from datetime import datetime, timedelta
import json

from rest_app.daily_update import DailyUpdater
from rest_app.weekly_update import WeeklyUpdater
from rest_app.monthly_update import MonthlyUpdater

startuplogfile = os.path.realpath(os.path.dirname(os.path.realpath(__file__)) + '/startuptasks.log')

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


if __name__ == '__main__':
    startconfig = {'lastdaily_run_at':'', 'lastweekly_run_at':'', 'lastmonthly_run_at':''}
    if os.path.isfile(startuplogfile):
        with open(startuplogfile, 'r') as cfgfile:
            startconfig = json.load(cfgfile)

    dnow = datetime.now()

    anyrun = False
    if daily_should_run(startconfig['lastdaily_run_at'], dnow):
        du = DailyUpdater()
        du.update_all()
        startconfig['lastdaily_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if weekly_should_run(startconfig['lastweekly_run_at'], dnow):
        wu = WeeklyUpdater()
        wu.update_all()
        startconfig['lastweekly_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if monthly_should_run(startconfig['lastmonthly_run_at'], dnow):
        mu = MonthlyUpdater()
        mu.update_all()
        startconfig['lastmonthly_run_at'] = dnow.strftime(f"%Y-%m-%d %H:%M")
        anyrun = True

    if anyrun:
        with open(startuplogfile, 'w') as cfgfile:
            json.dump(startconfig, cfgfile)
