# Python 3
# -*- coding:utf-8 -*-
from datetime import datetime, timedelta
from threading import Timer
import time

class TimerTask:
    def __init__(self, exe_time, _task) -> None:
        self.daytime = exe_time
        self.task = _task
        self.completed = False

    def seconds_to_execute(self):
        dnow = datetime.now()
        if isinstance(self.daytime, timedelta):
            target_time = dnow.replace(hour=0, minute=0, second=0) + self.daytime
        elif isinstance(self.daytime, str):
            dtarr = self.daytime.split(':')
            hr = int(dtarr[0])
            minutes = int(dtarr[1])
            secs = 0 if len(dtarr) < 3 else int(dtarr[2])
            target_time = dnow.replace(hour=hr, minute=minutes, second=secs)
        return (target_time-dnow).total_seconds()

    def execute_task(self):
        self.task()
        self.completed = True

    @classmethod
    def run_tasks(self, tasks):
        for task in tasks:
            sec_2_exe = task.seconds_to_execute()
            if sec_2_exe > 0:
                t = Timer(sec_2_exe, task.execute_task)
                t.start()
            else:
                task.completed = True

        while True:
            all_completed = all(task.completed for task in tasks)
            if all_completed:
                print("All tasks completed.")
                break

            time.sleep(60)
