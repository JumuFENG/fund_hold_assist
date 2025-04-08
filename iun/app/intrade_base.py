import asyncio
import traceback
import json
from app.logger import logger
from app.guang import guang


class StrategyI_Listener:
    async def start_strategy_tasks(self):
        assert hasattr(self, 'watcher'), 'watcher not set!'
        self.watcher.add_listener(self)
        await self.watcher.start_strategy_tasks()

    def create_intrade_matched_message(self, match_data, subscribe_detail):
        return create_strategy_matched_message_direct_buy(match_data, subscribe_detail)

    async def on_watcher(self, params):
        pass

    def on_taskstop(self):
        pass


class StrategyI_Watcher_Base:
    def __init__(self):
        self.listeners = []
        self.client_listeners = []

    def add_listener(self, listener):
        self.listeners.append(listener)

    def remove_listener(self, listener):
        if listener in self.listeners:
            self.listeners.remove(listener)

    def add_client_listener(self, listener):
        self.client_listeners.append(listener)

    def remove_client_listener(self, listener):
        if listener in self.client_listeners:
            self.client_listeners.remove(listener)

    async def notify_change(self, params):
        for listener in self.listeners:
            try:
                await listener.on_watcher(params)
            except Exception as e:
                logger.error(f'{e}')
                logger.error(traceback.format_exc())

    async def notify_clients(self, notification):
        for client in self.client_listeners[:]:
            try:
                await client.send(json.dumps(notification))
            except Exception as e:
                logger.error(f'error when send to {client}')
                logger.error(f'{e}')
                logger.error(traceback.format_exc())
                self.client_listeners.remove(client)

    def notify_stop(self):
        for listener in self.listeners:
            listener.on_taskstop()

    def set_listener_configs(self, msg):
        pass


class StrategyI_Simple_Watcher(StrategyI_Watcher_Base):
    def __init__(self, btime, etime=[]):
        '''
        btime和etime成对设置, 不要有重叠. 可以不设置etime, 则execute_simple_task后自动停止

        @param btime: '09:30' / ['09:30', '13:00']
        @param etime: '15:01' / ['11:31', '15:01']
        '''
        super().__init__()
        self.btime = [btime]
        if isinstance(btime, list) or isinstance(btime, tuple):
            self.btime = btime
        self.etime = [etime]
        if isinstance(etime, list) or isinstance(etime, tuple):
            self.etime = etime
        assert len(self.btime) == len(self.etime), 'btime and etime must have same length'
        self.task_running = False
        self.task_stopped = [False] * max(len(self.etime), 1)

    async def start_strategy_tasks(self):
        loop = asyncio.get_event_loop()
        for bt in self.btime:
            if guang.delay_seconds(bt) > 0:
                loop.call_later(guang.delay_seconds(bt), lambda: asyncio.ensure_future(self.start_simple_task()))
        for et in self.etime:
            if guang.delay_seconds(et) > 0:
                loop.call_later(guang.delay_seconds(et), self.stop_simple_task)

    async def start_simple_task(self):
        if self.task_running:
            return
        self.task_running = True
        try:
            await self.execute_simple_task()
        except Exception as e:
            logger.error(f'{e}')
            logger.error(traceback.format_exc())

        if len(self.etime) == 0:
            self.stop_simple_task()

    async def execute_simple_task(self):
        logger.info('execute_simple_task')

    def stop_simple_task(self):
        self.task_running = False
        for i, stopped in enumerate(self.task_stopped):
            if not stopped:
                self.task_stopped[i] = True
                break

    def done(self):
        return all(self.task_stopped)


class TestWatcher(StrategyI_Simple_Watcher):
    async def execute_simple_task(self):
        if not hasattr(self, 'count'):
            self.count = 0
        while self.count < 20:
            logger.info(f'execute_simple_task {self.count}')
            self.count += 1
            await asyncio.sleep(1)

    def done(self):
        if not hasattr(self, 'count'):
            return False
        return self.count >= 20
