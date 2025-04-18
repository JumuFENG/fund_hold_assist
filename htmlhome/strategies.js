window.ses = {
    "ComplexStrategyKeyNames": {
        "StrategyMA": "MA突破买卖",
        "StrategyGE": "网格买入,盈利卖出",
        "StrategyGEMid": "网格买入 (波段)",
        "StrategyGrid": "网格买入增仓",
        "StrategyTD": "TD点买卖",
        "StrategyBH": "低吸 短线买卖",
        "StrategyBias": "乖离率买卖",
        "StrategyIncDec": "大跌买 大涨卖",
        "StrategyZt1": "一字巨量阴"
    },
    "BuyStrategyKeyNames": {
        "StrategyBuy": "直接买入", 
        "StrategyBuySD": "止跌买入",
        "StrategyBuyPopup": "反弹买入", 
        "StrategyBuyR": "反弹(重复)买入", 
        "StrategyBuyIPO": "开板反弹买入", 
        "StrategyBuyZTBoard": "打板买入",
        "StrategyBuyDTBoard": "跌停开板买入",
        "StrategyBuyMA": "MA突破买入", 
        "StrategyBuyMAD": "MA突破(动态)买入",
        "StrategyBuyMAE": "MA突破(尾盘)买入",
        "StrategyBuyBE": "尾盘买入",
        "StrategyBuySupport": "支撑位买入"
    },
    "SellStrategyKeyNames": {
        "StrategySell": "反弹卖出",
        "StrategySellR": "反弹(重复)卖出",
        "StrategySellIPO": "开板卖出",
        "StrategySellEL": "止损止盈",
        "StrategySellELS": "止损止盈(超短)",
        "StrategySellELTop": "目标价止盈",
        "StrategySellMA": "MA突破卖出",
        "StrategySellMAD": "MA突破(动态)卖出",
        "StrategySellBE": "尾盘卖出"
    },
    "ExtIstrStrategies": {
        "istrategy_zt1wb": {
            "name": "首板烂板1进2",
            "desc": "首板烂板1进2,超预期开盘,开盘>-3%,以开盘价买入"
        }, "istrategy_3brk": {
            "name": "三阳开泰",
            "desc": "连续3根阳线价升量涨 以突破此3根阳线的最高价为买入点 以第一根阳线到买入日期之间的最低价为止损价 止盈设置5%"
        }, "istrategy_hotrank0": {
            "name": "开盘人气排行",
            "desc": "不涨停且股价涨跌幅介于[-3, 9] 选人气排行前10中新增粉丝>70%排名最前者"
        }, "istrategy_hotstks_open": {
            "name": "开盘热门领涨股",
            "desc": "最近涨停的高标人气股，最近连板高度前10左右，开盘时选这些票中人气排行前5的股票买入，需择时."
        }, "istrategy_dtstocks": {
            "name": "跌停翘板",
            "desc": "盘中: 跌停撬板, 优先选封单金额大的,从前高下来换手小, 跌幅大. 早上9:33之后开始监控防止有的票早盘撬板又封死, 下午2:30之后取消。竞价若昨日跌停数>5家,今日竞价无跌停,则选昨日跌停中今日开盘最低的几只."
        }, "istrategy_idxtrack": {
            "name": "指数跟踪策略",
            "desc": "跟踪指数的买入策略, 盘中指数如果出现主力净流入1分钟流入>1亿或者10分钟累积净流入>5亿则符合买入条件, 满足买入条件无仓位或与上次买入有一定跌幅则买入."
        }
    }
}
