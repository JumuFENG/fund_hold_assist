# Python 3
# -*- coding:utf-8 -*-
from datetime import datetime, timedelta
from threading import Timer
import time
import os
import logging


class TimerTask:
    logger = None
    def __init__(self, exe_time, _task) -> None:
        self.daytime = exe_time
        self.task = _task
        self.completed = False

    def seconds_to_execute(self):
        if self.daytime is None:
            return 0
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
    def setup_logger(self, logger):
        self.logger = logger

    @classmethod
    def run_tasks(self, tasks):
        for task in tasks:
            sec_2_exe = task.seconds_to_execute()
            if sec_2_exe == 0:
                task.execute_task()
            elif sec_2_exe > 0:
                t = Timer(sec_2_exe, task.execute_task)
                t.start()
            else:
                if self.logger is not None:
                    self.logger.info(f'task time due, mark as completed!')
                task.completed = True

        n = 1
        while True:
            all_completed = all(task.completed for task in tasks)
            if all_completed:
                if self.logger is not None:
                    self.logger.info(f'All tasks completed.\n')
                    for hdlr in self.logger.handlers:
                        hdlr.flush()
                break

            time.sleep(60)
