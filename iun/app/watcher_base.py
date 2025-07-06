import multiprocessing
import asyncio
import queue
import time
from typing import Dict, List
import traceback
from app.logger import logger
from app.config import IunCache
from app.guang import guang


class Watcher_Once:
    def __init__(self, btime, exec_if_expired=True):
        self.listeners = []
        self.btime = btime
        self.exec_if_expired = exec_if_expired
        self.task_running = False

    def add_listener(self, listener):
        self.listeners.append(listener)

    def remove_listener(self, listener):
        if listener in self.listeners:
            self.listeners.remove(listener)

    async def start_strategy_tasks(self):
        if guang.delay_seconds(self.btime) > 0:
            t = asyncio.create_task(self.start_simple_task(guang.delay_seconds(self.btime)))
            IunCache.delayed_tasks.append(t)
        else:
            if self.exec_if_expired:
                await self.execute_task()

    async def start_simple_task(self, delay=0):
        await asyncio.sleep(delay)
        if self.task_running:
            return
        self.task_running = True

        try:
            await self.execute_task()
        except Exception as e:
            logger.error(f'{e}')
            logger.error(traceback.format_exc())
        self.notify_stop()

    async def execute_task(self):
        await self.notify_change()

    async def notify_change(self, params=None):
        for listener in self.listeners:
            try:
                await listener.on_watcher(params)
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())

    def notify_stop(self):
        for listener in self.listeners:
            listener.on_taskstop()

class Watcher_Cycle(Watcher_Once):
    def __init__(self, btime, etime=[]):
        '''
        btime和etime成对设置, 不要有重叠. 如果是一次性任务使用StrategyI_Watcher_Once

        @param btime: '09:30' / ['09:30', '13:00']
        @param etime: '15:01' / ['11:31', '15:01']
        '''
        super().__init__('')
        self.btime = [btime]
        if isinstance(btime, list) or isinstance(btime, tuple):
            self.btime = btime
        self.etime = [etime]
        if isinstance(etime, list) or isinstance(etime, tuple):
            self.etime = etime
        assert len(self.btime) == len(self.etime), 'btime and etime must have same length'
        self.task_running = False
        self.simple_watchers = []

    async def start_strategy_tasks(self):
        for bt, et in zip(self.btime, self.etime):
            eticks = guang.delay_seconds(et)
            if eticks > 0:
                bticks = guang.delay_seconds(bt)
                if bticks < 0:
                    bticks = 0
                t = asyncio.create_task(self.start_simple_task(bticks))
                IunCache.delayed_tasks.append(t)
                e = asyncio.create_task(self.stop_simple_task(eticks))
                IunCache.delayed_tasks.append(e)

        if len(self.simple_watchers) > 0:
            for w in self.simple_watchers:
                await w.start_strategy_tasks()

    async def start_simple_task(self, delay=0):
        await asyncio.sleep(delay)
        if self.task_running:
            return
        self.task_running = True

        try:
            await self.execute_task()
        except Exception as e:
            logger.error(f'{e}')
            logger.error(traceback.format_exc())

    async def execute_task(self):
        logger.info('execute cycle task')

    async def stop_simple_task(self, delay=0):
        await asyncio.sleep(delay)
        self.task_running = False
        self.notify_stop()


class Stock_Rt_Watcher():
    def __init__(self):
        self.codes = {}

    def add_stock(self, code):
        if code not in self.codes:
            self.codes[code] = 1
        else:
            self.codes[code] += 1

    def remove_stock(self, code):
        if code in self.codes:
            self.codes[code] -= 1
            if self.codes[code] == 0:
                del self.codes[code]


class JobProcess(multiprocessing.Process):
    def __init__(self, task_queue: multiprocessing.Queue, result_queue: multiprocessing.Queue, period: int):
        super().__init__()
        self.task_queue = task_queue
        self.result_queue = result_queue
        self.period = period
        self.running = multiprocessing.Event()
        self.daemon = True  # 设置为守护进程，主进程退出时自动终止

    def run(self):
        self.running.set()
        while self.running.is_set():
            try:
                # 从任务队列获取需要获取K线的股票代码
                while not self.task_queue.empty():
                    in_data = self.task_queue.get_nowait()

                    # 模拟获取K线数据 - 替换为实际的asrt.klines调用
                    out_data = self.process_job(in_data)

                    # 将结果放入结果队列
                    self.result_queue.put(out_data)

                time.sleep(self.period)
            except Exception as e:
                logger.error(f"KlineFetcherProcess error: {e}")
                logger.error(traceback.format_exc())

    def process_job(self, codes: List[str]) -> Dict:
        pass

    def stop(self):
        self.running.clear()




class SubProcess_Watcher_Cycle(Watcher_Cycle, Stock_Rt_Watcher):
    def __init__(self, period, btime, etime=[]):
        super().__init__(btime, etime)
        Stock_Rt_Watcher.__init__(self)
        self.period = period

        # 多进程相关属性
        self.task_queue = multiprocessing.Queue()
        self.result_queue = multiprocessing.Queue()
        self.sub_process = None
        self.process_last_active = 0

    def feed_process_data(self):
        # 为子进程设置输入数据
        codes = [c for c in self.codes if self.codes[c] > 0]
        if codes:
            self.task_queue.put(codes)

    async def execute_task(self):
        # 确保子进程运行
        self._ensure_process_running()
        asyncio.create_task(self._check_result_queue())

        while self.task_running:
            try:
                self.feed_process_data()
                self.process_last_active = time.time()
                # 检查并维护子进程健康状态
                await self._monitor_process()
                await asyncio.sleep(self.period)
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())

    async def _check_result_queue(self):
        """检查结果队列并处理获取到的数据"""
        while self.task_running:
            try:
                while not self.result_queue.empty():
                    try:
                        presult = self.result_queue.get_nowait()
                        await self.handle_process_result(presult)
                    except queue.Empty:
                        break
                    except Exception as e:
                        logger.error(f"Error processing result data: {e}")
                        logger.error(traceback.format_exc())

                await asyncio.sleep(0.1)  # 更短的睡眠时间

            except Exception as e:
                logger.error(f"Error in result checking loop: {e}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(1)  # 出错时等待更长时间

    async def handle_process_result(self, result):
        pass

    async def _monitor_process(self):
        """监视子进程状态并处理异常"""
        now = time.time()

        # 检查进程是否存活
        if self.sub_process is None or not self.sub_process.is_alive():
            logger.warning("sub process is not alive, restarting...")
            self._restart_process()
            return

        # 长时间无活动后重启进程
        if now - self.process_last_active > min(self.period + 30, self.period * 3):
            logger.info("Restarting idle sub process...")
            self._restart_process()
            return

        # TODO: 定期重启进程防止内存泄漏 if needed!

    def _ensure_process_running(self):
        """确保子进程正在运行"""
        if self.sub_process is None or not self.sub_process.is_alive():
            self._start_process()

    def create_subprocess(self):
        return JobProcess(self.task_queue, self.result_queue, self.period)

    def _start_process(self):
        """启动子进程"""
        if self.sub_process is not None:
            self._stop_process()

        try:
            self.sub_process = self.create_subprocess()
            self.sub_process.start()
            self.process_last_active = time.time()
            logger.info(f"Sub process {self.sub_process.__class__.__name__} started")
        except Exception as e:
            logger.error(f"Failed to start sub process: {e}")
            logger.error(traceback.format_exc())
            self.sub_process = None

    def _stop_process(self):
        """停止子进程"""
        if self.sub_process is not None:
            self.sub_process.stop()
            self.sub_process.join(timeout=5)
            if self.sub_process.is_alive():
                self.sub_process.terminate()

    def _restart_process(self):
        """重启子进程"""
        self._stop_process()        
        self._start_process()

    async def stop_simple_task(self, delay=0):
        """停止任务时清理子进程"""
        await super().stop_simple_task(delay)
        self._stop_process()
        self.sub_process = None

