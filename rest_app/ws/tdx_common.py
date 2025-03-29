import time, json, os
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
        if api.connect(ip, port, time_out=timeout):
            response = api.get_security_count(market)
            success = response is not None
    except Exception:
        pass
    finally:
        api.disconnect()  # 确保连接关闭
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
