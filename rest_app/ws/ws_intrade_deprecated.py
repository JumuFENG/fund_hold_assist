# Python 3
# -*- coding:utf-8 -*-

################################
# the deprecated strategies
################################

from ws_intrade_strategy import *


# 胜率约45%, 收益平庸
class StrategyI_EndAuc_Nzt(StrategyI_Listener):
    ''' 盘中触及涨停价，尾盘竞价买入
    '''
    key = 'istrategy_eaucnzt'
    name = '炸板尾盘买入'
    desc = '盘中触及涨停, 尾盘竞价买入, 次日开盘卖出, 选上影线最小者.'
    watcher = WsIsUtils.get_watcher('endauction')
    on_intrade_matched = None
    sd = StockDumps()

    async def on_watcher(self, quotes):
        ushadows = []
        for code, knode in quotes:
            if knode.open > knode.close:
                continue
            if not code.startswith('SH60') and not code.startswith('SZ00'):
                continue
            if knode.close < 1:
                # 股价低于1元
                continue
            if knode.high > knode.close and knode.high >= Utils.zt_priceby(knode.lclose):
                allkl = self.sd.read_kd_data(code, fqt=1, length=10)
                if allkl is None:
                    continue
                allkl = [KNode(kl) for kl in allkl]
                if len([kl for kl in allkl if kl.pchange > 9 and kl.high == kl.close]) > 2:
                    # 10日内涨停数>2, 忽略
                    continue
                if len(allkl) < 3:
                    Utils.log(f'kldata not valid, {code}, {allkl}', Utils.Warn)
                    continue
                if ((allkl[-1].high == allkl[-1].close and Utils.zt_priceby(allkl[-2].close))
                    ) or (
                    (allkl[-2].high == allkl[-2].close and Utils.zt_priceby(allkl[-3].close))):
                    # 前两个交易日有涨停, 忽略
                    continue
                ushadows.append([code, round((knode.high - knode.close) * 100 / knode.lclose, 2), knode])
        if len(ushadows) == 0:
            return

        mncode, mnshadow, knode = sorted(ushadows, key=lambda x: x[1])[0]
        mncode = mncode.lstrip('SH').lstrip('SZ')
        if callable(self.on_intrade_matched):
            mnshadow_match_data = {'code': mncode, 'price': knode.high}
            mnshadow_match_data['strategies'] = {'StrategySellELS': {}}
            await self.on_intrade_matched(self.key, mnshadow_match_data, self.create_intrade_matched_message)


# 胜率约32%, 收益持续下行
class StrategyI_HighClose(StrategyI_Listener):
    ''' 收盘价为当日最高价，尾盘竞价买入
    '''
    key = 'istrategy_highclose'
    name = '光头阳线尾盘买入'
    desc = '收盘价为当日最高价尾盘竞价买入, 次日开盘卖出, 选涨跌幅最大者.'
    watcher = WsIsUtils.get_watcher('endauction')
    on_intrade_matched = None

    async def on_watcher(self, quotes):
        hcloses = []
        for code, knode in quotes:
            if not code.startswith('SH60') and not code.startswith('SZ00'):
                continue
            if WsIsUtils.is_stock_blacked(code) or WsIsUtils.to_be_divided(code) or knode.close < 1:
                continue
            if knode.high == knode.close and knode.high > knode.low and knode.close < Utils.zt_priceby(knode.lclose):
                hcloses.append([code, knode.pchange, knode])

        if len(hcloses) == 0:
            return
        mxcode, mxhclose, knode = sorted(hcloses, key=lambda x: x[1], reverse=True)[0]
        mxcode = mxcode.lstrip('SH').lstrip('SZ')
        if callable(self.on_intrade_matched):
            mnshadow_match_data = {'code': mxcode, 'price': round(Utils.zt_priceby(knode.lclose), 2)}
            mnshadow_match_data['strategies'] = {'StrategySellELS': {}}
            await self.on_intrade_matched(self.key, mnshadow_match_data, self.create_intrade_matched_message)


#胜率约43%, 收益一般
class StrategyI_HotrankClose(StrategyI_HotrankOpen):
    ''' 收盘人气排行
    '''
    key = 'istrategy_hotrank1'
    name = '收盘人气排行'
    desc = '盘中不触及涨停且股价大于水下一半 选人气排行最靠前且新增粉丝>70%'

    def __init__(self):
        self.stockranks = []
        self.watcher =  WsIsUtils.get_watcher('hotrank_close')
        self.taskwatcher = StrategyI_Simple_Watcher('14:55:50')
        self.taskwatcher.execute_simple_task = self.start_check_task
        self.tasklistner = StrategyI_Listener()
        self.tasklistner.watcher = self.taskwatcher

    def check_cls_basicinfo(self, snapshot):
        try:
            topprice = float(snapshot['topprice'])
            bottomprice = float(snapshot['bottomprice'])
            lclose = float(snapshot['fivequote']['yesClosePrice'])
            current_price = float(snapshot['realtimequote']['currentPrice'])
            high_price = float(snapshot['realtimequote']['high'])
            # 尾盘买入时排除炸板票
            return high_price < topprice and current_price > 1 and current_price < topprice and current_price > (bottomprice + lclose) / 2
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankClose.check_snapshot {e}', Utils.Err)
            return False

# 不及预期
class StrategyI_EVolumeD4(StrategyI_EVolume):
    ''' 尾盘竞价爆量
    '''
    key = 'istrategy_evold4'
    name = '尾盘竞价爆量4日'
    desc = '收盘集合竞价爆量 竞价成交量>0.04*全天成交量 换手>1% 成交额>1000万 4日前有涨停(涨停后调整3天)'

    async def execute_open_task(self):
        evoltbl = StockEndVolumeSelector()
        mx_tdate = TradingDate.maxTradingDate()
        if mx_tdate == Utils.today_date():
            candi_date = TradingDate.prevTradingDate(mx_tdate)
            candidates = evoltbl.dumpLatesetD4Candidates(candi_date, False)
            for c in candidates:
                if WsIsUtils.is_stock_blacked(c): continue
                if WsIsUtils.to_be_divided(c): continue
                snapshot = Utils.get_em_snapshot(c)
                price = 0 if snapshot['realtimequote']['currentPrice'] == '-' else float(snapshot['realtimequote']['currentPrice'])
                top_price = 0 if snapshot['topprice'] == '-' else float(snapshot['topprice'])
                if top_price == 0:
                    continue
                if price == 0:
                    price = top_price
                price = min(price * 1.02, top_price)
                if callable(self.on_intrade_matched):
                    mdata = {'code': c, 'price': price}
                    mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.95, 2) }}
                    await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
                    self.stock_notified.append(c)


# 一字板炸板或失败盈利少，一字板成功则基本无法买入， 该策略无实际价值
class StrategyI_Zt1H_Yzb(StrategyI_Listener):
    ''' 首板一字涨停排单
    '''
    key = 'istrategy_yzb'
    name = '首板一字板'
    desc = '首板一字板排单买入'
    on_intrade_matched = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('stkzt_open')
        self.stock_notified = []

    async def on_watcher(self, fecthed):
        for c, f, t, i in fecthed:
            if t != 4: continue
            if c in self.stock_notified: continue
            if WsIsUtils.recent_zt_reached(c): continue
            if WsIsUtils.is_stock_blacked(c): continue
            if WsIsUtils.to_be_divided(c): continue

            if callable(self.on_intrade_matched):
                price = float(i.split(',')[0])
                chg_match_data = {'code': c, 'price': price}
                chg_match_data['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2) }, 'StrategySellBE': {}}
                await self.on_intrade_matched(self.key, chg_match_data, self.create_intrade_matched_message)
                self.stock_notified.append(c)


# 并无明显溢价
class StrategyI_OpenFundFlow(StrategyI_Listener):
    ''' 开盘竞价净额
    '''
    key = 'istrategy_openfflow'
    name = '竞价净额前3'
    desc = '开盘竞价净额前三 (流通市值<1000亿)'
    on_intrade_matched = None
    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('open_fundflow')

    async def on_watcher(self, main_flows):
        for x in main_flows:
            Utils.log(f'{x}')


# 浏览器扩展中实现
class StrategyI_Zt1WbOpen(StrategyI_Listener):
    ''' 烂板1进2
    '''
    key = 'istrategy_zt1wb'
    name = '首板烂板1进2'
    desc = '首板烂板1进2,超预期开盘,开盘>-3%,以开盘价买入'
    on_intrade_matched = None
    zt1wbtbl = None

    def __init__(self):
        self.stockranks = []
        self.watcher = StrategyI_Simple_Watcher('9:25:11')
        self.watcher.execute_simple_task = self.execute_simple_task

    async def execute_simple_task(self):
        if self.zt1wbtbl is None:
            self.zt1wbtbl = StockZt1WbSelector()
        stocks = self.zt1wbtbl.dumpDataByDate()
        if len(stocks) == 0:
            szi = StockZtDailyMain()
            zstocks = szi.dumpDataByDate(TradingDate.maxTradedDate())
            if zstocks['date'] != TradingDate.maxTradedDate():
                return
            stocks = zstocks['pool']
            if len(stocks) == 0:
                return
        elif stocks[0][1] != TradingDate.maxTradedDate():
            return

        sbasics = Utils.get_cls_basics([s[0] for s in stocks])
        for c, b in sbasics.items():
            if b['cmc'] >= 1e11:
                continue
            open_px = b['open_px']
            preclose_px = b['preclose_px']
            opchange = (open_px - preclose_px) * 100 / preclose_px
            if opchange < -3:
                continue
            price = b['last_px']
            if callable(self.on_intrade_matched):
                price = min(price, open_px)
                mdata = {'code': c, 'price': price}
                mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2)}}
                await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)


# 浏览器扩展中实现
class StrategyI_3Bull_Breakup(StrategyI_Listener):
    ''' 三阳开泰
    '''
    key = 'istrategy_3brk'
    name = '三阳开泰'
    desc = '连续3根阳线价升量涨 以突破此3根阳线的最高价为买入点 以第一根阳线到买入日期之间的最低价为止损价 止盈设置5%'
    on_intrade_matched = None
    s3btbl = None

    def __init__(self):
        self.watcher = WsIsUtils.get_watcher('snapshot_5m')
        self.prewatcher = StrategyI_Simple_Watcher('9:28')
        self.prewatcher.execute_simple_task = self.prepare_candidates
        self.candidates = {}
        self.stock_notified = []

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.prewatcher.start_strategy_tasks()

    async def prepare_candidates(self):
        if self.s3btbl is None:
            self.s3btbl = StockTrippleBullSelector()
        chl = self.s3btbl.getLatestCandidatesHighLow()
        for c, h, l in chl:
            if WsIsUtils.is_stock_blacked(c) or WsIsUtils.to_be_divided(c):
                continue
            snap = Utils.get_em_snapshot(c)
            if snap['topprice'] == '-' or float(snap['topprice']) <= h:
                continue
            self.candidates[c] = {'high': h, 'low': l}
        self.watcher.add_stock(self.candidates.keys())

    async def on_watcher(self, csnapshot):
        code = csnapshot['code']
        if code not in self.candidates:
            return

        if csnapshot['price'] <= self.candidates[code]['high']:
            return

        if callable(self.on_intrade_matched) and csnapshot['price'] < 1.05 * self.candidates[code]['high'] and csnapshot['sell2'] > 0:
            mdata = {'code': code, 'price': csnapshot['sell2']}
            mdata['strategies'] = {'StrategySellELS': {'topprice': round(csnapshot['sell2'] * 1.05, 2), 'guardPrice': self.candidates[code]['low']}}
            await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)

        self.candidates.pop(code)
        self.watcher.remove_stock(code)
        self.stock_notified.append(code)

    def on_taskstop(self):
        if WsIsUtils.save_db_enabled():
            for code in self.stock_notified:
                self.s3btbl.setFdate(code)
        else:
            print ('save notified', self.stock_notified)
        self.stock_notified = []


# 浏览器扩展中实现
class StrategyI_HotrankOpen(StrategyI_Listener):
    ''' 开盘人气排行
    '''
    key = 'istrategy_hotrank0'
    name = '开盘人气排行'
    desc = '不涨停且股价涨跌幅介于[-3, 9] 选人气排行前10中新增粉丝>70%排名最前者'
    on_intrade_matched = None
    hotranktbl = None
    rked5d = []
    latest_ranks = None
    rankjqka = None
    ranktgb = None

    def __init__(self):
        self.stockranks = []
        self.matched = None
        self.topranks = {}
        self.price_upfix = 1.05
        self.watcher = WsIsUtils.get_watcher('hotrank_open')
        self.taskwatcher = StrategyI_Simple_Watcher('9:24:52')
        self.taskwatcher.execute_simple_task = self.start_check_task
        self.taskwatcher1 = StrategyI_Simple_Watcher('9:25:05')
        self.taskwatcher1.execute_simple_task = self.start_check_task1

    async def start_strategy_tasks(self):
        await super().start_strategy_tasks()
        await self.taskwatcher.start_strategy_tasks()
        await self.taskwatcher1.start_strategy_tasks()

    async def on_watcher(self, hotranks):
        self.latest_ranks, self.rankjqka, self.ranktgb = hotranks
        if self.latest_ranks is None or self.rankjqka is None or self.ranktgb is None:
            return

        rank20 = []
        for code, rf in self.latest_ranks.items():
            rankNumber=rf['rank']
            newFans = rf['newfans']
            if rankNumber <= 20:
                rank20.append([code, rankNumber])
            if newFans < 70 or rankNumber > 40:
                continue

            # if code not in self.rankjqka and code not in self.ranktgb:
            #     continue

            rkobj = {'code': code, 'rank': rankNumber, 'newfans': newFans}
            rkobj['rkjqka'] = self.rankjqka[code] if code in self.rankjqka else 0
            rkobj['rktgb'] = self.ranktgb[code] if code in self.ranktgb else 0
            self.stockranks.append(rkobj)

        if self.hotranktbl is None:
            self.hotranktbl = StockHotrank0Selector()
        WsIsUtils.blacklist()
        self.rked5d = [c[2:] for c in self.hotranktbl.getRanked(TradingDate.maxTradedDate())]

    def get_first_available(self, candidates, blacklist):
        for candidate in candidates:
            if candidate['code'] not in blacklist:
                return candidate

    def check_cls_basicinfo(self, clsbasic):
        try:
            current_price = clsbasic['last_px']
            change = clsbasic['change']
            return change >= -0.03 and change <= 0.09 and current_price > 1
        except ValueError as e:
            Utils.log(f'ValueError in StrategyI_HotrankOpen.check_cls_basicinfo {e}', Utils.Err)
            return False

    async def start_check_task(self):
        checked_ranks = []
        rkdict = {}
        for rk in self.stockranks:
            code = rk['code']
            if WsIsUtils.is_stock_blacked(code) or WsIsUtils.to_be_divided(code):
                continue
            rkdict[StockGlobal.full_stockcode(code)] = rk

        if len(rkdict.keys()) == 0:
            return

        rkbasics = Utils.get_cls_basics(rkdict.keys())
        for c, b in rkbasics.items():
            code = rkdict[c]['code']
            current_price = b['last_px']
            zdf = b['change'] * 100
            name = b['secu_name']
            if name.startswith('退市') or name.endswith('退'):
                continue
            self.topranks[code] = [StockGlobal.full_stockcode(code), TradingDate.maxTradingDate(), rkdict[c]['rank'], rkdict[c]['newfans'], rkdict[c]['rkjqka'], rkdict[c]['rktgb'], zdf]
            if rkdict[c]['rank'] <= 10 and code not in self.rked5d and self.check_cls_basicinfo(b):
                checked_ranks.append({'code': code, 'rank': rkdict[c]['rank'], 'price': current_price, 'topprice': b['up_price'], 'zdf': zdf})

        if len(checked_ranks) > 0 and callable(self.on_intrade_matched):
            candidate = checked_ranks[0]
            price = min(candidate['price'] * self.price_upfix, candidate['topprice'])
            mdata = {'code': candidate['code'], 'price': price}
            mdata['strategies'] = {'StrategySellELS': {'topprice': round(price * 1.05, 2), 'guardPrice': round(price * 0.92, 2)}}
            await self.on_intrade_matched(self.key, mdata, self.create_intrade_matched_message)
            self.matched = candidate

    async def start_check_task1(self):
        if self.matched is None:
            self.price_upfix = 1.018
            await self.start_check_task()

        Utils.log('StrategyI_HotrankOpen check task completed!')
        if len(self.topranks.values()) == 0:
            return

        if WsIsUtils.save_db_enabled():
            if self.hotranktbl is None:
                self.hotranktbl = StockHotrank0Selector()
            self.hotranktbl.saveDailyHotrank0(self.topranks.values())
        else:
            for rk in self.topranks.values():
                Utils.log(f'{rk}')

