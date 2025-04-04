import time, json, os
import asyncio
from pytdx.hq import TdxHq_API, random
from pytdx.config.hosts import hq_hosts
from concurrent.futures import ThreadPoolExecutor
from history import StockGlobal

def to_pytdx_market(market):
    """转换为pytdx的market"""
    if len(market) == 6:
        market = StockGlobal.full_stockcode(market)
    if len(market) == 8:
        market = market[0:2]
    if market.endswith('.BJ'):
        market = 'BJ'
    pytdx_market = {'SZ': 0, 'SH': 1, 'BJ': 2}
    return pytdx_market[market.upper()]

def ping(ip, port=7709, market=2, timeout=1):
    """测试TDX服务器连通性"""
    api = TdxHq_API(multithread=False)  # 每个线程独立API实例
    success = False
    starttime = time.time()
    response = None
    try:
        with api.connect(ip, port, time_out=timeout):
            response = api.get_security_count(market)
            success = response is not None
    except Exception:
        pass
    endtime = time.time()
    return (success, endtime - starttime, ip, port, response)

def search_best_tdx(n=8, max_workers=16):
    hosts = [(host[1], host[2]) for host in hq_hosts]
    file_hosts = os.path.join(os.path.dirname(__file__), 'tdx_hosts.json')
    fexists = os.path.exists(file_hosts)
    update_hosts = not fexists
    if fexists:
        with open(file_hosts, 'r') as f:
            hosts_json = json.load(f)
        if time.time() - hosts_json['last_update'] < 3600*24*15:
            hosts = hosts_json['hosts']
            update_hosts = False

    pmarket = random.choice([0, 1, 2])
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(ping, host[0], host[1], pmarket)
            for host in hosts
        ]
        res = [future.result() for future in futures]

    if update_hosts:
        success_to_save = [(host, port) for (success, _, host, port, _) in res if success]
        if success_to_save:
            hosts_json = {'hosts': success_to_save, 'last_update': time.time()}
            with open(file_hosts, 'w') as f:
                json.dump(hosts_json, f, indent=4)

    successful_hosts = [(result, host, port, delay) for (success, delay, host, port, result) in res if success]
    values = {}
    for response, host, port, delay in successful_hosts:
        if response:
            values.setdefault(response, []).append((host, port, delay))

    if not values:
        return []

    # 找到最长的结果组
    longest_group = max(values.values(), key=len)
    # 按delay排序并返回前n个
    sorted_hosts = sorted(longest_group, key=lambda x: x[2])[:n]
    if n == 1:
        return sorted_hosts[0][:2]
    return [[h, p] for h, p, d in sorted_hosts]


class TdxAsyncClient:
    def __init__(self, host):
        self.host = host  # (ip, port)
        self.api = TdxHq_API()
        self._lock = asyncio.Lock()  # 防止并发连接/断开冲突
        self._connected = False
        self._closing = False  # 标记是否正在关闭

    async def ensure_connected(self):
        """确保连接已建立（支持异步重连）"""
        if self._connected or self._closing:
            return self._connected

        async with self._lock:
            if not self._connected and not self._closing:
                try:
                    loop = asyncio.get_running_loop()
                    success = await loop.run_in_executor(
                        None,
                        lambda: self.api.connect(*self.host, time_out=2)
                    )
                    self._connected = success
                    if not success:
                        print(f"连接TDX服务器失败: {self.host}")
                    return success
                except Exception as e:
                    print(f"连接TDX服务器异常: {self.host}, 错误: {e}")
                    return False
        return self._connected

    async def disconnect(self):
        """异步断开连接"""
        if not self._connected or self._closing:
            return

        async with self._lock:
            if self._connected and not self._closing:
                self._closing = True  # 标记正在关闭
                try:
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(
                        None,
                        self.api.disconnect
                    )
                    print(f"已断开TDX服务器: {self.host}")
                except Exception as e:
                    print(f"断开TDX连接异常: {e}")
                finally:
                    self._connected = False
                    self._closing = False

    async def __aenter__(self):
        """支持async with上下文管理"""
        await self.ensure_connected()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """退出上下文时自动断开"""
        await self.disconnect()

    async def get_security_quotes_async(self, codes):
        """异步批量获取行情（自动维护连接）"""
        if not await self.ensure_connected():
            return None

        try:
            loop = asyncio.get_running_loop()
            quotes = await loop.run_in_executor(
                None,
                lambda: self.api.get_security_quotes([(to_pytdx_market(code), code[-6:]) for code in codes])
            )
            return quotes
        except ConnectionError:
            print(f"TDX服务器连接已断开: {self.host}")
            self._connected = False  # 触发下次自动重连
            return None
        except Exception as e:
            print(f"获取行情异常: {e}")
            return None

    async def get_transaction_data_async(self, code, start, count):
        if not await self.ensure_connected():
            return None

        try:
            loop = asyncio.get_running_loop()
            data = await loop.run_in_executor(
                None,
                lambda: self.api.get_transaction_data(to_pytdx_market(code), code[-6:], start, count)
            )
            return data
        except ConnectionError:
            print(f"TDX服务器连接已断开: {self.host}")
            self._connected = False  # 触发下次自动重连
            return None
        except Exception as e:
            print(f"获取分笔数据异常: {e}")
            return None
